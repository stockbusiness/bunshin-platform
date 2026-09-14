import { describe, expect, it, vi } from 'vitest';
import {
  getActiveRewardsPilotAccess,
  hasActiveRewardsPilotAccess,
  listActiveRewardsPilotServiceAccesses,
  REWARDS_PILOT_FEATURE_KEY,
} from '../src/rewards-pilot-access';
import { readFileSync } from 'node:fs';

const repository = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

describe('rewards pilot access', () => {
  it('allows every active, consented participant under an active group policy', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'membership-1',
      groupId: 'group-1',
      group: { featurePolicies: [{ endsAt: new Date('2026-09-18T00:00:00.000Z') }] },
    });
    const at = new Date('2026-09-11T00:00:00.000Z');

    await expect(
      hasActiveRewardsPilotAccess(
        { groupMembership: { findFirst } } as never,
        { workspaceId: 'workspace-1', groupId: 'group-1', userId: 'user-1' },
        at,
      ),
    ).resolves.toBe(true);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          groupId: 'group-1',
          userId: 'user-1',
          status: 'ACTIVE',
          serviceRole: 'PARTICIPANT',
          consentedAt: { not: null },
          group: expect.objectContaining({
            featurePolicies: {
              some: expect.objectContaining({ featureKey: REWARDS_PILOT_FEATURE_KEY }),
            },
          }),
        }),
      }),
    );
    expect(findFirst.mock.calls[0]?.[0]?.where).not.toHaveProperty('featureAssignments');
  });

  it('returns the service policy end date', async () => {
    const access = await getActiveRewardsPilotAccess(
      {
        groupMembership: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'membership-1',
            groupId: 'group-1',
            group: { featurePolicies: [{ endsAt: new Date('2026-09-18T00:00:00.000Z') }] },
          }),
        },
      } as never,
      { workspaceId: 'workspace-1', userId: 'user-1' },
      new Date('2026-09-11T00:00:00.000Z'),
    );

    expect(access).toEqual({
      membershipId: 'membership-1',
      groupId: 'group-1',
      endsAt: new Date('2026-09-18T00:00:00.000Z'),
    });
  });

  it('denies access when no exact active membership matches', async () => {
    await expect(
      hasActiveRewardsPilotAccess(
        { groupMembership: { findFirst: vi.fn().mockResolvedValue(null) } } as never,
        { workspaceId: 'workspace-1', userId: 'user-1' },
      ),
    ).resolves.toBe(false);
  });

  it('lists each eligible service without choosing an arbitrary membership', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'membership-1',
        workspaceId: 'workspace-1',
        groupId: 'group-1',
        group: {
          serviceConfiguration: { slug: 'service-a', displayName: 'サービスA' },
          featurePolicies: [{ endsAt: new Date('2026-10-01T00:00:00.000Z') }],
        },
      },
      {
        id: 'membership-2',
        workspaceId: 'workspace-1',
        groupId: 'group-2',
        group: {
          serviceConfiguration: { slug: 'service-b', displayName: 'サービスB' },
          featurePolicies: [{ endsAt: null }],
        },
      },
    ]);

    await expect(
      listActiveRewardsPilotServiceAccesses(
        { groupMembership: { findMany } } as never,
        { workspaceId: 'workspace-1', userId: 'user-1' },
        new Date('2026-09-12T00:00:00.000Z'),
      ),
    ).resolves.toEqual([
      {
        membershipId: 'membership-1',
        workspaceId: 'workspace-1',
        groupId: 'group-1',
        serviceSlug: 'service-a',
        serviceName: 'サービスA',
        endsAt: new Date('2026-10-01T00:00:00.000Z'),
      },
      {
        membershipId: 'membership-2',
        workspaceId: 'workspace-1',
        groupId: 'group-2',
        serviceSlug: 'service-b',
        serviceName: 'サービスB',
        endsAt: null,
      },
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          userId: 'user-1',
          group: expect.objectContaining({ serviceConfiguration: { isNot: null } }),
        }),
      }),
    );
  });

  it('does not limit registered participants to a manually selected group of 30', () => {
    expect(repository).not.toContain('if (otherEnabledMembers >= 30)');
    expect(repository).not.toContain("'rewards pilot member limit reached'");
  });
});
