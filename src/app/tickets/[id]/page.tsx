"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { canCancelPurchase } from "@/lib/cancellation";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

type TicketDetail = {
  id: number;
  event_id: number;
  stripe_session_id: string;
  buyer_user_id?: string | null;
  customer_email?: string;
  quantity: number;
  total_amount: number;
  payment_status: string;
  ticket_code: string;
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

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const { session } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [message, setMessage] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    async function loadTicket() {
      if (!canUseSupabase()) {
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
        .eq("id", Number(params.id))
        .maybeSingle();

      setTicket((data as TicketDetail | null) ?? null);
      setLoading(false);
    }

    loadTicket();
  }, [params.id]);

  useEffect(() => {
    async function buildQrCode() {
      if (!ticket?.ticket_code || ticket.cancelled_at) {
        setQrDataUrl("");
        return;
      }

      const nextDataUrl = await QRCode.toDataURL(ticket.ticket_code, {
        width: 320,
        margin: 2,
      });
      setQrDataUrl(nextDataUrl);
    }

    void buildQrCode();
  }, [ticket?.ticket_code, ticket?.cancelled_at]);

  async function handleCancel() {
    if (!ticket || !session) {
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

    setCancelLoading(true);
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
      setCancelLoading(false);
      return;
    }

    setTicket((current) =>
      current
        ? {
            ...current,
            payment_status: "refunded",
            cancelled_at: data.cancelledAt ?? new Date().toISOString(),
          }
        : current,
    );
    if (data.emailStatus === "sent") {
      setMessage("キャンセルしました。返金処理を開始し、確認メールを送りました。");
    } else if (data.emailStatus === "failed") {
      setMessage(`キャンセルしました。返金処理を開始しましたが、メール送信に失敗しました。${data.emailError ? ` ${data.emailError}` : ""}`);
    } else {
      setMessage("キャンセルしました。返金処理を開始しました。");
    }
    setCancelLoading(false);
  }

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-3xl">
        {message ? <p className="mb-4 text-sm text-gray-600">{message}</p> : null}
        {loading ? <p>読み込み中...</p> : null}

        {!loading && !ticket ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">チケットが見つかりません。</p>
            <Link href="/my-tickets" className="rounded-lg bg-black px-4 py-2 text-white">
              購入記録へ戻る
            </Link>
          </div>
        ) : null}

        {ticket ? (
          <div className="relative overflow-hidden rounded-[32px] border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-8 shadow-lg">
            {ticket.cancelled_at ? (
              <div className="pointer-events-none absolute right-6 top-6 rotate-12 rounded-2xl border-4 border-gray-500 px-6 py-3 text-3xl font-black tracking-[0.3em] text-gray-500 opacity-90">
                CANCELLED
              </div>
            ) : ticket.checked_in ? (
              <div className="pointer-events-none absolute right-6 top-6 rotate-12 rounded-2xl border-4 border-red-500 px-6 py-3 text-3xl font-black tracking-[0.3em] text-red-500 opacity-90">
                USED
              </div>
            ) : null}

            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Ticket #{ticket.id}</p>
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
            <h1 className="mb-2 text-3xl font-bold">{ticket.events?.title ?? "イベントチケット"}</h1>
            <p className="text-gray-600">{ticket.events?.date}</p>
            <p className="mb-6 text-gray-600">{ticket.events?.location}</p>

            <div className="mb-6 rounded-2xl border border-dashed border-black p-6 text-center">
              <p className="mb-2 text-sm text-gray-500">受付コード</p>
              <p className="font-mono text-3xl font-bold tracking-[0.3em]">
                {ticket.ticket_code || "コード未発行"}
              </p>
              {qrDataUrl && !ticket.cancelled_at ? (
                <div className="mt-6 flex justify-center">
                  <Image
                    src={qrDataUrl}
                    alt="受付用QRコード"
                    width={224}
                    height={224}
                    className="h-56 w-56 rounded-xl border border-gray-200 bg-white p-3"
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-2xl bg-black p-5 text-white">
              <p>枚数: {ticket.quantity}</p>
              <p>金額: ¥{ticket.total_amount.toLocaleString()}</p>
              <p>支払い状態: {ticket.payment_status}</p>
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
              <p className="text-sm text-gray-300">{ticket.customer_email}</p>
              <p className="text-sm text-gray-300">
                キャンセル期限: イベント前日まで
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <Link href="/my-tickets" className="rounded-lg border border-gray-300 px-4 py-2">
                購入記録へ戻る
              </Link>
              {canCancelPurchase({
                eventDate: ticket.events?.date,
                checkedIn: ticket.checked_in,
                paymentStatus: ticket.payment_status,
                cancelledAt: ticket.cancelled_at,
              }) ? (
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={cancelLoading}
                  className="rounded-lg border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50"
                >
                  {cancelLoading ? "キャンセル中..." : "キャンセルする"}
                </button>
              ) : null}
              <Link href="/" className="rounded-lg bg-black px-4 py-2 text-white">
                イベント一覧へ
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
