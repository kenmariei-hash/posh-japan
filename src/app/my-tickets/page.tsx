"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { canCancelPurchase } from "@/lib/cancellation";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

type TicketRow = {
  id: number;
  event_id: number;
  stripe_session_id: string;
  buyer_user_id?: string | null;
  customer_email?: string;
  quantity: number;
  total_amount: number;
  payment_status: string;
  ticket_code?: string;
  checked_in?: boolean;
  checked_in_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  events?: {
    title: string;
    date: string;
    location: string;
  };
};

export default function MyTicketsPage() {
  const { session, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelLoadingId, setCancelLoadingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadTickets() {
      if (!canUseSupabase()) {
        setLoading(false);
        return;
      }

      if (authLoading) {
        return;
      }

      if (!session) {
        setTickets([]);
        setLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("purchases")
        .select("id, event_id, stripe_session_id, buyer_user_id, customer_email, quantity, total_amount, payment_status, ticket_code, checked_in, checked_in_at, cancelled_at, created_at, events(title, date, location)")
        .order("id", { ascending: false });

      setTickets((data as TicketRow[] | null) ?? []);
      setLoading(false);
    }

    void loadTickets();
  }, [authLoading, session]);

  async function handleCancel(ticket: TicketRow) {
    if (!session) {
      setMessage("キャンセルするにはログインが必要です。");
      return;
    }

    if (
      !canCancelPurchase({
        eventDate: ticket.events?.date,
        checkedIn: ticket.checked_in,
        paymentStatus: ticket.payment_status,
        cancelledAt: ticket.cancelled_at,
      })
    ) {
      setMessage("このチケットはイベント前日までキャンセル可能です。");
      return;
    }

    const confirmed = window.confirm("このチケットをキャンセルしますか？");
    if (!confirmed) {
      return;
    }

    setCancelLoadingId(ticket.id);
    setMessage("");

    const supabase = getSupabaseBrowserClient();
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    const response = await fetch(`/api/purchases/${ticket.id}/cancel`, {
      method: "POST",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      emailStatus?: "sent" | "skipped" | "failed";
      emailError?: string;
      cancelledAt?: string;
    };
    if (!response.ok) {
      setMessage(data.error ?? "キャンセルに失敗しました。");
      setCancelLoadingId(null);
      return;
    }

    const cancelledAt = data.cancelledAt ?? new Date().toISOString();
    setTickets((current) =>
      current.map((currentTicket) =>
        currentTicket.id === ticket.id
          ? {
              ...currentTicket,
              payment_status: "cancelled",
              cancelled_at: cancelledAt,
            }
          : currentTicket,
      ),
    );
    if (data.emailStatus === "sent") {
      setMessage("キャンセルしました。返金処理を開始し、確認メールを送りました。");
    } else if (data.emailStatus === "failed") {
      setMessage(`キャンセルしました。返金処理を開始しましたが、メール送信に失敗しました。${data.emailError ? ` ${data.emailError}` : ""}`);
    } else {
      setMessage("キャンセルしました。返金処理を開始しました。");
    }
    setCancelLoadingId(null);
  }

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-3xl font-bold">購入記録</h1>
        <p className="mb-6 text-gray-600">決済完了したチケットをここで確認できます。</p>
        {message ? <p className="mb-4 text-sm text-gray-600">{message}</p> : null}

        {loading ? <p>読み込み中...</p> : null}

        {!loading && tickets.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">まだ購入記録はありません。</p>
            <Link href="/" className="rounded-lg bg-black px-4 py-2 text-white">
              イベント一覧へ
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-2xl font-semibold">{ticket.events?.title ?? "イベント"}</h2>
                <span
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    ticket.cancelled_at
                      ? "bg-gray-200 text-gray-700"
                      : ticket.checked_in
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {ticket.cancelled_at ? "キャンセル済み" : ticket.checked_in ? "使用済み" : "未使用"}
                </span>
              </div>
              <p className="text-gray-600">{ticket.events?.date}</p>
              <p className="text-gray-600">{ticket.events?.location}</p>
              <p className="mt-3">枚数: {ticket.quantity}</p>
              <p>金額: ¥{ticket.total_amount.toLocaleString()}</p>
              <p>支払い状態: {ticket.payment_status}</p>
              <p>受付コード: {ticket.ticket_code || "未発行"}</p>
              <p>
                入場状態: {ticket.cancelled_at ? "キャンセル済み" : ticket.checked_in ? "使用済み" : "未使用"}
              </p>
              <p>
                使用時刻:{" "}
                {ticket.checked_in_at
                  ? new Date(ticket.checked_in_at).toLocaleString("ja-JP")
                  : "未使用"}
              </p>
              <p>
                キャンセル時刻:{" "}
                {ticket.cancelled_at
                  ? new Date(ticket.cancelled_at).toLocaleString("ja-JP")
                  : "未キャンセル"}
              </p>
              <p className="text-sm text-gray-500">{ticket.customer_email}</p>
              <p className="text-sm text-gray-500">キャンセル期限: イベント前日まで</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="rounded-lg bg-black px-4 py-2 text-white"
                >
                  チケットを見る
                </Link>
                {canCancelPurchase({
                  eventDate: ticket.events?.date,
                  checkedIn: ticket.checked_in,
                  paymentStatus: ticket.payment_status,
                  cancelledAt: ticket.cancelled_at,
                }) ? (
                  <button
                    type="button"
                    onClick={() => void handleCancel(ticket)}
                    disabled={cancelLoadingId === ticket.id}
                    className="rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50"
                  >
                    {cancelLoadingId === ticket.id ? "キャンセル中..." : "キャンセルする"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
