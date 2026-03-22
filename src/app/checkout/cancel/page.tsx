import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function CheckoutCancelPage() {
  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <SiteHeader />
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="mb-3 text-3xl font-bold">購入を中止しました</h1>
        <p className="mb-6 text-gray-600">
          まだ決済は完了していません。内容を確認してから、もう一度購入できます。
        </p>
        <Link href="/" className="rounded-lg border border-gray-300 px-4 py-2">
          イベント一覧に戻る
        </Link>
      </div>
    </main>
  );
}
