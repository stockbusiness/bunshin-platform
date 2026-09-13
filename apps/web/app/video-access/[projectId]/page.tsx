import { redirect } from 'next/navigation';
import { authorizedVideoView } from '../../../src/http/video-line-access';
import { PublicShell } from '../../ui/public-shell';
import { VideoPostCopy } from '../../ui/video-post-copy';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '動画を見る',
  robots: { index: false, follow: false },
  // Keep Origin on our POST form while withholding referrers from external sites.
  referrer: 'same-origin' as const,
};
export default async function VideoAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ result?: string; decision?: string; posted?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const scope = await authorizedVideoView(projectId);
  if (scope?.appOwner && !scope.project.renderAttempts.length)
    redirect(`/groups/${scope.project.groupId}/videos/${projectId}?manage=1`);
  const source = `/video-access/${projectId}/download`;
  return (
    <PublicShell>
      <main className="app-page" style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px' }}>
        {scope ? (
          <>
            <h1>{scope.project.title}</h1>
            {scope.project.renderAttempts.length ? (
              <>
                <video
                  controls
                  playsInline
                  preload="metadata"
                  src={source}
                  style={{ width: '100%', maxHeight: '65vh', background: '#111' }}
                />
                {scope.postCopy ? (
                  <VideoPostCopy
                    value={scope.postCopy}
                    authorizationPath={`/video-access/${projectId}/copy-authorization`}
                  />
                ) : null}
                {scope.project.reviewDecision === 'ADOPTED' ? (
                  <>
                    <p role="status">
                      <strong>この動画を使うことを記録しました。</strong>
                    </p>
                    <p>
                      <a href={source} target="_blank" rel="noreferrer">
                        動画を開く・iPhoneへ保存する
                      </a>
                    </p>
                    <p>動画を開き、共有メニューから「ビデオを保存」を押してください。</p>
                    <section className="settings-card">
                      <h2>SNSに投稿した後</h2>
                      {scope.postRecorded || query.posted === '1' ? (
                        <p role="status">
                          <strong>投稿完了を記録しました。おつかれさまでした。</strong>
                        </p>
                      ) : (
                        <>
                          <p>Instagramなどへの投稿が終わったら、下のボタンを1回押してください。</p>
                          <form action={`/video-access/${projectId}/posted`} method="post">
                            <button type="submit">投稿しました</button>
                          </form>
                        </>
                      )}
                      <p>この記録をもとに、ポイントやバッジが反映されます。</p>
                    </section>
                  </>
                ) : scope.project.reviewDecision === 'REJECTED' ? (
                  <section className="settings-card" role="status">
                    <strong>今回は使わないことを記録しました。</strong>
                    <p>選んだ理由は運営者へ届き、次の動画づくりの改善に使われます。</p>
                  </section>
                ) : query.decision === 'adopted' ? (
                  <p role="status">この動画を使うことを記録しました。</p>
                ) : null}
                <div className="form-stack">
                  <form action={`/video-access/${projectId}/decision`} method="post">
                    <input type="hidden" name="decision" value="ADOPTED" />
                    <button type="submit">この動画を使う</button>
                  </form>
                  <form action={`/video-access/${projectId}/decision`} method="post">
                    <input type="hidden" name="decision" value="REJECTED" />
                    <label className="field">
                      <span className="field__label">使わない理由</span>
                      <select
                        className="field__control"
                        name="reviewReason"
                        defaultValue={scope.project.reviewReason ?? ''}
                        required
                      >
                        <option value="" disabled>選んでください</option>
                        <option value="NARRATION_HARD_TO_HEAR">ナレーションが聞き取りにくい</option>
                        <option value="AI_VOICE_UNNATURAL">声が不自然</option>
                        <option value="CONTENT_MISMATCH">内容が希望と違う</option>
                        <option value="VISUAL_UNNATURAL">映像や画像が不自然</option>
                        <option value="TOO_LONG">動画が長すぎる</option>
                        <option value="OTHER">その他</option>
                      </select>
                    </label>
                    <label className="field">
                      <span className="field__label">詳しく伝える（任意）</span>
                      <textarea
                        className="field__control"
                        name="reviewNote"
                        maxLength={500}
                        defaultValue={scope.project.reviewNote ?? ''}
                        placeholder="例：声が速くて聞き取れませんでした"
                      />
                    </label>
                    <button type="submit" className="button button--secondary">
                      理由を送って今回は使わない
                    </button>
                  </form>
                </div>
                {query.result === 'decision-failed' ? (
                  <p role="alert">操作を記録できませんでした。もう一度お試しください。</p>
                ) : null}
                {query.result === 'post-failed' ? (
                  <p role="alert">
                    投稿完了を記録できませんでした。投稿案で「この内容で進める」を押してから、もう一度お試しください。
                  </p>
                ) : null}
              </>
            ) : (
              <p>動画は準備中、または保存期限を過ぎています。</p>
            )}
            {scope.appOwner ? (
              <p>
                <a href={`/groups/${scope.project.groupId}/videos/${projectId}?manage=1`}>
                  台本を直して作り直す
                </a>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h1>LINEで届いた動画を見る</h1>
            <p>通知を受け取ったLINEで本人確認すると、この動画を閲覧・保存できます。</p>
            {query.result === 'failed' ? (
              <p role="alert">
                確認できませんでした。通知を受け取ったLINEで、もう一度確認してください。保存期限を過ぎた動画は開けません。
              </p>
            ) : null}
            <form action="/auth/video-line/start" method="post">
              <input type="hidden" name="projectId" value={projectId} />
              <button type="submit">LINEで本人確認して動画を見る</button>
            </form>
            <p>
              <a href={`/login?returnTo=${encodeURIComponent(`/video-access/${projectId}`)}`}>
                動画を作成したアカウントでログインする
              </a>
            </p>
          </>
        )}
      </main>
    </PublicShell>
  );
}
