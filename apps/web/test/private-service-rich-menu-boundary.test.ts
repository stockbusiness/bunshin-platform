import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

describe('private service rich menu destinations', () => {
  it.each([
    'app/s/[serviceSlug]/home/page.tsx',
    'app/s/[serviceSlug]/bunshins/page.tsx',
    'app/s/[serviceSlug]/onboarding/page.tsx',
    'app/s/[serviceSlug]/bunshins/new/page.tsx',
  ])('authenticates before resolving member access in %s', (relativePath) => {
    const page = source(relativePath);
    expect(page).toMatch(
      /const actor = await[\s\S]*if \(!actor\) redirect[\s\S]*context\(serviceSlug, actor\.userId\)/,
    );
    expect(page).toContain('returnTo=${encodeURIComponent(returnTo)}');
  });

  it('preserves the service account destination through LINE login', () => {
    const page = source('app/(app)/account/page.tsx');
    expect(page).toContain('`/account?service=${encodeURIComponent(requestedService)}`');
    expect(page).toContain('`/login?returnTo=${encodeURIComponent(returnTo)}`');
  });
});
