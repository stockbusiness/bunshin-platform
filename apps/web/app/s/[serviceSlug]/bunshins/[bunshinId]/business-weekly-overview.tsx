import type { SocialPreferredFormat } from '@bunshin/capability-social';

interface BusinessWeeklyOverviewPlan {
  id: string;
  weekStartDate: string;
  status: 'DRAFT' | 'CONFIRMED' | 'EXPIRED';
  items: Array<{
    id: string;
    scheduledDate: string;
    contentPillarId: string;
    angle: string;
    recommendedFormat: SocialPreferredFormat;
  }>;
}

const formatLabels: Record<SocialPreferredFormat, string> = {
  TEXT: '文章の投稿',
  SLIDE: '複数枚の画像投稿',
  LIVE_ACTION: '自分で撮る動画',
  AI_VIDEO_PROMPT: 'AIで作る動画',
  IMAGE: '画像投稿',
};

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function selectCurrentBusinessWeeklyPlan(
  plans: BusinessWeeklyOverviewPlan[],
  today: string,
) {
  return (
    plans.find(
      (plan) =>
        plan.status === 'CONFIRMED' &&
        plan.weekStartDate <= today &&
        addDays(plan.weekStartDate, 6) >= today,
    ) ??
    plans.find((plan) => plan.status === 'CONFIRMED' && addDays(plan.weekStartDate, 6) >= today)
  );
}

export function BusinessWeeklyOverview({
  today,
  plans,
  pillars,
}: {
  today: string;
  plans: BusinessWeeklyOverviewPlan[];
  pillars: Array<{ id: string; title: string }>;
}) {
  const plan = selectCurrentBusinessWeeklyPlan(plans, today);
  const items = plan?.items.filter(({ scheduledDate }) => scheduledDate >= today) ?? [];

  return (
    <section
      className="business-weekly-overview service-entry__card"
      aria-labelledby="business-weekly-overview-title"
    >
      <header>
        <p className="eyebrow">今週の見通し</p>
        <h2 id="business-weekly-overview-title">これからの発信予定</h2>
        <p>予定は投稿パートナーが毎週準備します。内容を覚えておく必要はありません。</p>
      </header>

      {!plan ? (
        <div className="business-weekly-overview__empty">
          <strong>次の予定を準備しています</strong>
          <p>準備できると、ここに日付と内容が表示されます。LINEでもお知らせします。</p>
        </div>
      ) : items.length === 0 ? (
        <div className="business-weekly-overview__empty">
          <strong>今週の予定はすべて終わりました</strong>
          <p>次の予定は自動で準備します。そのままお待ちください。</p>
        </div>
      ) : (
        <ol className="business-weekly-overview__items">
          {items.map((item) => (
            <li className={item.scheduledDate === today ? 'is-today' : undefined} key={item.id}>
              <div className="business-weekly-overview__date">
                <strong>
                  {item.scheduledDate === today ? '今日' : dateLabel(item.scheduledDate)}
                </strong>
                <span>{formatLabels[item.recommendedFormat]}</span>
              </div>
              <div>
                <strong>
                  {pillars.find(({ id }) => id === item.contentPillarId)?.title ?? '発信テーマ'}
                </strong>
                <p>{item.angle}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <a className="button button--primary button--full" href="#today-post">
        今日の投稿案を見る
      </a>
    </section>
  );
}
