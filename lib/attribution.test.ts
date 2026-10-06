import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkRepo } from './attribution';

const projectRoot = process.cwd();
let fixtureRoot: string | undefined;

const cssRuleFrontmatter = [
  '---',
  'languages:',
  '  - JavaScript',
  '  - TypeScript',
  '  - CSS',
  'requiredPackages:',
  "  - '@eslint/css'",
  '---',
  '',
].join('\n');
const jsRuleFrontmatter = [
  '---',
  'languages:',
  '  - JavaScript',
  '  - TypeScript',
  'requiredPackages: []',
  '---',
  '',
].join('\n');

afterEach(() => {
  if (fixtureRoot) {
    rmSync(fixtureRoot, { recursive: true, force: true });
    fixtureRoot = undefined;
  }
});

const upstreamUrl = 'https://example.com/package/blob/v1.2.3/rules/ported.ts';
const licenseText = 'MIT License\n\nCopyright (c) Example';

function createFixture(): string {
  const root = mkdtempSync(resolve(projectRoot, 'lib/.attribution-fixture-'));
  fixtureRoot = root;
  const write = (path: string, contents: string) => {
    const absolutePath = join(root, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  };
  const portedHeader = [
    '// @rule alpha v0.1.0',
    '// Ported from package v1.2.3, rule alpha:',
    `// ${upstreamUrl}`,
    '// Original license:',
    ...licenseText.split('\n').map((line) => `//${line ? ` ${line}` : ''}`),
  ].join('\n');
  const portedTestHeader = portedHeader
    .replace('// @rule alpha v0.1.0', '// @rule alpha v0.1.0 test')
    .replace('rule alpha:', 'rule alpha test:');
  const originalHeader = '// @rule plain v0.1.0';
  const originalTestHeader = '// @rule plain v0.1.0 test';

  write(
    'eslint-rules/alpha/alpha.ts',
    `${portedHeader}\nimport { helper } from '../shared/helper';\nexport const alpha = { meta: { languages: ['js/js', 'css/css'] }, helper };\n`
  );
  write(
    'eslint-rules/alpha/alpha.test.ts',
    `${portedTestHeader}\nimport { describe, it } from 'vitest';\n`
  );
  write(
    'eslint-rules/plain/plain.ts',
    `${originalHeader}\nexport const plain = { meta: { languages: ['js/js'] } };\n`
  );
  write('eslint-rules/plain/plain.test.ts', `${originalTestHeader}\n`);
  write('eslint-rules/shared/helper.ts', '// @shared helper v0.1.0\nexport const helper = true;\n');
  write(
    'eslint-rules/plugin.ts',
    [
      '// @plugin v0.1.0',
      "import { alpha } from './alpha/alpha';",
      "import { plain } from './plain/plain';",
      'export const plugin = {',
      '  rules: {',
      '    alpha: alpha,',
      '    plain: plain,',
      '  },',
      '};',
    ].join('\n')
  );
  write('licenses/package.txt', `${licenseText}\n`);
  write(
    'eslint-rules/alpha/README.md',
    cssRuleFrontmatter +
      [
        '# alpha',
        '',
        `Ported from package 1.2.3, rule alpha [source](${upstreamUrl}) (MIT).`,
        '',
        '## Files to copy',
        '',
        '- `eslint-rules/alpha/alpha.ts`',
        '- `eslint-rules/alpha/alpha.test.ts` (optional)',
        '- `eslint-rules/shared/helper.ts`',
        '',
        '## Changelog',
        '',
        '### 0.1.0',
      ].join('\n')
  );
  write(
    'eslint-rules/plain/README.md',
    jsRuleFrontmatter +
      [
        '# plain',
        '',
        'An original rule.',
        '',
        '## Files to copy',
        '',
        '- `eslint-rules/plain/plain.ts`',
        '- `eslint-rules/plain/plain.test.ts` (optional)',
        '',
        '## Changelog',
        '',
        '### 0.1.0',
      ].join('\n')
  );

  return root;
}

function updateFixture(path: string, contents: string): void {
  if (!fixtureRoot) {
    throw new Error('Fixture has not been created');
  }
  writeFileSync(join(fixtureRoot, path), contents);
}

describe('checkRepo', () => {
  it('should pass for the real repository', () => {
    expect(() => checkRepo(projectRoot)).not.toThrow();
  });

  it('should pass for a consistent fixture tree', () => {
    expect(() => checkRepo(createFixture())).not.toThrow();
  });

  it('should report a rule doc missing required frontmatter', () => {
    const root = createFixture();
    const docPath = 'eslint-rules/plain/README.md';
    const doc = readFileSync(join(root, docPath), 'utf8');
    updateFixture(docPath, doc.replace(/^---[\s\S]*?---\r?\n/, ''));

    expect(() => checkRepo(root)).toThrow(/eslint-rules\/plain\/README\.md.*frontmatter/);
  });

  it('should require @eslint/css for rules that document CSS support', () => {
    const root = createFixture();
    const docPath = 'eslint-rules/alpha/README.md';
    const doc = readFileSync(join(root, docPath), 'utf8');
    updateFixture(
      docPath,
      doc.replace("requiredPackages:\n  - '@eslint/css'", 'requiredPackages: []')
    );

    expect(() => checkRepo(root)).toThrow(/eslint-rules\/alpha\/README\.md.*@eslint\/css/);
  });

  it('should report a changed line in a ported license block', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/alpha/alpha.ts',
      `${[
        '// @rule alpha v0.1.0',
        '// Ported from package v1.2.3, rule alpha:',
        `// ${upstreamUrl}`,
        '// Original license:',
        '// MIT License',
        '//',
        '// Copyright (c) Changed',
        "import { helper } from '../shared/helper';",
      ].join('\n')}\n`
    );
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/alpha\/alpha\.ts/);
  });

  it('should report a missing upstream license file', () => {
    const root = createFixture();
    rmSync(join(root, 'licenses/package.txt'));
    expect(() => checkRepo(root)).toThrow(/licenses\/package\.txt/);
  });

  it('should report a ported doc URL that differs from its header', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/alpha/README.md',
      [
        '# alpha',
        '',
        'Ported from package 1.2.3, rule alpha [source](https://example.com/wrong) (MIT).',
        '',
        '## Files to copy',
        '',
        '- `eslint-rules/alpha/alpha.ts`',
        '- `eslint-rules/alpha/alpha.test.ts` (optional)',
        '- `eslint-rules/shared/helper.ts`',
        '',
        '## Changelog',
        '',
        '### 0.1.0',
      ].join('\n')
    );
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/alpha\/README\.md/);
  });

  it('should report a test that names a different upstream version', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/alpha/alpha.test.ts',
      [
        '// @rule alpha v0.1.0 test',
        '// Ported from package v2.3.4, rule alpha test:',
        '// https://example.com/package/blob/v2.3.4/rules/ported.ts',
        '// Original license:',
        '// MIT License',
        '//',
        '// Copyright (c) Example',
      ].join('\n')
    );
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/alpha\/alpha\.test\.ts/);
  });

  it('should report a Ported from line in an original rule doc', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/plain/README.md',
      [
        '# plain',
        '',
        'Ported from another package [source](https://example.com/source) (MIT).',
        '',
        '## Files to copy',
        '',
        '- `eslint-rules/plain/plain.ts`',
        '- `eslint-rules/plain/plain.test.ts` (optional)',
        '',
        '## Changelog',
        '',
        '### 0.1.0',
      ].join('\n')
    );
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/plain\/README\.md/);
  });

  it('should report an unused license file', () => {
    const root = createFixture();
    writeFileSync(join(root, 'licenses/unused.txt'), 'unused');
    expect(() => checkRepo(root)).toThrow(/licenses\/unused\.txt/);
  });

  it('should report rule and test versions that differ', () => {
    const root = createFixture();
    updateFixture('eslint-rules/alpha/alpha.test.ts', '// @rule alpha v0.2.0 test\n');
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/alpha\/alpha\.test\.ts/);
  });

  it('should report a changelog version that differs from its rule header', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/alpha/README.md',
      [
        '# alpha',
        '',
        `Ported from package 1.2.3, rule alpha [source](${upstreamUrl}) (MIT).`,
        '',
        '## Files to copy',
        '',
        '- `eslint-rules/alpha/alpha.ts`',
        '- `eslint-rules/alpha/alpha.test.ts` (optional)',
        '- `eslint-rules/shared/helper.ts`',
        '',
        '## Changelog',
        '',
        '### 0.2.0',
      ].join('\n')
    );
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/alpha\/README\.md/);
  });

  it('should report a rule that has no doc', () => {
    const root = createFixture();
    rmSync(join(root, 'eslint-rules/plain/README.md'));
    expect(() => checkRepo(root)).toThrow(
      /eslint-rules\/plain\/plain\.ts.*eslint-rules\/plain\/README\.md/
    );
  });

  it('should report a Files to copy list missing a shared dependency', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/alpha/README.md',
      [
        '# alpha',
        '',
        `Ported from package 1.2.3, rule alpha [source](${upstreamUrl}) (MIT).`,
        '',
        '## Files to copy',
        '',
        '- `eslint-rules/alpha/alpha.ts`',
        '- `eslint-rules/alpha/alpha.test.ts` (optional)',
        '',
        '## Changelog',
        '',
        '### 0.1.0',
      ].join('\n')
    );
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/alpha\/README\.md/);
  });

  it('should report a rule missing from plugin registration', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/plugin.ts',
      [
        '// @plugin v0.1.0',
        "import { alpha } from './alpha/alpha';",
        "import { plain } from './plain/plain';",
        'export const plugin = {',
        '  rules: {',
        '    alpha: alpha,',
        '  },',
        '};',
      ].join('\n')
    );
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/plugin\.ts.*plain/);
  });

  it('should report a disallowed external import', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/plain/plain.ts',
      `${'// @rule plain v0.1.0'}\nimport value from 'lodash';\n`
    );
    expect(() => checkRepo(root)).toThrow(/eslint-rules\/plain\/plain\.ts.*lodash/);
  });

  it('should list multiple problems in one error', () => {
    const root = createFixture();
    updateFixture(
      'eslint-rules/plain/plain.ts',
      "// @rule plain v0.1.0\nimport value from 'lodash';\n"
    );
    updateFixture(
      'eslint-rules/alpha/README.md',
      [
        '# alpha',
        '',
        'Ported from package 1.2.3, rule alpha [source](https://example.com/wrong) (MIT).',
        '',
        '## Files to copy',
        '',
        '- `eslint-rules/alpha/alpha.ts`',
        '',
        '## Changelog',
        '',
        '### 0.2.0',
      ].join('\n')
    );
    expect(() => checkRepo(root)).toThrow(
      /eslint-rules\/plain\/plain\.ts[\s\S]*eslint-rules\/alpha\/README\.md/
    );
  });
});
