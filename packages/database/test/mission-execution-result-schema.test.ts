import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL(
    '../prisma/migrations/20260915120000_add_mission_execution_results/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('mission execution result persistence', () => {
  it.each([
    'EXECUTION_COMPLETED',
    'EXECUTION_PARTIAL',
    'EXECUTION_NOT_COMPLETED',
    'EXECUTION_HELP_NEEDED',
  ])('adds %s to the schema and deploy migration', (value) => {
    expect(schema).toContain(value);
    expect(migration).toContain(`ADD VALUE IF NOT EXISTS '${value}'`);
  });
});
