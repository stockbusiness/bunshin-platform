import 'server-only';
import { getServerEnvironment } from '@bunshin/config';
import { ApplicationError } from '@bunshin/shared';
import { z } from 'zod';

const domainResponseSchema = z
  .object({
    name: z.string(),
    verified: z.boolean().optional().default(false),
    verification: z
      .array(
        z.object({
          type: z.string().optional(),
          domain: z.string().optional(),
          value: z.string().optional(),
          reason: z.string().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

export type CustomDomainProviderResult = {
  verified: boolean;
  challenge: { type: string; name: string; value: string } | null;
};

function configuration() {
  const environment = getServerEnvironment();
  if (!environment.VERCEL_API_TOKEN || !environment.VERCEL_PROJECT_ID_OR_NAME)
    throw new ApplicationError(
      'CONFIGURATION_ERROR',
      'Vercelの独自ドメイン接続情報が設定されていません。',
    );
  return {
    token: environment.VERCEL_API_TOKEN,
    project: environment.VERCEL_PROJECT_ID_OR_NAME,
    teamId: environment.VERCEL_TEAM_ID,
  };
}

function endpoint(path: string, teamId?: string) {
  const url = new URL(path, 'https://api.vercel.com');
  if (teamId) url.searchParams.set('teamId', teamId);
  return url;
}

async function request(path: string, init: RequestInit) {
  const config = configuration();
  const response = await fetch(endpoint(path, config.teamId), {
    ...init,
    headers: {
      authorization: `Bearer ${config.token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  return { response, config };
}

function normalize(payload: unknown): CustomDomainProviderResult {
  const domain = domainResponseSchema.parse(payload);
  const verification = domain.verification?.find((item) => item.type && item.domain && item.value);
  return {
    verified: domain.verified,
    challenge: verification
      ? { type: verification.type!, name: verification.domain!, value: verification.value! }
      : null,
  };
}

async function readProjectDomain(hostname: string) {
  const config = configuration();
  const { response } = await request(
    `/v9/projects/${encodeURIComponent(config.project)}/domains/${encodeURIComponent(hostname)}`,
    { method: 'GET' },
  );
  if (!response.ok)
    throw new ApplicationError('INTERNAL_ERROR', 'Vercelのドメイン状態を取得できません。');
  return normalize(await response.json());
}

export class VercelCustomDomainProvider {
  async connect(hostname: string): Promise<CustomDomainProviderResult> {
    const config = configuration();
    const { response } = await request(
      `/v10/projects/${encodeURIComponent(config.project)}/domains`,
      { method: 'POST', body: JSON.stringify({ name: hostname }) },
    );
    if (response.status === 409) return readProjectDomain(hostname);
    if (!response.ok)
      throw new ApplicationError('INTERNAL_ERROR', 'Vercelへ独自ドメインを接続できません。');
    return normalize(await response.json());
  }

  async verify(hostname: string): Promise<CustomDomainProviderResult> {
    const config = configuration();
    const { response } = await request(
      `/v9/projects/${encodeURIComponent(config.project)}/domains/${encodeURIComponent(hostname)}/verify`,
      { method: 'POST' },
    );
    if (response.ok) return normalize(await response.json());
    if (response.status === 400) return readProjectDomain(hostname);
    throw new ApplicationError('INTERNAL_ERROR', 'VercelでDNSを確認できません。');
  }

  async disconnect(hostname: string): Promise<void> {
    const config = configuration();
    const { response } = await request(
      `/v9/projects/${encodeURIComponent(config.project)}/domains/${encodeURIComponent(hostname)}`,
      { method: 'DELETE' },
    );
    if (!response.ok && response.status !== 404)
      throw new ApplicationError('INTERNAL_ERROR', 'Vercelから独自ドメインを解除できません。');
  }
}
