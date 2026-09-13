'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function VideoSceneEditor({
  workspaceId,
  groupId,
  projectId,
  sceneId,
  revision,
  narration,
  caption,
  narrationEnabled,
  maxNarrationLength,
}: {
  workspaceId: string;
  groupId: string;
  projectId: string;
  sceneId: string;
  revision: number;
  narration: string;
  caption: string;
  narrationEnabled: boolean;
  maxNarrationLength: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [narrationValue, setNarrationValue] = useState(narration);
  const [captionValue, setCaptionValue] = useState(caption);
  const [message, setMessage] = useState('');

  async function save() {
    if (!narrationValue.trim() || !captionValue.trim()) {
      setMessage('読み上げる言葉と画面の文字を入力してください。');
      return;
    }
    if (narrationEnabled && Array.from(narrationValue.trim()).length > maxNarrationLength) {
      setMessage(`読み上げる言葉を${maxNarrationLength}文字以内に短くしてください。`);
      return;
    }
    setSaving(true);
    setMessage('この場面を保存しています…');
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/groups/${groupId}/video-projects/${projectId}/scenes/${sceneId}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: revision,
            narration: narrationValue,
            caption: captionValue,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        data?: { id?: string };
        error?: { code?: string; message?: string };
      } | null;
      if (!response.ok || !result?.data?.id) {
        const message =
          response.status === 409
            ? '台本が更新されました。画面を読み直して、もう一度お試しください。'
            : response.status === 400
              ? '文字数を確認してください。読み上げる言葉は短くすると聞き取りやすくなります。'
              : 'この場面を保存できませんでした。少し待ってから、もう一度お試しください。';
        throw new Error(message);
      }
      setMessage('この場面だけ直しました。');
      setEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'この場面を保存できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  if (!editing)
    return (
      <div className="video-scene-editor__closed">
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            setEditing(true);
            setMessage('');
          }}
        >
          この場面を直す
        </button>
        {message ? (
          <p role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>
    );

  return (
    <div className="video-scene-editor">
      <p>
        <strong>この場面だけ直せます。</strong>ほかの場面は変わりません。
      </p>
      <label className="field">
        <span className="field__label">
          {narrationEnabled ? 'AI音声で読み上げる言葉' : '参考の台本'}
        </span>
        <textarea
          className="field__control"
          rows={4}
          maxLength={narrationEnabled ? maxNarrationLength : 2_000}
          value={narrationValue}
          disabled={saving}
          onChange={(event) => setNarrationValue(event.target.value)}
        />
        {narrationEnabled ? (
          <span className="form-help">
            {Array.from(narrationValue.trim()).length} / {maxNarrationLength}文字
          </span>
        ) : null}
      </label>
      <label className="field">
        <span className="field__label">画面に表示する文字</span>
        <textarea
          className="field__control"
          rows={3}
          maxLength={240}
          value={captionValue}
          disabled={saving}
          onChange={(event) => setCaptionValue(event.target.value)}
        />
      </label>
      <div className="video-scene-editor__actions">
        <button
          className="button button--primary"
          type="button"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? '保存中…' : 'この場面を保存'}
        </button>
        <button
          className="button button--secondary"
          type="button"
          disabled={saving}
          onClick={() => {
            setNarrationValue(narration);
            setCaptionValue(caption);
            setMessage('');
            setEditing(false);
          }}
        >
          やめる
        </button>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
