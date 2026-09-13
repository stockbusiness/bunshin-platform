import 'server-only';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function postCopyFromMissionContent(value: unknown) {
  const content = record(value);
  if (!content) return null;
  const caption = typeof content.caption === 'string' ? content.caption.trim() : '';
  if (!caption) return null;
  const hashtags = Array.isArray(content.hashtags)
    ? content.hashtags
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.startsWith('#') && !caption.includes(item))
        .slice(0, 30)
    : [];
  return [caption, hashtags.join(' ')].filter(Boolean).join('\n\n');
}

export function postCopyFromDisclosure(value: unknown) {
  const disclosure = record(value);
  const copy =
    disclosure && typeof disclosure.postCopy === 'string' ? disclosure.postCopy.trim() : '';
  return copy || null;
}

export async function resolveMissionPostCopy(input: {
  workspaceId: string;
  bunshinId: string;
  dailyMissionId: string;
  actorUserId: string;
}) {
  const db = await import('@bunshin/database');
  const selected = await db.prisma.missionContentVariantSelection.findFirst({
    where: {
      workspaceId: input.workspaceId,
      bunshinId: input.bunshinId,
      dailyMissionId: input.dailyMissionId,
      actorUserId: input.actorUserId,
    },
    orderBy: { selectedAt: 'desc' },
    select: { variant: { select: { contentJson: true } } },
  });
  if (selected) return postCopyFromMissionContent(selected.variant.contentJson);
  const original = await db.prisma.missionContent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      bunshinId: input.bunshinId,
      dailyMissionId: input.dailyMissionId,
    },
    select: { contentJson: true },
  });
  return postCopyFromMissionContent(original?.contentJson);
}

export async function resolveVideoPostCopy(input: {
  disclosureSnapshot: unknown;
  socialImageGenerationRequestId: string | null | undefined;
  workspaceId: string;
  ownerUserId: string;
}) {
  const snapshot = postCopyFromDisclosure(input.disclosureSnapshot);
  if (snapshot || !input.socialImageGenerationRequestId) return snapshot;
  const db = await import('@bunshin/database');
  const source = await db.prisma.socialImageGenerationRequest.findFirst({
    where: {
      id: input.socialImageGenerationRequestId,
      workspaceId: input.workspaceId,
      ownerUserId: input.ownerUserId,
    },
    select: { bunshinId: true, dailyMissionId: true },
  });
  return source
    ? resolveMissionPostCopy({
        workspaceId: input.workspaceId,
        bunshinId: source.bunshinId,
        dailyMissionId: source.dailyMissionId,
        actorUserId: input.ownerUserId,
      })
    : null;
}
