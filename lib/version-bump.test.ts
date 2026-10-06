import { readFileSync, rmSync, writeFileSync, cpSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkRepo } from './attribution';
import { parseHeader } from './rule-files';
import {
  bumpVersion,
  levelFromLabels,
  packageForPath,
  planBumps,
  setChangelogEntry,
  setHeaderVersion,
} from './version-bump';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = resolve(projectRoot, '.fixture-out/version-bump');

function execute(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  return execFileSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

describe('version-bump helpers', () => {
  it('should extract one version label and ignore unrelated labels', () => {
    expect(levelFromLabels(['bug', 'version: minor'])).toBe('minor');
    expect(levelFromLabels(['bug'])).toBeUndefined();
    expect(() => levelFromLabels(['version: minor', 'version: patch'])).toThrow(/version: minor/u);
    expect(() => levelFromLabels(['version: invalid'])).toThrow(/Unknown version label/u);
  });

  it('should bump semantic versions by each supported level', () => {
    expect(bumpVersion('1.0.0', 'major')).toBe('2.0.0');
    expect(bumpVersion('1.0.0', 'minor')).toBe('1.1.0');
    expect(bumpVersion('1.0.0', 'patch')).toBe('1.0.1');
  });

  it('should map only copyable files to packages', () => {
    expect(packageForPath('eslint-rules/filename-case/filename-case.ts')).toEqual({
      kind: 'rule',
      name: 'filename-case',
    });
    expect(packageForPath('eslint-rules/shared/case.test.ts')).toEqual({
      kind: 'shared',
      name: 'case',
    });
    expect(packageForPath('eslint-rules/plugin.ts')).toEqual({
      kind: 'plugin',
      name: 'plugin',
    });
    expect(packageForPath('eslint-rules/filename-case/README.md')).toBeNull();
    expect(packageForPath('lib/version-bump.ts')).toBeNull();
  });

  it('should plan rule and shared-helper bumps from base versions', () => {
    const baseVersions = new Map([
      ['rule:filename-case', '1.0.0'],
      ['shared:file-name', '1.0.0'],
      ['rule:colocated-files', '1.0.0'],
      ['rule:index-reexport-only', '1.0.0'],
    ]);

    expect(
      planBumps({
        changedPaths: ['eslint-rules/filename-case/filename-case.ts'],
        level: 'patch',
        baseVersions,
        sharedDependents: new Map(),
      })
    ).toEqual([{ package: 'rule:filename-case', from: '1.0.0', to: '1.0.1' }]);

    expect(
      planBumps({
        changedPaths: ['eslint-rules/shared/file-name.ts'],
        level: 'minor',
        baseVersions,
        sharedDependents: new Map([
          ['eslint-rules/shared/file-name.ts', ['colocated-files', 'index-reexport-only']],
        ]),
      })
    ).toEqual([
      { package: 'rule:colocated-files', from: '1.0.0', to: '1.1.0' },
      { package: 'rule:index-reexport-only', from: '1.0.0', to: '1.1.0' },
      { package: 'shared:file-name', from: '1.0.0', to: '1.1.0' },
    ]);

    expect(
      planBumps({
        changedPaths: ['eslint-rules/filename-case/filename-case.ts'],
        level: 'none',
        baseVersions,
        sharedDependents: new Map(),
      })
    ).toEqual([{ package: 'rule:filename-case', from: '1.0.0', to: '1.0.0' }]);
    expect(
      planBumps({
        changedPaths: ['eslint-rules/filename-case/README.md'],
        level: 'patch',
        baseVersions,
        sharedDependents: new Map(),
      })
    ).toEqual([]);
    expect(
      planBumps({
        changedPaths: ['eslint-rules/new-rule/new-rule.ts'],
        level: 'patch',
        baseVersions,
        sharedDependents: new Map(),
      })
    ).toEqual([]);
  });

  it('should update only the version in a file header', () => {
    expect(setHeaderVersion('// @rule sample v1.0.0 test\nexport {};\n', '1.1.0')).toBe(
      '// @rule sample v1.1.0 test\nexport {};\n'
    );
    expect(() => setHeaderVersion('export {};\n', '1.1.0')).toThrow(/header/u);
  });

  it('should replace and remove this PR changelog entry after level changes', () => {
    const doc = '# sample\n\n## Changelog\n\n### 1.0.0\n\n- Initial release.\n';
    const patch = setChangelogEntry(doc, {
      baseTopVersion: '1.0.0',
      version: '1.0.1',
      entry: 'fix: sample',
    });
    const minor = setChangelogEntry(patch, {
      baseTopVersion: '1.0.0',
      version: '1.1.0',
      entry: 'fix: sample',
    });
    expect(minor.match(/^### /gm)).toHaveLength(2);
    expect(minor).toContain('### 1.1.0\n\n- fix: sample');

    const reset = setChangelogEntry(minor, {
      baseTopVersion: '1.0.0',
      version: '1.0.0',
      entry: 'fix: sample',
    });
    expect(reset).toBe(doc);
  });
});

describe('version-bump CLI', () => {
  beforeAll(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
    mkdirSync(fixtureRoot, { recursive: true });
    for (const directory of ['eslint-rules', 'licenses']) {
      cpSync(join(projectRoot, directory), join(fixtureRoot, directory), { recursive: true });
    }
    cpSync(join(projectRoot, 'package.json'), join(fixtureRoot, 'package.json'));
    cpSync(join(projectRoot, '.gitignore'), join(fixtureRoot, '.gitignore'));
    mkdirSync(join(fixtureRoot, 'lib'), { recursive: true });
    for (const file of ['rule-files.ts', 'version-bump.ts', 'version-bump-cli.ts']) {
      cpSync(join(projectRoot, 'lib', file), join(fixtureRoot, 'lib', file));
    }
    symlinkSync(join(projectRoot, 'node_modules'), join(fixtureRoot, 'node_modules'), 'dir');
    execute('git', ['init', '-b', 'main'], fixtureRoot);
    execute('git', ['config', 'user.name', 'Fixture'], fixtureRoot);
    execute('git', ['config', 'user.email', 'fixture@example.invalid'], fixtureRoot);
    execute('git', ['add', '.'], fixtureRoot);
    execute('git', ['commit', '-m', 'base'], fixtureRoot);
    const baseSha = execute('git', ['rev-parse', 'HEAD'], fixtureRoot).trim();
    execute('git', ['update-ref', 'refs/remotes/origin/main', baseSha], fixtureRoot);

    const rulePath = join(fixtureRoot, 'eslint-rules/filename-case/filename-case.ts');
    writeFileSync(rulePath, `${readFileSync(rulePath, 'utf8')}\n// Fixture-only comment.\n`);
    execute('git', ['add', 'eslint-rules/filename-case/filename-case.ts'], fixtureRoot);
    execute('git', ['commit', '-m', 'edit rule'], fixtureRoot);
  });

  afterAll(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it('should produce the same tree when the CLI runs twice for one PR', async () => {
    const runBump = () =>
      execute('pnpm', ['bump'], fixtureRoot, {
        VERSION_LABELS: 'version: patch',
        PR_TITLE: 'fix(filename-case): handle dotfiles',
        BASE_REF: 'main',
      });

    runBump();
    const firstStatus = execute('git', ['status', '--porcelain'], fixtureRoot);
    runBump();
    const secondStatus = execute('git', ['status', '--porcelain'], fixtureRoot);
    expect(secondStatus).toBe(firstStatus);
    expect(
      parseHeader(
        readFileSync(join(fixtureRoot, 'eslint-rules/filename-case/filename-case.ts'), 'utf8')
      ).version
    ).toBe('1.0.1');
    expect(
      readFileSync(join(fixtureRoot, 'eslint-rules/filename-case/README.md'), 'utf8')
    ).toContain('### 1.0.1\n\n- fix(filename-case): handle dotfiles');
    expect(() => checkRepo(fixtureRoot)).not.toThrow();
  });
});
