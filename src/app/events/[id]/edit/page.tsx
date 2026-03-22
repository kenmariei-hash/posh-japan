"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { normalizeEvent } from "@/lib/events";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = Number(params.id);
  const { session, loading } = useAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ナイト");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      const { data, error } = await supabase
        .from("events")
        .select("id, title, category, date, price, max_capacity, location, description, image_url, host_user_id, is_published")
        .eq("id", eventId)
        .eq("host_user_id", session.user.id)
        .maybeSingle();

      if (error || !data) {
        setPageLoading(false);
        return;
      }

      const event = normalizeEvent(data);
      setTitle(event.title);
      setCategory(event.category);
      setDate(event.date);
      setPrice(String(event.price));
      setMaxCapacity(event.maxCapacity ? String(event.maxCapacity) : "");
      setLocation(event.location);
      setDescription(event.description);
      setIsPublished(event.isPublished ?? true);
      setPageLoading(false);
    }

    loadEvent();
  }, [eventId, session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!session) {
      router.push("/login");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from("events")
      .update({
        title,
        category,
        date,
        price: Number(price),
        max_capacity: maxCapacity ? Number(maxCapacity) : null,
        location,
        description,
        is_published: isPublished,
      })
      .eq("id", eventId)
      .eq("host_user_id", session.user.id);

    if (error) {
      alert(`更新に失敗しました: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    router.push("/my-events");
  }

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold">イベントを編集</h1>

        {canUseSupabase() && !loading && !session ? (
          <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
            <p className="mb-4 text-gray-600">編集するにはログインが必要です。</p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-lg bg-black px-4 py-2 text-white"
            >
              ログイン画面へ
            </button>
          </div>
        ) : null}

        {pageLoading ? <p>読み込み中...</p> : null}

        {!pageLoading && session ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block font-medium">イベント名</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">カテゴリ</label>
              <select
                className="w-full rounded-lg border px-3 py-2"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>ナイト</option>
                <option>学生</option>
                <option>ウェルネス</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium">日時</label>
              <input
                type="datetime-local"
                className="w-full rounded-lg border px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">価格（円）</label>
              <input
                type="number"
                className="w-full rounded-lg border px-3 py-2"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">定員（任意）</label>
              <input
                type="number"
                className="w-full rounded-lg border px-3 py-2"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">公開設定</label>
              <select
                className="w-full rounded-lg border px-3 py-2"
                value={isPublished ? "published" : "private"}
                onChange={(e) => setIsPublished(e.target.value === "published")}
              >
                <option value="published">公開</option>
                <option value="private">非公開</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium">開催場所</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">説明文</label>
              <textarea
                className="min-h-32 w-full rounded-lg border px-3 py-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {isSubmitting ? "更新中..." : "更新する"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/my-events")}
                className="rounded-lg border border-gray-300 px-4 py-2"
              >
                戻る
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </main>
  );
}
