'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function VideoReviewActions({
  workspaceId,
  groupId,
  projectId,
  revision,
  allowAdopt = true,
}: {
  workspaceId: string;
  groupId: string;
  projectId: string;
  revision: number;
  allowAdopt?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<'ADOPT' | 'REVISE' | null>(null);
  const [message, setMessage] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  async function review(action: 'ADOPT' | 'REVISE') {
    if (action === 'REVISE' && !reviewReason) {
      setMessage('作り直す理由を選んでください。');
      return;
    }
    setSaving(action);
    setMessage(
      action === 'ADOPT' ? '使用することを記録しています…' : '台本の編集画面を準備しています…',
    );
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/groups/${groupId}/video-projects/${projectId}/review`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedRevision: revision,
            action,
            reviewReason: action === 'REVISE' ? reviewReason : null,
            reviewNote: action === 'REVISE' && reviewNote.trim() ? reviewNote.trim() : null,
          }),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        data?: { id?: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || !result?.data?.id)
        throw new Error('操作を保存できませんでした。画面を読み直して、もう一度お試しください。');
      setMessage(
        action === 'ADOPT'
          ? 'この動画を使うことを記録しました。'
          : '台本を直せる画面へ戻しました。直したい場面を選んでください。',
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作を保存できませんでした。');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="form-stack">
      {allowAdopt ? (
        <button
          className="button button--primary"
          type="button"
          disabled={saving !== null}
          onClick={() => void review('ADOPT')}
        >
          {saving === 'ADOPT' ? '保存中…' : 'この動画を使う'}
        </button>
      ) : null}
      <label className="field">
        <span className="field__label">作り直したい理由</span>
        <select
          className="field__control"
          value={reviewReason}
          onChange={(event) => setReviewReason(event.target.value)}
          disabled={saving !== null}
        >
          <option value="">選んでください</option>
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
          value={reviewNote}
          maxLength={500}
          onChange={(event) => setReviewNote(event.target.value)}
          disabled={saving !== null}
          placeholder="例：声が速くて聞き取れませんでした"
        />
      </label>
      <button
        className="button button--secondary"
        type="button"
        disabled={saving !== null}
        onClick={() => void review('REVISE')}
      >
        {saving === 'REVISE' ? '準備中…' : '台本を直して作り直す'}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
