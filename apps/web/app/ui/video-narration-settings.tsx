'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Voice = 'marin' | 'cedar' | 'coral';
type Speed = 'SLOW' | 'STANDARD';

export function VideoNarrationSettings({
  workspaceId,
  groupId,
  projectId,
  revision,
  initialVoice,
  initialSpeed,
}: {
  workspaceId: string;
  groupId: string;
  projectId: string;
  revision: number;
  initialVoice: Voice;
  initialSpeed: Speed;
}) {
  const router = useRouter();
  const [voice, setVoice] = useState<Voice>(initialVoice);
  const [speed, setSpeed] = useState<Speed>(initialSpeed);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [message, setMessage] = useState('');

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const endpoint = `/api/workspaces/${workspaceId}/groups/${groupId}/video-projects/${projectId}`;

  async function preview() {
    setPreviewing(true);
    setMessage('実際の台本で試し聞きを作っています…');
    try {
      const response = await fetch(`${endpoint}/narration-preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voice, speed, previewRequestId: crypto.randomUUID() }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(result?.error?.message ?? '試し聞きを作れませんでした。');
      }
      const nextUrl = URL.createObjectURL(await response.blob());
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setMessage('再生ボタンを押して聞いてください。よければ設定を保存します。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '試し聞きを作れませんでした。');
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    setSaving(true);
    setMessage('声と速さを保存しています…');
    try {
      const response = await fetch(`${endpoint}/narration-settings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: revision, voice, speed }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          response.status === 409
            ? '台本が更新されました。画面を読み直して、もう一度お試しください。'
            : (result?.error?.message ?? '設定を保存できませんでした。'),
        );
      }
      setMessage('完成動画に使う声と速さを保存しました。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '設定を保存できませんでした。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-card">
      <h2>実際の台本を試し聞きする</h2>
      <p>最初の場面を聞いて、聞き取りやすい声と速さを選んでください。</p>
      <div className="form-stack">
        <label className="field">
          <span className="field__label">声</span>
          <select
            className="field__control"
            value={voice}
            onChange={(event) => setVoice(event.target.value as Voice)}
          >
            <option value="marin">やさしく落ち着いた声</option>
            <option value="cedar">はっきり信頼感のある声</option>
            <option value="coral">明るく親しみやすい声</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">速さ</span>
          <select
            className="field__control"
            value={speed}
            onChange={(event) => setSpeed(event.target.value as Speed)}
          >
            <option value="SLOW">ゆっくり（聞き取りやすい）</option>
            <option value="STANDARD">標準</option>
          </select>
        </label>
        <button
          className="button button--secondary"
          type="button"
          disabled={previewing || saving}
          onClick={() => void preview()}
        >
          {previewing ? '試し聞きを作っています…' : 'この声と速さで試し聞きする'}
        </button>
        {previewUrl ? <audio controls autoPlay src={previewUrl} /> : null}
        <button
          className="button button--primary"
          type="button"
          disabled={previewing || saving}
          onClick={() => void save()}
        >
          {saving ? '保存しています…' : 'この声と速さを完成動画に使う'}
        </button>
        <small>試し聞きもAI利用回数に含まれます。</small>
        <p role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </section>
  );
}
