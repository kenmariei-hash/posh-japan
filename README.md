# POSH JAPAN

日本向けイベント集客・チケット販売アプリです。  
学生向けイベント、ナイトイベント、ウェルネスイベントを主な対象にしています。

## 現在できること

- イベント作成 / 編集 / 削除
- 公開 / 非公開の切り替え
- 画像アップロード
- 主催者ログイン
- Stripe Checkout 決済
- 購入記録とチケット表示
- QRコード付きチケット
- 主催者受付 / チェックイン
- door支払い記録
- キャンセル / 返金
- 購入確認メール / キャンセル確認メール
- 主催者向けダッシュボード / CSV出力

## 技術スタック

- Next.js 16
- TypeScript
- Supabase
- Stripe
- Resend
- Tailwind CSS

## ローカル起動

```bash
cd /Users/eitoyasuda/Documents/posh-japan
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 必要な環境変数

`.env.local.example` を参考に `.env.local` を作成してください。

最低限必要なもの:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=
EMAIL_FROM=
```

法務情報を env から差し替える場合:

```env
NEXT_PUBLIC_SERVICE_NAME=POSH JAPAN
NEXT_PUBLIC_LEGAL_OPERATOR_NAME=
NEXT_PUBLIC_LEGAL_ADDRESS=
NEXT_PUBLIC_LEGAL_PHONE=
NEXT_PUBLIC_LEGAL_EMAIL=
```

## Supabase 初期化

Supabase の `SQL Editor` で以下を実行します。

- [supabase-schema.sql](/Users/eitoyasuda/Documents/posh-japan/supabase-schema.sql)

これで必要なテーブル、RLS、Storage bucket が作成されます。

## 本番公開前チェック

必要なら下記ページで設定漏れを確認できます。

- [http://localhost:3000/launch-check](http://localhost:3000/launch-check)

公開前に最低限確認すること:

1. 特商法ページの事業者情報を実値にする
2. `NEXT_PUBLIC_APP_URL` を本番ドメインへ変更する
3. `EMAIL_FROM` を本番送信元ドメインへ変更する
4. Stripe を本番鍵へ切り替える前にテスト決済を再確認する
5. 一覧 → 詳細 → 購入 → 購入記録 → チケット → 受付 を通し確認する

## 主なページ

- `/` イベント一覧
- `/create` イベント作成
- `/my-events` 主催者管理
- `/dashboard` 主催者ダッシュボード
- `/my-tickets` 購入記録
- `/terms` 利用規約
- `/privacy` プライバシーポリシー
- `/commerce` 特商法表記

## 補足

- `resend.dev` の送信元を使う間は、受信先に制限があります
- Safari の QR 読み取りは、カメラ環境によって不安定なことがあります
- その場合は受付画面の `画像から読む` を使う運用が堅いです
