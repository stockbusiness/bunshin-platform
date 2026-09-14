type BusinessPartnerProfile = {
  businessName: string;
  productService: string;
  primaryPurpose: 'ATTRACT' | 'RESERVATION' | 'SALES' | 'RECRUITING' | 'AWARENESS' | 'RETENTION';
  targetAudience: string;
  businessFeatures: string;
  preferredTone: string;
};

const purposeLabels: Record<BusinessPartnerProfile['primaryPurpose'], string> = {
  ATTRACT: '新しいお客様に知ってもらうこと',
  RESERVATION: '予約につなげること',
  SALES: '商品・サービスの販売につなげること',
  RECRUITING: '採用につなげること',
  AWARENESS: '事業を知ってもらうこと',
  RETENTION: '既存のお客様との関係を深めること',
};

function within(value: string, maximum: number) {
  return value.trim().slice(0, maximum);
}

export function defaultBusinessPartner(profile: BusinessPartnerProfile) {
  return {
    name: within(`${profile.businessName}の投稿パートナー`, 100),
    objectiveSummary: within(
      `${profile.productService}について発信し、${purposeLabels[profile.primaryPurpose]}を目指す`,
      500,
    ),
    audienceSummary: within(profile.targetAudience, 500),
    personalitySummary: within(
      `${profile.preferredTone}。事業の特徴（${profile.businessFeatures}）を正しく、分かりやすく案内する`,
      500,
    ),
  };
}
