import { describe, expect, it, vi } from 'vitest';
import type * as ApplicationModule from '@bunshin/application';

vi.mock('server-only', () => ({}));

const m = vi.hoisted(() => ({
  reserve: vi.fn(),
  finish: vi.fn(),
  organizationQuota: vi.fn(),
  membership: vi.fn(),
  mission: vi.fn(),
  brand: vi.fn(),
  selectedPhoto: vi.fn(),
  readPhoto: vi.fn(),
  normalizePhoto: vi.fn(),
  storeReference: vi.fn(),
  createRequest: vi.fn(),
  transitionRequest: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock('../src/service-media-generation-quota', () => ({
  reserveServiceMediaGeneration: m.reserve,
  finishServiceMediaGeneration: m.finish,
}));
vi.mock('../src/organization-generation-quota', () => ({
  assertOrganizationGenerationQuota: m.organizationQuota,
}));
vi.mock('../src/daily-actions/daily-action-storage', () => ({
  DailyActionStorage: class {
    read = m.readPhoto;
  },
}));
vi.mock('../src/social-image-reference', () => ({
  normalizeImageReferenceBytes: m.normalizePhoto,
}));
vi.mock('../src/social-image-storage', () => ({
  SupabaseSocialImageStorage: class {
    storeReference = m.storeReference;
  },
}));
vi.mock('@bunshin/database', () => ({
  prisma: {
    groupMembership: { findFirst: m.membership },
    dailyMission: { findFirst: m.mission },
    serviceBrand: { findFirst: m.brand },
    bunshinMemory: { findFirst: m.selectedPhoto },
  },
  PrismaSocialImageGenerationAuthorizationRepository: class {},
  PrismaSocialImageGenerationRequestRepository: class {},
  PrismaJobRepository: class {},
}));
vi.mock('@bunshin/application', async (importOriginal) => {
  const actual = await importOriginal<typeof ApplicationModule>();
  return {
    ...actual,
    CreateSocialImageGenerationRequest: class {
      execute = m.createRequest;
    },
    TransitionSocialImageGenerationRequest: class {
      execute = m.transitionRequest;
    },
    EnqueueJob: class {
      enqueue = m.enqueue;
    },
  };
});

import {
  editorialSlidesForMission,
  isAutomaticDailyImageEligible,
  queueAutomaticDailyImage,
} from '../src/services/automatic-daily-image';

const automaticInput = {
  environment: 'PRODUCTION' as const,
  workspaceId: '11111111-1111-4111-8111-111111111111',
  groupId: '22222222-2222-4222-8222-222222222222',
  actorUserId: '33333333-3333-4333-8333-333333333333',
  bunshinId: '44444444-4444-4444-8444-444444444444',
  correlationId: 'daily-image-test',
  mediaMode: 'IMAGE' as const,
  mission: {
    id: '55555555-5555-4555-8555-555555555555',
    assistanceLevel: 'READY_TO_USE' as const,
    format: 'IMAGE',
    topic: '今日の紹介',
    angle: '商品をわかりやすく紹介する',
    content: {},
  },
};

describe('automatic daily image eligibility', () => {
  it('uses the selected owned daily photo as the automatic image reference', async () => {
    const referenceImage = { sha256: 'a'.repeat(64), rightsConfirmed: true as const };
    m.reserve.mockResolvedValue({ status: 'RESERVED', id: 'reservation' });
    m.membership.mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666' });
    m.mission.mockResolvedValue({ campaignId: null, contentLinkUsage: null });
    m.brand.mockResolvedValue({ primaryColor: '#123456' });
    m.selectedPhoto.mockResolvedValue({ attachmentStorageKey: 'workspace/owner/photo.jpg' });
    m.readPhoto.mockResolvedValue(new Uint8Array([1, 2, 3]));
    m.normalizePhoto.mockResolvedValue({ bytes: new Uint8Array([4, 5, 6]), referenceImage });
    m.createRequest.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      status: 'DRAFT',
      revision: 1,
      referenceImage,
    });
    m.transitionRequest.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      status: 'QUEUED',
      revision: 2,
      referenceImage,
    });
    m.enqueue.mockResolvedValue({ id: 'job' });

    expect(await queueAutomaticDailyImage(automaticInput)).toEqual({
      status: 'QUEUED',
      requestId: '77777777-7777-4777-8777-777777777777',
    });
    expect(m.selectedPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          automaticImageReference: true,
          bunshin: expect.objectContaining({
            ownerUserId: automaticInput.actorUserId,
            groupId: automaticInput.groupId,
          }),
        }),
      }),
    );
    expect(m.createRequest).toHaveBeenCalledWith(expect.objectContaining({ referenceImage }));
    expect(m.storeReference).toHaveBeenCalledWith({
      workspaceId: automaticInput.workspaceId,
      groupId: automaticInput.groupId,
      ownerUserId: automaticInput.actorUserId,
      requestId: '77777777-7777-4777-8777-777777777777',
      bytes: new Uint8Array([4, 5, 6]),
    });
  });

  it('uses all five prepared pages for image-plan generation', () => {
    const slides = Array.from({ length: 5 }, (_, index) => ({
      index: index + 1,
      role: ['HOOK', 'PROBLEM', 'INSIGHT', 'SOLUTION', 'CTA'][index],
      headline: `見出し${index + 1}`,
      body: `本文${index + 1}`,
      visualScene: `場面${index + 1}`,
    }));

    const result = editorialSlidesForMission({ format: 'IMAGE', content: { slides } });
    expect(result).toHaveLength(5);
    expect(result.map((slide) => slide.visualScene)).toEqual([
      '場面1',
      '場面2',
      '場面3',
      '場面4',
      '場面5',
    ]);
  });

  it('allows only opted-in, ready-to-use image Missions in production', () => {
    expect(
      isAutomaticDailyImageEligible({
        mediaMode: 'IMAGE',
        assistanceLevel: 'READY_TO_USE',
        format: 'IMAGE',
        environment: 'PRODUCTION',
      }),
    ).toBe(true);
    expect(
      isAutomaticDailyImageEligible({
        mediaMode: 'IMAGE',
        assistanceLevel: 'READY_TO_USE',
        format: 'SLIDE',
        environment: 'PRODUCTION',
      }),
    ).toBe(true);
  });

  it.each([
    ['TEXT_ONLY', 'READY_TO_USE', 'IMAGE', 'PRODUCTION'],
    ['IMAGE', 'GUIDED', 'IMAGE', 'PRODUCTION'],
    ['IMAGE', 'READY_TO_USE', 'TEXT', 'PRODUCTION'],
    ['IMAGE', 'READY_TO_USE', 'IMAGE', 'STAGING'],
  ] as const)(
    'rejects media=%s assistance=%s format=%s environment=%s',
    (mediaMode, assistanceLevel, format, environment) => {
      expect(
        isAutomaticDailyImageEligible({ mediaMode, assistanceLevel, format, environment }),
      ).toBe(false);
    },
  );
});
