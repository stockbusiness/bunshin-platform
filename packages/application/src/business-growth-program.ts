export const BUSINESS_GROWTH_PROGRAM_LENGTH_DAYS = 90;

export const BUSINESS_GROWTH_PROGRAM_PHASES = [
  {
    key: 'FOUNDATION',
    startDay: 1,
    endDay: 14,
    label: '土台を整える',
    title: 'SNS集客の土台を整える',
    description: '売りたい商品、お客様、自社の強み、プロフィールと問い合わせ先を整理します。',
    goals: [
      '一番紹介したい商品・サービスを決める',
      '届けたいお客様と自社の強みを言葉にする',
      'SNSプロフィールと問い合わせ先を整える',
    ],
  },
  {
    key: 'START_POSTING',
    startDay: 15,
    endDay: 30,
    label: '投稿を始める',
    title: '無理のない投稿を始める',
    description: '投稿文と撮影指示を使い、自社を知ってもらう発信を少しずつ始めます。',
    goals: [
      '自己紹介や商品・サービスを伝える',
      'よくある質問やお客様の悩みに答える',
      '仕事風景、利用事例、お客様の声を題材にする',
    ],
  },
  {
    key: 'BUILD_RESPONSE',
    startDay: 31,
    endDay: 60,
    label: '反応を作る',
    title: 'お客様とのやり取りを増やす',
    description: '投稿だけでなく返信や交流も行い、問い合わせにつながる接点を作ります。',
    goals: [
      'コメントやメッセージへ返信する',
      '実際の質問や感想を次の投稿へ生かす',
      '過去の投稿を再利用して問い合わせ先を案内する',
    ],
  },
  {
    key: 'ESTABLISH_PATTERN',
    startDay: 61,
    endDay: 90,
    label: '自社の型を作る',
    title: '続けられる集客パターンを作る',
    description: '反応と問い合わせを振り返り、自社に合う題材と曜日の型を固めます。',
    goals: [
      '反応のよい題材と問い合わせ経路を確認する',
      '成果のあった投稿を再利用する',
      '曜日ごとの発信パターンと次の90日計画を決める',
    ],
  },
] as const;

export type BusinessGrowthProgramPhaseKey = (typeof BUSINESS_GROWTH_PROGRAM_PHASES)[number]['key'];

export type BusinessGrowthProgramPhase = (typeof BUSINESS_GROWTH_PROGRAM_PHASES)[number];

export interface BusinessGrowthProgramStatus {
  cycleNumber: number;
  day: number;
  daysRemaining: number;
  progressPercent: number;
  phase: BusinessGrowthProgramPhase;
}

const dayNumber = (date: string) =>
  Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / (24 * 60 * 60 * 1000));

export function dateInBusinessTimezone(date: Date, timezone = 'Asia/Tokyo') {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function businessGrowthProgramStatus(input: {
  startedAt: Date | string;
  currentDate: string;
  timezone?: string;
}): BusinessGrowthProgramStatus {
  const startedDate =
    input.startedAt instanceof Date
      ? dateInBusinessTimezone(input.startedAt, input.timezone)
      : input.startedAt;
  const startedDay = dayNumber(startedDate);
  const currentDay = dayNumber(input.currentDate);
  const elapsedDays =
    Number.isFinite(startedDay) && Number.isFinite(currentDay)
      ? Math.max(0, currentDay - startedDay)
      : 0;
  const cycleNumber = Math.floor(elapsedDays / BUSINESS_GROWTH_PROGRAM_LENGTH_DAYS) + 1;
  const day = (elapsedDays % BUSINESS_GROWTH_PROGRAM_LENGTH_DAYS) + 1;
  const phase =
    BUSINESS_GROWTH_PROGRAM_PHASES.find(
      (candidate) => day >= candidate.startDay && day <= candidate.endDay,
    ) ?? BUSINESS_GROWTH_PROGRAM_PHASES[0];
  return {
    cycleNumber,
    day,
    daysRemaining: BUSINESS_GROWTH_PROGRAM_LENGTH_DAYS - day,
    progressPercent: Math.round((day / BUSINESS_GROWTH_PROGRAM_LENGTH_DAYS) * 100),
    phase,
  };
}
