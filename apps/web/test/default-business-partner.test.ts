import { describe, expect, it } from 'vitest';
import { defaultBusinessPartner } from '../src/services/default-business-partner';

describe('default business partner', () => {
  it('turns the saved business profile into an immediately usable partner', () => {
    expect(
      defaultBusinessPartner({
        businessName: '海辺珈琲店',
        productService: '自家焙煎コーヒーと季節の焼き菓子',
        primaryPurpose: 'ATTRACT',
        targetAudience: '近隣で落ち着ける喫茶店を探している方',
        businessFeatures: '毎朝店内で少量ずつ焙煎している',
        preferredTone: 'やさしく親しみやすい',
      }),
    ).toEqual({
      name: '海辺珈琲店の投稿パートナー',
      objectiveSummary:
        '自家焙煎コーヒーと季節の焼き菓子について発信し、新しいお客様に知ってもらうことを目指す',
      audienceSummary: '近隣で落ち着ける喫茶店を探している方',
      personalitySummary:
        'やさしく親しみやすい。事業の特徴（毎朝店内で少量ずつ焙煎している）を正しく、分かりやすく案内する',
    });
  });

  it('keeps every generated field within the Bunshin limits', () => {
    const partner = defaultBusinessPartner({
      businessName: '店'.repeat(200),
      productService: '商品'.repeat(500),
      primaryPurpose: 'SALES',
      targetAudience: '顧客'.repeat(500),
      businessFeatures: '特徴'.repeat(500),
      preferredTone: '丁寧'.repeat(100),
    });

    expect(partner.name.length).toBeLessThanOrEqual(100);
    expect(partner.objectiveSummary.length).toBeLessThanOrEqual(500);
    expect(partner.audienceSummary.length).toBeLessThanOrEqual(500);
    expect(partner.personalitySummary.length).toBeLessThanOrEqual(500);
  });
});
