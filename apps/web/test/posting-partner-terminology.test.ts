import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(__dirname, '../../..');
const sourceRoots = [
  'apps/web/app',
  'apps/web/src',
  'packages/application/src',
  'packages/database/src',
].map((relativePath) => path.join(repositoryRoot, relativePath));

function productionTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionTypeScriptFiles(entryPath);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

describe('posting partner terminology', () => {
  it('does not show the former product term in production copy', () => {
    const formerTerm = /分身|(?<![A-Z0-9_])BUNSHIN(?![A-Z0-9_])/u;
    const violations = sourceRoots
      .flatMap(productionTypeScriptFiles)
      .filter((file) => formerTerm.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(repositoryRoot, file));
    expect(violations).toEqual([]);
  });

  it('uses posting partner wording in the standard LINE rich menu', () => {
    const richMenu = fs.readFileSync(
      path.join(repositoryRoot, 'apps/web/src/line/default-rich-menu.ts'),
      'utf8',
    );
    expect(richMenu).toContain("title: '投稿パートナーを見る'");
    expect(richMenu).toContain("subtitle: 'あなたの投稿パートナー一覧'");
  });
});
