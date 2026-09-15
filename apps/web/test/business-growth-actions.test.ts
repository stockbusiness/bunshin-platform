import { describe, expect, it } from 'vitest';
import { businessGrowthActionForMission, businessGrowthProgramStatus } from '@bunshin/application';

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

  it.each([
    ['2026-09-01', 1, 1, 'FOUNDATION'],
    ['2026-09-14', 1, 14, 'FOUNDATION'],
    ['2026-09-15', 1, 15, 'START_POSTING'],
    ['2026-09-30', 1, 30, 'START_POSTING'],
    ['2026-10-01', 1, 31, 'BUILD_RESPONSE'],
    ['2026-10-30', 1, 60, 'BUILD_RESPONSE'],
    ['2026-10-31', 1, 61, 'ESTABLISH_PATTERN'],
    ['2026-11-29', 1, 90, 'ESTABLISH_PATTERN'],
    ['2026-11-30', 2, 1, 'FOUNDATION'],
  ] as const)('places %s on cycle %s day %s in %s', (currentDate, cycleNumber, day, phaseKey) => {
    expect(businessGrowthProgramStatus({ startedAt: '2026-09-01', currentDate })).toMatchObject({
      cycleNumber,
      day,
      phase: { key: phaseKey },
    });
  });

  it.each([
    ['2026-09-07', 'PROFILE_IMPROVEMENT', 'FOUNDATION'],
    ['2026-09-21', 'PHOTO', 'START_POSTING'],
    ['2026-10-19', 'COMMENT_REPLY', 'BUILD_RESPONSE'],
    ['2026-11-16', 'RESULT_REVIEW', 'ESTABLISH_PATTERN'],
  ] as const)(
    'changes Monday action on %s to match the program phase',
    (missionDate, kind, phase) => {
      expect(
        businessGrowthActionForMission({
          missionDate,
          topic: '秋の新商品',
          programStartedAt: '2026-09-07',
        }),
      ).toMatchObject({ kind, program: { phaseKey: phase } });
    },
  );
});
