"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [message, setMessage] = useState("購入内容を確認しています...");
  const [subMessage, setSubMessage] = useState("");

  useEffect(() => {
    async function confirmCheckout() {
      if (!sessionId) {
        setMessage("決済確認に必要な情報が見つかりませんでした。時間をおいて購入記録をご確認ください。");
        return;
      }

      const response = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      const rawText = await response.text();
      let data: { error?: string; emailStatus?: string; emailError?: string } = {};

      if (rawText) {
        try {
          data = JSON.parse(rawText) as { error?: string };
        } catch {
          data = { error: rawText };
        }
      }

      if (!response.ok) {
        setMessage(data.error ?? "購入記録の保存に失敗しました。");
        return;
      }

      setMessage("購入記録を保存しました。");
      if (data.emailStatus === "sent") {
        setSubMessage("確認メールを送信しました。");
      } else if (data.emailStatus === "failed") {
        setSubMessage(`確認メールの送信に失敗しました。${data.emailError ? ` ${data.emailError}` : ""}`);
      } else {
        setSubMessage("確認メール送信は未設定です。");
      }
    }

    confirmCheckout();
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="mb-3 text-3xl font-bold">購入が完了しました</h1>
        <p className="mb-2 text-gray-600">{message}</p>
        {subMessage ? <p className="mb-6 text-sm text-gray-500">{subMessage}</p> : <div className="mb-6" />}
        <div className="flex gap-3">
          <Link href="/" className="rounded-lg bg-black px-4 py-2 text-white">
            イベント一覧に戻る
          </Link>
          <Link href="/my-tickets" className="rounded-lg border border-gray-300 px-4 py-2">
            購入記録を見る
          </Link>
        </div>
      </div>
    </main>
  );
}
