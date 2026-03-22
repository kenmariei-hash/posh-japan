"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { EventItem, normalizeEvent } from "@/lib/events";
import {
  canUseSupabase,
  getStoragePathFromPublicUrl,
  getSupabaseBrowserClient,
} from "@/lib/supabase";

type PurchaseSummaryRow = {
  event_id: number;
  quantity: number;
  total_amount: number;
  payment_status: string;
  checked_in?: boolean | null;
  cancelled_at?: string | null;
};

type EventDashboard = {
  soldCount: number;
  checkedInCount: number;
  activeTicketCount: number;
  refundedTicketCount: number;
  grossSales: number;
  refundedAmount: number;
};

function buildEmptyDashboard(): EventDashboard {
  return {
    soldCount: 0,
    checkedInCount: 0,
    activeTicketCount: 0,
    refundedTicketCount: 0,
    grossSales: 0,
    refundedAmount: 0,
  };
}

export default function MyEventsPage() {
  const { session, loading } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [dashboardByEventId, setDashboardByEventId] = useState<Record<number, EventDashboard>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    async function loadMyEvents() {
      if (!canUseSupabase() || !session) {
        setPageLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setPageLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .select("id, title, category, date, price, max_capacity, location, description, image_url, host_user_id, is_published")
        .eq("host_user_id", session.user.id)
        .order("id", { ascending: false });

      if (!error && data) {
        const normalizedEvents = data.map(normalizeEvent);
        setEvents(normalizedEvents);

        if (normalizedEvents.length > 0) {
          const eventIds = normalizedEvents.map((event) => event.id);
          const { data: purchaseRows } = await supabase
            .from("purchases")
            .select("event_id, quantity, total_amount, payment_status, checked_in, cancelled_at")
            .in("event_id", eventIds);

          const nextDashboardByEventId = normalizedEvents.reduce<Record<number, EventDashboard>>(
            (accumulator, event) => {
              accumulator[event.id] = buildEmptyDashboard();
              return accumulator;
            },
            {},
          );

          ((purchaseRows as PurchaseSummaryRow[] | null) ?? []).forEach((purchase) => {
            const summary = nextDashboardByEventId[purchase.event_id];
            if (!summary) {
              return;
            }

            const quantity = Number(purchase.quantity ?? 0);
            const totalAmount = Number(purchase.total_amount ?? 0);
            const isCancelled =
              purchase.payment_status === "cancelled" ||
              purchase.payment_status === "refunded" ||
              Boolean(purchase.cancelled_at);

            if (isCancelled) {
              summary.refundedTicketCount += quantity;
              summary.refundedAmount += totalAmount;
              return;
            }

            if (purchase.payment_status === "paid") {
              summary.soldCount += quantity;
              summary.activeTicketCount += quantity;
              summary.grossSales += totalAmount;
            }

            if (purchase.checked_in) {
              summary.checkedInCount += quantity;
            }
          });

          setDashboardByEventId(nextDashboardByEventId);

        } else {
          setDashboardByEventId({});
        }
      }

      setPageLoading(false);
    }

    loadMyEvents();
  }, [session]);

  async function handleDelete(event: EventItem) {
    const confirmed = window.confirm(`"${event.title}" を削除します。よければOKを押してください。`);
    if (!confirmed) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    setDeletingId(event.id);

    const imagePath = event.imageUrl ? getStoragePathFromPublicUrl(event.imageUrl) : null;
    if (imagePath) {
      await supabase.storage.from("event-images").remove([imagePath]);
    }

    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) {
      alert(`削除に失敗しました: ${error.message}`);
      setDeletingId(null);
      return;
    }

    setEvents((current) => current.filter((item) => item.id !== event.id));
    setDeletingId(null);
  }

  async function handleTogglePublish(event: EventItem) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !session) {
      return;
    }

    setTogglingId(event.id);
    const nextPublished = !(event.isPublished ?? true);
    const { error } = await supabase
      .from("events")
      .update({ is_published: nextPublished })
      .eq("id", event.id)
      .eq("host_user_id", session.user.id);

    if (error) {
      alert(`公開設定の更新に失敗しました: ${error.message}`);
      setTogglingId(null);
      return;
    }

    setEvents((current) =>
      current.map((item) =>
        item.id === event.id ? { ...item, isPublished: nextPublished } : item,
      ),
    );
    setTogglingId(null);
  }

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-bold">自分のイベント</h1>
        <p className="mb-6 text-gray-600">主催者として作成したイベントを管理できます。</p>

        {canUseSupabase() && !loading && !session ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">管理画面を見るにはログインが必要です。</p>
            <Link href="/login" className="rounded-lg bg-black px-4 py-2 text-white">
              ログイン画面へ
            </Link>
          </div>
        ) : null}

        {pageLoading ? <p>読み込み中...</p> : null}

        {!pageLoading && session && events.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">まだ自分のイベントはありません。</p>
            <Link href="/create" className="rounded-lg bg-blue-600 px-4 py-2 text-white">
              新しいイベントを作る
            </Link>
          </div>
        ) : null}

        <div className="grid gap-4">
          {events.map((event) => (
            <div key={event.id} className="rounded-2xl border border-gray-200 p-4 shadow-sm">
              {event.imageUrl ? (
                <Image
                  src={event.imageUrl}
                  alt={event.title}
                  width={1200}
                  height={720}
                  className="mb-4 h-52 w-full rounded-xl object-cover"
                />
              ) : null}
              <p className="mb-1 text-sm text-blue-600">{event.category}</p>
              <h2 className="text-2xl font-semibold">{event.title}</h2>
              <p
                className={`mt-1 inline-block rounded-full px-3 py-1 text-sm ${
                  event.isPublished === false
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {event.isPublished === false ? "非公開" : "公開中"}
              </p>
              <p className="text-gray-600">{event.date}</p>
              <p className="text-gray-600">{event.location}</p>
              <p className="mt-2 font-bold">¥{event.price.toLocaleString()}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">売上</p>
                  <p className="text-2xl font-bold">
                    ¥{(dashboardByEventId[event.id]?.grossSales ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">返金額</p>
                  <p className="text-2xl font-bold">
                    ¥{(dashboardByEventId[event.id]?.refundedAmount ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">申込数</p>
                  <p className="text-2xl font-bold">{dashboardByEventId[event.id]?.soldCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">使用済み</p>
                  <p className="text-2xl font-bold">
                    {dashboardByEventId[event.id]?.checkedInCount ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">残席</p>
                  <p className="text-2xl font-bold">
                    {typeof event.maxCapacity === "number"
                      ? Math.max(
                          event.maxCapacity - (dashboardByEventId[event.id]?.activeTicketCount ?? 0),
                          0,
                        )
                      : "∞"}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                <p>有効チケット: {dashboardByEventId[event.id]?.activeTicketCount ?? 0}</p>
                <p>キャンセル数: {dashboardByEventId[event.id]?.refundedTicketCount ?? 0}</p>
                <p>
                  定員: {typeof event.maxCapacity === "number" ? `${event.maxCapacity}名` : "制限なし"}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/events/${event.id}`}
                  className="rounded-lg border border-gray-300 px-4 py-2"
                >
                  詳細
                </Link>
                <Link
                  href={`/events/${event.id}/edit`}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white"
                >
                  編集
                </Link>
                <button
                  type="button"
                  onClick={() => handleTogglePublish(event)}
                  disabled={togglingId === event.id}
                  className="rounded-lg border border-gray-300 px-4 py-2 disabled:opacity-50"
                >
                  {togglingId === event.id
                    ? "更新中..."
                    : event.isPublished === false
                      ? "公開にする"
                      : "非公開にする"}
                </button>
                <Link
                  href={`/events/${event.id}/check-in`}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white"
                >
                  受付
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(event)}
                  disabled={deletingId === event.id}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
                >
                  {deletingId === event.id ? "削除中..." : "削除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
