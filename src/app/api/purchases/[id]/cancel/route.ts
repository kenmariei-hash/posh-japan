import { NextResponse } from "next/server";
import { canCancelPurchase } from "@/lib/cancellation";
import { canSendPurchaseEmail, sendPurchaseCancellationEmail } from "@/lib/email";
import { canUseStripe, getStripeServerClient } from "@/lib/stripe";
import { canUseSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!canUseSupabaseServerClient()) {
    return NextResponse.json({ error: "Supabaseサーバー設定が未完了です。" }, { status: 501 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase初期化に失敗しました。" }, { status: 500 });
  }

  const { id } = await context.params;
  const purchaseId = Number(id);
  if (!purchaseId) {
    return NextResponse.json({ error: "購入IDが不正です。" }, { status: 400 });
  }

  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json({ error: "ログイン情報がありません。" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "ログイン確認に失敗しました。" }, { status: 401 });
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .select("id, stripe_session_id, buyer_user_id, customer_email, quantity, total_amount, payment_status, checked_in, cancelled_at, events(title, date, location)")
    .eq("id", purchaseId)
    .maybeSingle();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "購入記録が見つかりません。" }, { status: 404 });
  }

  if (purchase.buyer_user_id !== userData.user.id) {
    return NextResponse.json({ error: "この購入記録をキャンセルする権限がありません。" }, { status: 403 });
  }

  const eventDate =
    typeof purchase.events === "object" && purchase.events !== null && "date" in purchase.events
      ? String(purchase.events.date ?? "")
      : "";

  if (
    !canCancelPurchase({
      eventDate,
      checkedIn: purchase.checked_in,
      paymentStatus: purchase.payment_status,
      cancelledAt: purchase.cancelled_at,
    })
  ) {
    return NextResponse.json(
      { error: "このチケットはイベント前日までキャンセル可能です。" },
      { status: 400 },
    );
  }

  if (!canUseStripe()) {
    return NextResponse.json({ error: "Stripe未設定のため返金できません。" }, { status: 501 });
  }

  const stripe = getStripeServerClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe初期化に失敗しました。" }, { status: 500 });
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(purchase.stripe_session_id, {
    expand: ["payment_intent"],
  });

  const paymentIntent =
    typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;

  if (!paymentIntent) {
    return NextResponse.json({ error: "返金対象の決済情報が見つかりません。" }, { status: 400 });
  }

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntent,
    reason: "requested_by_customer",
    metadata: {
      purchaseId: String(purchase.id),
      eventId: String((purchase as { event_id?: number }).event_id ?? ""),
    },
  });

  if (refund.status !== "succeeded" && refund.status !== "pending") {
    return NextResponse.json({ error: "Stripe返金処理に失敗しました。" }, { status: 500 });
  }

  const cancelledAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("purchases")
    .update({
      payment_status: "refunded",
      cancelled_at: cancelledAt,
    })
    .eq("id", purchaseId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let emailStatus: "sent" | "skipped" | "failed" = "skipped";
  let emailError: string | undefined;

  const eventTitle =
    typeof purchase.events === "object" && purchase.events !== null && "title" in purchase.events
      ? String(purchase.events.title ?? "")
      : "";
  const eventLocation =
    typeof purchase.events === "object" && purchase.events !== null && "location" in purchase.events
      ? String(purchase.events.location ?? "")
      : "";

  if (purchase.customer_email && canSendPurchaseEmail()) {
    const emailResult = await sendPurchaseCancellationEmail({
      to: purchase.customer_email,
      eventTitle,
      eventDate,
      eventLocation,
      quantity: purchase.quantity,
      totalAmount: purchase.total_amount,
      refundStatus: refund.status === "succeeded" ? "succeeded" : "pending",
      cancelledAt,
    });

    if (emailResult.ok) {
      emailStatus = "sent";
    } else {
      emailStatus = "failed";
      emailError = emailResult.error;
    }
  }

  return NextResponse.json({ ok: true, emailStatus, emailError, cancelledAt });
}
