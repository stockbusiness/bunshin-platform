# 日次動画の演出設定 実装報告

## 1. 調査した内容

- 日次5枚画像動画は、全サービスで同じ横移動と4%の拡大縮小を使っていた。
- 演出は動画作成時の設定として保存されておらず、サービス運営者が読みやすさに合わせて選べなかった。
- 動画プロジェクトの `disclosureSnapshot` は作成時の設定を保持し、再レンダリングでも同じ値を参照できる。

## 2. 変更したファイル

- `apps/web/src/services/service-onboarding-settings.ts`
- `apps/web/src/http/service-settings.ts`
- `apps/web/app/s/[serviceSlug]/manage/settings/service-settings-editor.tsx`
- `apps/web/src/jobs/daily-mission-job-handler.ts`
- `apps/web/src/services/automatic-daily-video.ts`
- `apps/web/src/providers/creatomate-video-render.ts`
- 関連テスト

## 3. 主要な設計判断

- 運営者は「標準」「ゆったり」「動きなし」の3種類から選ぶ。
- 既存サービスと手動作成動画は `STANDARD` を使い、現在の見た目を維持する。
- 日次動画を作る時点の選択を動画プロジェクトへ保存する。後からサービス設定を変えても、既存動画の再生成結果は変えない。
- `CALM` は切り替えを長くし、拡大縮小を2%に抑える。`MINIMAL` は画像の動きを付けない。
- BGMは音源ごとの利用許諾と配布条件が必要なため、この変更には含めない。

## 4. 実行した検証

- サービス設定の後方互換性
- 日次ジョブから動画作成までの設定引き渡し
- 動画プロジェクトへの演出スナップショット保存
- Creatomate RenderScriptでの3種類の演出反映
- 対象テスト、全体typecheck、lint、全テスト、build

## 5. 未解決事項

- 実際のCreatomate出力をスマートフォンで比較する本番確認
- 権利処理済みBGMの選択と音量設定

## 6. 次Phaseへ進める条件

- PRをマージし、サービス管理画面で演出を選んだ後に新しい日次動画を生成する。
- 3種類をスマートフォンで比較し、標準設定にする演出を決める。
