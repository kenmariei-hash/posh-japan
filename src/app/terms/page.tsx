import { SiteHeader } from "@/components/site-header";

const termsSections = [
  {
    title: "第1条 適用",
    body: "本規約は、POSH JAPANが提供するイベント掲載、申込、決済、受付その他一切の機能の利用条件を定めるものです。利用者は、本サービスを利用した時点で本規約に同意したものとみなします。",
  },
  {
    title: "第2条 アカウント",
    body: "利用者は、自己の責任でアカウント情報を管理するものとします。ログイン情報の漏えい、不正利用その他アカウント管理不備により生じた損害について、当社に故意または重過失がある場合を除き責任を負いません。",
  },
  {
    title: "第3条 イベント掲載と申込",
    body: "主催者は、掲載内容を正確に管理し、法令、公序良俗および第三者の権利を侵害しない範囲でイベントを掲載するものとします。参加者は、各イベントページに表示された条件、日時、会場、キャンセル条件を確認したうえで申込を行うものとします。",
  },
  {
    title: "第4条 決済とキャンセル",
    body: "チケット代金の決済は、当社が指定する外部決済事業者を通じて行われます。キャンセル可否、期限および返金有無はイベントページまたは当社所定のルールに従います。返金処理の反映時期はカード会社等により異なります。",
  },
  {
    title: "第5条 禁止事項",
    body: "利用者は、虚偽情報の登録、法令違反行為、迷惑行為、不正決済、システム妨害、他者の権利侵害、反社会的勢力への利益供与その他当社が不適切と判断する行為を行ってはなりません。",
  },
  {
    title: "第6条 サービス停止等",
    body: "当社は、保守、障害対応、通信回線障害、不可抗力その他運営上必要がある場合、事前通知なく本サービスの全部または一部を停止または変更できるものとします。",
  },
  {
    title: "第7条 免責",
    body: "イベントの実施、内容、安全管理、参加者間トラブル等は主催者と参加者の責任で処理されるものとします。当社は、本サービス提供に関して通常生ずべき範囲を超える損害について責任を負いません。ただし、法令上制限される場合を除きます。",
  },
  {
    title: "第8条 規約変更",
    body: "当社は、必要に応じて本規約を変更できます。変更後の規約は、本サービス上に掲示した時点または別途定める時点で効力を生じます。",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white p-6 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <SiteHeader />
        <h1 className="mb-2 text-3xl font-bold">利用規約</h1>
        <p className="mb-8 text-sm text-gray-500">最終更新日: 2026年3月20日</p>

        <div className="space-y-8">
          {termsSections.map((section) => (
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
