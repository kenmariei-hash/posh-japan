"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { canUseSupabase, getSupabaseBrowserClient, type WaitlistRecord } from "@/lib/supabase";

type EventInfo = {
  id: number;
  title: string;
  host_user_id?: string | null;
};

export default function EventWaitlistPage() {
  const params = useParams<{ id: string }>();
  const { session, loading } = useAuth();
  const eventId = Number(params.id);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [entries, setEntries] = useState<WaitlistRecord[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const activeEntries = useMemo(
    () => entries.filter((entry) => !entry.cancelled_at && !entry.converted_at),
    [entries],
  );

  useEffect(() => {
    async function loadWaitlist() {
      if (!canUseSupabase() || !session) {
        setPageLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setPageLoading(false);
        return;
      }

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("id, title, host_user_id")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError || !eventData || eventData.host_user_id !== session.user.id) {
        setPageLoading(false);
        return;
      }

      setEvent(eventData);

      const { data: waitlistData } = await supabase
        .from("waitlist_entries")
        .select("id, event_id, user_id, email, name, notified_at, converted_at, cancelled_at, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      setEntries((waitlistData as WaitlistRecord[] | null) ?? []);
      setPageLoading(false);
    }

    void loadWaitlist();
  }, [eventId, session]);

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-3xl font-bold">待機リスト</h1>
        <p className="mb-6 text-gray-600">満席イベントの待機登録一覧を確認できます。</p>

        {canUseSupabase() && !loading && !session ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">待機リストを見るにはログインが必要です。</p>
            <Link href="/login" className="rounded-lg bg-black px-4 py-2 text-white">
              ログイン画面へ
            </Link>
          </div>
        ) : null}

        {pageLoading ? <p>読み込み中...</p> : null}

        {!pageLoading && session && !event ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">このイベントの待機リストは確認できません。</p>
            <Link href="/my-events" className="rounded-lg border border-gray-300 px-4 py-2">
              自分のイベントへ戻る
            </Link>
          </div>
        ) : null}

        {!pageLoading && event ? (
          <>
            <div className="mb-6 rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-sm text-gray-500">イベントID: {event.id}</p>
              <h2 className="mt-2 text-2xl font-semibold">{event.title}</h2>
              <p className="mt-3 text-gray-600">現在の待機人数: {activeEntries.length}</p>
            </div>

            {activeEntries.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
                <p className="text-gray-600">まだ待機登録はありません。</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeEntries.map((entry, index) => (
                  <div key={entry.id} className="rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-500">順番: {index + 1}</p>
                        <h3 className="mt-1 text-xl font-semibold">{entry.name || "名前未入力"}</h3>
                        <p className="text-gray-600">{entry.email}</p>
                      </div>
                      <div className="text-sm text-gray-500">
                        登録日時:{" "}
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleString("ja-JP")
                          : "不明"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
