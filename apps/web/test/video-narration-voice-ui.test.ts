import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('video narration voice UI', () => {
  it('offers three plain-language voices, preview, and project persistence', () => {
    const source = readFileSync('app/ui/video-project-creator.tsx', 'utf8');
    expect(source).toContain('やさしく落ち着いた声');
    expect(source).toContain('はっきり信頼感のある声');
    expect(source).toContain('明るく親しみやすい声');
    expect(source).toContain('video-narration-preview');
    expect(source).toContain('narrationVoice,');
    expect(source).toContain('narrationSpeed,');
    expect(source).toContain('ゆっくり（聞き取りやすい）');
    expect(source).toContain('<audio controls autoPlay');
  });

  it('previews the owned project script and saves the choice before approval', () => {
    const ui = readFileSync('app/ui/video-narration-settings.tsx', 'utf8');
    const http = readFileSync('src/http/video-narration-settings.ts', 'utf8');
    expect(ui).toContain('実際の台本を試し聞きする');
    expect(ui).toContain('/narration-preview');
    expect(ui).toContain('/narration-settings');
    expect(http).toContain('new db.PrismaVideoProjectRepository().findOwned');
    expect(http).toContain('new UpdateVideoNarrationSettings');
    expect(http).toContain("project.status !== 'WAITING_APPROVAL'");
    expect(http).toContain('value.firstScene.narration.trim()');
    expect(http).not.toContain('input.text');
  });

  it('keeps preview generation within the signed-in group and AI quota boundary', () => {
    const source = readFileSync('src/http/video-narration-preview.ts', 'utf8');
    expect(source).toContain('requireSameOrigin(request)');
    expect(source).toContain('userId: actor.userId');
    expect(source).toContain('workspaceId: safeWorkspaceId');
    expect(source).toContain('groupId: safeGroupId');
    expect(source).toContain('withOrganizationAiGenerationQuota');
    expect(source).toContain("taskType: 'VIDEO_NARRATION_PREVIEW'");
    expect(source).not.toContain('process.env.OPENAI_API_KEY');
  });
});
