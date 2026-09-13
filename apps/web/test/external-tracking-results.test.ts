import { beforeEach, describe, expect, it, vi } from 'vitest';

const systemId = '11111111-1111-4111-8111-111111111111';
const workspaceId = '22222222-2222-4222-8222-222222222222';
const groupId = '33333333-3333-4333-8333-333333333333';
const userId = '44444444-4444-4444-8444-444444444444';

const state = vi.hoisted(() => ({
  currentUser: null as { userId: string } | null,
  system: null as null | {
    id: string;
    workspaceId: string;
    groupId: string;
    resultIngestTokenHash: string | null;
  },
  systemUpdate: vi.fn((input: unknown) => {
    void input;
    return Promise.resolve({ id: 'system' });
  }),
  auditCreate: vi.fn((input: unknown) => {
    void input;
    return Promise.resolve({ id: 'audit' });
  }),
  createMany: vi.fn((input?: unknown) => {
    void input;
    return Promise.resolve({ count: 1 });
  }),
}));

vi.mock('../src/auth/current-user', () => ({
  currentUserProvider: () =>
    Promise.resolve({ getCurrentUser: () => Promise.resolve(state.currentUser) }),
}));

vi.mock('@bunshin/database', () => {
  const tx = {
    externalTrackingResult: { createMany: state.createMany },
    externalTrackingSystem: { update: state.systemUpdate },
  };
  return {
    prisma: {
      workspaceMembership: { findFirst: vi.fn(() => Promise.resolve({ id: 'manager' })) },
      groupMembership: { findFirst: vi.fn() },
      externalTrackingSystem: {
        findFirst: vi.fn(() => Promise.resolve(state.system)),
        update: state.systemUpdate,
      },
      externalTrackingAuditLog: { create: state.auditCreate },
      externalTrackingLink: { findMany: vi.fn(() => Promise.resolve([])) },
      externalTrackingMemberIdentity: { findMany: vi.fn(() => Promise.resolve([])) },
      externalTrackingResult: { createMany: state.createMany },
      $transaction: vi.fn((operation: unknown) =>
        typeof operation === 'function'
          ? (operation as (client: typeof tx) => Promise<unknown>)(tx)
          : Promise.all(operation as Promise<unknown>[]),
      ),
    },
  };
});

import {
  ingestExternalTrackingResultsResponse,
  rotateExternalTrackingResultTokenResponse,
} from '../src/http/external-tracking-results';

function request(body: unknown, token?: string) {
  return new Request(`http://localhost:3000/api/external-tracking/results/${systemId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('external tracking result ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    vi.stubEnv('DATABASE_URL', 'postgresql://local');
    vi.stubEnv('DIRECT_URL', 'postgresql://local');
    vi.stubEnv('SESSION_SECRET', '12345678901234567890123456789012');
    vi.stubEnv('LOG_LEVEL', 'info');
    state.currentUser = { userId };
    state.system = null;
    state.createMany.mockResolvedValue({ count: 1 });
  });

  it('rejects result batches without a connection token', async () => {
    const response = await ingestExternalTrackingResultsResponse(
      request({ records: [] }),
      systemId,
    );
    expect(response.status).toBe(401);
    expect(state.createMany).not.toHaveBeenCalled();
  });

  it('stores a valid result batch and reports provider duplicates', async () => {
    const token = 'wwr_example-provider-token';
    const { createHash } = await import('node:crypto');
    state.system = {
      id: systemId,
      workspaceId,
      groupId,
      resultIngestTokenHash: createHash('sha256').update(token).digest('hex'),
    };
    state.createMany.mockResolvedValue({ count: 1 });
    const response = await ingestExternalTrackingResultsResponse(
      request(
        {
          records: [
            {
              externalEventId: 'event-1',
              metricType: 'PURCHASE',
              count: 1,
              amountMinor: 1200,
              currency: 'JPY',
              occurredAt: '2026-09-13T10:00:00.000Z',
            },
            {
              externalEventId: 'event-1',
              metricType: 'PURCHASE',
              occurredAt: '2026-09-13T10:00:00.000Z',
            },
          ],
        },
        token,
      ),
      systemId,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { accepted: 2, inserted: 1, duplicates: 1 },
    });
  });

  it('shows a newly rotated secret once and persists only its hash', async () => {
    state.system = { id: systemId, workspaceId, groupId, resultIngestTokenHash: null };
    const response = await rotateExternalTrackingResultTokenResponse(
      request({}, undefined),
      workspaceId,
      systemId,
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { token: string } };
    expect(payload.data.token).toMatch(/^wwr_/);
    const saved = state.systemUpdate.mock.calls[0]?.[0] as {
      data: { resultIngestTokenHash: string };
    };
    expect(saved.data.resultIngestTokenHash).not.toContain(payload.data.token);
    expect(JSON.stringify(saved)).not.toContain(payload.data.token);
  });
});
