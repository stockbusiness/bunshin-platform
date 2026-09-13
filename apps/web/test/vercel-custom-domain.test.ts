import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { VercelCustomDomainProvider } from '../src/services/vercel-custom-domain';

describe('Vercel custom domain provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    vi.stubEnv('DATABASE_URL', 'postgresql://local');
    vi.stubEnv('DIRECT_URL', 'postgresql://local');
    vi.stubEnv('SESSION_SECRET', '12345678901234567890123456789012');
    vi.stubEnv('VERCEL_API_TOKEN', 'vercel-token-12345678901234567890');
    vi.stubEnv('VERCEL_PROJECT_ID_OR_NAME', 'bunshin-platform');
    vi.stubEnv('VERCEL_TEAM_ID', 'team-example');
  });

  it('adds a domain to the configured project and returns its DNS challenge', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'service.example.com',
          verified: false,
          verification: [
            { type: 'TXT', domain: '_vercel.service.example.com', value: 'verification-token' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await new VercelCustomDomainProvider().connect('service.example.com');
    expect(result).toEqual({
      verified: false,
      challenge: {
        type: 'TXT',
        name: '_vercel.service.example.com',
        value: 'verification-token',
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/v10/projects/bunshin-platform/domains',
        search: '?teamId=team-example',
      }),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer vercel-token-12345678901234567890',
        }),
      }),
    );
  });

  it('marks a domain verified only when Vercel confirms it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ name: 'service.example.com', verified: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(new VercelCustomDomainProvider().verify('service.example.com')).resolves.toEqual({
      verified: true,
      challenge: null,
    });
  });
});
