# ワタシワークス公式 企業向け初回導線短縮 実装報告

## 1. 調査した内容

ワタシワークス公式では、事業情報の登録後にも投稿パートナー候補の生成・選択、SNS、受信時刻、LINE通知同意が必要だった。企業、店舗、個人事業主がスマートフォンから迷わず開始できるよう、初回導線を確認した。

## 2. 変更したファイル

- `apps/web/src/services/default-business-partner.ts`
- `apps/web/src/http/service-onboarding.ts`
- `apps/web/app/s/[serviceSlug]/onboarding/service-onboarding-form.tsx`
- `apps/web/app/s/[serviceSlug]/bunshins/[bunshinId]/simple-first-post-setup.tsx`
- 対応するWebテスト

## 3. 主要な設計判断

- 事業プロフィールを使うServiceでは、保存した会社名、商品、目的、対象顧客、特徴、文章の雰囲気から標準投稿パートナーを自動作成する。
- 同じServiceに本人の投稿パートナーがある場合は再利用し、重複作成を避ける。
- 保存後は候補選択画面を省略し、投稿するSNSと受信時刻を選ぶ画面へ直接進む。
- 「LINE配信を始める」の1回の操作で、投稿テーマ、Social Profile、発信戦略、通知同意、週間予定の準備を進める。
- 事業プロフィールを使わないServiceの既存導線は変更しない。

## 4. 実行した検証

- 専用テスト: 6件成功
- Web TypeScript型検査: 成功
- Web lint: 成功
- Web本番ビルド: 成功

## 5. 未解決事項

- 本番反映後、未登録のテスト利用者でLINEログインから初回配信開始までを実機確認する。
- 既に初回設定済みの利用者には今回の導線変更は表示されない。

## 6. 次Phaseへ進める条件

本番で、事業情報保存後に候補選択が表示されず、SNSと受信時刻を選んでLINE配信を開始できることを確認する。
