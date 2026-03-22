import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

async function browserLockNoop<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) {
  return await fn();
}

export type EventRecord = {
  id: number;
  title: string;
  category: string;
  date: string;
  price: number;
  max_capacity?: number | null;
  location: string;
  description: string;
  image_url?: string;
  host_user_id?: string;
  is_published?: boolean;
  created_at?: string;
};

export type PurchaseRecord = {
  id: number;
  event_id: number;
  stripe_session_id: string;
  buyer_user_id?: string | null;
  customer_email?: string;
  quantity: number;
  total_amount: number;
  payment_status: string;
  ticket_code?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  cancelled_at?: string | null;
  created_at?: string;
};

export type WaitlistRecord = {
  id: number;
  event_id: number;
  user_id?: string | null;
  email: string;
  name?: string | null;
  notified_at?: string | null;
  converted_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string;
};

export function canUseSupabase() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function canUseSupabaseServerClient() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (browserClient) {
    return browserClient;
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      lock: browserLockNoop,
    },
  });
  return browserClient;
}

export function getSupabaseServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  if (serverClient) {
    return serverClient;
  }

  serverClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return serverClient;
}

export function getStoragePathFromPublicUrl(publicUrl: string) {
  const marker = "/storage/v1/object/public/event-images/";
  const index = publicUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return publicUrl.slice(index + marker.length);
}
