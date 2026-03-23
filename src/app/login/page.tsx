"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { canUseSupabase, getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  useEffect(() => {
    if (!loading && session) {
      router.push("/create");
    }
  }, [loading, router, session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase未設定のためログインは使えません。");
      return;
    }

    const redirectBase =
      configuredAppUrl || (typeof window !== "undefined" ? window.location.origin : "");
    if (!redirectBase) {
      setMessage("ログインの戻り先URLが未設定です。");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${redirectBase}/create`,
      },
    });

    if (error) {
      setMessage(`ログインメール送信に失敗しました: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setMessage("ログイン用メールを送りました。メールを開いてログインを完了してください。");
    setIsSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <div className="mx-auto max-w-2xl">
        <SiteHeader />
        <div className="rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h1 className="mb-3 text-3xl font-bold">主催者ログイン</h1>
          <p className="mb-6 text-gray-600">
            メールアドレスにログインリンクを送ります。リンクを開くとイベント作成ができるようになります。
          </p>

          {canUseSupabase() ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block font-medium">メールアドレス</label>
                <input
                  type="email"
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
              >
                {isSubmitting ? "送信中..." : "ログインメールを送る"}
              </button>
            </form>
          ) : (
            <p className="text-gray-600">Supabase未設定ではログインは不要です。</p>
          )}

          {message ? <p className="mt-4 text-sm text-gray-600">{message}</p> : null}
        </div>
      </div>
    </main>
  );
}
