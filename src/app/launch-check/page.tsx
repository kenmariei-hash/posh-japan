import { SiteHeader } from "@/components/site-header";
import { hasPlaceholderLegalInfo, siteConfig } from "@/lib/site-config";

type CheckItem = {
  label: string;
  status: "ok" | "warn";
  detail: string;
};

function buildChecks(): CheckItem[] {
  const checks: CheckItem[] = [];

  checks.push({
    label: "事業者情報",
    status: hasPlaceholderLegalInfo() ? "warn" : "ok",
    detail: hasPlaceholderLegalInfo()
      ? "運営者名、住所、電話番号、メールアドレスに仮値が残っています。"
      : "特商法ページの事業者情報は実値です。",
  });

  checks.push({
    label: "Stripe",
    status: process.env.STRIPE_SECRET_KEY ? "ok" : "warn",
    detail: process.env.STRIPE_SECRET_KEY
      ? "決済用の秘密鍵が設定されています。"
      : "STRIPE_SECRET_KEY が未設定です。",
  });

  checks.push({
    label: "Supabase",
    status:
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "ok"
        : "warn",
    detail:
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "接続に必要な環境変数が揃っています。"
        : "Supabase の環境変数が不足しています。",
  });

  checks.push({
    label: "メール送信",
    status: process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? "ok" : "warn",
    detail:
      process.env.RESEND_API_KEY && process.env.EMAIL_FROM
        ? "購入確認・通知メールの設定があります。"
        : "RESEND_API_KEY または EMAIL_FROM が未設定です。",
  });

  checks.push({
    label: "公開URL",
    status: process.env.NEXT_PUBLIC_APP_URL ? "ok" : "warn",
    detail: process.env.NEXT_PUBLIC_APP_URL
      ? `現在の設定: ${process.env.NEXT_PUBLIC_APP_URL}`
      : "NEXT_PUBLIC_APP_URL が未設定です。",
  });

  return checks;
}

const releaseSteps = [
  "特商法ページの事業者情報を実値へ差し替える",
  "本番ドメインへ NEXT_PUBLIC_APP_URL を合わせる",
  "Resend の送信元ドメインを本番用に切り替える",
  "Stripe を live key へ切り替える前にテスト決済を再確認する",
  "一覧 → 詳細 → 購入 → 購入記録 → チケット → 受付 の導線を1周確認する",
];

export default function LaunchCheckPage() {
  const checks = buildChecks();

  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <SiteHeader />
        <h1 className="mb-2 text-3xl font-bold">公開前チェック</h1>
        <p className="mb-8 text-gray-600">
          本番公開前に必要な設定と未完了項目をまとめています。
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {checks.map((check) => (
            <section
              key={check.label}
              className="rounded-2xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{check.label}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    check.status === "ok"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {check.status === "ok" ? "OK" : "要対応"}
                </span>
              </div>
              <p className="text-sm text-gray-700">{check.detail}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">差し替え対象</h2>
          <div className="grid gap-2 text-sm text-gray-700">
            <p>運営者名: {siteConfig.legal.operatorName}</p>
            <p>住所: {siteConfig.legal.address}</p>
            <p>電話番号: {siteConfig.legal.phone}</p>
            <p>メール: {siteConfig.legal.email}</p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">公開直前チェックリスト</h2>
          <ol className="space-y-3 text-sm text-gray-700">
            {releaseSteps.map((step, index) => (
              <li key={step}>
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
