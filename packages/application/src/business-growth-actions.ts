import {
  businessGrowthProgramStatus,
  type BusinessGrowthProgramPhaseKey,
} from './business-growth-program';

export const BUSINESS_GROWTH_ACTION_KINDS = [
  'POST',
  'PHOTO',
  'COMMENT_REPLY',
  'CUSTOMER_QUESTION',
  'PROFILE_IMPROVEMENT',
  'RESULT_REVIEW',
  'REST',
] as const;

export type BusinessGrowthActionKind = (typeof BUSINESS_GROWTH_ACTION_KINDS)[number];

export interface BusinessGrowthAction {
  kind: BusinessGrowthActionKind;
  label: string;
  title: string;
  reason: string;
  steps: string[];
  postContentIsPrimary: boolean;
  program?: {
    cycleNumber: number;
    day: number;
    phaseKey: BusinessGrowthProgramPhaseKey;
    phaseLabel: string;
  };
}

const defaultActionKindByDay: Record<number, BusinessGrowthActionKind> = {
  0: 'REST',
  1: 'PROFILE_IMPROVEMENT',
  2: 'PHOTO',
  3: 'POST',
  4: 'COMMENT_REPLY',
  5: 'CUSTOMER_QUESTION',
  6: 'RESULT_REVIEW',
};

const phaseActionKindByDay: Record<
  BusinessGrowthProgramPhaseKey,
  Record<number, BusinessGrowthActionKind>
> = {
  FOUNDATION: {
    0: 'REST',
    1: 'PROFILE_IMPROVEMENT',
    2: 'CUSTOMER_QUESTION',
    3: 'PROFILE_IMPROVEMENT',
    4: 'CUSTOMER_QUESTION',
    5: 'PROFILE_IMPROVEMENT',
    6: 'RESULT_REVIEW',
  },
  START_POSTING: {
    0: 'REST',
    1: 'PHOTO',
    2: 'CUSTOMER_QUESTION',
    3: 'POST',
    4: 'PHOTO',
    5: 'POST',
    6: 'RESULT_REVIEW',
  },
  BUILD_RESPONSE: {
    0: 'REST',
    1: 'COMMENT_REPLY',
    2: 'CUSTOMER_QUESTION',
    3: 'POST',
    4: 'COMMENT_REPLY',
    5: 'CUSTOMER_QUESTION',
    6: 'RESULT_REVIEW',
  },
  ESTABLISH_PATTERN: {
    0: 'REST',
    1: 'RESULT_REVIEW',
    2: 'CUSTOMER_QUESTION',
    3: 'POST',
    4: 'COMMENT_REPLY',
    5: 'RESULT_REVIEW',
    6: 'RESULT_REVIEW',
  },
};

function dateDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? 3 : date.getUTCDay();
}

export function businessGrowthActionForMission(input: {
  missionDate: string;
  topic: string;
  programStartedAt?: Date | string;
}): BusinessGrowthAction {
  const topic = input.topic.trim() || '今日の発信テーマ';
  const program = input.programStartedAt
    ? businessGrowthProgramStatus({
        startedAt: input.programStartedAt,
        currentDate: input.missionDate,
      })
    : null;
  const day = dateDay(input.missionDate);
  const kind = program
    ? (phaseActionKindByDay[program.phase.key][day] ?? 'POST')
    : (defaultActionKindByDay[day] ?? 'POST');
  const actions: Record<BusinessGrowthActionKind, BusinessGrowthAction> = {
    POST: {
      kind,
      label: '投稿する日',
      title: `「${topic}」を投稿する`,
      reason: '今週伝えたい内容を、お客様へ実際に届ける日です。',
      steps: [
        '下の「内容を見る」を押す',
        '「採用する」を押して投稿文をコピーする',
        '使っているSNSへ貼り付けて投稿する',
      ],
      postContentIsPrimary: true,
    },
    PHOTO: {
      kind,
      label: '写真をためる日',
      title: `「${topic}」に使える写真を1枚撮る`,
      reason: '投稿の日に慌てないよう、今日できる素材だけを準備します。',
      steps: [
        '商品、仕事中の手元、店内のうち一つを選ぶ',
        '明るい場所でスマートフォンを縦にして1枚撮る',
        '人の名前や伝票などが写っていないか確認して保存する',
      ],
      postContentIsPrimary: false,
    },
    COMMENT_REPLY: {
      kind,
      label: 'お客様と話す日',
      title: 'コメントやメッセージへ1件返信する',
      reason: '新しい投稿を増やす前に、今つながっているお客様を大切にします。',
      steps: [
        '使っているSNSを一つ開く',
        '返事をしていないコメントかメッセージを一つ選ぶ',
        'お礼と短い返事を書いて送る',
      ],
      postContentIsPrimary: false,
    },
    CUSTOMER_QUESTION: {
      kind,
      label: '題材を集める日',
      title: 'お客様から聞かれたことを1つ残す',
      reason: '実際の質問は、次の投稿で役立つ一番分かりやすい題材になります。',
      steps: [
        '最近お客様から聞かれたことを一つ思い出す',
        '質問された言葉のまま短くメモする',
        'この画面の「今日の素材を残す」から保存する',
      ],
      postContentIsPrimary: false,
    },
    PROFILE_IMPROVEMENT: {
      kind,
      label: '入口を整える日',
      title: 'SNSのプロフィールを1か所だけ確認する',
      reason: '投稿を見た人が、何の事業か分かる入口を整えます。',
      steps: [
        '使っているSNSで自分のプロフィールを開く',
        '「何をしているか」「誰向けか」「地域」のうち一つが書かれているか見る',
        '抜けている一つだけを追加して保存する',
      ],
      postContentIsPrimary: false,
    },
    RESULT_REVIEW: {
      kind,
      label: '反応を見る日',
      title: '今週の投稿を1つ開いて反応を見る',
      reason: '数字の良し悪しを責めず、次に続ける題材を見つけます。',
      steps: [
        '今週投稿した内容を一つ開く',
        '閲覧、いいね、コメントのうち見える数字を一つ確認する',
        '反応があった内容を次にも使えるよう覚えておく',
      ],
      postContentIsPrimary: false,
    },
    REST: {
      kind,
      label: '休む日',
      title: '今日は休み、次の題材を1つだけメモする',
      reason: '続けるための休みも集客活動の一部です。',
      steps: [
        '投稿や数字の確認は休む',
        '思いついたことがあれば一言だけメモする',
        '何も浮かばなければ、そのまま休んで終わる',
      ],
      postContentIsPrimary: false,
    },
  };
  return {
    ...actions[kind],
    ...(program
      ? {
          program: {
            cycleNumber: program.cycleNumber,
            day: program.day,
            phaseKey: program.phase.key,
            phaseLabel: program.phase.label,
          },
        }
      : {}),
  };
}
