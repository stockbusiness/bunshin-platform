import { describe, expect, it } from 'vitest';
import { businessGrowthActionForMission } from '@bunshin/application';

describe('business growth action mix', () => {
  it.each([
    ['2026-09-13', 'REST'],
    ['2026-09-14', 'PROFILE_IMPROVEMENT'],
    ['2026-09-15', 'PHOTO'],
    ['2026-09-16', 'POST'],
    ['2026-09-17', 'COMMENT_REPLY'],
    ['2026-09-18', 'CUSTOMER_QUESTION'],
    ['2026-09-19', 'RESULT_REVIEW'],
  ] as const)('assigns %s to %s', (missionDate, expected) => {
    expect(businessGrowthActionForMission({ missionDate, topic: '秋の新商品' }).kind).toBe(
      expected,
    );
  });

  it('keeps posting as the primary content only on the posting day', () => {
    expect(
      businessGrowthActionForMission({ missionDate: '2026-09-16', topic: '秋の新商品' }),
    ).toMatchObject({
      kind: 'POST',
      postContentIsPrimary: true,
      steps: expect.arrayContaining([expect.stringContaining('投稿文をコピー')]),
    });
    expect(
      businessGrowthActionForMission({ missionDate: '2026-09-15', topic: '秋の新商品' }),
    ).toMatchObject({ kind: 'PHOTO', postContentIsPrimary: false });
  });
});
