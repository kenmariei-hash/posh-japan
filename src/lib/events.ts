export type EventItem = {
  id: number;
  title: string;
  category: string;
  date: string;
  price: number;
  location: string;
  description: string;
  imageUrl: string;
  maxCapacity?: number | null;
  hostUserId?: string;
  isPublished?: boolean;
};

export const defaultEvents: EventItem[] = [
  {
    id: 1,
    title: "渋谷ナイト交流会",
    category: "ナイト",
    date: "3/15(土) 20:00",
    price: 2500,
    location: "渋谷駅徒歩5分",
    description: "音楽と会話を楽しみながら、初参加でも入りやすい交流イベントです。",
    imageUrl: "",
    maxCapacity: 80,
    isPublished: true,
  },
  {
    id: 2,
    title: "学生限定カフェ会",
    category: "学生",
    date: "3/16(日) 14:00",
    price: 500,
    location: "下北沢のカフェスペース",
    description: "大学や学年を超えてつながれる、少人数のゆるい交流会です。",
    imageUrl: "",
    maxCapacity: 30,
    isPublished: true,
  },
  {
    id: 3,
    title: "朝ヨガ in 代々木公園",
    category: "ウェルネス",
    date: "3/17(月) 08:00",
    price: 1500,
    location: "代々木公園 中央広場",
    description: "朝の空気の中で体をほぐし、初心者でも参加しやすい屋外ヨガです。",
    imageUrl: "",
    maxCapacity: 20,
    isPublished: true,
  },
];

export function normalizeEvent(event: {
  id: number;
  title: string;
  category: string;
  date: string;
  price: number | string;
  location?: string | null;
  description?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  max_capacity?: number | null;
  maxCapacity?: number | null;
  host_user_id?: string | null;
  hostUserId?: string | null;
  is_published?: boolean | null;
  isPublished?: boolean | null;
}): EventItem {
  const numericPrice =
    typeof event.price === "number"
      ? event.price
      : Number(String(event.price).replace(/[^\d]/g, ""));

  return {
    id: event.id,
    title: event.title,
    category: event.category,
    date: event.date,
    price: numericPrice,
    location: event.location ?? "場所未設定",
    description: event.description ?? "説明はまだありません。",
    imageUrl: event.image_url ?? event.imageUrl ?? "",
    maxCapacity: event.max_capacity ?? event.maxCapacity ?? null,
    hostUserId: event.host_user_id ?? event.hostUserId ?? undefined,
    isPublished: event.is_published ?? event.isPublished ?? true,
  };
}

export function getFallbackEvents() {
  if (typeof window === "undefined") {
    return defaultEvents;
  }

  const saved = localStorage.getItem("events");
  if (!saved) {
    return defaultEvents;
  }

  const parsed = JSON.parse(saved).map(normalizeEvent) as EventItem[];
  return [...parsed, ...defaultEvents];
}

export function getStoredEventsOnly() {
  if (typeof window === "undefined") {
    return [] as EventItem[];
  }

  const saved = localStorage.getItem("events");
  if (!saved) {
    return [] as EventItem[];
  }

  return JSON.parse(saved).map(normalizeEvent) as EventItem[];
}
