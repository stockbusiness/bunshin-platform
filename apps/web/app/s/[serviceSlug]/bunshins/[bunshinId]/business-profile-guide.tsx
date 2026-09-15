'use client';

import type { SocialAccountStrategyDestination, SocialPlatform } from '@bunshin/capability-social';
import { useState } from 'react';

const platformLabels: Record<SocialPlatform, string> = {
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  X: 'X（旧Twitter）',
  THREADS: 'Threads',
  YOUTUBE_SHORTS: 'YouTube ショート',
  OTHER: 'SNS',
};

const destinationLabels: Record<SocialAccountStrategyDestination, string> = {
  PROFILE: 'SNSの自己紹介ページ',
  LINE: 'LINE',
  LP: '案内ページ',
  BLOG: 'ブログ',
  EC: 'ネットショップ',
  INQUIRY: '問い合わせページ',
  RECRUIT_PAGE: '求人ページ',
  NONE: '案内先はありません',
  OTHER: '設定した案内先',
};

export interface BusinessProfileGuideStrategy {
  platform: SocialPlatform;
  profileDraft: string;
  ctaStrategy: string;
  destinationType: SocialAccountStrategyDestination;
  destinationDetail: string | null;
}

function copyWithSelection(value: string) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

async function writeToClipboard(value: string) {
  let clipboardAttempt: Promise<boolean> | null = null;
  try {
    clipboardAttempt = navigator.clipboard.writeText(value).then(
      () => true,
      () => false,
    );
  } catch {
    // LINE内ブラウザや一部のiPhoneではClipboard APIを利用できない場合がある。
  }
  const selectedCopy = copyWithSelection(value);
  return selectedCopy || (await clipboardAttempt) || false;
}

export function BusinessProfileGuide({ strategy }: { strategy: BusinessProfileGuideStrategy }) {
  const [message, setMessage] = useState('');

  async function copy(value: string, kind: 'profile' | 'guidance') {
    const copied = await writeToClipboard(value);
    setMessage(
      copied
        ? kind === 'profile'
          ? `自己紹介文をコピーしました。${platformLabels[strategy.platform]}のプロフィール編集画面に貼り付けてください。`
          : '投稿の最後に入れる案内文をコピーしました。'
        : '自動でコピーできませんでした。文章を長押しして「コピー」を選んでください。',
    );
  }

  return (
    <section
      className="business-profile-guide service-entry__card"
      id="sns-profile-guide"
      aria-labelledby="sns-profile-guide-title"
    >
      <header>
        <p className="eyebrow">最初に一度だけ</p>
        <h2 id="sns-profile-guide-title">SNSの自己紹介文を入れましょう</h2>
        <p>用意した文章をコピーして、{platformLabels[strategy.platform]}へ貼り付けます。</p>
      </header>

      <ol className="business-profile-guide__steps">
        <li>下の青いボタンを押す</li>
        <li>{platformLabels[strategy.platform]}を開き、「プロフィールを編集」を押す</li>
        <li>自己紹介の欄を長押しして「貼り付け」を押し、保存する</li>
      </ol>

      <div className="business-profile-guide__copy-block">
        <h3>コピーする自己紹介文</h3>
        <textarea
          aria-label="SNSへ貼り付ける自己紹介文"
          className="field__control"
          readOnly
          rows={6}
          value={strategy.profileDraft}
        />
        <button
          className="button button--primary button--full"
          type="button"
          onClick={() => void copy(strategy.profileDraft, 'profile')}
        >
          自己紹介文をコピー
        </button>
      </div>

      {strategy.destinationType !== 'NONE' ? (
        <div className="business-profile-guide__copy-block">
          <h3>投稿を見た人への案内</h3>
          <p className="business-profile-guide__destination">
            案内先：{destinationLabels[strategy.destinationType]}
            {strategy.destinationDetail ? `（${strategy.destinationDetail}）` : ''}
          </p>
          <textarea
            aria-label="投稿の最後に入れる案内文"
            className="field__control"
            readOnly
            rows={4}
            value={strategy.ctaStrategy}
          />
          <button
            className="button button--secondary button--full"
            type="button"
            onClick={() => void copy(strategy.ctaStrategy, 'guidance')}
          >
            案内文をコピー
          </button>
          <p className="business-profile-guide__hint">
            この案内文は、投稿文のいちばん最後に貼り付けて使います。
          </p>
        </div>
      ) : null}

      <p className="business-profile-guide__message" role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
