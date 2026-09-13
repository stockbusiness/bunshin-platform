export type BusinessPilotEvent = { userId: string; occurredAt: Date };
export type BusinessPilotParticipant = { userId: string; joinedAt: Date };

export type RetentionMetric = { eligible: number; retained: number; percent: number | null };

const DAY = 86_400_000;
const percent = (value: number, total: number) =>
  total === 0 ? null : Math.min(100, Math.round((value / total) * 100));
const tokyoDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

function retention(
  participants: BusinessPilotParticipant[],
  events: BusinessPilotEvent[],
  now: Date,
  day: number,
): RetentionMetric {
  const eligible = participants.filter(
    ({ joinedAt }) => joinedAt.getTime() + (day + 1) * DAY <= now.getTime(),
  );
  const retained = eligible.filter(({ userId, joinedAt }) => {
    const start = joinedAt.getTime() + day * DAY;
    const end = start + DAY;
    return events.some(
      (event) =>
        event.userId === userId &&
        event.occurredAt.getTime() >= start &&
        event.occurredAt.getTime() < end,
    );
  }).length;
  return { eligible: eligible.length, retained, percent: percent(retained, eligible.length) };
}

export function buildBusinessPilotMetrics(input: {
  participants: BusinessPilotParticipant[];
  events: BusinessPilotEvent[];
  now: Date;
  missions: number;
  viewed: number;
  accepted: number;
  copied: number;
  posted: number;
  lineSent: number;
  lineOpened: number;
}) {
  const sevenDaysAgo = input.now.getTime() - 7 * DAY;
  const datesByUser = new Map<string, Set<string>>();
  for (const event of input.events) {
    if (event.occurredAt.getTime() < sevenDaysAgo || event.occurredAt > input.now) continue;
    const dates = datesByUser.get(event.userId) ?? new Set<string>();
    dates.add(tokyoDate(event.occurredAt));
    datesByUser.set(event.userId, dates);
  }
  return {
    openRate: percent(input.lineOpened, input.lineSent),
    viewRate: percent(input.viewed, input.missions),
    acceptanceRate: percent(input.accepted, input.missions),
    copyRate: percent(input.copied, input.missions),
    postRate: percent(input.posted, input.missions),
    sevenDayRetention: retention(input.participants, input.events, input.now, 7),
    thirtyDayRetention: retention(input.participants, input.events, input.now, 30),
    threeDayActiveUsers: [...datesByUser.values()].filter((dates) => dates.size >= 3).length,
  };
}
