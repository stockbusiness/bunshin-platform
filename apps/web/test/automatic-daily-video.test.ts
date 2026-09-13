import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  mission: vi.fn(),
  membership: vi.fn(),
  contract: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  replace: vi.fn(),
  approve: vi.fn(),
  render: vi.fn(),
  enqueue: vi.fn(),
  policy: vi.fn(),
  imageRequest: vi.fn(),
}));
vi.mock('../src/ai/runtime-provider-configuration', () => ({
  resolveCreatomateRuntimeConfiguration: vi.fn(),
}));
vi.mock('@bunshin/database', () => ({
  prisma: {
    dailyMission: { findFirst: m.mission },
    groupMembership: { findFirst: m.membership },
    serviceCommercialSetting: { findFirst: m.contract },
    socialImageGenerationRequest: { findFirst: m.imageRequest },
  },
  PrismaVideoProjectRepository: class {
    findOwned = m.find;
    create = m.create;
    replacePlan = m.replace;
    approvePlan = m.approve;
  },
  PrismaVideoRenderRepository: class {
    enqueueApproved = m.render;
  },
  PrismaVideoDisclosurePolicyRepository: class {
    findActive = m.policy;
  },
  PrismaJobRepository: class {
    enqueue = m.enqueue;
  },
}));

import {
  buildDailyVideoScenes,
  buildDailyCarouselVideoScenes,
  dailyVideoProjectId,
  queueAutomaticDailyVideo,
} from '../src/services/automatic-daily-video';

const input = {
  environment: 'PRODUCTION' as const,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  groupId: '22222222-2222-4222-8222-222222222222',
  actorUserId: '33333333-3333-4333-8333-333333333333',
  bunshinId: '44444444-4444-4444-8444-444444444444',
  correlationId: 'daily-test',
  mediaMode: 'VIDEO' as const,
  mission: {
    id: '55555555-5555-4555-8555-555555555555',
    assistanceLevel: 'READY_TO_USE',
    topic: '今日の紹介',
  },
};

