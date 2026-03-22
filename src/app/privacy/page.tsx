import { SiteHeader } from "@/components/site-header";

const privacySections = [
  {
    title: "1. 取得する情報",
    body: "当社は、アカウント登録情報、メールアドレス、イベント申込情報、決済関連情報、問い合わせ内容、アクセスログその他サービス提供に必要な情報を取得します。カード番号等の機微な決済情報は、原則として決済代行事業者が管理します。",
  },
  {
    title: "2. 利用目的",
    body: "取得した情報は、本人確認、イベント申込処理、決済処理、チケット発行、受付対応、問い合わせ対応、サービス改善、不正利用防止、法令対応のために利用します。",
  },
  {
    title: "3. 第三者提供",
    body: "当社は、法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供しません。ただし、決済、メール送信、認証、インフラ提供等のために業務委託先へ必要な範囲で情報を提供することがあります。",
  },
  {
    title: "4. 安全管理",
    body: "当社は、不正アクセス、漏えい、滅失、毀損等を防止するため、合理的な安全管理措置を講じます。",
  },
  {
    title: "5. 保有期間",
    body: "当社は、利用目的達成に必要な期間または法令で保存義務が課される期間、個人情報を保有します。",
  },
  {
    title: "6. 開示・訂正・削除等",
    body: "本人は、法令に基づき、自己に関する個人情報の開示、訂正、利用停止、削除等を請求できます。請求時は本人確認を行います。",
  },
  {
    title: "7. お問い合わせ",
    body: "個人情報の取扱いに関する問い合わせは、特商法表記ページに記載の連絡先までご連絡ください。",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <SiteHeader />
        <h1 className="mb-2 text-3xl font-bold">プライバシーポリシー</h1>
        <p className="mb-8 text-sm text-gray-500">最終更新日: 2026年3月20日</p>

        <div className="space-y-8">
          {privacySections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-semibold">{section.title}</h2>
              <p className="leading-8 text-gray-700">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
