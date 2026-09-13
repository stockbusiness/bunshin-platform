# 日次動画のBGM設定 実装報告

## 1. 調査した内容

- 既存の動画素材機能は写真・動画・ロゴだけを扱い、音源の登録、選択、利用許諾確認はできなかった。
- 日次動画はサービス設定を動画プロジェクトへ固定し、レンダリング時に短時間だけ有効な素材URLを発行する構成になっていた。
- CreatomateのAudio Elementは、音源URL、ループ、音量、フェードイン、フェードアウトをRenderScriptで指定できる。

## 2. 変更したファイル

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260913111000_add_video_audio_asset/migration.sql`
- `packages/application/src/video-assets.ts`
- `packages/application/src/video-core.ts`
- `packages/database/src/index.ts`
- `apps/web/src/http/video-assets.ts`
- `apps/web/src/video/video-asset-storage.ts`
- `apps/web/app/ui/video-asset-uploader.tsx`
- `apps/web/app/(app)/groups/[groupId]/video-assets/page.tsx`
- `apps/web/src/services/service-onboarding-settings.ts`
- `apps/web/src/http/service-settings.ts`
- `apps/web/app/s/[serviceSlug]/manage/settings/page.tsx`
- `apps/web/app/s/[serviceSlug]/manage/settings/service-settings-editor.tsx`
- `apps/web/src/jobs/daily-mission-job-handler.ts`
- `apps/web/src/services/automatic-daily-video.ts`
- `apps/web/src/jobs/video-render-job-handler.ts`
- `apps/web/src/providers/creatomate-video-render.ts`
- 関連テスト

## 3. 主要な設計判断

- BGMは運営者本人が利用権を確認して登録したMP3またはWAVだけを選択できる。
- 選択可能な音源を、同じWorkspace、サービス、運営者に属する、利用可能期間内の登録済み素材へ限定する。
- 日次動画を作る時点の音源IDと音量を動画プロジェクトへ保存し、後から設定を変えても既存動画の再生成結果を変えない。
- レンダリング直前にも同じサービス内で利用可能な音源か確認し、削除済み・期限切れ・準備未完了の音源なら処理を止める。
- 音源の公開URLは保存せず、レンダリング開始時に短時間だけ有効なURLを作る。
- 音量は聞きやすさを優先して8%、12%、20%から選べる。動画全体でループし、開始1秒と終了2秒にフェードを付ける。
- 既存サービスの既定値はBGMなしとし、既存動画の出力を変えない。

## 4. 実行した検証

- MP3/WAVのファイル署名確認と不明なバイト列の拒否
- 既存Supabaseバケットへの音声MIME許可の追加
- サービス設定の後方互換性とBGM設定の読み込み
- 日次ジョブから動画作成までの設定引き渡し
- 動画プロジェクトへの音源ID・音量の固定
- レンダリング開始時の署名付き音源URL発行
- Creatomate RenderScriptへのループ、音量、フェード設定
- 対象テスト、全体typecheck、lint、全テスト、build

## 5. 未解決事項

- 実音源を使ったCreatomate本番出力とiPhoneでの音量確認
- ナレーションとBGMを同時に使う場合の、サービスごとの推奨音量の調整

## 6. 次Phaseへ進める条件

- PRをマージし、DB migrationを適用する。
- サービス運営者が権利確認済みの短いMP3またはWAVを登録し、管理画面でBGMを有効にする。
- 新しい日次動画を1本生成し、iPhoneでループの継ぎ目、ナレーションの聞き取りやすさ、終了時のフェードを確認する。

参考: [Creatomate Audio Element](https://creatomate.com/docs/api/render-script/audio-element)
