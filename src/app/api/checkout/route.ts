import { NextResponse } from "next/server";
import { canUseSupabaseServerClient, getSupabaseServerClient } from "@/lib/supabase";
import { canUseStripe, getStripeServerClient } from "@/lib/stripe";

type CheckoutBody = {
  eventId: number;
  title: string;
  price: number;
  quantity: number;
  customerEmail?: string;
};

export async function POST(request: Request) {
  if (!canUseStripe()) {
    return NextResponse.json(
      { error: "Stripe未設定です。.env.local に STRIPE_SECRET_KEY を追加してください。" },
      { status: 501 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const stripe = getStripeServerClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe clientの初期化に失敗しました。" }, { status: 500 });
  }

  const body = (await request.json()) as CheckoutBody;
  if (!body.title || !body.price || !body.quantity) {
    return NextResponse.json({ error: "決済に必要な情報が不足しています。" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!canUseSupabaseServerClient() || !supabase) {
    return NextResponse.json(
      { error: "Supabaseのサーバー設定が未完了です。.env.local を確認してください。" },
      { status: 501 },
    );
  }

  const unitAmount = Math.max(50, Math.round(body.price));
  const quantity = Math.max(1, Math.min(10, Math.round(body.quantity)));
  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  let buyerUserId = "";

  if (accessToken) {
    const { data: userData } = await supabase.auth.getUser(accessToken);
    buyerUserId = userData.user?.id ?? "";
  }

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id, title, max_capacity, is_published")
    .eq("id", body.eventId)
    .maybeSingle();

  if (eventError || !eventData) {
    return NextResponse.json({ error: "イベント情報の取得に失敗しました。" }, { status: 404 });
  }

  if (eventData.is_published === false) {
    return NextResponse.json({ error: "このイベントは現在非公開です。" }, { status: 400 });
  }

  if (typeof eventData.max_capacity === "number") {
    const { data: purchaseRows, error: purchaseError } = await supabase
      .from("purchases")
      .select("quantity")
      .eq("event_id", body.eventId)
      .eq("payment_status", "paid");

    if (purchaseError) {
      return NextResponse.json({ error: "残席確認に失敗しました。" }, { status: 500 });
    }

    const soldCount = (purchaseRows ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    const remainingSeats = eventData.max_capacity - soldCount;

    if (remainingSeats <= 0) {
      return NextResponse.json({ error: "このイベントは満席です。" }, { status: 400 });
    }

    if (quantity > remainingSeats) {
      return NextResponse.json(
        { error: `残席は ${remainingSeats} 枚です。購入枚数を減らしてください。` },
        { status: 400 },
      );
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: body.customerEmail || undefined,
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancel`,
    line_items: [
      {
        quantity,
        price_data: {
          currency: "jpy",
          product_data: {
            name: body.title,
            description: `イベントID: ${body.eventId}`,
          },
          unit_amount: unitAmount,
        },
      },
    ],
    metadata: {
      eventId: String(body.eventId),
      quantity: String(quantity),
      unitPrice: String(unitAmount),
      buyerUserId,
    },
  });

  return NextResponse.json({ url: session.url });
}
