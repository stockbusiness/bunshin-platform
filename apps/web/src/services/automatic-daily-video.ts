import 'server-only';
import { createHash } from 'node:crypto';
import {
  ApproveVideoPlan,
  CreateVideoProject,
  EnqueueJob,
  QueueVideoRender,
  ReplaceVideoPlan,
  ResolveVideoDisclosurePolicy,
  VIDEO_RENDER_JOB_TYPE,
  type JobEnvironment,
} from '@bunshin/application';
import { ApplicationError } from '@bunshin/shared';
import { createLogger } from '@bunshin/observability';
import { resolveCreatomateRuntimeConfiguration } from '../ai/runtime-provider-configuration';
import { getServerEnvironment } from '@bunshin/config';
import {
  readServiceOnboardingSettings,
  type ServiceDailyIdeaDeliverySettings,
} from './service-onboarding-settings';

export function dailyVideoProjectId(workspaceId: string, bunshinId: string, missionId: string) {
  const hex = createHash('sha256')
    .update(`daily-video-v1:${workspaceId}:${bunshinId}:${missionId}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Reuse only finished posting copy, never external-tool prompts or shooting instructions. */
export function buildDailyVideoScenes(content: unknown) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const value = content as Record<string, unknown>;
  const copy =
    typeof value.caption === 'string' && value.caption.trim()
      ? value.caption
      : typeof value.body === 'string'
        ? value.body
        : '';
  const tags = Array.isArray(value.hashtags)
    ? value.hashtags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const text = [copy.trim(), ...tags.filter((tag) => !copy.includes(tag))]
    .filter(Boolean)
    .join('\n');
  const chars = [...text];
  // Do not silently remove mandatory disclosures or squeeze unreadable text into a short video.
  if (chars.length < 5 || chars.length > 560) return null;
  const count = Math.max(5, Math.ceil(chars.length / 80));
  const size = Math.ceil(chars.length / count);
  const captions = Array.from({ length: count }, (_, i) =>
    chars.slice(i * size, (i + 1) * size).join(''),
  );
  if (captions.some((caption) => !caption.trim())) return null;
  return captions.map((caption, i) => ({
    sceneNo: i + 1,
    durationMs:
      i === count - 1 ? 30_000 - Math.floor(30_000 / count) * i : Math.floor(30_000 / count),
    narration: caption,
    caption,
    visualType: 'TEXT_MOTION' as const,
    visualPrompt: null,
    keywords: [],
    aiProcessingTypes: [],
    locked: false,
  }));
}

function narrationWithinDuration(value: string, durationMs: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const maxCharacters = Math.floor((durationMs / 1_000) * 3);
  const characters = [...normalized];
  if (characters.length <= maxCharacters) return normalized;
  return `${characters.slice(0, Math.max(1, maxCharacters - 1)).join('')}。`;
}

export function buildDailyCarouselVideoScenes(
  content: unknown,
  mediaIds: string[],
  narrationEnabled = false,
) {
  if (mediaIds.length < 2 || mediaIds.length > 7 || new Set(mediaIds).size !== mediaIds.length)
    return null;
  const value =
    content && typeof content === 'object' && !Array.isArray(content)
      ? (content as Record<string, unknown>)
      : {};
  const slides: unknown[] = Array.isArray(value.slides) ? value.slides : [];
  const pageText = mediaIds.map((_, index) => {
    const slide = slides[index];
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) return `投稿画像 ${index + 1}`;
    const row = slide as Record<string, unknown>;
    return (
      [row.headline, row.body]
        .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .join('。')
        .slice(0, 240) || `投稿画像 ${index + 1}`
    );
  });
  const duration = Math.floor(30_000 / mediaIds.length);
  return mediaIds.map((mediaId, index) => {
    const durationMs = index === mediaIds.length - 1 ? 30_000 - duration * index : duration;
    return {
      sceneNo: index + 1,
      durationMs,
      narration: narrationEnabled
        ? narrationWithinDuration(pageText[index]!, durationMs)
        : pageText[index]!,
      caption: pageText[index]!,
      visualType: 'GENERATED_IMAGE' as const,
      visualPrompt: null,
      keywords: [mediaId],
      aiProcessingTypes: [],
      locked: false,
    };
  });
}

export async function queueAutomaticDailyVideo(input: {
  environment: JobEnvironment;
  workspaceId: string;
  groupId: string;
  actorUserId: string;
  bunshinId: string;
  correlationId: string;
  mediaMode: ServiceDailyIdeaDeliverySettings['mediaMode'];
  videoStyle?: ServiceDailyIdeaDeliverySettings['videoStyle'];
  videoNarration?: ServiceDailyIdeaDeliverySettings['videoNarration'];
  mission: { id: string; assistanceLevel: string; topic: string };
  socialImageGenerationRequestId?: string;
}) {
  if (
    input.environment !== 'PRODUCTION' ||
    input.mission.assistanceLevel !== 'READY_TO_USE' ||
    !['VIDEO', 'IMAGE_AND_VIDEO'].includes(input.mediaMode)
  )
    return { status: 'SKIPPED' } as const;
  try {
    const db = await import('@bunshin/database');
    const mission = await db.prisma.dailyMission.findFirst({
      where: {
        id: input.mission.id,
        workspaceId: input.workspaceId,
        bunshinId: input.bunshinId,
        assistanceLevel: 'READY_TO_USE',
        status: { notIn: ['SKIPPED', 'EXPIRED'] },
        bunshin: { groupId: input.groupId, ownerUserId: input.actorUserId },
      },
      include: { socialProfile: true, content: true },
    });
    if (!mission || mission.reason.includes('business-daily-idea-fallback'))
      return { status: 'SKIPPED' } as const;
    const socialImage = input.socialImageGenerationRequestId
      ? await db.prisma.socialImageGenerationRequest.findFirst({
          where: {
            id: input.socialImageGenerationRequestId,
            workspaceId: input.workspaceId,
            groupId: input.groupId,
            ownerUserId: input.actorUserId,
            bunshinId: input.bunshinId,
            dailyMissionId: mission.id,
            status: 'READY_FOR_REVIEW',
            idempotencyKey: `automatic-daily-image:${mission.id}`,
          },
          select: {
            id: true,
            media: {
              where: { status: 'READY', deletedAt: null },
              select: { id: true },
              orderBy: { pageIndex: 'asc' },
            },
          },
        })
      : null;
    if (input.socialImageGenerationRequestId && !socialImage)
      return { status: 'WAITING_FOR_IMAGES' } as const;
    const narration = socialImage && input.videoNarration?.enabled ? input.videoNarration : null;
    const scenes = socialImage
      ? buildDailyCarouselVideoScenes(
          mission.content?.contentJson,
          socialImage.media.map((media) => media.id),
          Boolean(narration),
        )
      : buildDailyVideoScenes(mission.content?.contentJson);
    if (!scenes) return { status: 'SKIPPED' } as const;
    const platform = mission.socialProfile?.platform;
    if (platform !== 'INSTAGRAM' && platform !== 'TIKTOK' && platform !== 'YOUTUBE_SHORTS')
      return { status: 'SKIPPED' } as const;
    const [membership, plan] = await Promise.all([
      db.prisma.groupMembership.findFirst({
        where: {
          workspaceId: input.workspaceId,
          groupId: input.groupId,
          userId: input.actorUserId,
          status: 'ACTIVE',
          consentedAt: { not: null },
        },
        select: { id: true },
      }),
      db.prisma.serviceCommercialSetting.findFirst({
        where: {
          workspaceId: input.workspaceId,
          groupId: input.groupId,
          status: 'ACTIVE',
          monthlyVideoGenerationLimit: { gt: 0 },
        },
        select: { id: true },
      }),
    ]);
    if (!membership || !plan) return { status: 'SKIPPED' } as const;
    await resolveCreatomateRuntimeConfiguration();
    const projects = new db.PrismaVideoProjectRepository();
    const scope = {
      workspaceId: input.workspaceId,
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      videoProjectId: dailyVideoProjectId(input.workspaceId, input.bunshinId, mission.id),
    };
    let project = await projects.findOwned(scope);
    if (!project) {
      const disclosure = await new ResolveVideoDisclosurePolicy(
        new db.PrismaVideoDisclosurePolicyRepository(),
      ).execute({ environment: input.environment, platform });
      try {
        project = await new CreateVideoProject(projects).execute({
          ...scope,
          id: scope.videoProjectId,
          groupMembershipId: membership.id,
          bunshinId: input.bunshinId,
          campaignId: mission.campaignId,
          characterProfileVersionId: null,
          title: input.mission.topic,
          platform,
          type: socialImage ? 'PHOTO_SLIDESHOW' : 'EXPLAINER',
          socialImageGenerationRequestId: socialImage?.id ?? null,
          durationSeconds: 30,
          standardComposition: true,
          ...(narration
            ? {
                narrationEnabled: true,
                narrationVoice: narration.voice,
                narrationSpeed: narration.speed,
              }
            : { narrationEnabled: false }),
          aiProcessingTypes: narration ? ['VOICE_SYNTHESIS'] : [],
          disclosureSnapshot: {
            schemaVersion: 1,
            source: 'SERVICE_DAILY_VIDEO',
            dailyMissionId: mission.id,
            videoStyle: input.videoStyle ?? 'STANDARD',
            policyId: disclosure.policyId,
            policyVersion: disclosure.policyVersion,
            disclosureText: disclosure.disclosureText,
            hashtags: disclosure.hashtags,
            guidance: disclosure.guidance,
            outputMetadata: disclosure.outputMetadata,
            explanation: socialImage
              ? `サービスの自動準備設定に基づき、完成した投稿画像を場面順につないだ${narration ? 'AI音声付き' : ''}動画です。投稿前に内容を確認してください。`
              : 'サービスの自動準備設定に基づく字幕動画です。投稿前に内容を確認してください。',
          },
        });
      } catch (error) {
        // A concurrent delivery attempt may have created the deterministic project already.
        project = await projects.findOwned(scope);
        if (!project) throw error;
      }
    }
    if (project.status === 'DRAFT')
      project = await new ReplaceVideoPlan(projects).execute({
        ...scope,
        expectedRevision: project.revision,
        scenes,
        projectAiProcessingTypes: narration ? ['VOICE_SYNTHESIS'] : [],
        standardComposition: true,
        aiVideoSceneCount: 0,
      });
    if (project.status === 'WAITING_APPROVAL')
      project = await new ApproveVideoPlan(projects).execute({
        ...scope,
        expectedRevision: project.revision,
      });
    if (!['APPROVED', 'QUEUED'].includes(project.status))
      return { status: 'ALREADY_AVAILABLE' } as const;
    const render = await new QueueVideoRender(new db.PrismaVideoRenderRepository()).execute({
      ...scope,
      expectedRevision: project.revision,
      provider: 'CREATOMATE',
    });
    await new EnqueueJob(new db.PrismaJobRepository()).enqueue({
      workspaceId: input.workspaceId,
      bunshinId: input.bunshinId,
      correlationId: input.correlationId,
      requestedBy: input.actorUserId,
      environment: input.environment,
      jobType: VIDEO_RENDER_JOB_TYPE,
      payloadReference: `video-render:${render.id}`,
      idempotencyKey: `video-render:${render.id}`,
      priority: 40,
      maxAttempts: 12,
    });
    return { status: 'QUEUED' } as const;
  } catch (error) {
    createLogger().warn('automatic daily video preparation failed', {
      correlationId: input.correlationId,
      dailyMissionId: input.mission.id,
      errorCode: error instanceof ApplicationError ? error.code : 'AUTOMATIC_VIDEO_FAILED',
    });
    return { status: 'FAILED' } as const;
  }
}

const jobEnvironment = {
  development: 'DEVELOPMENT',
  staging: 'STAGING',
  production: 'PRODUCTION',
} as const satisfies Record<string, JobEnvironment>;

async function prepareDailyCarouselVideoAfterImage(input: {
  workspaceId: string;
  groupId: string;
  requestId: string;
  correlationId: string;
}) {
  const environment = jobEnvironment[getServerEnvironment().APP_ENV];
  if (environment !== 'PRODUCTION') return { status: 'SKIPPED' } as const;
  const db = await import('@bunshin/database');
  const request = await db.prisma.socialImageGenerationRequest.findFirst({
    where: {
      id: input.requestId,
      workspaceId: input.workspaceId,
      groupId: input.groupId,
      status: 'READY_FOR_REVIEW',
    },
    select: {
      id: true,
      ownerUserId: true,
      bunshinId: true,
      dailyMissionId: true,
      idempotencyKey: true,
    },
  });
  if (!request || request.idempotencyKey !== `automatic-daily-image:${request.dailyMissionId}`)
    return { status: 'SKIPPED' } as const;
  const [mission, policy] = await Promise.all([
    db.prisma.dailyMission.findFirst({
      where: {
        id: request.dailyMissionId,
        workspaceId: input.workspaceId,
        bunshinId: request.bunshinId,
        bunshin: { groupId: input.groupId, ownerUserId: request.ownerUserId },
      },
      select: { id: true, assistanceLevel: true, topic: true },
    }),
    db.prisma.serviceRegistrationPolicy.findFirst({
      where: { workspaceId: input.workspaceId, groupId: input.groupId },
      select: { onboardingConfig: true, surveyConfig: true },
    }),
  ]);
  const dailyIdeas = readServiceOnboardingSettings(
    policy?.onboardingConfig,
    policy?.surveyConfig,
  ).dailyIdeaDelivery;
  if (!mission || !dailyIdeas.enabled || dailyIdeas.mediaMode !== 'IMAGE_AND_VIDEO')
    return { status: 'SKIPPED' } as const;
  return queueAutomaticDailyVideo({
    environment,
    workspaceId: input.workspaceId,
    groupId: input.groupId,
    actorUserId: request.ownerUserId,
    bunshinId: request.bunshinId,
    correlationId: input.correlationId,
    mediaMode: dailyIdeas.mediaMode,
    videoStyle: dailyIdeas.videoStyle,
    videoNarration: dailyIdeas.videoNarration,
    mission,
    socialImageGenerationRequestId: request.id,
  });
}

export async function queueDailyCarouselVideoAfterImage(input: {
  workspaceId: string;
  groupId: string;
  requestId: string;
  correlationId: string;
}) {
  try {
    return await prepareDailyCarouselVideoAfterImage(input);
  } catch (error) {
    createLogger().warn('daily carousel video preparation after image failed', {
      correlationId: input.correlationId,
      imageRequestId: input.requestId,
      errorCode: error instanceof ApplicationError ? error.code : 'AUTOMATIC_VIDEO_FAILED',
    });
    return { status: 'FAILED' } as const;
  }
}
