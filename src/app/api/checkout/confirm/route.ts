import { NextResponse } from "next/server";
import {
  canSendPurchaseEmail,
  sendOrganizerPurchaseNotificationEmail,
  sendPurchaseConfirmationEmail,
} from "@/lib/email";
import { canUseStripe, getStripeServerClient } from "@/lib/stripe";
import {
  canUseSupabaseServerClient,
  getSupabaseServerClient,
} from "@/lib/supabase";

export async function POST(request: Request) {
  const { sessionId } = (await request.json()) as { sessionId?: string };

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId がありません。" }, { status: 400 });
  }

  if (!canUseStripe()) {
    return NextResponse.json({ error: "Stripe未設定です。" }, { status: 501 });
  }

  if (!canUseSupabaseServerClient()) {
    return NextResponse.json(
      { error: "Supabaseのサーバー設定が未完了です。.env.local に SUPABASE_SERVICE_ROLE_KEY を追加してください。" },
      { status: 501 },
    );
  }

  const stripe = getStripeServerClient();
  const supabase = getSupabaseServerClient();

  if (!stripe || !supabase) {
    return NextResponse.json({ error: "決済確認の初期化に失敗しました。" }, { status: 500 });
  }

  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  const eventId = Number(checkoutSession.metadata?.eventId);
  const quantity = Number(checkoutSession.metadata?.quantity ?? 1);
  const unitPrice = Number(checkoutSession.metadata?.unitPrice ?? 0);
  const buyerUserId = checkoutSession.metadata?.buyerUserId || null;

  if (!eventId || !quantity) {
    return NextResponse.json({ error: "決済メタデータが不足しています。" }, { status: 400 });
  }

  const { data: existingPurchase } = await supabase
    .from("purchases")
    .select("id, buyer_user_id, customer_email, email_sent_at")
    .eq("stripe_session_id", checkoutSession.id)
    .maybeSingle();

  const ticketCode = `PJ-${eventId}-${checkoutSession.id.slice(-8).toUpperCase()}`;
  const customerEmail =
    checkoutSession.customer_details?.email ?? checkoutSession.customer_email ?? undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let purchaseId = existingPurchase?.id;

  if (!existingPurchase) {
    const { data: insertedPurchase, error } = await supabase
      .from("purchases")
      .insert({
        event_id: eventId,
        stripe_session_id: checkoutSession.id,
        buyer_user_id: buyerUserId,
        customer_email: customerEmail,
        quantity,
        total_amount: unitPrice * quantity,
        payment_status: checkoutSession.payment_status,
        ticket_code: ticketCode,
        cancelled_at: null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    purchaseId = insertedPurchase?.id;
  } else if ((!existingPurchase.buyer_user_id && buyerUserId) || (!existingPurchase.customer_email && customerEmail)) {
    await supabase
      .from("purchases")
      .update({
        ...(buyerUserId && !existingPurchase.buyer_user_id ? { buyer_user_id: buyerUserId } : {}),
        ...(customerEmail && !existingPurchase.customer_email ? { customer_email: customerEmail } : {}),
      })
      .eq("id", existingPurchase.id);
  }

  let emailStatus: "sent" | "skipped" | "failed" = "skipped";
  let emailError: string | undefined;

  const shouldSendPurchaseEmail = Boolean(customerEmail && canSendPurchaseEmail() && !existingPurchase?.email_sent_at);
  const shouldSendOrganizerEmail = Boolean(canSendPurchaseEmail() && !existingPurchase);

  if (shouldSendPurchaseEmail || shouldSendOrganizerEmail) {
    const { data: eventData } = await supabase
      .from("events")
      .select("title, date, location, host_user_id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventData && shouldSendPurchaseEmail && customerEmail) {
      const emailResult = await sendPurchaseConfirmationEmail({
        to: customerEmail,
        eventTitle: eventData.title,
        eventDate: eventData.date,
        eventLocation: eventData.location,
        quantity,
        totalAmount: unitPrice * quantity,
        ticketCode,
        ticketUrl: `${appUrl}/tickets/${purchaseId}`,
      });

      if (emailResult.ok) {
        emailStatus = "sent";
        await supabase
          .from("purchases")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("stripe_session_id", checkoutSession.id);
      } else {
        emailStatus = "failed";
        emailError = emailResult.error;
      }
    }

    if (eventData?.host_user_id && shouldSendOrganizerEmail) {
        const { data: hostUserData } = await supabase.auth.admin.getUserById(eventData.host_user_id);
        const hostEmail = hostUserData.user?.email;

        if (hostEmail) {
          await sendOrganizerPurchaseNotificationEmail({
            to: hostEmail,
            eventTitle: eventData.title,
            eventDate: eventData.date,
            eventLocation: eventData.location,
            quantity,
            totalAmount: unitPrice * quantity,
            customerEmail,
            ticketCode,
          });
        }
    }
  }

  return NextResponse.json({
    ok: true,
    paymentStatus: checkoutSession.payment_status,
    customerEmail,
    ticketCode,
    emailStatus,
    emailError,
  });
}
