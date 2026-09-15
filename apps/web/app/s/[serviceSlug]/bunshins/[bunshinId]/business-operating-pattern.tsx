import type { BusinessGrowthProgramStatus } from '@bunshin/application';
import type { BusinessOutcomes } from '../../../../../src/services/business-outcomes';
import { buildBusinessResponseInsight } from './business-response-insights';

interface OperatingPatternMission {
  id: string;
  missionDate: string;
  topic: string;
  postedAt: string | null;
  businessOutcomes?: BusinessOutcomes;
}

const weekdayLabels = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

export function buildBusinessOperatingPattern(missions: OperatingPatternMission[]) {
  const posted = missions
    .filter((mission) => mission.postedAt)
    .sort((left, right) => right.missionDate.localeCompare(left.missionDate))
    .slice(0, 12);
  const weekdayCounts = new Map<number, number>();
  for (const mission of posted) {
    const weekday = new Date(`${mission.missionDate}T00:00:00.000Z`).getUTCDay();
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
  }
  const weekdays = [...weekdayCounts.entries()]
    .sort(([leftDay, leftCount], [rightDay, rightCount]) =>
      rightCount === leftCount ? leftDay - rightDay : rightCount - leftCount,
    )
    .slice(0, 2)
    .map(([weekday]) => weekdayLabels[weekday]!);

  return {
    postedCount: posted.length,
    weekdays,
    bestTopic: buildBusinessResponseInsight(posted).bestTopic,
  };
}

export function BusinessOperatingPattern({
  program,
  missions,
  destination,
  roadmapHref,
  reportHref,
}: {
  program: BusinessGrowthProgramStatus;
  missions: OperatingPatternMission[];
  destination?: string | null;
  roadmapHref: string;
  reportHref?: string;
}) {
  if (program.cycleNumber === 1 && program.phase.key !== 'ESTABLISH_PATTERN') return null;
  const pattern = buildBusinessOperatingPattern(missions);
  const weekdayText = pattern.weekdays.length
    ? pattern.weekdays.join('・')
    : '毎週の予定表に表示された曜日';
  const topicText = pattern.bestTopic ?? 'これから反応を記録して見つける題材';
  const destinationText = destination?.trim() || 'SNSプロフィールに設定した問い合わせ先';

  return (
    <section
      className="business-operating-pattern service-entry__card"
      aria-labelledby="business-operating-pattern-title"
    >
      <header>
        <p className="eyebrow">あなたの続ける型</p>
        <h2 id="business-operating-pattern-title">次の90日も、この形で進めます</h2>
        <p>これまでの投稿とお客様の反応から、続ける内容を3つにまとめました。</p>
      </header>

      <dl className="business-operating-pattern__items">
        <div>
          <dt>投稿する曜日</dt>
          <dd>{weekdayText}</dd>
        </div>
        <div>
          <dt>繰り返す題材</dt>
          <dd>{topicText}</dd>
        </div>
        <div>
          <dt>お客様の案内先</dt>
          <dd>{destinationText}</dd>
        </div>
      </dl>

      <div className="business-operating-pattern__plan">
        <strong>次の90日ですること</strong>
        <ol>
          <li>{weekdayText}を目安に、届いた投稿案を使う</li>
          <li>「{topicText}」を、写真や言葉を変えて繰り返す</li>
          <li>投稿の最後に「{destinationText}」への案内を入れる</li>
        </ol>
      </div>

      <a className="button button--secondary button--full" href={roadmapHref}>
        90日計画の現在地を見る
      </a>
      {reportHref ? (
        <a className="button button--secondary button--full" href={reportHref}>
          90日間の成果を見る
        </a>
      ) : null}
    </section>
  );
}
