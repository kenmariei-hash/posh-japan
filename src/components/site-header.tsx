"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

export function SiteHeader() {
  const router = useRouter();
  const { session, loading } = useAuth();

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  return (
    <header className="mb-8 flex items-center justify-between gap-4 border-b border-gray-200 pb-4">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        POSH JAPAN
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-gray-600">
          一覧
        </Link>
        <Link href="/dashboard" className="text-sm text-gray-600">
          ダッシュボード
        </Link>
        <Link href="/my-tickets" className="text-sm text-gray-600">
          購入記録
        </Link>
        <Link href="/my-events" className="text-sm text-gray-600">
          自分のイベント
        </Link>
        {canUseSupabase() ? (
          loading ? (
            <span className="text-sm text-gray-500">確認中...</span>
          ) : session ? (
            <>
              <span className="max-w-44 truncate text-sm text-gray-500">
                {session.user.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                ログアウト
              </button>
            </>
          ) : (
            <Link href="/login" className="rounded-lg bg-black px-3 py-2 text-sm text-white">
              ログイン
            </Link>
          )
        ) : (
          <span className="text-sm text-gray-500">ローカルモード</span>
        )}
      </div>
    </header>
  );
}
