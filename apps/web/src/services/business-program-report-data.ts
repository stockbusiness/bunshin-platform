import 'server-only';
import { businessGrowthProgramStatus } from '@bunshin/application';
import type { prisma } from '@bunshin/database';
import { readBusinessOutcomes, sumBusinessOutcomes } from './business-outcomes';
import type { BusinessOutcomes } from './business-outcomes';
import { socialInsightChanges, type SocialInsightMetrics } from './social-insights';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOKYO = 'Asia/Tokyo';

const localDate = (value: Date) =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: TOKYO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const timestamp = (date: string) => new Date(`${date}T00:00:00+09:00`);

const metrics = (value: {
  followers: number | null;
  reach: number | null;
  impressions: number | null;
  profileViews: number | null;
  interactions: number | null;
}): SocialInsightMetrics => ({
  followers: value.followers,
  reach: value.reach,
  impressions: value.impressions,
  profileViews: value.profileViews,
  interactions: value.interactions,
});

export type BusinessProgramReport = {
  userId: string;
  displayName: string;
  businessName: string;
  cycleNumber: number;
  latestCycleNumber: number;
  startedOn: string;
  endedOn: string;
  reportThrough: string;
  complete: boolean;
  day: number;
  progressPercent: number;
  totals: {
    posts: number;
    activeDays: number;
    materials: number;
    pointsEarned: number;
    pointsUsed: number;
    badges: string[];
    outcomes: BusinessOutcomes;
    outcomeTotal: number;
  };
  successfulTopics: Array<{ topic: string; posts: number; outcomes: number }>;
  socialInsight: null | {
    platform: string;
    start: SocialInsightMetrics & { observedOn: string };
    latest: SocialInsightMetrics & { observedOn: string };
    changes: SocialInsightMetrics;
  };
  nextPlan: { weekdays: string; topic: string; destination: string };
};

