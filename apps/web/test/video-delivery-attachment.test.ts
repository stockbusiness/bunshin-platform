import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoDeliveryMessagingContext } from '../src/line/video-delivery-messaging';

const fake = vi.hoisted(() => ({
  findDelivery: vi.fn(),
  updateDelivery: vi.fn(),
  findRender: vi.fn(),
  send: vi.fn(),
  sign: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@bunshin/database', () => ({
  prisma: {
    videoDelivery: { findFirst: fake.findDelivery, updateMany: fake.updateDelivery },
    videoRender: { findFirst: fake.findRender },
  },
}));
vi.mock('../src/line/messaging-provider', () => ({
  LineMessagingApiAdapter: class {
    pushVideoCompletion = fake.send;
    getQuota = vi.fn();
  },
}));
vi.mock('../src/video/video-render-output-storage', () => ({
  SupabaseVideoRenderOutputStorage: class {
    createLineDeliveryUrl = fake.sign;
  },
}));

import { videoDeliveryMessaging } from '../src/line/video-delivery-messaging';

const id = '11111111-1111-4111-8111-111111111111';
const renderId = '22222222-2222-4222-8222-222222222222';
const context: VideoDeliveryMessagingContext = {
  deliveryId: id,
  workspaceId: 'workspace',
  groupId: 'group',
  ownerUserId: 'owner',
  videoProjectId: 'project',
  videoRenderId: renderId,
  notificationAttemptCount: 0,
};
const input = {
  accessToken: 'test-token',
  recipientId: 'recipient',
  projectTitle: '運営者から届いた動画',
  reviewUrl: 'https://example.com/review',
  retryKey: id,
};

const createMessaging = (value: VideoDeliveryMessagingContext = context) =>
  videoDeliveryMessaging(value, () =>
    Promise.resolve({
      prisma: {
        videoDelivery: { findFirst: fake.findDelivery, updateMany: fake.updateDelivery },
        videoRender: { findFirst: fake.findRender },
      },
    } as never),
  );

beforeEach(() => {
  vi.clearAllMocks();
  const delivery = {
    notificationSnapshot: null as string | null,
    expiresAt: null as Date | null,
  };
  fake.findDelivery.mockImplementation(() => Promise.resolve({ ...delivery }));
  fake.updateDelivery.mockImplementation((value: { data: { notificationSnapshot: string } }) => {
    if (!delivery.notificationSnapshot)
      delivery.notificationSnapshot = value.data.notificationSnapshot;
    return Promise.resolve({ count: 1 });
  });
  fake.findRender.mockResolvedValue({
    outputStorageKey: `workspace/owner/${renderId}.mp4`,
    expiresAt: null,
  });
  fake.sign.mockResolvedValue('https://storage.example/video.mp4?token=signed');
  fake.send.mockResolvedValue({ ok: true });
});

describe('operator video delivery attachments', () => {
  it('freezes the owned video attachment before sending and reuses it on retry', async () => {
    const messaging = createMessaging();
    await messaging.pushVideoCompletion(input);
    await messaging.pushVideoCompletion({
      ...input,
      projectTitle: '変更後',
      reviewUrl: 'https://example.com/changed',
    });

    expect(fake.send.mock.calls[1]).toEqual(fake.send.mock.calls[0]);
    expect(fake.send).toHaveBeenCalledWith(
      expect.objectContaining({
        video: {
          originalContentUrl: 'https://storage.example/video.mp4?token=signed',
          previewImageUrl: 'https://example.com/api/media/video-cover',
        },
      }),
    );
    expect(fake.updateDelivery.mock.invocationCallOrder[0]).toBeLessThan(
      fake.send.mock.invocationCallOrder[0]!,
    );
    expect(fake.findDelivery).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspaceId: context.workspaceId,
        groupId: context.groupId,
        ownerUserId: context.ownerUserId,
        videoProjectId: context.videoProjectId,
        videoRenderId: context.videoRenderId,
        status: { notIn: ['EXPIRED', 'REVOKED'] },
      }),
    });
  });

  it('uses the persisted winner when simultaneous attempts create different signed URLs', async () => {
    fake.sign
      .mockResolvedValueOnce('https://storage.example/one')
      .mockResolvedValueOnce('https://storage.example/two');
    await Promise.all([
      createMessaging().pushVideoCompletion(input),
      createMessaging().pushVideoCompletion(input),
    ]);
    expect(fake.send.mock.calls[0]).toEqual(fake.send.mock.calls[1]);
  });

  it.each([{ recipientId: 'different' }, { accessToken: 'rotated' }])(
    'refuses destination or credential changes after preparing a delivery',
    async (change) => {
      const messaging = createMessaging();
      await messaging.pushVideoCompletion(input);
      await expect(messaging.pushVideoCompletion({ ...input, ...change })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(fake.send).toHaveBeenCalledOnce();
    },
  );

  it('keeps a legacy retry or soon-expiring delivery as a link notification', async () => {
    await createMessaging({ ...context, notificationAttemptCount: 1 }).pushVideoCompletion(input);
    expect(fake.sign).not.toHaveBeenCalled();
    expect(fake.send.mock.calls[0]![0]).not.toHaveProperty('video');
  });

  it('refuses another owner, missing render, or mismatched storage path', async () => {
    fake.findDelivery.mockResolvedValueOnce(null);
    await expect(createMessaging().pushVideoCompletion(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    fake.findRender.mockResolvedValue({
      outputStorageKey: 'workspace/another-owner/video.mp4',
      expiresAt: null,
    });
    await expect(createMessaging().pushVideoCompletion(input)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(fake.send).not.toHaveBeenCalled();
  });
});
