"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { EventItem } from "@/lib/events";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

export default function CreateEventPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ナイト");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
  }

  function convertFileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(new Error("画像の読み込みに失敗しました。"));
      };
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      reader.readAsDataURL(file);
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const numericPrice = Number(price);
      let imageUrl = "";
      const newEvent: EventItem = {
        id: Date.now(),
        title,
        category,
        date,
        price: numericPrice,
        maxCapacity: maxCapacity ? Number(maxCapacity) : null,
        location,
        description,
        imageUrl,
        hostUserId: session?.user.id,
        isPublished,
      };

      if (canUseSupabase()) {
        const supabase = getSupabaseBrowserClient();

        if (supabase) {
          if (!session) {
            alert("イベント作成にはログインが必要です。");
            setIsSubmitting(false);
            router.push("/login");
            return;
          }

          if (imageFile) {
            const fileExt = imageFile.name.split(".").pop() ?? "jpg";
            const baseName = imageFile.name.replace(/\.[^/.]+$/, "");
            const sanitizedFileName = baseName.replace(/[^a-zA-Z0-9-]/g, "-");
            const filePath = `${Date.now()}-${sanitizedFileName}.${fileExt}`;

            const uploadResult = await supabase.storage
              .from("event-images")
              .upload(filePath, imageFile, { upsert: false });

            if (uploadResult.error) {
              alert(`画像アップロードに失敗しました: ${uploadResult.error.message}`);
              setIsSubmitting(false);
              return;
            }

            const publicUrlResult = supabase.storage.from("event-images").getPublicUrl(filePath);
            imageUrl = publicUrlResult.data.publicUrl;
            newEvent.imageUrl = imageUrl;
          }

          const { error } = await supabase.from("events").insert({
            title: newEvent.title,
            category: newEvent.category,
            date: newEvent.date,
            price: newEvent.price,
            max_capacity: newEvent.maxCapacity,
            location: newEvent.location,
            description: newEvent.description,
            image_url: newEvent.imageUrl,
            host_user_id: session.user.id,
            is_published: newEvent.isPublished,
          });

          if (error) {
            alert(`Supabase保存に失敗しました: ${error.message}`);
            setIsSubmitting(false);
            return;
          }
        }
      } else {
        if (imageFile) {
          imageUrl = await convertFileToDataUrl(imageFile);
          newEvent.imageUrl = imageUrl;
        }

        const existing = localStorage.getItem("events");
        const events: EventItem[] = existing ? JSON.parse(existing) : [];
        events.unshift(newEvent);
        localStorage.setItem("events", JSON.stringify(events));
      }

      router.push(isPublished ? "/" : "/my-events");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存に失敗しました。";
      alert(message);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-white text-gray-900">
      <SiteHeader />
      <h1 className="text-3xl font-bold mb-6">イベントを作成</h1>

      {canUseSupabase() && !loading && !session ? (
        <div className="max-w-xl rounded-2xl border border-gray-200 p-6 shadow-sm">
          <p className="mb-4 text-gray-600">
            主催者ログインをするとイベントを作成できます。
          </p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            ログイン画面へ
          </button>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className={`max-w-xl space-y-4 ${canUseSupabase() && !session ? "pointer-events-none opacity-40" : ""}`}
      >
        <div>
          <label className="block mb-1 font-medium">イベント名</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            placeholder="例: 渋谷ナイト交流会"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">カテゴリ</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>ナイト</option>
            <option>学生</option>
            <option>ウェルネス</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">日時</label>
          <input
            type="datetime-local"
            className="w-full border rounded-lg px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">価格（円）</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="2500"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">定員（任意）</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2"
            placeholder="例: 50"
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">開催場所</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            placeholder="例: 渋谷駅徒歩5分"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
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
          <label className="block mb-1 font-medium">イベント画像</label>
          <input
            type="file"
            accept="image/*"
            className="w-full border rounded-lg px-3 py-2"
            onChange={handleImageChange}
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">説明文</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 min-h-32"
            placeholder="イベントの雰囲気、参加条件、持ち物などを書く"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {isSubmitting ? "保存中..." : "作成する"}
        </button>
      </form>
    </main>
  );
}