export async function listBusinessProgramParticipants(input: {
  client: typeof prisma;
  workspaceId: string;
  groupId: string;
}) {
  return input.client.groupMembership.findMany({
    where: {
      workspaceId: input.workspaceId,
      groupId: input.groupId,
      status: 'ACTIVE',
      serviceRole: 'PARTICIPANT',
      consentedAt: { not: null },
      serviceMemberBusinessProfile: { isNot: null },
      user: { status: 'ACTIVE' },
    },
    select: { userId: true, user: { select: { displayName: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function loadBusinessProgramReport(input: {
  client: typeof prisma;
  workspaceId: string;
  groupId: string;
  userId: string;
  cycleNumber?: number;
  asOf?: Date;
}): Promise<BusinessProgramReport | null> {
  const asOf = input.asOf ?? new Date();
  const today = localDate(asOf);
  const membership = await input.client.groupMembership.findFirst({
    where: {
      workspaceId: input.workspaceId,
      groupId: input.groupId,
      userId: input.userId,
      status: 'ACTIVE',
      serviceMemberBusinessProfile: { isNot: null },
      user: { status: 'ACTIVE' },
    },
    select: {
      userId: true,
      user: { select: { displayName: true } },
      serviceMemberBusinessProfile: { select: { businessName: true, createdAt: true } },
    },
  });
  const profile = membership?.serviceMemberBusinessProfile;
  if (!membership || !profile) return null;

  const current = businessGrowthProgramStatus({ startedAt: profile.createdAt, currentDate: today });
  const requested = input.cycleNumber ?? current.cycleNumber;
  const cycleNumber = Math.min(current.cycleNumber, Math.max(1, Math.trunc(requested)));
  const firstStartedOn = localDate(profile.createdAt);
  const startedOn = addDays(firstStartedOn, (cycleNumber - 1) * 90);
  const endedOn = addDays(startedOn, 89);
  const complete = endedOn < today || cycleNumber < current.cycleNumber;
  const reportThrough = complete ? endedOn : today;
  const startAt = timestamp(startedOn);
  const endAt = timestamp(addDays(reportThrough, 1));
  const elapsedDays = Math.max(
    1,
    Math.min(90, Math.floor((timestamp(reportThrough).getTime() - startAt.getTime()) / DAY_MS) + 1),
  );

  const bunshins = await input.client.bunshin.findMany({
    where: {
      workspaceId: input.workspaceId,
      groupId: input.groupId,
      ownerUserId: input.userId,
      status: { not: 'ARCHIVED' },
    },
    select: { id: true },
  });
  const bunshinIds = bunshins.map(({ id }) => id);
  if (!bunshinIds.length) return null;

  const [missions, posts, activities, materials, points, badges, insights, strategy] =
    await Promise.all([
      input.client.dailyMission.findMany({
        where: {
          workspaceId: input.workspaceId,
          bunshinId: { in: bunshinIds },
          missionDate: {
            gte: new Date(`${startedOn}T00:00:00.000Z`),
            lte: new Date(`${reportThrough}T00:00:00.000Z`),
          },
        },
        select: { id: true, topic: true },
      }),
      input.client.postRecord.findMany({
        where: {
          workspaceId: input.workspaceId,
          bunshinId: { in: bunshinIds },
          actorUserId: input.userId,
          postedAt: { gte: startAt, lt: endAt },
        },
        select: { dailyMissionId: true, postedAt: true, manualMetrics: true },
      }),
      input.client.missionActivity.findMany({
        where: {
          workspaceId: input.workspaceId,
          bunshinId: { in: bunshinIds },
          actorUserId: input.userId,
          occurredAt: { gte: startAt, lt: endAt },
        },
        select: { occurredAt: true },
      }),
      input.client.bunshinMemory.findMany({
        where: {
          workspaceId: input.workspaceId,
          bunshinId: { in: bunshinIds },
          sourceType: 'USER_INPUT',
          sourceId: { startsWith: 'daily-action:' },
          active: true,
          deletedAt: null,
          createdAt: { gte: startAt, lt: endAt },
        },
        select: { createdAt: true },
      }),
      input.client.pointTransaction.findMany({
        where: {
          workspaceId: input.workspaceId,
          groupId: input.groupId,
          userId: input.userId,
          type: { in: ['GRANT', 'CONSUME'] },
          createdAt: { gte: startAt, lt: endAt },
        },
        select: { type: true, amount: true },
      }),
      input.client.badgeAward.findMany({
        where: {
          workspaceId: input.workspaceId,
          groupId: input.groupId,
          userId: input.userId,
          awardedAt: { gte: startAt, lt: endAt },
        },
        select: { badgeVersion: { select: { title: true } } },
        orderBy: { awardedAt: 'asc' },
      }),
      input.client.socialInsightSnapshot.findMany({
        where: {
          workspaceId: input.workspaceId,
          groupId: input.groupId,
          userId: input.userId,
          bunshinId: { in: bunshinIds },
          observedOn: {
            gte: new Date(`${startedOn}T00:00:00.000Z`),
            lte: new Date(`${reportThrough}T00:00:00.000Z`),
          },
        },
        select: {
          id: true,
          socialProfileId: true,
          platform: true,
          observedOn: true,
          followers: true,
          reach: true,
          impressions: true,
          profileViews: true,
          interactions: true,
          updatedAt: true,
        },
        orderBy: [{ observedOn: 'asc' }, { updatedAt: 'asc' }],
      }),
      input.client.socialAccountStrategy.findFirst({
        where: {
          workspaceId: input.workspaceId,
          bunshinId: { in: bunshinIds },
          status: 'APPROVED',
        },
        select: { destinationDetail: true },
        orderBy: { version: 'desc' },
      }),
    ]);

  const missionTopic = new Map(missions.map(({ id, topic }) => [id, topic] as const));
  const topicResults = new Map<string, { posts: number; outcomes: number }>();
  for (const post of posts) {
    const topic = missionTopic.get(post.dailyMissionId) ?? '投稿した内容';
    const outcomeCount = Object.values(readBusinessOutcomes(post.manualMetrics)).reduce(
      (sum, value) => sum + value,
      0,
    );
    const previous = topicResults.get(topic) ?? { posts: 0, outcomes: 0 };
    topicResults.set(topic, {
      posts: previous.posts + 1,
      outcomes: previous.outcomes + outcomeCount,
    });
  }
  const successfulTopics = [...topicResults.entries()]
    .map(([topic, result]) => ({ topic, ...result }))
    .filter(({ outcomes }) => outcomes > 0)
    .sort(
      (left, right) =>
        right.outcomes - left.outcomes ||
        right.posts - left.posts ||
        left.topic.localeCompare(right.topic, 'ja'),
    )
    .slice(0, 3);

  const activeDates = new Set([
    ...posts.map(({ postedAt }) => localDate(postedAt)),
    ...activities.map(({ occurredAt }) => localDate(occurredAt)),
    ...materials.map(({ createdAt }) => localDate(createdAt)),
  ]);
  const weekdayLabels = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const weekdayCounts = new Map<number, number>();
  for (const post of posts) {
    const day = new Date(`${localDate(post.postedAt)}T00:00:00.000Z`).getUTCDay();
    weekdayCounts.set(day, (weekdayCounts.get(day) ?? 0) + 1);
  }
  const weekdays = [...weekdayCounts.entries()]
    .sort(
      ([leftDay, leftCount], [rightDay, rightCount]) =>
        rightCount - leftCount || leftDay - rightDay,
    )
    .slice(0, 2)
    .map(([day]) => weekdayLabels[day]!)
    .join('・');

  const latestInsight = insights.at(-1) ?? null;
  const relatedInsights = latestInsight
    ? insights.filter(({ socialProfileId }) => socialProfileId === latestInsight.socialProfileId)
    : [];
  const startInsight = relatedInsights[0] ?? null;
  const outcomes = sumBusinessOutcomes(posts.map(({ manualMetrics }) => manualMetrics));
  const outcomeTotal = Object.values(outcomes).reduce((sum, value) => sum + value, 0);
  return {
    userId: membership.userId,
    displayName: membership.user.displayName,
    businessName: profile.businessName,
    cycleNumber,
    latestCycleNumber: current.cycleNumber,
    startedOn,
    endedOn,
    reportThrough,
    complete,
    day: elapsedDays,
    progressPercent: Math.round((elapsedDays / 90) * 100),
    totals: {
      posts: posts.length,
      activeDays: activeDates.size,
      materials: materials.length,
      pointsEarned: points
        .filter(({ type }) => type === 'GRANT')
        .reduce((sum, { amount }) => sum + Math.max(0, amount), 0),
      pointsUsed: Math.abs(
        points
          .filter(({ type }) => type === 'CONSUME')
          .reduce((sum, { amount }) => sum + amount, 0),
      ),
      badges: [...new Set(badges.map(({ badgeVersion }) => badgeVersion.title))],
      outcomes,
      outcomeTotal,
    },
    successfulTopics,
    socialInsight:
      latestInsight && startInsight
        ? {
            platform: latestInsight.platform,
            start: {
              ...metrics(startInsight),
              observedOn: startInsight.observedOn.toISOString().slice(0, 10),
            },
            latest: {
              ...metrics(latestInsight),
              observedOn: latestInsight.observedOn.toISOString().slice(0, 10),
            },
            changes: socialInsightChanges(metrics(latestInsight), metrics(startInsight)),
          }
        : null,
    nextPlan: {
      weekdays: weekdays || '毎週の予定表に表示された曜日',
      topic: successfulTopics[0]?.topic ?? '反応を記録しながら見つける題材',
      destination: strategy?.destinationDetail?.trim() || 'SNSプロフィールに設定した問い合わせ先',
    },
  };
}
