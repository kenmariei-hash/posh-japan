"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { defaultEvents, EventItem, getFallbackEvents, normalizeEvent } from "@/lib/events";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

export default function Home() {
  const [events, setEvents] = useState<EventItem[]>(defaultEvents);

  useEffect(() => {
    async function loadEvents() {
      if (canUseSupabase()) {
        const supabase = getSupabaseBrowserClient();

        if (supabase) {
          const { data, error } = await supabase
            .from("events")
            .select("id, title, category, date, price, max_capacity, location, description, image_url, is_published")
            .eq("is_published", true)
            .order("id", { ascending: false });

          if (!error && data) {
            setEvents(data.map(normalizeEvent));
            return;
          }
        }
      }

      setEvents(getFallbackEvents());
    }

    loadEvents();
  }, []);

  return (
    <main className="min-h-screen bg-white text-gray-900 p-6">
      <SiteHeader />
      <h1 className="text-3xl font-bold mb-2">POSH JAPAN</h1>
      <p className="text-gray-600 mb-4">今夜・週末のイベントを見つけよう</p>

      <Link
        href="/create"
        className="inline-block mb-6 px-4 py-2 rounded-lg bg-blue-600 text-white"
      >
        イベントを作成する
      </Link>

      <div className="grid gap-4">
        {events.map((event) => (
          <div key={event.id} className="border rounded-xl p-4 shadow-sm">
            {event.imageUrl ? (
              <Image
                src={event.imageUrl}
                alt={event.title}
                width={1200}
                height={720}
                unoptimized={event.imageUrl.startsWith("data:")}
                className="mb-4 h-48 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="mb-4 flex h-48 w-full items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                No Image
              </div>
            )}
            <p className="text-sm text-blue-600 mb-1">{event.category}</p>
            <h2 className="text-xl font-semibold">{event.title}</h2>
            <p className="text-gray-600">{event.date}</p>
            <p className="text-gray-600">{event.location}</p>
            <p className="text-gray-600">
              {event.maxCapacity ? `定員 ${event.maxCapacity}名` : "定員なし"}
            </p>
            <p className="font-bold mt-2">¥{event.price.toLocaleString()}</p>
            <Link
              href={`/events/${event.id}`}
              className="inline-block mt-3 px-4 py-2 rounded-lg bg-black text-white"
            >
              詳細を見る
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
