'use client';

import { useState, type FormEvent } from 'react';

export function GroupAdminEditor({ workspaceId }: { workspaceId: string }) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = data.get('name');
    if (typeof name !== 'string') return;
    setSaving(true);
    setMessage('作成しています…');
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/groups`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const result = (await response.json()) as { error?: { message?: string } };
      if (!response.ok)
        throw new Error(result.error?.message ?? 'プロジェクトを作成できませんでした。');
      form.reset();
      setMessage('プロジェクトを作成しました。画面を更新します…');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'プロジェクトを作成できませんでした。');
      setSaving(false);
    }
  }

  return (
    <section className="settings-card" aria-labelledby="create-group-title">
      <h2 id="create-group-title">新しいプロジェクトを作る</h2>
      <p>選択中の運営団体の中に、発信内容・参加者・LINE設定をまとめるプロジェクトを作ります。</p>
      <form onSubmit={(event) => void createGroup(event)}>
        <label>
          プロジェクト名
          <input name="name" required maxLength={120} placeholder="例：千ノ国メディア" />
        </label>
        <button type="submit" disabled={saving}>
          {saving ? '作成中…' : 'プロジェクトを作成する'}
        </button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
