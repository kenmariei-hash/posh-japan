"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { EventItem, getFallbackEvents, normalizeEvent } from "@/lib/events";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

export default function EventDetail() {
  const params = useParams<{ id: string }>();
  const { session } = useAuth();
  const eventId = Number(params.id);

  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [soldCount, setSoldCount] = useState(0);
  const [canViewUnpublished, setCanViewUnpublished] = useState(false);

  useEffect(() => {
    async function loadEvent() {
      if (canUseSupabase()) {
        const supabase = getSupabaseBrowserClient();

        if (supabase) {
          const { data, error } = await supabase
            .from("events")
            .select("id, title, category, date, price, max_capacity, location, description, image_url, is_published, host_user_id")
            .eq("id", eventId)
            .maybeSingle();

          if (!error && data) {
            const normalized = normalizeEvent(data);
            const isOwner = data.host_user_id && data.host_user_id === session?.user.id;
            if (!normalized.isPublished && !isOwner) {
              setEvent(null);
              setLoading(false);
              return;
            }

            setCanViewUnpublished(Boolean(isOwner && !normalized.isPublished));
            setEvent(normalized);

            const { data: purchaseRows } = await supabase
              .from("purchases")
              .select("quantity")
              .eq("event_id", eventId)
              .eq("payment_status", "paid");

            const nextSoldCount = (purchaseRows ?? []).reduce(
              (sum, row) => sum + Number(row.quantity ?? 0),
              0,
            );
            setSoldCount(nextSoldCount);

            setLoading(false);
            return;
          }
        }
      }

      const fallbackEvent = getFallbackEvents().find((item) => item.id === eventId) ?? null;
      setEvent(fallbackEvent);
      setLoading(false);
    }

    loadEvent();
  }, [eventId, session?.user.id]);

  if (loading) {
    return <main className="min-h-screen p-6">読み込み中...</main>;
  }

  if (!event) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-sm text-gray-500 mb-2">イベントID: {params.id}</p>
        <h1 className="text-3xl font-bold mb-3">イベントが見つかりません</h1>
        <Link href="/" className="inline-block px-4 py-2 rounded-lg bg-black text-white">
          一覧に戻る
        </Link>
      </main>
    );
  }

  const remainingSeats =
    typeof event.maxCapacity === "number" ? Math.max(event.maxCapacity - soldCount, 0) : null;
  const isSoldOut = remainingSeats !== null && remainingSeats <= 0;
  const isPrivate = event.isPublished === false;
  const quantityOptions = remainingSeats !== null
    ? Array.from({ length: Math.min(Math.max(remainingSeats, 0), 5) }, (_, index) => index + 1)
    : [1, 2, 3, 4, 5];

  async function handleCheckout() {
    if (isSoldOut) {
      alert("このイベントは満席です。");
      return;
    }

    if (isPrivate) {
      alert("このイベントは非公開のため購入できません。");
      return;
    }

    setCheckoutLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const accessToken = (await supabase?.auth.getSession())?.data.session?.access_token;
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          eventId: event.id,
          title: event.title,
          price: event.price,
          quantity,
          customerEmail: email || undefined,
        }),
      });

      const rawText = await response.text();
      let data: { url?: string; error?: string } = {};

      if (rawText) {
        try {
          data = JSON.parse(rawText) as { url?: string; error?: string };
        } catch {
          data = { error: rawText };
        }
      }

      if (!response.ok || !data.url) {
        alert(data.error ?? "決済ページの作成に失敗しました。");
        setCheckoutLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "決済ページの作成に失敗しました。";
      alert(message);
      setCheckoutLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 bg-white text-gray-900">
      <SiteHeader />
      {event.imageUrl ? (
        <Image
          src={event.imageUrl}
          alt={event.title}
          width={1600}
          height={960}
          unoptimized={event.imageUrl.startsWith("data:")}
          className="mb-6 h-72 w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="mb-6 flex h-72 w-full items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
          No Image
        </div>
      )}
      <p className="text-sm text-gray-500 mb-2">イベントID: {event.id}</p>
      <p className="inline-block mb-3 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
        {event.category}
      </p>
      {canViewUnpublished ? (
        <p className="mb-3 inline-block rounded-full bg-amber-50 px-3 py-1 text-sm text-amber-700">
          非公開イベント
        </p>
      ) : null}
      <h1 className="text-3xl font-bold mb-3">{event.title}</h1>
      <div className="mb-6 space-y-2 text-lg">
        <p>日時: {event.date}</p>
        <p>場所: {event.location}</p>
        <p>料金: ¥{event.price.toLocaleString()}</p>
        <p>
          {event.maxCapacity
            ? `残席: ${remainingSeats} / ${event.maxCapacity}`
            : "残席: 制限なし"}
        </p>
      </div>
      <p className="mb-8 text-gray-600 whitespace-pre-line">{event.description}</p>
      <div className="mb-6 max-w-md space-y-4 rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h2 className="text-xl font-semibold">チケット購入</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">枚数</label>
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full rounded-lg border px-3 py-2"
            disabled={isSoldOut}
          >
            {quantityOptions.map((count) => (
              <option key={count} value={count}>
                {count}枚
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="購入確認用。未入力でも進めます"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
        <p className="text-sm text-gray-600">
          合計: ¥{(event.price * quantity).toLocaleString()}
        </p>
        {session ? (
          <p className="text-sm text-gray-500">イベント前日までキャンセル可能です。</p>
        ) : (
          <p className="text-sm text-gray-500">ログインすると購入後のキャンセル管理ができます。</p>
        )}
        <button
          type="button"
          onClick={handleCheckout}
          disabled={checkoutLoading || isSoldOut || isPrivate}
          className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isPrivate
            ? "非公開イベント"
            : isSoldOut
            ? "満席です"
            : checkoutLoading
              ? "決済ページを作成中..."
              : "チケットを購入"}
        </button>
      </div>
      {isSoldOut && !isPrivate ? (
        <div className="mb-6 max-w-md space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <h2 className="text-xl font-semibold">オンライン申込は満席です</h2>
          <p className="text-sm text-gray-700">
            当日枠がある場合は、会場受付で当日支払いにて案内してください。
          </p>
          <p className="text-sm text-gray-600">
            事前決済は停止しています。入場可否は当日の運営判断で対応します。
          </p>
        </div>
      ) : null}
      <div className="flex gap-3">
        <Link href="/" className="px-4 py-2 rounded-lg border border-gray-300">
          一覧に戻る
        </Link>
      </div>
    </main>
  );
}
