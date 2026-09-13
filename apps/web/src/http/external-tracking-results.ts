import 'server-only';
import { requestIdFromHeader } from '@bunshin/observability';
import { ApplicationError, toApiError } from '@bunshin/shared';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { currentUserProvider } from '../auth/current-user';
import { requireSameOrigin } from '../auth/request-security';

const uuid = z.string().uuid();
const resultRecordSchema = z
  .object({
    externalEventId: z.string().min(1).max(200),
    metricType: z.enum(['CLICK', 'LEAD', 'SIGNUP', 'PURCHASE', 'OTHER']),
    count: z.number().int().min(1).max(1_000_000).optional(),
    amountMinor: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    occurredAt: z.string().datetime(),
    externalLinkId: z.string().min(1).max(255).nullable().optional(),
    externalMemberId: z.string().min(1).max(255).nullable().optional(),
  })
  .strict();
const resultBatchSchema = z
  .object({ records: z.array(resultRecordSchema).min(1).max(500) })
  .strict();

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function sameHash(left: string, right: string) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function response(request: Request, operation: () => Promise<unknown>) {
  const requestId = requestIdFromHeader(request.headers.get('x-request-id'));
  try {
    return Response.json(
      { data: await operation(), requestId },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (error) {
    const mapped = toApiError(error, requestId);
    return Response.json(mapped.body, {
      status: mapped.status,
      headers: { 'cache-control': 'private, no-store' },
    });
  }
}

async function requireManager(workspaceId: string, actorUserId: string, groupId: string) {
  const db = await import('@bunshin/database');
  const workspaceManager = await db.prisma.workspaceMembership.findFirst({
    where: {
      workspaceId,
      userId: actorUserId,
      status: 'ACTIVE',
      role: { in: ['OWNER', 'ADMIN'] },
    },
    select: { id: true },
  });
  if (workspaceManager) return;
  const groupManager = await db.prisma.groupMembership.findFirst({
    where: { workspaceId, groupId, userId: actorUserId, status: 'ACTIVE', role: 'MANAGER' },
    select: { id: true },
  });
  if (!groupManager) throw new ApplicationError('FORBIDDEN', 'management role required');
}

export function rotateExternalTrackingResultTokenResponse(
  request: Request,
  workspaceId: string,
  systemId: string,
  serviceId?: string,
) {
  return response(request, async () => {
    requireSameOrigin(request);
    const user = await (await currentUserProvider()).getCurrentUser();
    if (!user) throw new ApplicationError('UNAUTHENTICATED', 'session required');
    const parsedWorkspaceId = uuid.parse(workspaceId);
    const parsedSystemId = uuid.parse(systemId);
    const db = await import('@bunshin/database');
    const system = await db.prisma.externalTrackingSystem.findFirst({
      where: {
        id: parsedSystemId,
        workspaceId: parsedWorkspaceId,
        ...(serviceId ? { groupId: serviceId } : {}),
      },
      select: { id: true, groupId: true },
    });
    if (!system) throw new ApplicationError('NOT_FOUND', 'tracking system unavailable');
    await requireManager(parsedWorkspaceId, user.userId, system.groupId);

    const token = `wwr_${randomBytes(32).toString('base64url')}`;
    const now = new Date();
    await db.prisma.$transaction([
      db.prisma.externalTrackingSystem.update({
        where: { id: system.id },
        data: {
          resultIngestTokenHash: tokenHash(token),
          resultIngestTokenPrefix: token.slice(0, 12),
          resultIngestTokenCreatedAt: now,
          updatedByUserId: user.userId,
        },
      }),
      db.prisma.externalTrackingAuditLog.create({
        data: {
          workspaceId: parsedWorkspaceId,
          groupId: system.groupId,
          resourceType: 'RESULT_CONNECTION',
          resourceId: system.id,
          action: 'UPDATED',
          afterData: { tokenPrefix: token.slice(0, 12), configuredAt: now.toISOString() },
          performedByUserId: user.userId,
        },
      }),
    ]);
    const endpointPath = `/api/external-tracking/results/${system.id}`;
    return {
      token,
      endpointPath,
      endpointUrl: new URL(endpointPath, request.url).toString(),
      configuredAt: now,
    };
  });
}

export function ingestExternalTrackingResultsResponse(request: Request, systemId: string) {
  return response(request, async () => {
    const parsedSystemId = uuid.parse(systemId);
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer '))
      throw new ApplicationError('UNAUTHENTICATED', 'result ingest token required');
    const presentedToken = authorization.slice('Bearer '.length).trim();
    if (!presentedToken)
      throw new ApplicationError('UNAUTHENTICATED', 'result ingest token required');
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (contentLength > 1_000_000)
      throw new ApplicationError('VALIDATION_ERROR', 'result batch is too large');

    const db = await import('@bunshin/database');
    const system = await db.prisma.externalTrackingSystem.findFirst({
      where: { id: parsedSystemId, status: 'ACTIVE', resultIngestTokenHash: { not: null } },
      select: {
        id: true,
        workspaceId: true,
        groupId: true,
        resultIngestTokenHash: true,
      },
    });
    if (
      !system?.resultIngestTokenHash ||
      !sameHash(tokenHash(presentedToken), system.resultIngestTokenHash)
    )
      throw new ApplicationError('UNAUTHENTICATED', 'invalid result ingest token');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new ApplicationError('VALIDATION_ERROR', 'application/json required');

    const batch = resultBatchSchema.parse(await request.json());
    const linkKeys = [...new Set(batch.records.flatMap((item) => item.externalLinkId ?? []))];
    const memberKeys = [...new Set(batch.records.flatMap((item) => item.externalMemberId ?? []))];
    const [links, members] = await Promise.all([
      linkKeys.length
        ? db.prisma.externalTrackingLink.findMany({
            where: { systemId: system.id, externalLinkId: { in: linkKeys } },
            select: { id: true, externalLinkId: true },
          })
        : [],
      memberKeys.length
        ? db.prisma.externalTrackingMemberIdentity.findMany({
            where: { systemId: system.id, externalMemberId: { in: memberKeys } },
            select: { id: true, externalMemberId: true },
          })
        : [],
    ]);
    const linkIds = new Map(links.map((item) => [item.externalLinkId, item.id]));
    const memberIds = new Map(members.map((item) => [item.externalMemberId, item.id]));
    const rows = batch.records.map((item) => ({
      workspaceId: system.workspaceId,
      groupId: system.groupId,
      systemId: system.id,
      externalEventId: item.externalEventId,
      metricType: item.metricType,
      count: item.count ?? 1,
      amountMinor: item.amountMinor ?? null,
      currency: item.currency ?? null,
      occurredAt: new Date(item.occurredAt),
      externalTrackingLinkId: item.externalLinkId
        ? (linkIds.get(item.externalLinkId) ?? null)
        : null,
      memberIdentityId: item.externalMemberId
        ? (memberIds.get(item.externalMemberId) ?? null)
        : null,
    }));
    const created = await db.prisma.$transaction(async (tx) => {
      const result = await tx.externalTrackingResult.createMany({
        data: rows,
        skipDuplicates: true,
      });
      await tx.externalTrackingSystem.update({
        where: { id: system.id },
        data: { lastResultReceivedAt: new Date() },
      });
      return result.count;
    });
    return {
      accepted: rows.length,
      inserted: created,
      duplicates: rows.length - created,
      unmatchedLinks: batch.records.filter(
        (item) => item.externalLinkId && !linkIds.has(item.externalLinkId),
      ).length,
      unmatchedMembers: batch.records.filter(
        (item) => item.externalMemberId && !memberIds.has(item.externalMemberId),
      ).length,
    };
  });
}
