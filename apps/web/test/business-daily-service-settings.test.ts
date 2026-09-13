import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  enforceBusinessDailyServiceSettings,
  enforceBusinessFreeRegistrationSettings,
} from '../src/services/business-daily-service-settings';
import { DEFAULT_SERVICE_DAILY_IDEA_DELIVERY } from '../src/services/service-onboarding-settings';

describe('business daily service settings', () => {
  it('locks the free service to LINE, daily ready-to-use text delivery', () => {
    const value = enforceBusinessDailyServiceSettings({
      businessProfileEnabled: true,
      emailEnabled: true,
      lineEnabled: false,
      inviteCodeEnabled: true,
      referralEnabled: true,
      dailyIdeaDelivery: {
        ...DEFAULT_SERVICE_DAILY_IDEA_DELIVERY,
        enabled: false,
        cadence: 'WEEKDAYS',
        lockCadence: false,
        contentMode: 'PROMPT',
        mediaMode: 'IMAGE_AND_VIDEO',
        videoBgm: { enabled: true, assetId: 'track', volumePercent: 20 },
        videoNarration: { enabled: true, voice: 'cedar', speed: 'STANDARD' },
        visualCharacter: { enabled: true, profileVersionId: 'character' },
      },
    });

    expect(value).toMatchObject({
      emailEnabled: false,
      lineEnabled: true,
      inviteCodeEnabled: false,
      referralEnabled: false,
      dailyIdeaDelivery: {
        enabled: true,
        cadence: 'DAILY',
        lockCadence: true,
        contentMode: 'READY_TO_USE',
        mediaMode: 'TEXT_ONLY',
        videoBgm: { enabled: false, assetId: null },
        videoNarration: { enabled: false },
        visualCharacter: { enabled: false, profileVersionId: null },
      },
    });
  });

  it('does not change other service settings', () => {
    const value = {
      businessProfileEnabled: false,
      emailEnabled: true,
      lineEnabled: false,
      inviteCodeEnabled: true,
      referralEnabled: true,
      dailyIdeaDelivery: DEFAULT_SERVICE_DAILY_IDEA_DELIVERY,
    };
    expect(enforceBusinessDailyServiceSettings(value)).toBe(value);
  });

  it('locks free business registration to public LINE access', () => {
    expect(
      enforceBusinessFreeRegistrationSettings({
        businessProfileEnabled: true,
        registrationMode: 'CLOSED',
        emailEnabled: true,
        lineEnabled: false,
        inviteCodeEnabled: true,
        referralEnabled: true,
      }),
    ).toEqual({
      businessProfileEnabled: true,
      registrationMode: 'PUBLIC',
      emailEnabled: false,
      lineEnabled: true,
      inviteCodeEnabled: false,
      referralEnabled: false,
    });
  });

  it('applies the lock in both the operator form and the save endpoint', () => {
    const editor = readFileSync(
      new URL(
        '../app/s/[serviceSlug]/manage/settings/service-settings-editor.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const endpoint = readFileSync(
      new URL('../src/http/service-settings.ts', import.meta.url),
      'utf8',
    );

    expect(editor).toContain('disabled={businessFreeSettingsLocked}');
    expect(editor).toContain('企業向け無料サービスはLINEだけを使用します。');
    expect(endpoint).toContain('enforceBusinessDailyServiceSettings(parsedValue)');
    expect(endpoint).toContain('enforceBusinessFreeRegistrationSettings(');
  });
});
