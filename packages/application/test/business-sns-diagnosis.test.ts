import { describe, expect, it } from 'vitest';
import { diagnoseBusinessSnsReadiness } from '../src/business-sns-diagnosis';

describe('business SNS diagnosis', () => {
  it('points to the first unfinished preparation without overwhelming the member', () => {
    const result = diagnoseBusinessSnsReadiness({
      productService: '予約制の家事代行',
      targetAudience: '共働きの家庭',
      businessFeatures: '初回相談を丁寧に行う',
      activeSocialProfileCount: 0,
      hasApprovedDestination: false,
      automaticDeliveryEnabled: false,
    });

    expect(result.score).toBe(40);
    expect(result.readyCount).toBe(2);
    expect(result.nextAction.itemKey).toBe('SOCIAL');
    expect(result.nextAction.title).toBe('投稿に使うSNS');
  });

  it('marks a fully configured business as ready to start', () => {
    const result = diagnoseBusinessSnsReadiness({
      productService: '地域の方向け整体',
      targetAudience: '肩こりに悩む地域の方',
      businessFeatures: '予約なしでも相談できる',
      activeSocialProfileCount: 1,
      hasApprovedDestination: true,
      automaticDeliveryEnabled: true,
    });

    expect(result.score).toBe(100);
    expect(result.headline).toBe('今日からSNS集客を始められます');
    expect(result.nextAction.itemKey).toBeNull();
  });
});
