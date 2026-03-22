"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { EventItem, normalizeEvent } from "@/lib/events";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

type PurchaseSummaryRow = {
  id: number;
  event_id: number;
  ticket_code?: string | null;
  customer_email?: string | null;
  quantity: number;
  total_amount: number;
  payment_status: string;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string | null;
};

type EventDashboard = {
  soldCount: number;
  checkedInCount: number;
  activeTicketCount: number;
  refundedTicketCount: number;
  grossSales: number;
  refundedAmount: number;
};

type SalesPoint = {
  label: string;
  grossSales: number;
  refundedAmount: number;
};

type PeriodOption = 7 | 14 | 30 | 90;
type MonthlyComparison = {
  currentMonthSales: number;
  previousMonthSales: number;
  currentMonthRefunds: number;
  previousMonthRefunds: number;
  currentMonthOrders: number;
  previousMonthOrders: number;
};
type DashboardExportRow = {
  eventId: number;
  title: string;
  category: string;
  date: string;
  location: string;
  maxCapacity: number | null;
  remainingSeats: number | null;
  grossSales: number;
  refundedAmount: number;
  soldCount: number;
  checkedInCount: number;
  activeTicketCount: number;
  refundedTicketCount: number;
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

function formatPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return "0%";
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatDelta(current: number, previous: number, prefix = "") {
  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${prefix}${delta.toLocaleString()}`;
}

function calculateAverageTicketPrice(totalAmount: number, soldCount: number) {
  if (soldCount <= 0) {
    return 0;
  }

  return Math.round(totalAmount / soldCount);
}

function formatShortDateLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function buildSalesSeries(purchases: PurchaseSummaryRow[], days: PeriodOption) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const points: SalesPoint[] = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - ((days - 1) - index));
    return {
      label: formatShortDateLabel(date),
      grossSales: 0,
      refundedAmount: 0,
    };
  });

  const indexByLabel = new Map(points.map((point, index) => [point.label, index]));

  purchases.forEach((purchase) => {
    if (!purchase.created_at) {
      return;
    }

    const createdAt = new Date(purchase.created_at);
    createdAt.setHours(0, 0, 0, 0);
    const label = formatShortDateLabel(createdAt);
    const pointIndex = indexByLabel.get(label);
    if (pointIndex === undefined) {
      return;
    }

    const totalAmount = Number(purchase.total_amount ?? 0);
    const isCancelled =
      purchase.payment_status === "cancelled" ||
      purchase.payment_status === "refunded" ||
      Boolean(purchase.cancelled_at);

    if (isCancelled) {
      points[pointIndex].refundedAmount += totalAmount;
      return;
    }

    if (purchase.payment_status === "paid") {
      points[pointIndex].grossSales += totalAmount;
    }
  });

  return points;
}

function buildMonthlyComparison(purchases: PurchaseSummaryRow[]): MonthlyComparison {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  return purchases.reduce<MonthlyComparison>(
    (accumulator, purchase) => {
      if (!purchase.created_at) {
        return accumulator;
      }

      const createdAt = new Date(purchase.created_at);
      const year = createdAt.getFullYear();
      const month = createdAt.getMonth();
      const totalAmount = Number(purchase.total_amount ?? 0);
      const isCancelled =
        purchase.payment_status === "cancelled" ||
        purchase.payment_status === "refunded" ||
        Boolean(purchase.cancelled_at);

      const isCurrentMonth = year === currentYear && month === currentMonth;
      const isPreviousMonth = year === previousYear && month === previousMonth;

      if (!isCurrentMonth && !isPreviousMonth) {
        return accumulator;
      }

      if (isCurrentMonth) {
        if (isCancelled) {
          accumulator.currentMonthRefunds += totalAmount;
        } else if (purchase.payment_status === "paid") {
          accumulator.currentMonthSales += totalAmount;
          accumulator.currentMonthOrders += 1;
        }
      }

      if (isPreviousMonth) {
        if (isCancelled) {
          accumulator.previousMonthRefunds += totalAmount;
        } else if (purchase.payment_status === "paid") {
          accumulator.previousMonthSales += totalAmount;
          accumulator.previousMonthOrders += 1;
        }
      }

      return accumulator;
    },
    {
      currentMonthSales: 0,
      previousMonthSales: 0,
      currentMonthRefunds: 0,
      previousMonthRefunds: 0,
      currentMonthOrders: 0,
      previousMonthOrders: 0,
    },
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number | null) {
  const stringValue = value === null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

export default function DashboardPage() {
  const { session, loading } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [dashboardByEventId, setDashboardByEventId] = useState<Record<number, EventDashboard>>({});
  const [purchasesByEventId, setPurchasesByEventId] = useState<Record<number, PurchaseSummaryRow[]>>({});
  const [salesSeries, setSalesSeries] = useState<SalesPoint[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparison>({
    currentMonthSales: 0,
    previousMonthSales: 0,
    currentMonthRefunds: 0,
    previousMonthRefunds: 0,
    currentMonthOrders: 0,
    previousMonthOrders: 0,
  });
  const [periodDays, setPeriodDays] = useState<PeriodOption>(14);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
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
        .select("id, title, category, date, price, max_capacity, location, description, image_url, host_user_id")
        .eq("host_user_id", session.user.id)
        .order("date", { ascending: true });

      if (error || !data) {
        setPageLoading(false);
        return;
      }

      const normalizedEvents = data.map(normalizeEvent);
      setEvents(normalizedEvents);

      if (normalizedEvents.length === 0) {
        setDashboardByEventId({});
        setPurchasesByEventId({});
        setPageLoading(false);
        return;
      }

      const eventIds = normalizedEvents.map((event) => event.id);
      const { data: purchaseRows } = await supabase
        .from("purchases")
        .select(
          "id, event_id, ticket_code, customer_email, quantity, total_amount, payment_status, checked_in, checked_in_at, cancelled_at, created_at",
        )
        .in("event_id", eventIds);

      const normalizedPurchaseRows = (purchaseRows as PurchaseSummaryRow[] | null) ?? [];
      setSalesSeries(buildSalesSeries(normalizedPurchaseRows, periodDays));
      setMonthlyComparison(buildMonthlyComparison(normalizedPurchaseRows));
      const nextPurchasesByEventId = normalizedEvents.reduce<Record<number, PurchaseSummaryRow[]>>(
        (accumulator, event) => {
          accumulator[event.id] = [];
          return accumulator;
        },
        {},
      );

      const nextDashboardByEventId = normalizedEvents.reduce<Record<number, EventDashboard>>(
        (accumulator, event) => {
          accumulator[event.id] = buildEmptyDashboard();
          return accumulator;
        },
        {},
      );

      normalizedPurchaseRows.forEach((purchase) => {
        nextPurchasesByEventId[purchase.event_id]?.push(purchase);
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

      setPurchasesByEventId(nextPurchasesByEventId);
      setDashboardByEventId(nextDashboardByEventId);
      setPageLoading(false);
    }

    void loadDashboard();
  }, [periodDays, session]);

  const totals = events.reduce(
    (accumulator, event) => {
      const dashboard = dashboardByEventId[event.id] ?? buildEmptyDashboard();
      accumulator.grossSales += dashboard.grossSales;
      accumulator.refundedAmount += dashboard.refundedAmount;
      accumulator.soldCount += dashboard.soldCount;
      accumulator.checkedInCount += dashboard.checkedInCount;
      accumulator.activeTicketCount += dashboard.activeTicketCount;
      accumulator.refundedTicketCount += dashboard.refundedTicketCount;
      return accumulator;
    },
    buildEmptyDashboard(),
  );

  const exportRows: DashboardExportRow[] = events.map((event) => {
    const dashboard = dashboardByEventId[event.id] ?? buildEmptyDashboard();
    const remainingSeats =
      typeof event.maxCapacity === "number"
        ? Math.max(event.maxCapacity - dashboard.activeTicketCount, 0)
        : null;

    return {
      eventId: event.id,
      title: event.title,
      category: event.category,
      date: event.date,
      location: event.location,
      maxCapacity: typeof event.maxCapacity === "number" ? event.maxCapacity : null,
      remainingSeats,
      grossSales: dashboard.grossSales,
      refundedAmount: dashboard.refundedAmount,
      soldCount: dashboard.soldCount,
      checkedInCount: dashboard.checkedInCount,
      activeTicketCount: dashboard.activeTicketCount,
      refundedTicketCount: dashboard.refundedTicketCount,
    };
  });

  function handleDownloadDashboardCsv() {
    const rows: string[][] = [
      [
        "event_id",
        "title",
        "category",
        "date",
        "location",
        "max_capacity",
        "remaining_seats",
        "gross_sales",
        "refunded_amount",
        "sold_count",
        "checked_in_count",
        "active_ticket_count",
        "cancelled_count",
      ],
      ...exportRows.map((row) => [
        String(row.eventId),
        row.title,
        row.category,
        row.date,
        row.location,
        row.maxCapacity === null ? "" : String(row.maxCapacity),
        row.remainingSeats === null ? "" : String(row.remainingSeats),
        String(row.grossSales),
        String(row.refundedAmount),
        String(row.soldCount),
        String(row.checkedInCount),
        String(row.activeTicketCount),
        String(row.refundedTicketCount),
      ]),
    ];

    downloadCsv("dashboard-summary.csv", rows);
  }

  function handleDownloadEventDetailCsv(event: EventItem) {
    const purchases = purchasesByEventId[event.id] ?? [];
    const rows: string[][] = [
      [
        "purchase_id",
        "ticket_code",
        "customer_email",
        "quantity",
        "total_amount",
        "payment_status",
        "checked_in",
        "checked_in_at",
        "cancelled_at",
        "created_at",
      ],
      ...purchases.map((purchase) => [
        String(purchase.id),
        purchase.ticket_code ?? "",
        purchase.customer_email ?? "",
        String(purchase.quantity ?? 0),
        String(purchase.total_amount ?? 0),
        purchase.payment_status ?? "",
        purchase.checked_in ? "true" : "false",
        purchase.checked_in_at ?? "",
        purchase.cancelled_at ?? "",
        purchase.created_at ?? "",
      ]),
    ];

    const safeTitle = event.title.replaceAll(/\s+/g, "-").replaceAll(/[\\/:*?"<>|]/g, "");
    downloadCsv(`${safeTitle || `event-${event.id}`}-detail.csv`, rows);
  }

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-3xl font-bold">主催者ダッシュボード</h1>
        <p className="mb-6 text-gray-600">売上、返金、参加状況をイベント単位で確認できます。</p>

        {canUseSupabase() && !loading && !session ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">ダッシュボードを見るにはログインが必要です。</p>
            <Link href="/login" className="rounded-lg bg-black px-4 py-2 text-white">
              ログイン画面へ
            </Link>
          </div>
        ) : null}

        {pageLoading ? <p>読み込み中...</p> : null}

        {!pageLoading && session ? (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-2xl bg-black p-5 text-white">
                <p className="text-sm text-gray-300">総売上</p>
                <p className="mt-2 text-3xl font-bold">¥{totals.grossSales.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-gray-100 p-5">
                <p className="text-sm text-gray-500">総返金額</p>
                <p className="mt-2 text-3xl font-bold">¥{totals.refundedAmount.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-gray-100 p-5">
                <p className="text-sm text-gray-500">総申込数</p>
                <p className="mt-2 text-3xl font-bold">{totals.soldCount}</p>
              </div>
              <div className="rounded-2xl bg-gray-100 p-5">
                <p className="text-sm text-gray-500">総使用済み</p>
                <p className="mt-2 text-3xl font-bold">{totals.checkedInCount}</p>
              </div>
              <div className="rounded-2xl bg-gray-100 p-5">
                <p className="text-sm text-gray-500">有効チケット</p>
                <p className="mt-2 text-3xl font-bold">{totals.activeTicketCount}</p>
              </div>
              <div className="rounded-2xl bg-gray-100 p-5">
                <p className="text-sm text-gray-500">キャンセル数</p>
                <p className="mt-2 text-3xl font-bold">{totals.refundedTicketCount}</p>
              </div>
            </div>

            <section className="mb-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">全体キャンセル率</p>
                <p className="mt-2 text-3xl font-bold">
                  {formatPercent(
                    totals.refundedTicketCount,
                    totals.activeTicketCount + totals.refundedTicketCount,
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">全体チェックイン率</p>
                <p className="mt-2 text-3xl font-bold">
                  {formatPercent(totals.checkedInCount, totals.activeTicketCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-sm text-gray-500">平均チケット単価</p>
                <p className="mt-2 text-3xl font-bold">
                  ¥{calculateAverageTicketPrice(totals.grossSales, totals.soldCount).toLocaleString()}
                </p>
              </div>
            </section>

            <section className="mb-8 rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-2xl font-semibold">月別売上比較</h2>
                <p className="text-sm text-gray-600">今月と先月の売上、返金、申込件数を比較できます。</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">売上</p>
                  <p className="mt-2 text-2xl font-bold">
                    今月 ¥{monthlyComparison.currentMonthSales.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    先月 ¥{monthlyComparison.previousMonthSales.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    差分 {formatDelta(monthlyComparison.currentMonthSales, monthlyComparison.previousMonthSales, "¥")}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">返金</p>
                  <p className="mt-2 text-2xl font-bold">
                    今月 ¥{monthlyComparison.currentMonthRefunds.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    先月 ¥{monthlyComparison.previousMonthRefunds.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    差分 {formatDelta(monthlyComparison.currentMonthRefunds, monthlyComparison.previousMonthRefunds, "¥")}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">申込件数</p>
                  <p className="mt-2 text-2xl font-bold">今月 {monthlyComparison.currentMonthOrders}</p>
                  <p className="text-sm text-gray-600">先月 {monthlyComparison.previousMonthOrders}</p>
                  <p className="mt-2 text-sm text-gray-500">
                    差分 {formatDelta(monthlyComparison.currentMonthOrders, monthlyComparison.previousMonthOrders)}
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8 rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">売上推移</h2>
                  <p className="text-sm text-gray-600">売上と返金額を日別で確認できます。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {([7, 14, 30, 90] as PeriodOption[]).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setPeriodDays(days)}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        periodDays === days
                          ? "bg-black text-white"
                          : "border border-gray-300 text-gray-600"
                      }`}
                    >
                      {days}日
                    </button>
                  ))}
                </div>
              </div>

              {salesSeries.some((point) => point.grossSales > 0 || point.refundedAmount > 0) ? (
                <>
                  <div className="flex h-64 items-end gap-2 overflow-x-auto rounded-xl bg-gray-50 p-4">
                    {salesSeries.map((point) => {
                      const maxValue = Math.max(
                        ...salesSeries.map((item) => Math.max(item.grossSales, item.refundedAmount)),
                        1,
                      );

                      return (
                        <div key={point.label} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                          <div className="flex h-44 items-end gap-1">
                            <div
                              className="w-4 rounded-t bg-black"
                              style={{ height: `${(point.grossSales / maxValue) * 100}%` }}
                              title={`売上 ¥${point.grossSales.toLocaleString()}`}
                            />
                            <div
                              className="w-4 rounded-t bg-rose-400"
                              style={{ height: `${(point.refundedAmount / maxValue) * 100}%` }}
                              title={`返金 ¥${point.refundedAmount.toLocaleString()}`}
                            />
                          </div>
                          <p className="text-xs text-gray-500">{point.label}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-sm bg-black" />
                      売上
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-sm bg-rose-400" />
                      返金
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-gray-50 p-6 text-sm text-gray-600">
                  直近{periodDays}日に集計できる売上データはありません。
                </div>
              )}
            </section>

            <section className="mb-8 rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">売上サマリーCSV</h2>
                  <p className="text-sm text-gray-600">イベントごとの売上・返金・申込数をCSVでダウンロードできます。</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadDashboardCsv}
                  disabled={exportRows.length === 0}
                  className="rounded-lg bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  売上CSVをダウンロード
                </button>
              </div>
            </section>

            {events.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="mb-4 text-gray-600">まだ集計できるイベントはありません。</p>
                <Link href="/create" className="rounded-lg bg-blue-600 px-4 py-2 text-white">
                  新しいイベントを作る
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {events.map((event) => {
                  const dashboard = dashboardByEventId[event.id] ?? buildEmptyDashboard();
                  const remainingSeats =
                    typeof event.maxCapacity === "number"
                      ? Math.max(event.maxCapacity - dashboard.activeTicketCount, 0)
                      : null;

                  return (
                    <div key={event.id} className="rounded-2xl border border-gray-200 p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="mb-1 text-sm text-blue-600">{event.category}</p>
                          <h2 className="text-2xl font-semibold">{event.title}</h2>
                          <p className="text-gray-600">{event.date}</p>
                          <p className="text-gray-600">{event.location}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Link href={`/events/${event.id}`} className="rounded-lg border border-gray-300 px-4 py-2">
                            詳細
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDownloadEventDetailCsv(event)}
                            className="rounded-lg border border-gray-300 px-4 py-2"
                          >
                            明細CSV
                          </button>
                          <Link href={`/events/${event.id}/check-in`} className="rounded-lg bg-emerald-600 px-4 py-2 text-white">
                            受付
                          </Link>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-xl bg-gray-50 p-4">
                          <p className="text-sm text-gray-500">売上</p>
                          <p className="text-2xl font-bold">¥{dashboard.grossSales.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4">
                          <p className="text-sm text-gray-500">返金額</p>
                          <p className="text-2xl font-bold">¥{dashboard.refundedAmount.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4">
                          <p className="text-sm text-gray-500">申込数</p>
                          <p className="text-2xl font-bold">{dashboard.soldCount}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4">
                          <p className="text-sm text-gray-500">使用済み</p>
                          <p className="text-2xl font-bold">{dashboard.checkedInCount}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-4">
                          <p className="text-sm text-gray-500">残席</p>
                          <p className="text-2xl font-bold">{remainingSeats === null ? "∞" : remainingSeats}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                        <p>有効チケット: {dashboard.activeTicketCount}</p>
                        <p>キャンセル数: {dashboard.refundedTicketCount}</p>
                        <p>定員: {typeof event.maxCapacity === "number" ? `${event.maxCapacity}名` : "制限なし"}</p>
                        <p>
                          キャンセル率:{" "}
                          {formatPercent(
                            dashboard.refundedTicketCount,
                            dashboard.activeTicketCount + dashboard.refundedTicketCount,
                          )}
                        </p>
                        <p>
                          チェックイン率:{" "}
                          {formatPercent(dashboard.checkedInCount, dashboard.activeTicketCount)}
                        </p>
                        <p>
                          平均チケット単価: ¥
                          {calculateAverageTicketPrice(
                            dashboard.grossSales,
                            dashboard.soldCount,
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
