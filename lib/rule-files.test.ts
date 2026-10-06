import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listExternalImports,
  parseHeader,
  parseRuleMetadata,
  resolveSharedImports,
} from './rule-files';

const projectRoot = process.cwd();
const rulesDir = resolve(projectRoot, 'eslint-rules');
let fixtureRoot: string | undefined;

afterEach(() => {
  if (fixtureRoot) {
    rmSync(fixtureRoot, { recursive: true, force: true });
    fixtureRoot = undefined;
  }
});

describe('parseHeader', () => {
  it('should parse headers from real rule, test, shared, and plugin files', () => {
    const readRuleFile = (path: string) => readFileSync(resolve(rulesDir, path), 'utf8');

    expect(parseHeader(readRuleFile('colocated-files/colocated-files.ts'))).toMatchObject({
      kind: 'rule',
      name: 'colocated-files',
      version: '1.0.0',
    });
    expect(parseHeader(readRuleFile('colocated-files/colocated-files.test.ts'))).toMatchObject({
      kind: 'rule-test',
      name: 'colocated-files',
      version: '1.0.0',
    });
    expect(parseHeader(readRuleFile('shared/file-name.ts'))).toMatchObject({
      kind: 'shared',
      name: 'file-name',
      version: '1.0.0',
    });
    expect(parseHeader(readRuleFile('plugin.ts'))).toMatchObject({
      kind: 'plugin',
      name: 'plugin',
      version: '1.0.0',
    });
  });

  it('should parse upstream metadata and original license text', () => {
    const source = parseHeader(
      readFileSync(resolve(rulesDir, 'filename-case/filename-case.ts'), 'utf8')
    );

    expect(source).toMatchObject({
      kind: 'rule',
      name: 'filename-case',
      version: '1.0.0',
      source: {
        package: 'eslint-plugin-unicorn',
        version: '77.0.0',
        rule: 'filename-case',
        url: 'https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v77.0.0/rules/filename-case.js',
      },
    });
    expect(source.licenseText).toContain('MIT License');
    expect(source.licenseText).toContain('Copyright (c) Sindre Sorhus');
    expect(
      parseHeader(
        readFileSync(resolve(rulesDir, 'no-default-export/no-default-export.test.ts'), 'utf8')
      ).source
    ).toMatchObject({
      package: 'eslint-plugin-import-x',
      version: '4.17.1',
      rule: 'no-default-export',
    });

    expect(
      parseHeader(readFileSync(resolve(rulesDir, 'shared/case.ts'), 'utf8')).source
    ).toMatchObject({
      package: 'change-case',
      version: '5.4.4',
      url: 'https://github.com/blakeembrey/change-case/blob/change-case@5.4.4/packages/change-case/src/index.ts',
    });
    expect(
      parseHeader(readFileSync(resolve(rulesDir, 'shared/case.ts'), 'utf8')).source
    ).not.toHaveProperty('rule');
    expect(
      parseHeader(readFileSync(resolve(rulesDir, 'shared/case.test.ts'), 'utf8'))
    ).toMatchObject({
      kind: 'shared-test',
      source: {
        package: 'change-case',
        version: '5.4.4',
      },
    });
  });

  it('should reject missing and malformed headers', () => {
    expect(() => parseHeader('export const rule = {};')).toThrow(/header/i);
    expect(() => parseHeader('// @rule example vnot-semver\n')).toThrow(/version|semver/i);
    expect(() =>
      parseHeader(
        [
          '// @rule example v1.2.3',
          '// Ported from example-package v2.3.4, rule example:',
          '// https://example.com/example',
          '// SPDX-License-Identifier: MIT',
        ].join('\n')
      )
    ).toThrow(/license/i);
  });
});

describe('parseRuleMetadata', () => {
  it('should parse supported languages and required packages from real rule docs', () => {
    const readRuleDoc = (name: string) =>
      readFileSync(resolve(rulesDir, name, 'README.md'), 'utf8');

    expect(parseRuleMetadata(readRuleDoc('filename-case'))).toEqual({
      languages: ['JavaScript', 'TypeScript', 'CSS'],
      requiredPackages: ['@eslint/css'],
    });
    expect(parseRuleMetadata(readRuleDoc('no-default-export'))).toEqual({
      languages: ['JavaScript', 'TypeScript'],
      requiredPackages: [],
    });
  });

  it('should reject missing or malformed frontmatter', () => {
    expect(() => parseRuleMetadata('# rule')).toThrow(/frontmatter/i);
    expect(() => parseRuleMetadata('---\nlanguages:\n  - Rust\n---')).toThrow(/requiredPackages/i);
    expect(() =>
      parseRuleMetadata('---\nlanguages:\n  - Rust\nrequiredPackages: []\n---\n# rule')
    ).toThrow(/unsupported language/i);
  });
});

describe('resolveSharedImports', () => {
  it('should return the shared helpers used by each real rule', () => {
    const readRule = (name: string) => readFileSync(resolve(rulesDir, name, `${name}.ts`), 'utf8');

    expect(
      resolveSharedImports(
        readRule('filename-case'),
        rulesDir,
        resolve(rulesDir, 'filename-case/filename-case.ts')
      )
    ).toEqual(['eslint-rules/shared/case.ts']);
    expect(
      resolveSharedImports(
        readRule('colocated-files'),
        rulesDir,
        resolve(rulesDir, 'colocated-files/colocated-files.ts')
      )
    ).toEqual(['eslint-rules/shared/file-name.ts']);
    expect(
      resolveSharedImports(
        readRule('index-reexport-only'),
        rulesDir,
        resolve(rulesDir, 'index-reexport-only/index-reexport-only.ts')
      )
    ).toEqual(['eslint-rules/shared/file-name.ts']);
    expect(
      resolveSharedImports(
        readRule('no-default-export'),
        rulesDir,
        resolve(rulesDir, 'no-default-export/no-default-export.ts')
      )
    ).toEqual([]);
  });

  it('should follow imports between shared helpers', () => {
    fixtureRoot = mkdtempSync(resolve(projectRoot, 'lib/.rule-files-fixture-'));
    const fixtureRulesDir = join(fixtureRoot, 'eslint-rules');
    mkdirSync(join(fixtureRulesDir, 'shared'), { recursive: true });
    mkdirSync(join(fixtureRulesDir, 'rule'), { recursive: true });
    writeFileSync(
      join(fixtureRulesDir, 'rule/rule.ts'),
      "import { helper } from '../shared/first';\n"
    );
    writeFileSync(
      join(fixtureRulesDir, 'shared/first.ts'),
      "import { nested } from './nested';\nexport { nested };\n"
    );
    writeFileSync(join(fixtureRulesDir, 'shared/nested.ts'), 'export const nested = true;\n');

    expect(
      resolveSharedImports(
        readFileSync(join(fixtureRulesDir, 'rule/rule.ts'), 'utf8'),
        fixtureRulesDir,
        join(fixtureRulesDir, 'rule/rule.ts')
      )
    ).toEqual(['eslint-rules/shared/first.ts', 'eslint-rules/shared/nested.ts']);
  });
});

describe('listExternalImports', () => {
  it('should list external imports and ignore relative imports', () => {
    const source = readFileSync(
      resolve(rulesDir, 'no-default-export/no-default-export.ts'),
      'utf8'
    );
    expect(listExternalImports(source)).toEqual(['eslint']);
    expect(listExternalImports("import './local';\nimport value from 'external-package';")).toEqual(
      ['external-package']
    );
  });
});
