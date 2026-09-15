import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260915150000_add_social_insight_snapshots/migration.sql',
  'utf8',
);

describe('social insight snapshot persistence', () => {
  it('scopes confirmed metrics to service, user, bunshin and social profile', () => {
    expect(schema).toContain('model SocialInsightSnapshot');
    expect(schema).toContain('groupMembershipId String');
    expect(schema).toContain('socialProfileId   String');
    expect(migration).toContain('social_insight_snapshots_membership_fkey');
    expect(migration).toContain('social_insight_snapshots_social_profile_fkey');
    expect(migration).toContain('social_insight_snapshots_nonnegative_check');
  });
});
