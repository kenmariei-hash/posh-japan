"use client";

import jsQR from "jsqr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

type EventSummary = {
  id: number;
  title: string;
  date: string;
  location: string;
  host_user_id?: string;
};

type PurchaseLookup = {
  id: number;
  ticket_code: string;
  checked_in: boolean;
  checked_in_at?: string | null;
  cancelled_at?: string | null;
  quantity: number;
  total_amount: number;
  customer_email?: string | null;
};

type RecentPurchase = PurchaseLookup & {
  payment_status?: string | null;
  created_at?: string | null;
};

type PurchaseSummaryRow = {
  quantity: number;
  checked_in?: boolean | null;
};

function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export default function EventCheckInPage() {
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [ticketCode, setTicketCode] = useState("");
  const [lookup, setLookup] = useState<PurchaseLookup | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [doorSaving, setDoorSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [imageReading, setImageReading] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [totalPurchaseCount, setTotalPurchaseCount] = useState(0);
  const [totalCheckedInCount, setTotalCheckedInCount] = useState(0);
  const [doorQuantity, setDoorQuantity] = useState(1);
  const [doorAmount, setDoorAmount] = useState(0);
  const [doorEmail, setDoorEmail] = useState("");

  function stopScanner() {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScannerOpen(false);
    setScannerLoading(false);
  }

  async function loadRecentPurchases(eventId: number) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const { data } = await supabase
      .from("purchases")
      .select(
        "id, ticket_code, checked_in, checked_in_at, cancelled_at, quantity, total_amount, customer_email, payment_status, created_at",
      )
      .eq("event_id", eventId)
      .order("id", { ascending: false })
      .limit(10);

    setRecentPurchases((data as RecentPurchase[] | null) ?? []);
  }

  async function loadSummaryCounts(eventId: number) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const { data } = await supabase
      .from("purchases")
      .select("quantity, checked_in")
      .eq("event_id", eventId)
      .neq("payment_status", "cancelled");

    const rows = (data as PurchaseSummaryRow[] | null) ?? [];
    setTotalPurchaseCount(rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0));
    setTotalCheckedInCount(
      rows.reduce(
        (sum, row) => sum + (row.checked_in ? Number(row.quantity ?? 0) : 0),
        0,
      ),
    );
  }

  useEffect(() => {
    setScannerSupported(
      typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    );
  }, []);

  useEffect(() => {
    async function loadEvent() {
      if (!canUseSupabase() || !session) {
        setPageLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setPageLoading(false);
        return;
      }

      const { data } = await supabase
        .from("events")
        .select("id, title, date, location, host_user_id")
        .eq("id", Number(params.id))
        .eq("host_user_id", session.user.id)
        .maybeSingle();

      const nextEvent = (data as EventSummary | null) ?? null;
      setEvent(nextEvent);
      if (nextEvent) {
        await Promise.all([loadRecentPurchases(nextEvent.id), loadSummaryCounts(nextEvent.id)]);
      }
      setPageLoading(false);
    }

    loadEvent();
  }, [params.id, session]);

  useEffect(() => stopScanner, []);
  useEffect(() => {
    inputRef.current?.focus();
  }, [lookup, resultMessage]);

  async function handleLookup(eventObject: React.FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    setResultMessage("");
    setLookup(null);

    const normalizedCode = ticketCode.trim().toUpperCase();
    if (!normalizedCode) {
      setResultMessage("受付コードを入力してください。");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !event) {
      setResultMessage("受付画面の初期化に失敗しました。");
      return;
    }

    const { data, error } = await supabase
      .from("purchases")
      .select("id, ticket_code, checked_in, checked_in_at, cancelled_at, quantity, total_amount, customer_email")
      .eq("event_id", event.id)
      .eq("ticket_code", normalizedCode)
      .maybeSingle();

    if (error) {
      setResultMessage(`検索に失敗しました: ${error.message}`);
      return;
    }

    if (!data) {
      setResultMessage("該当するチケットが見つかりません。");
      return;
    }

    if (data.cancelled_at) {
      setResultMessage("このチケットはキャンセル済みです。");
    }

    setLookup(data as PurchaseLookup);
  }

  async function handleCheckIn() {
    if (!lookup) {
      return;
    }

    if (lookup.checked_in) {
      setResultMessage("このチケットはすでに使用済みです。");
      return;
    }

    if (lookup.cancelled_at) {
      setResultMessage("このチケットはキャンセル済みです。");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setResultMessage("Supabase の初期化に失敗しました。");
      return;
    }

    setSaving(true);
    const checkedInAt = new Date().toISOString();
    const { error } = await supabase
      .from("purchases")
      .update({ checked_in: true, checked_in_at: checkedInAt })
      .eq("id", lookup.id);

    if (error) {
      setResultMessage(`チェックインに失敗しました: ${error.message}`);
      setSaving(false);
      return;
    }

    setLookup((current) =>
      current
        ? {
            ...current,
            checked_in: true,
            checked_in_at: checkedInAt,
          }
        : current,
    );
    setResultMessage("チェックイン完了です。入場済みに更新しました。");
    if (event) {
      await Promise.all([loadRecentPurchases(event.id), loadSummaryCounts(event.id)]);
    }
    setTicketCode("");
    setSaving(false);
  }

  async function quickCheckIn(purchase: RecentPurchase) {
    if (purchase.checked_in || purchase.cancelled_at) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setResultMessage("Supabase の初期化に失敗しました。");
      return;
    }

    setSaving(true);
    const checkedInAt = new Date().toISOString();
    const { error } = await supabase
      .from("purchases")
      .update({ checked_in: true, checked_in_at: checkedInAt })
      .eq("id", purchase.id);

    if (error) {
      setResultMessage(`チェックインに失敗しました: ${error.message}`);
      setSaving(false);
      return;
    }

    setLookup({
      id: purchase.id,
      ticket_code: purchase.ticket_code,
      checked_in: true,
      checked_in_at: checkedInAt,
      cancelled_at: purchase.cancelled_at,
      quantity: purchase.quantity,
      total_amount: purchase.total_amount,
      customer_email: purchase.customer_email,
    });
    setResultMessage(`受付コード ${purchase.ticket_code} を入場済みに更新しました。`);
    if (event) {
      await Promise.all([loadRecentPurchases(event.id), loadSummaryCounts(event.id)]);
    }
    setTicketCode("");
    setSaving(false);
  }

  async function runTicketLookup(code: string) {
    setTicketCode(code);
    setResultMessage("");
    setLookup(null);

    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setResultMessage("受付コードを入力してください。");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !event) {
      setResultMessage("受付画面の初期化に失敗しました。");
      return;
    }

    const { data, error } = await supabase
      .from("purchases")
      .select("id, ticket_code, checked_in, checked_in_at, cancelled_at, quantity, total_amount, customer_email")
      .eq("event_id", event.id)
      .eq("ticket_code", normalizedCode)
      .maybeSingle();

    if (error) {
      setResultMessage(`検索に失敗しました: ${error.message}`);
      return;
    }

    if (!data) {
      setResultMessage("該当するチケットが見つかりません。");
      return;
    }

    if (data.cancelled_at) {
      setResultMessage("このチケットはキャンセル済みです。");
    }

    setLookup(data as PurchaseLookup);
  }

  async function startScanner() {
    if (!scannerSupported || scannerLoading) {
      return;
    }

    setScannerLoading(true);
    setResultMessage("");

    try {
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch {
          stream = null;
        }
      }

      if (!stream) {
        setResultMessage("カメラを起動できませんでした。Safariのカメラ許可を確認してください。");
        setScannerLoading(false);
        return;
      }

      streamRef.current = stream;
      setScannerOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise<void>((resolve) => {
          const video = videoRef.current;
          if (!video) {
            resolve();
            return;
          }

          if (video.readyState >= 2) {
            resolve();
            return;
          }

          const onLoaded = () => {
            video.removeEventListener("loadedmetadata", onLoaded);
            resolve();
          };

          video.addEventListener("loadedmetadata", onLoaded);
          window.setTimeout(() => {
            video.removeEventListener("loadedmetadata", onLoaded);
            resolve();
          }, 1500);
        });

        await videoRef.current.play().catch(() => undefined);
      }

      scanIntervalRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
          return;
        }

        try {
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (!width || !height) {
            return;
          }

          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) {
            return;
          }

          context.drawImage(video, 0, 0, width, height);
          const imageData = context.getImageData(0, 0, width, height);
          const result = jsQR(imageData.data, imageData.width, imageData.height);
          const rawValue = result?.data?.trim();
          if (!rawValue) {
            return;
          }

          stopScanner();
          await runTicketLookup(rawValue);
        } catch {
          setResultMessage("QRの読み取りに失敗しました。コードを手入力してください。");
          stopScanner();
        }
      }, 700);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "カメラの起動に失敗しました。";
      setResultMessage(`QR読み取りを開始できません: ${message}`);
      stopScanner();
    } finally {
      setScannerLoading(false);
    }
  }

  async function handleImageUpload(eventObject: React.ChangeEvent<HTMLInputElement>) {
    const file = eventObject.target.files?.[0];
    if (!file) {
      return;
    }

    setImageReading(true);
    setResultMessage("");

    try {
      const imageUrl = URL.createObjectURL(file);
      const image = new window.Image();
      image.src = imageUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      });

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("QR解析の初期化に失敗しました。");
      }

      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("画像解析の準備に失敗しました。");
      }

      context.drawImage(image, 0, 0, image.width, image.height);
      const imageData = context.getImageData(0, 0, image.width, image.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);

      URL.revokeObjectURL(imageUrl);

      if (!result?.data?.trim()) {
        throw new Error("QRコードを読み取れませんでした。");
      }

      await runTicketLookup(result.data.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR画像の読み取りに失敗しました。";
      setResultMessage(message);
    } finally {
      eventObject.target.value = "";
      setImageReading(false);
    }
  }

  async function handleDownloadCsv() {
    if (!event) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setResultMessage("CSV出力の初期化に失敗しました。");
      return;
    }

    setDownloading(true);
    setResultMessage("");

    const { data, error } = await supabase
      .from("purchases")
      .select(
        "id, ticket_code, checked_in, checked_in_at, cancelled_at, quantity, total_amount, customer_email, payment_status, created_at",
      )
      .eq("event_id", event.id)
      .order("id", { ascending: false });

    if (error) {
      setResultMessage(`CSV出力に失敗しました: ${error.message}`);
      setDownloading(false);
      return;
    }

    const rows = (data as RecentPurchase[] | null) ?? [];
    if (rows.length === 0) {
      setResultMessage("出力できる参加者データがまだありません。");
      setDownloading(false);
      return;
    }

    const csvRows = [
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
      ].join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.ticket_code,
          row.customer_email || "",
          row.quantity,
          row.total_amount,
          row.payment_status,
          row.checked_in ? "used" : "unused",
          row.checked_in_at ? new Date(row.checked_in_at).toISOString() : "",
          row.cancelled_at ? new Date(row.cancelled_at).toISOString() : "",
          row.created_at ? new Date(row.created_at).toISOString() : "",
        ]
          .map((cell) => escapeCsvCell(cell))
          .join(","),
      ),
    ];

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = event.title.replaceAll(/[\\/:*?"<>|]/g, "-");
    link.href = url;
    link.download = `${safeTitle}-participants.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setResultMessage("参加者CSVをダウンロードしました。");
    setDownloading(false);
  }

  async function handleCreateDoorPurchase(eventObject: React.FormEvent<HTMLFormElement>) {
    eventObject.preventDefault();
    if (!event) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    if (!token) {
      setResultMessage("door参加者を追加するにはログインが必要です。");
      return;
    }

    setDoorSaving(true);
    setResultMessage("");

    const response = await fetch(`/api/events/${event.id}/door`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        quantity: doorQuantity,
        totalAmount: doorAmount,
        customerEmail: doorEmail || undefined,
        checkedIn: true,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      purchase?: PurchaseLookup;
    };

    if (!response.ok || !data.purchase) {
      setResultMessage(data.error ?? "door参加者の追加に失敗しました。");
      setDoorSaving(false);
      return;
    }

    setLookup(data.purchase);
    setResultMessage(data.message ?? "door参加者を追加しました。");
    setDoorQuantity(1);
    setDoorAmount(0);
    setDoorEmail("");
    if (event) {
      await Promise.all([loadRecentPurchases(event.id), loadSummaryCounts(event.id)]);
    }
    setDoorSaving(false);
  }

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold">主催者受付</h1>
        <p className="mb-6 text-gray-600">受付コードを入力して入場済みに更新します。</p>

        {canUseSupabase() && !loading && !session ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">受付画面を見るにはログインが必要です。</p>
            <Link href="/login" className="rounded-lg bg-black px-4 py-2 text-white">
              ログイン画面へ
            </Link>
          </div>
        ) : null}

        {pageLoading ? <p>読み込み中...</p> : null}

        {!pageLoading && session && !event ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">このイベントの受付権限がありません。</p>
            <Link href="/my-events" className="rounded-lg bg-black px-4 py-2 text-white">
              自分のイベントへ戻る
            </Link>
          </div>
        ) : null}

        {event ? (
          <div className="grid gap-6">
            <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
              <p className="text-sm text-gray-500">受付対象イベント</p>
              <h2 className="mt-1 text-2xl font-semibold">{event.title}</h2>
              <p className="text-gray-600">{event.date}</p>
              <p className="text-gray-600">{event.location}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">入場済み累計</p>
                  <p className="text-3xl font-bold">{totalCheckedInCount}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-sm text-gray-500">購入記録累計</p>
                  <p className="text-3xl font-bold">{totalPurchaseCount}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={downloading}
                className="mt-4 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {downloading ? "CSV作成中..." : "参加者CSVをダウンロード"}
              </button>
            </div>

            <form
              onSubmit={handleCreateDoorPurchase}
              className="rounded-2xl border border-gray-200 p-6 shadow-sm"
            >
              <h3 className="text-xl font-semibold">door支払いを記録</h3>
              <p className="mt-1 text-sm text-gray-600">
                当日現金払いの参加者を追加し、そのまま入場済みにします。
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">枚数</label>
                  <input
                    type="number"
                    min={1}
                    value={doorQuantity}
                    onChange={(eventObject) => setDoorQuantity(Number(eventObject.target.value))}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">金額</label>
                  <input
                    type="number"
                    min={0}
                    value={doorAmount}
                    onChange={(eventObject) => setDoorAmount(Number(eventObject.target.value))}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">メールアドレス</label>
                  <input
                    type="email"
                    value={doorEmail}
                    onChange={(eventObject) => setDoorEmail(eventObject.target.value)}
                    placeholder="任意"
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={doorSaving}
                className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {doorSaving ? "追加中..." : "door参加者を追加"}
              </button>
            </form>

            <form onSubmit={handleLookup} className="rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <label className="block font-medium">受付コード</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startScanner}
                    disabled={!scannerSupported || scannerLoading || scannerOpen}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {scannerLoading ? "カメラ起動中..." : "QRを読む"}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageReading}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {imageReading ? "画像解析中..." : "画像から読む"}
                  </button>
                  {scannerOpen ? (
                    <button
                      type="button"
                      onClick={stopScanner}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                    >
                      カメラを閉じる
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                ref={inputRef}
                value={ticketCode}
                onChange={(eventObject) => setTicketCode(eventObject.target.value.toUpperCase())}
                placeholder="例: PJ-12-ABCD1234"
                className="mb-4 w-full rounded-xl border border-gray-300 px-4 py-3 font-mono tracking-[0.2em]"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {scannerOpen ? (
                <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-black">
                  <video
                    ref={videoRef}
                    className="aspect-video w-full object-cover"
                    muted
                    playsInline
                    autoPlay
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              ) : null}
              {!scannerSupported ? (
                <p className="mb-4 text-sm text-gray-500">
                  この端末ではカメラが使えません。受付コードを手入力してください。
                </p>
              ) : (
                <p className="mb-4 text-sm text-gray-500">
                  Safariでカメラが黒い場合は、チケット画面のQRをスクショして `画像から読む` を使ってください。
                </p>
              )}
              <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
                チケットを検索
              </button>
            </form>

            {resultMessage ? (
              <div className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-700 shadow-sm">
                {resultMessage}
              </div>
            ) : null}

            {lookup ? (
              <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="mb-1 text-sm text-gray-500">検索結果</p>
                <p className="font-mono text-2xl font-bold">{lookup.ticket_code}</p>
                <div className="mt-4 grid gap-2 text-gray-700">
                  <p>枚数: {lookup.quantity}</p>
                  <p>金額: ¥{lookup.total_amount.toLocaleString()}</p>
                  <p>メール: {lookup.customer_email || "未入力"}</p>
                  <p>入場状態: {lookup.cancelled_at ? "キャンセル済み" : lookup.checked_in ? "使用済み" : "未使用"}</p>
                  <p>
                    使用時刻:{" "}
                    {lookup.checked_in_at
                      ? new Date(lookup.checked_in_at).toLocaleString("ja-JP")
                      : "未使用"}
                  </p>
                  <p>
                    キャンセル時刻:{" "}
                    {lookup.cancelled_at
                      ? new Date(lookup.cancelled_at).toLocaleString("ja-JP")
                      : "未キャンセル"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={saving || lookup.checked_in || Boolean(lookup.cancelled_at)}
                  className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
                >
                  {lookup.cancelled_at
                    ? "キャンセル済みチケット"
                    : lookup.checked_in
                      ? "すでに使用済み"
                      : saving
                        ? "更新中..."
                        : "入場済みにする"}
                </button>
                <div className="mt-3">
                  <Link
                    href={`/tickets/${lookup.id}`}
                    className="rounded-lg border border-gray-300 px-4 py-2"
                  >
                    チケットを見る
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">最近の受付履歴</p>
                  <h3 className="text-xl font-semibold">直近10件</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (event) {
                      void Promise.all([loadRecentPurchases(event.id), loadSummaryCounts(event.id)]);
                    }
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  更新
                </button>
              </div>

              {recentPurchases.length === 0 ? (
                <p className="text-gray-600">まだ購入記録はありません。</p>
              ) : (
                <div className="grid gap-3">
                  {recentPurchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="rounded-xl border border-gray-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-lg font-bold">{purchase.ticket_code}</p>
                          <p className="text-sm text-gray-500">
                            {purchase.customer_email || "メール未入力"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-sm ${
                            purchase.cancelled_at
                              ? "bg-gray-200 text-gray-700"
                              : purchase.checked_in
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {purchase.cancelled_at
                            ? "キャンセル済み"
                            : purchase.checked_in
                              ? "使用済み"
                              : "未使用"}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-1 text-sm text-gray-600">
                        <p>枚数: {purchase.quantity}</p>
                        <p>金額: ¥{purchase.total_amount.toLocaleString()}</p>
                        <p>支払い状態: {purchase.payment_status}</p>
                        <p>
                          使用時刻:{" "}
                          {purchase.checked_in_at
                            ? new Date(purchase.checked_in_at).toLocaleString("ja-JP")
                            : "未使用"}
                        </p>
                        <p>
                          キャンセル時刻:{" "}
                          {purchase.cancelled_at
                            ? new Date(purchase.cancelled_at).toLocaleString("ja-JP")
                            : "未キャンセル"}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {!purchase.checked_in && !purchase.cancelled_at ? (
                          <button
                            type="button"
                            onClick={() => quickCheckIn(purchase)}
                            disabled={saving}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
                          >
                            すぐ入場済みにする
                          </button>
                        ) : null}
                        <Link
                          href={`/tickets/${purchase.id}`}
                          className="rounded-lg border border-gray-300 px-3 py-2"
                        >
                          チケットを見る
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
