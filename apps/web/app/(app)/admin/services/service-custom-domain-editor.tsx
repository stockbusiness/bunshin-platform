'use client';

import { useState, type FormEvent } from 'react';

type CustomDomain = {
  hostname: string;
  status: 'DRAFT' | 'VERIFIED' | 'ACTIVE' | 'DISABLED';
  verificationNote: string | null;
  provider: string | null;
  verificationRecordType: string | null;
  verificationRecordName: string | null;
  verificationRecordValue: string | null;
  providerLastCheckedAt: string | null;
};

export function ServiceCustomDomainEditor({
  serviceId,
  domain,
}: {
  serviceId: string;
  domain: CustomDomain | null;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    setMessage('独自ドメインの設定を保存しています…');
    try {
      const response = await fetch(
        `/api/admin/services/${encodeURIComponent(serviceId)}/custom-domain`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            hostname: formData.get('hostname'),
            status: formData.get('status'),
            verificationNote: formData.get('verificationNote'),
            reason: formData.get('reason'),
          }),
        },
      );
      const result = (await response.json()) as { error?: { message?: string } };
      if (!response.ok)
        throw new Error(result.error?.message ?? '独自ドメインを保存できませんでした。');
      setMessage('保存しました。画面を更新します…');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '独自ドメインを保存できませんでした。');
      setSaving(false);
    }
  }

  async function transition(action: 'connect' | 'verify' | 'disconnect') {
    setSaving(true);
    setMessage(
      action === 'disconnect'
        ? '接続を解除しています…'
        : action === 'verify'
          ? 'DNS設定を確認しています…'
          : '公開先へ接続しています…',
    );
    try {
      const response = await fetch(
        `/api/admin/services/${encodeURIComponent(serviceId)}/custom-domain/${action}`,
        { method: 'POST' },
      );
      const result = (await response.json()) as { error?: { message?: string } };
      if (!response.ok)
        throw new Error(result.error?.message ?? '接続状態を更新できませんでした。');
      setMessage(action === 'disconnect' ? '接続を解除しました。' : '接続状態を更新しました。');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '接続状態を更新できませんでした。');
      setSaving(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setMessage('コピーしました。');
  }

  return (
    <details className="settings-card">
      <summary>OEM・独自ドメインを準備する</summary>
      <p>独自ドメインを公開先へ接続し、DNS確認と公開開始までこの画面で進められます。</p>
      <ol>
        <li>利用するドメインを入力し「準備中」で保存します。</li>
        <li>「公開先へ接続する」を押します。</li>
        <li>表示されたDNSレコードをドメイン管理会社で設定します。</li>
        <li>「DNSを確認する」を押すと、確認後に自動で公開を始めます。</li>
      </ol>
      <form className="admin-form-grid" onSubmit={(event) => void submit(event)}>
        <label>
          独自ドメイン
          <input
            defaultValue={domain?.hostname ?? ''}
            name="hostname"
            placeholder="app.example.jp"
            required
          />
        </label>
        <label>
          状態
          <select defaultValue={domain?.status ?? 'DRAFT'} name="status">
            <option value="DRAFT">準備中</option>
            {domain?.status === 'VERIFIED' ? (
              <option value="VERIFIED" disabled>
                確認済み
              </option>
            ) : null}
            {domain?.status === 'ACTIVE' ? (
              <option value="ACTIVE" disabled>
                公開中
              </option>
            ) : null}
            <option value="DISABLED">停止中</option>
          </select>
        </label>
        <label>
          確認メモ（任意）
          <input
            defaultValue={domain?.verificationNote ?? ''}
            name="verificationNote"
            maxLength={1000}
          />
        </label>
        <label>
          変更理由
          <input
            name="reason"
            required
            maxLength={1000}
            placeholder="例：OEMサービスの独自ドメインを申請"
          />
        </label>
        <button disabled={saving || Boolean(domain?.provider)} type="submit">
          {domain?.provider
            ? '変更する場合は先に接続を解除してください'
            : saving
              ? '保存中…'
              : '独自ドメインを保存する'}
        </button>
      </form>
      {domain ? (
        <section>
          <h3>公開接続</h3>
          <p>
            状態：
            {domain.status === 'ACTIVE' ? '公開中' : domain.provider ? 'DNS設定待ち' : '未接続'}
          </p>
          {domain.verificationRecordType &&
          domain.verificationRecordName &&
          domain.verificationRecordValue ? (
            <div className="notice">
              <strong>ドメイン管理会社へ追加するDNSレコード</strong>
              <p>種類：{domain.verificationRecordType}</p>
              <p>
                名前：<code>{domain.verificationRecordName}</code>{' '}
                <button type="button" onClick={() => void copy(domain.verificationRecordName!)}>
                  コピー
                </button>
              </p>
              <p>
                値：<code>{domain.verificationRecordValue}</code>{' '}
                <button type="button" onClick={() => void copy(domain.verificationRecordValue!)}>
                  コピー
                </button>
              </p>
            </div>
          ) : null}
          <div className="table-actions">
            {domain.status !== 'ACTIVE' && !domain.provider ? (
              <button disabled={saving} type="button" onClick={() => void transition('connect')}>
                公開先へ接続する
              </button>
            ) : null}
            {domain.status !== 'ACTIVE' && domain.provider ? (
              <button disabled={saving} type="button" onClick={() => void transition('verify')}>
                DNSを確認する
              </button>
            ) : null}
            {domain.provider ? (
              <button
                className="button button--secondary"
                disabled={saving}
                type="button"
                onClick={() => void transition('disconnect')}
              >
                接続を解除する
              </button>
            ) : null}
          </div>
          {domain.providerLastCheckedAt ? (
            <p>最終確認：{new Date(domain.providerLastCheckedAt).toLocaleString('ja-JP')}</p>
          ) : null}
        </section>
      ) : null}
      <p aria-live="polite" role="status">
        {message}
      </p>
    </details>
  );
}
