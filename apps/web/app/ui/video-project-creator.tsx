'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function VideoProjectCreator({
  workspaceId,
  groupId,
  groupMembershipId,
  bunshins,
  campaigns,
  characters,
  photos = [],
}: {
  workspaceId: string;
  groupId: string;
  groupMembershipId: string;
  bunshins: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string }>;
  photos?: Array<{ id: string; originalFilename: string }>;
  characters: Array<{ id: string; name: string; version: number; referenceCount: number }>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedBunshinId, setSelectedBunshinId] = useState(bunshins[0]?.id ?? '');
  const [compositionMode, setCompositionMode] = useState<'STANDARD' | 'AI_SCENES'>('STANDARD');
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const [narrationVoice, setNarrationVoice] = useState<'marin' | 'cedar' | 'coral'>('marin');
  const [narrationSpeed, setNarrationSpeed] = useState<'SLOW' | 'STANDARD'>('STANDARD');
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function previewNarration() {
    if (!selectedBunshinId) return;
    setPreviewing(true);
    setMessage('声の見本を作っています…');
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/groups/${groupId}/video-narration-preview`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            groupMembershipId,
            bunshinId: selectedBunshinId,
            voice: narrationVoice,
            speed: narrationSpeed,
            previewRequestId: crypto.randomUUID(),
          }),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: { message?: string } };
        throw new Error(result.error?.message ?? '声の見本を作れませんでした。');
      }
      const nextUrl = URL.createObjectURL(await response.blob());
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setMessage('再生ボタンで声を確認できます。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '声の見本を作れませんでした。');
    } finally {
      setPreviewing(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const durationSeconds = Number(values.get('durationSeconds'));
    const campaignId = values.get('campaignId');
    setSaving(true);
    setMessage('動画の準備をしています…');
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/groups/${groupId}/video-projects`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            groupMembershipId,
            bunshinId: selectedBunshinId,
            campaignId: typeof campaignId === 'string' && campaignId ? campaignId : null,
            characterProfileVersionId: values.get('characterProfileVersionId') || null,
            title: values.get('title'),
            platform: values.get('platform'),
            type: values.get('type'),
            durationSeconds,
            compositionMode,
            photoAssetIds: compositionMode === 'STANDARD' ? selectedPhotos : [],
            narrationEnabled,
            narrationVoice,
            narrationSpeed,
          }),
        },
      );
      const result = (await response.json()) as {
        data?: { id?: string };
        error?: { message?: string };
      };
      if (!response.ok || !result.data?.id)
        throw new Error(result.error?.message ?? '動画の準備を始められませんでした。');
      router.push(`/groups/${groupId}/videos/${result.data.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動画の準備を始められませんでした。');
      setSaving(false);
    }
  }

  return (
    <section className="settings-card">
      <h2>新しい動画を考える</h2>
      <p>使う分身と投稿先を選ぶと、AIが30秒または60秒の台本を提案します。</p>
      {bunshins.length === 0 ? <p>先に自分の分身を作ってください。</p> : null}
      <form className="form-stack" onSubmit={(event) => void create(event)}>
        <label className="field">
          <span className="field__label">動画の名前</span>
          <input
            className="field__control"
            name="title"
            required
            maxLength={160}
            placeholder="例：商品の使い方を30秒で紹介"
          />
        </label>
        <label className="field">
          <span className="field__label">話す分身</span>
          <select
            className="field__control"
            name="bunshinId"
            required
            value={selectedBunshinId}
            onChange={(event) => setSelectedBunshinId(event.target.value)}
          >
            {bunshins.map((bunshin) => (
              <option key={bunshin.id} value={bunshin.id}>
                {bunshin.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">動画に出すAIキャラクター（任意）</span>
          <select className="field__control" name="characterProfileVersionId" defaultValue="">
            <option value="">選ばない</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}（第{character.version}版・基準画像{character.referenceCount}枚）
              </option>
            ))}
          </select>
          <small>選ぶと、今の見た目と基準画像をこの動画だけに固定して使います。</small>
        </label>
        <label className="field">
          <span className="field__label">投稿する場所</span>
          <select className="field__control" name="platform" defaultValue="INSTAGRAM">
            <option value="INSTAGRAM">Instagram</option>
            <option value="TIKTOK">TikTok</option>
            <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">動画の内容</span>
          <select className="field__control" name="type" defaultValue="EXPLAINER">
            <option value="EXPLAINER">わかりやすく説明する</option>
            <option value="PRODUCT_INTRODUCTION">商品を紹介する</option>
            <option
              value="PHOTO_SLIDESHOW"
              disabled={compositionMode !== 'STANDARD' || selectedPhotos.length === 0}
            >
              写真を順番に見せる
            </option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">動画の長さ</span>
          <select className="field__control" name="durationSeconds" defaultValue="30">
            <option value="30">30秒</option>
            <option value="60">60秒</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">動画の作り方</span>
          <select
            className="field__control"
            value={compositionMode}
            onChange={(event) => setCompositionMode(event.target.value as 'STANDARD' | 'AI_SCENES')}
          >
            <option value="STANDARD">写真・字幕動画</option>
            <option value="AI_SCENES" disabled={characters.length === 0}>
              AI動画を使う（場面ごとにAIで動画を作る）
            </option>
          </select>
          {compositionMode === 'AI_SCENES' ? (
            <small>
              AIキャラクターと基準画像を選びます。生成は承認後に始まり、設定した上限内だけで実行されます。
            </small>
          ) : null}
        </label>
        {compositionMode === 'STANDARD' ? (
          <fieldset>
            <legend>使う写真（任意・5枚まで）</legend>
            <p>チェックした順に表示します。場面数より少ない場合は同じ順で繰り返します。</p>
            {photos.length === 0 ? (
              <p>動画一覧の「写真・動画・ロゴを管理」から写真を追加できます。</p>
            ) : null}
            {photos.map((photo) => (
              <label key={photo.id} className="field">
                <input
                  type="checkbox"
                  checked={selectedPhotos.includes(photo.id)}
                  disabled={selectedPhotos.length >= 5 && !selectedPhotos.includes(photo.id)}
                  onChange={(event) =>
                    setSelectedPhotos((previous) =>
                      event.target.checked
                        ? [...previous, photo.id]
                        : previous.filter((id) => id !== photo.id),
                    )
                  }
                />
                {selectedPhotos.includes(photo.id)
                  ? `${selectedPhotos.indexOf(photo.id) + 1}番目：`
                  : ''}
                {photo.originalFilename}
              </label>
            ))}
          </fieldset>
        ) : null}
        <label className="field">
          <input
            type="checkbox"
            name="narrationEnabled"
            checked={narrationEnabled}
            onChange={(event) => setNarrationEnabled(event.target.checked)}
          />
          AIナレーションを付ける
          <small>
            確認した台本をOpenAIへ送り、AI音声を作ります。動画内にも「AI音声」と表示します。音声生成もAI利用回数に含まれます。
          </small>
        </label>
        {narrationEnabled ? (
          <div className="field">
            <label htmlFor="narrationVoice" className="field__label">
              読み上げる声
            </label>
            <select
              id="narrationVoice"
              className="field__control"
              value={narrationVoice}
              onChange={(event) =>
                setNarrationVoice(event.target.value as 'marin' | 'cedar' | 'coral')
              }
            >
              <option value="marin">やさしく落ち着いた声</option>
              <option value="cedar">はっきり信頼感のある声</option>
              <option value="coral">明るく親しみやすい声</option>
            </select>
            <label htmlFor="narrationSpeed" className="field__label">
              読み上げる速さ
            </label>
            <select
              id="narrationSpeed"
              className="field__control"
              value={narrationSpeed}
              onChange={(event) => setNarrationSpeed(event.target.value as 'SLOW' | 'STANDARD')}
            >
              <option value="SLOW">ゆっくり（聞き取りやすい）</option>
              <option value="STANDARD">標準</option>
            </select>
            <button
              className="button button--secondary"
              type="button"
              disabled={previewing || bunshins.length === 0}
              onClick={() => void previewNarration()}
            >
              {previewing ? '見本を作っています…' : 'この声と速さを試し聞きする'}
            </button>
            {previewUrl ? <audio controls autoPlay src={previewUrl} /> : null}
            <small>試し聞きもAI利用回数に含まれます。</small>
          </div>
        ) : null}
        <label className="field">
          <span className="field__label">紹介する企画（任意）</span>
          <select className="field__control" name="campaignId" defaultValue="">
            <option value="">選ばない</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button" type="submit" disabled={saving || bunshins.length === 0}>
          {saving ? '準備中…' : '動画の準備を始める'}
        </button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
