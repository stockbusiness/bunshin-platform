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
    expect(source).toContain('<audio controls autoPlay');
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