describe('daily subtitle videos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.mission.mockResolvedValue({
      ...input.mission,
      reason: 'quality checked',
      campaignId: null,
      content: { contentJson: { caption: '投稿用の文章です。'.repeat(10), hashtags: ['#PR'] } },
      socialProfile: { platform: 'INSTAGRAM' },
    });
    m.membership.mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666' });
    m.contract.mockResolvedValue({ id: 'contract' });
    m.find.mockResolvedValue({
      id: dailyVideoProjectId(input.workspaceId, input.bunshinId, input.mission.id),
      status: 'APPROVED',
      revision: 3,
    });
    m.render.mockResolvedValue({ id: '77777777-7777-4777-8777-777777777777', status: 'QUEUED' });
    m.enqueue.mockResolvedValue({ id: 'job' });
  });
  it('keeps full copy and disclosures and makes exactly 30 seconds', () => {
    const copy = '商品について事実を紹介します。'.repeat(15);
    const scenes = buildDailyVideoScenes({ caption: copy, hashtags: ['#PR'] })!;
    expect(scenes.map((scene) => scene.caption).join('')).toBe(`${copy}\n#PR`);
    expect(scenes.reduce((sum, scene) => sum + scene.durationMs, 0)).toBe(30_000);
    expect(scenes.length).toBeGreaterThanOrEqual(5);
    expect(scenes.length).toBeLessThanOrEqual(7);
  });
  it('does not turn production instructions into posting copy or truncate long copy', () => {
    expect(
      buildDailyVideoScenes({ prompt: 'generate a character', shootingInstruction: '撮影する' }),
    ).toBeNull();
    expect(buildDailyVideoScenes({ caption: '長'.repeat(561) })).toBeNull();
  });
  it('turns completed carousel pages into ordered 30-second image scenes', () => {
    const mediaIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ];
    const scenes = buildDailyCarouselVideoScenes(
      { slides: mediaIds.map((_, index) => ({ headline: `${index + 1}枚目`, body: '説明' })) },
      mediaIds,
    )!;
    expect(scenes.map((scene) => scene.keywords[0])).toEqual(mediaIds);
    expect(scenes.every((scene) => scene.visualType === 'GENERATED_IMAGE')).toBe(true);
    expect(scenes.reduce((sum, scene) => sum + scene.durationMs, 0)).toBe(30_000);
  });
  it('keeps each automatic narration within its scene while preserving the full image copy', () => {
    const scenes = buildDailyCarouselVideoScenes(
      {
        slides: Array.from({ length: 5 }, () => ({
          headline: '午後の集中力を戻すための方法',
          body: '席を立って水を飲み、深呼吸して机を整えます。',
        })),
      },
      [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555',
      ],
      true,
    )!;
    expect(
      scenes.every(
        (scene) => [...scene.narration].length <= Math.floor((scene.durationMs / 1_000) * 3),
      ),
    ).toBe(true);
    expect(scenes[0]?.caption).toContain('深呼吸して机を整えます');
  });
  it('isolates deterministic project identities by mission, workspace and bunshin', () => {
    const id = dailyVideoProjectId('w', 'b', 'm');
    expect(id).toBe(dailyVideoProjectId('w', 'b', 'm'));
    expect(id).not.toBe(dailyVideoProjectId('w2', 'b', 'm'));
    expect(id).not.toBe(dailyVideoProjectId('w', 'b2', 'm'));
    expect(id).not.toBe(dailyVideoProjectId('w', 'b', 'm2'));
  });
  it('queues the same render job key on repeated daily preparation', async () => {
    expect(await queueAutomaticDailyVideo(input)).toEqual({ status: 'QUEUED' });
    expect(await queueAutomaticDailyVideo(input)).toEqual({ status: 'QUEUED' });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.enqueue).toHaveBeenCalledTimes(2);
    expect(m.enqueue.mock.calls[0]?.[0]).toEqual(m.enqueue.mock.calls[1]?.[0]);
    expect(m.mission).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: input.workspaceId,
          bunshinId: input.bunshinId,
          bunshin: { groupId: input.groupId, ownerUserId: input.actorUserId },
        }),
      }),
    );
  });
  it('prepares and approves a new subtitle project before queueing its render', async () => {
    m.find.mockResolvedValue(null);
    m.policy.mockResolvedValue({
      id: 'policy',
      version: 1,
      platform: 'INSTAGRAM',
      disclosureText: 'AI利用',
      hashtags: ['#AI'],
      guidance: '投稿前に確認',
      outputMetadata: {},
    });
    m.create.mockResolvedValue({ status: 'DRAFT', revision: 1 });
    m.replace.mockResolvedValue({ status: 'WAITING_APPROVAL', revision: 2 });
    m.approve.mockResolvedValue({ status: 'APPROVED', revision: 3 });
    expect(await queueAutomaticDailyVideo(input)).toEqual({ status: 'QUEUED' });
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: dailyVideoProjectId(input.workspaceId, input.bunshinId, input.mission.id),
        actorUserId: input.actorUserId,
      }),
    );
    expect(m.replace.mock.invocationCallOrder[0]).toBeLessThan(
      m.approve.mock.invocationCallOrder[0]!,
    );
    expect(m.approve.mock.invocationCallOrder[0]).toBeLessThan(
      m.render.mock.invocationCallOrder[0]!,
    );
    expect(m.render).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 3 }));
  });
  it('creates the daily video from the completed image request', async () => {
    const requestId = '88888888-8888-4888-8888-888888888888';
    m.find.mockResolvedValue(null);
    m.imageRequest.mockResolvedValue({
      id: requestId,
      media: Array.from({ length: 5 }, (_, index) => ({
        id: `${index + 1}9999999-9999-4999-8999-999999999999`,
      })),
    });
    m.policy.mockResolvedValue({
      id: 'policy',
      version: 1,
      platform: 'INSTAGRAM',
      disclosureText: 'AI利用',
      hashtags: ['#AI'],
      guidance: '投稿前に確認',
      outputMetadata: {},
    });
    m.create.mockResolvedValue({ status: 'DRAFT', revision: 1 });
    m.replace.mockResolvedValue({ status: 'WAITING_APPROVAL', revision: 2 });
    m.approve.mockResolvedValue({ status: 'APPROVED', revision: 3 });
    expect(
      await queueAutomaticDailyVideo({
        ...input,
        mediaMode: 'IMAGE_AND_VIDEO',
        socialImageGenerationRequestId: requestId,
        videoStyle: 'CALM',
        videoNarration: { enabled: true, voice: 'cedar', speed: 'SLOW' },
        videoBgm: {
          enabled: true,
          assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          volumePercent: 8,
        },
      }),
    ).toEqual({ status: 'QUEUED' });
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PHOTO_SLIDESHOW',
        socialImageGenerationRequestId: requestId,
        narrationEnabled: true,
        narrationVoice: 'cedar',
        narrationSpeed: 'SLOW',
        aiProcessingTypes: ['VOICE_SYNTHESIS'],
        disclosureSnapshot: expect.objectContaining({
          videoStyle: 'CALM',
          backgroundMusic: {
            assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            volumePercent: 8,
          },
        }),
      }),
    );
    expect(m.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        scenes: expect.arrayContaining([
          expect.objectContaining({ visualType: 'GENERATED_IMAGE' }),
        ]),
        projectAiProcessingTypes: ['VOICE_SYNTHESIS'],
      }),
    );
  });
  it.each(['TEXT_ONLY', 'IMAGE'] as const)('does not start video for %s', async (mediaMode) => {
    expect(await queueAutomaticDailyVideo({ ...input, mediaMode })).toEqual({ status: 'SKIPPED' });
    expect(m.mission).not.toHaveBeenCalled();
  });
  it('does not create without a matching member or configured video allowance', async () => {
    m.contract.mockResolvedValue(null);
    expect(await queueAutomaticDailyVideo(input)).toEqual({ status: 'SKIPPED' });
    expect(m.render).not.toHaveBeenCalled();
  });
  it('does not create for another owner, a prompt-only plan or preview environment', async () => {
    m.mission.mockResolvedValue(null);
    expect(await queueAutomaticDailyVideo(input)).toEqual({ status: 'SKIPPED' });
    expect(await queueAutomaticDailyVideo({ ...input, environment: 'STAGING' })).toEqual({
      status: 'SKIPPED',
    });
    expect(
      await queueAutomaticDailyVideo({
        ...input,
        mission: { ...input.mission, assistanceLevel: 'GUIDED' },
      }),
    ).toEqual({ status: 'SKIPPED' });
    expect(m.render).not.toHaveBeenCalled();
  });
  it('leaves a failed render for operational retry without generating another project', async () => {
    m.find.mockResolvedValue({ status: 'FAILED', revision: 3 });
    await queueAutomaticDailyVideo(input);
    expect(m.render).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });
});
