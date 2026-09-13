import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { VideoCompletionMessagingPort } from '@bunshin/application';
import { ApplicationError } from '@bunshin/shared';
import { LineMessagingApiAdapter } from './messaging-provider';
import { SupabaseVideoRenderOutputStorage } from '../video/video-render-output-storage';

const snapshotSchema = z
  .object({
    recipientId: z.string(),
    credentialFingerprint: z.string(),
    projectTitle: z.string(),
    reviewUrl: z.string(),
    retryKey: z.string().uuid(),
    video: z.object({ originalContentUrl: z.string(), previewImageUrl: z.string() }).optional(),
  })
  .strict();

export interface VideoDeliveryMessagingContext {
  deliveryId: string;
  workspaceId: string;
  groupId: string;
  ownerUserId: string;
  videoProjectId: string;
  videoRenderId: string;
  notificationAttemptCount: number;
}

/** Freeze an operator delivery before the first external send, including its signed video URL. */
export function videoDeliveryMessaging(
  context: VideoDeliveryMessagingContext,
  loadDatabase = () => import('@bunshin/database'),
): VideoCompletionMessagingPort {
  const messaging = new LineMessagingApiAdapter();
  return {
    getQuota: (token) => messaging.getQuota(token),
    async pushVideoCompletion(input) {
      const db = await loadDatabase();
      const deliveryWhere = {
        id: context.deliveryId,
        workspaceId: context.workspaceId,
        groupId: context.groupId,
        ownerUserId: context.ownerUserId,
        videoProjectId: context.videoProjectId,
        videoRenderId: context.videoRenderId,
        status: { notIn: ['EXPIRED' as const, 'REVOKED' as const] },
      };
      const renderWhere = {
        id: context.videoRenderId,
        workspaceId: context.workspaceId,
        groupId: context.groupId,
        ownerUserId: context.ownerUserId,
        videoProjectId: context.videoProjectId,
        status: 'SUCCEEDED' as const,
        outputStorageKey: { not: null },
        deletedAt: null,
      };
      const [delivery, render] = await Promise.all([
        db.prisma.videoDelivery.findFirst({ where: deliveryWhere }),
        db.prisma.videoRender.findFirst({ where: renderWhere }),
      ]);
      if (!delivery || !render?.outputStorageKey)
        throw new ApplicationError('FORBIDDEN', 'video delivery attachment unavailable');

      const credentialFingerprint = createHash('sha256').update(input.accessToken).digest('hex');
      let stored = delivery.notificationSnapshot;
      if (!stored) {
        const expectedKey = `${context.workspaceId}/${context.ownerUserId}/${context.videoRenderId}.mp4`;
        if (render.outputStorageKey !== expectedKey)
          throw new ApplicationError('FORBIDDEN', 'video delivery storage scope mismatch');
        const minimumExpiry = Date.now() + 24 * 60 * 60 * 1000;
        const attach =
          context.notificationAttemptCount === 0 &&
          (!render.expiresAt || render.expiresAt.getTime() > minimumExpiry) &&
          (!delivery.expiresAt || delivery.expiresAt.getTime() > minimumExpiry);
        const snapshot = {
          recipientId: input.recipientId,
          credentialFingerprint,
          projectTitle: input.projectTitle,
          reviewUrl: input.reviewUrl,
          retryKey: input.retryKey,
          ...(attach
            ? {
                video: {
                  originalContentUrl:
                    await new SupabaseVideoRenderOutputStorage().createLineDeliveryUrl(expectedKey),
                  previewImageUrl: new URL('/api/media/video-cover', input.reviewUrl).toString(),
                },
              }
            : {}),
        };
        await db.prisma.videoDelivery.updateMany({
          where: { ...deliveryWhere, notificationSnapshot: null },
          data: { notificationSnapshot: JSON.stringify(snapshot) },
        });
        stored =
          (await db.prisma.videoDelivery.findFirst({ where: deliveryWhere }))
            ?.notificationSnapshot ?? null;
      }
      if (!stored)
        throw new ApplicationError('CONFLICT', 'video delivery notification unavailable');
      const snapshot = snapshotSchema.parse(JSON.parse(stored));
      if (
        snapshot.recipientId !== input.recipientId ||
        snapshot.credentialFingerprint !== credentialFingerprint ||
        snapshot.retryKey !== input.retryKey
      )
        throw new ApplicationError('FORBIDDEN', 'video delivery destination changed');
      return messaging.pushVideoCompletion({
        accessToken: input.accessToken,
        recipientId: snapshot.recipientId,
        projectTitle: snapshot.projectTitle,
        reviewUrl: snapshot.reviewUrl,
        retryKey: snapshot.retryKey,
        ...(snapshot.video ? { video: snapshot.video } : {}),
      });
    },
  };
}
