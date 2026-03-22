import { NextResponse } from "next/server";
import {
  canUseSupabaseServerClient,
  getSupabaseServerClient,
} from "@/lib/supabase";

function buildDoorTicketCode(eventId: number) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PJ-${eventId}-${random}`;
}

function buildDoorSessionId(eventId: number) {
  return `door-${eventId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  const eventId = Number(id);
  if (!eventId) {
    return NextResponse.json({ error: "イベントIDが不正です。" }, { status: 400 });
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

  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id, title, host_user_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !eventData) {
    return NextResponse.json({ error: "イベントが見つかりません。" }, { status: 404 });
  }

  if (eventData.host_user_id !== userData.user.id) {
    return NextResponse.json({ error: "このイベントに door 参加者を追加する権限がありません。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    quantity?: number;
    totalAmount?: number;
    customerEmail?: string;
    checkedIn?: boolean;
  };

  const quantity = Number(body.quantity ?? 1);
  const totalAmount = Number(body.totalAmount ?? 0);
  const customerEmail = body.customerEmail?.trim() || null;
  const checkedIn = body.checkedIn !== false;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "枚数は1以上の整数で指定してください。" }, { status: 400 });
  }

  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return NextResponse.json({ error: "金額は0以上で指定してください。" }, { status: 400 });
  }

  const checkedInAt = checkedIn ? new Date().toISOString() : null;
  const ticketCode = buildDoorTicketCode(eventId);

  const { data: insertedPurchase, error: insertError } = await supabase
    .from("purchases")
    .insert({
      event_id: eventId,
      stripe_session_id: buildDoorSessionId(eventId),
      buyer_user_id: null,
      customer_email: customerEmail,
      quantity,
      total_amount: totalAmount,
      payment_status: "paid",
      ticket_code: ticketCode,
      checked_in: checkedIn,
      checked_in_at: checkedInAt,
      cancelled_at: null,
    })
    .select("id, ticket_code, checked_in, checked_in_at, cancelled_at, quantity, total_amount, customer_email")
    .single();

  if (insertError || !insertedPurchase) {
    return NextResponse.json({ error: insertError?.message ?? "door参加者の追加に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    purchase: insertedPurchase,
    message: checkedIn
      ? "door参加者を追加し、そのまま入場済みにしました。"
      : "door参加者を追加しました。",
  });
}
