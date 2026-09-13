import type { ServiceDailyIdeaDeliverySettings } from './service-onboarding-settings';

export type BusinessDailyServiceSettings = {
  businessProfileEnabled: boolean;
  emailEnabled: boolean;
  lineEnabled: boolean;
  inviteCodeEnabled: boolean;
  referralEnabled: boolean;
  dailyIdeaDelivery: ServiceDailyIdeaDeliverySettings;
};

export function enforceBusinessDailyServiceSettings<T extends BusinessDailyServiceSettings>(
  value: T,
): T {
  if (!value.businessProfileEnabled) return value;
  return {
    ...value,
    emailEnabled: false,
    lineEnabled: true,
    inviteCodeEnabled: false,
    referralEnabled: false,
    dailyIdeaDelivery: {
      ...value.dailyIdeaDelivery,
      enabled: true,
      cadence: 'DAILY',
      lockCadence: true,
      contentMode: 'READY_TO_USE',
      mediaMode: 'TEXT_ONLY',
      videoBgm: { ...value.dailyIdeaDelivery.videoBgm, enabled: false, assetId: null },
      videoNarration: { ...value.dailyIdeaDelivery.videoNarration, enabled: false },
      visualCharacter: {
        ...value.dailyIdeaDelivery.visualCharacter,
        enabled: false,
        profileVersionId: null,
      },
    },
  };
}
