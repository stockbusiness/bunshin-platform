import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

const configurationId = '22222222-2222-4222-8222-222222222222';
const state = vi.hoisted(() => ({
  user: null as { userId: string } | null,
  updateDomain: vi.fn(),
  createAudit: vi.fn(),
}));

vi.mock('../src/auth/current-user', () => ({
  currentUserProvider: () => Promise.resolve({ getCurrentUser: () => Promise.resolve(state.user) }),
}));

vi.mock('@bunshin/database', () => ({
  prisma: {
    platformAdmin: { findFirst: vi.fn(() => Promise.resolve({ id: 'platform-admin-1' })) },
    serviceConfiguration: {
      findUnique: vi.fn(() =>
        Promise.resolve({
          id: configurationId,
          workspaceId: 'workspace-1',
          groupId: 'group-1',
          customDomain: {
            id: 'domain-1',
            hostname: 'service.example.com',
            status: 'DRAFT',
            provider: null,
            providerConfiguredAt: null,
            verifiedAt: null,
            activatedAt: null,
          },
        }),
      ),
    },
    organizationEntitlement: {
      findUnique: vi.fn(() => Promise.resolve({ customDomainEnabled: true, suspended: false })),
    },
    $transaction: vi.fn((operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        serviceCustomDomain: { update: state.updateDomain },
        serviceConfigurationAudit: { create: state.createAudit },
      }),
    ),
  },
}));

import { transitionServiceCustomDomainResponse } from '../src/http/services';

const request = () =>
  new Request(`http://localhost:3000/api/admin/services/${configurationId}/custom-domain/connect`, {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
  });

describe('service custom domain activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    vi.stubEnv('DATABASE_URL', 'postgresql://local');
    vi.stubEnv('DIRECT_URL', 'postgresql://local');
    vi.stubEnv('SESSION_SECRET', '12345678901234567890123456789012');
    state.user = { userId: 'admin-1' };
    state.updateDomain.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        hostname: 'service.example.com',
        ...data,
      }),
    );
    state.createAudit.mockResolvedValue({ id: 'audit-1' });
  });

  it('keeps an unverified domain private and stores the DNS challenge', async () => {
    const provider = {
      connect: vi.fn(() =>
        Promise.resolve({
          verified: false,
          challenge: { type: 'TXT', name: '_vercel.service.example.com', value: 'vc-token' },
        }),
      ),
      verify: vi.fn(),
      disconnect: vi.fn(),
    };
    const response = await transitionServiceCustomDomainResponse(
      request(),
      configurationId,
      'connect',
      provider,
    );
    expect(response.status).toBe(200);
    expect(state.updateDomain).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          provider: 'VERCEL',
          verificationRecordType: 'TXT',
          verificationRecordValue: 'vc-token',
        }),
      }),
    );
  });

  it('activates the domain only after the provider verifies it', async () => {
    const provider = {
      connect: vi.fn(),
      verify: vi.fn(() => Promise.resolve({ verified: true, challenge: null })),
      disconnect: vi.fn(),
    };
    const response = await transitionServiceCustomDomainResponse(
      request(),
      configurationId,
      'verify',
      provider,
    );
    expect(response.status).toBe(200);
    expect(state.updateDomain).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', verifiedAt: expect.any(Date) }),
      }),
    );
  });
});
