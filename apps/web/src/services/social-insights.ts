export const SOCIAL_INSIGHT_METRIC_KEYS = [
  'followers',
  'reach',
  'impressions',
  'profileViews',
  'interactions',
] as const;

export type SocialInsightMetricKey = (typeof SOCIAL_INSIGHT_METRIC_KEYS)[number];

export type SocialInsightMetrics = Record<SocialInsightMetricKey, number | null>;

export type SocialInsightSnapshotView = SocialInsightMetrics & {
  id: string;
  socialProfileId: string;
  platform: string;
  observedOn: string;
  periodStart: string | null;
  periodEnd: string | null;
  source: string;
};

export const socialInsightLabels: Record<SocialInsightMetricKey, string> = {
  followers: 'フォロワー',
  reach: 'リーチ',
  impressions: '表示回数',
  profileViews: 'プロフィール閲覧',
  interactions: '反応数',
};

export function socialInsightChanges(
  latest: SocialInsightMetrics,
  previous: SocialInsightMetrics | null,
) {
  return Object.fromEntries(
    SOCIAL_INSIGHT_METRIC_KEYS.map((key) => [
      key,
      latest[key] === null || previous?.[key] === null || previous?.[key] === undefined
        ? null
        : latest[key] - previous[key],
    ]),
  ) as SocialInsightMetrics;
}
