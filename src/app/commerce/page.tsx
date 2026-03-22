import { SiteHeader } from "@/components/site-header";
import { hasPlaceholderLegalInfo, siteConfig } from "@/lib/site-config";

const commerceItems = [
  ["販売事業者", siteConfig.serviceName],
  ["運営責任者", siteConfig.legal.operatorName],
  ["所在地", siteConfig.legal.address],
  ["電話番号", siteConfig.legal.phone],
  ["メールアドレス", siteConfig.legal.email],
  ["販売価格", "各イベントページに表示された価格"],
  ["商品代金以外の必要料金", "インターネット接続に必要な通信料等は利用者負担です"],
  ["支払方法", "クレジットカードその他当社が指定する決済方法"],
  ["支払時期", "申込時に決済が確定します"],
  ["引渡時期", "決済完了後、購入記録およびチケット画面に表示します"],
  ["キャンセル・返金", "各イベントページおよび当社所定のキャンセルポリシーに従います。イベント前日までキャンセル可能な場合があります"],
  ["動作環境", "最新の主要ブラウザでの利用を推奨します"],
];

export default function CommercePage() {
  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <SiteHeader />
        <h1 className="mb-2 text-3xl font-bold">特定商取引法に基づく表記</h1>
        <p className="mb-8 text-sm text-gray-500">最終更新日: 2026年3月20日</p>

        {hasPlaceholderLegalInfo() ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            公開前に、運営者名・住所・電話番号・メールアドレスを実際の情報へ差し替えてください。
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {commerceItems.map(([label, value]) => (
                <tr key={label} className="border-b border-gray-200 last:border-b-0">
                  <th className="w-1/3 bg-gray-50 px-4 py-4 font-medium text-gray-700">{label}</th>
                  <td className="px-4 py-4 text-gray-700">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          キャンセル・返金条件は各イベントページにも表示されます。個別条件がある場合はイベント説明に明記してください。
        </p>
      </div>
    </main>
  );
}
