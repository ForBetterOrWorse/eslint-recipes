import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseHeader, resolveSharedImports } from './rule-files';
import {
  type VersionLevel,
  levelFromLabels,
  packageForPath,
  planBumps,
  setChangelogEntry,
  setHeaderVersion,
} from './version-bump';

function git(args: string[], cwd: string, allowFailure = false): string | undefined {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (allowFailure) {
      return undefined;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(' ')} failed: ${detail}`, { cause: error });
  }
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function packageSourcePath(key: string): string {
  const [kind, name] = key.split(':');
  if (kind === 'rule' && name) {
    return `eslint-rules/${name}/${name}.ts`;
  }
  if (kind === 'shared' && name) {
    return `eslint-rules/shared/${name}.ts`;
  }
  if (key === 'plugin') {
    return 'eslint-rules/plugin.ts';
  }
  throw new Error(`Unknown package key "${key}"`);
}

function run(): void {
  const root = process.cwd();
  const baseBranch = requireEnvironment('BASE_REF');
  if (!/^[A-Za-z0-9._/-]+$/.test(baseBranch) || baseBranch.includes('..')) {
    throw new Error(`Invalid base branch "${baseBranch}"`);
  }
  const baseRef = `origin/${baseBranch}`;
  const changedPaths = (git(['diff', '--name-only', `${baseRef}...HEAD`], root) ?? '')
    .split(/\r?\n/)
    .filter(Boolean);
  const copyablePaths = changedPaths.filter((path) => packageForPath(path) !== null);
  if (copyablePaths.length === 0) {
    console.log('No copyable files changed.');
    return;
  }

  let level: VersionLevel | undefined;
  try {
    level = levelFromLabels(
      (process.env.VERSION_LABELS ?? '')
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean)
    );
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(
      `Add exactly one label: version: major, version: minor, version: patch, or version: none. See docs/versioning.md.${detail}`,
      { cause: error }
    );
  }
  if (level === undefined) {
    throw new Error(
      'Add exactly one label: version: major, version: minor, version: patch, or version: none. See docs/versioning.md.'
    );
  }

  const title = requireEnvironment('PR_TITLE');
  if (/[\r\n]/.test(title)) {
    throw new Error('PR_TITLE must be a single line');
  }

  const rulesDirectory = join(root, 'eslint-rules');
  const sharedDependents = new Map<string, string[]>();
  for (const entry of readdirSync(rulesDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const name = entry.name;
    const rulePath = join(rulesDirectory, name, `${name}.ts`);
    if (!existsSync(rulePath)) {
      continue;
    }
    const source = readFileSync(rulePath, 'utf8');
    for (const sharedPath of resolveSharedImports(source, rulesDirectory, rulePath)) {
      const dependents = sharedDependents.get(sharedPath) ?? [];
      dependents.push(name);
      sharedDependents.set(sharedPath, dependents);
    }
  }

  const baseCommit = git(['rev-parse', '--verify', `${baseRef}^{commit}`], root)?.trim();
  if (!baseCommit) {
    throw new Error(`Unable to resolve base ref "${baseRef}"`);
  }

  const baseVersions = new Map<string, string>();
  for (const key of new Set(
    copyablePaths
      .map((path) => packageForPath(path))
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .map((item) => (item.kind === 'plugin' ? 'plugin' : `${item.kind}:${item.name}`))
  )) {
    const path = packageSourcePath(key);
    if (git(['cat-file', '-e', `${baseCommit}:${path}`], root, true) === undefined) {
      continue;
    }
    const source = git(['show', `${baseCommit}:${path}`], root);
    if (source === undefined) {
      throw new Error(`Unable to read ${path} from ${baseRef}`);
    }
    baseVersions.set(key, parseHeader(source).version);
  }

  for (const changedPath of copyablePaths) {
    const changedPackage = packageForPath(changedPath);
    if (changedPackage?.kind !== 'shared') {
      continue;
    }
    const sharedPath = changedPath.replace(/\.test\.ts$/, '.ts');
    for (const dependent of sharedDependents.get(sharedPath) ?? []) {
      const key = `rule:${dependent}`;
      if (baseVersions.has(key)) {
        continue;
      }
      const path = packageSourcePath(key);
      const source = git(['show', `${baseCommit}:${path}`], root, true);
      if (source !== undefined) {
        baseVersions.set(key, parseHeader(source).version);
      }
    }
  }

  const bumps = planBumps({ changedPaths: copyablePaths, level, baseVersions, sharedDependents });
  for (const bump of bumps) {
    const sourcePath = packageSourcePath(bump.package);
    const packagePaths =
      bump.package === 'plugin'
        ? [sourcePath]
        : [sourcePath, sourcePath.replace(/\.ts$/, '.test.ts')];
    for (const path of packagePaths) {
      if (!existsSync(resolve(root, path))) {
        throw new Error(`Missing package file ${path}`);
      }
      const source = readFileSync(resolve(root, path), 'utf8');
      writeFileSync(resolve(root, path), setHeaderVersion(source, bump.to));
    }

    if (!bump.package.startsWith('rule:')) {
      continue;
    }
    const ruleName = bump.package.slice('rule:'.length);
    const docPath = `eslint-rules/${ruleName}/README.md`;
    const baseDoc = git(['show', `${baseCommit}:${docPath}`], root, true);
    if (baseDoc === undefined) {
      continue;
    }
    const baseTopVersion = /^## Changelog\s*$([\s\S]*)/m
      .exec(baseDoc)?.[1]
      ?.match(/^### (\S+)\s*$/m)?.[1];
    if (!baseTopVersion) {
      throw new Error(`Missing top changelog version in ${docPath} on ${baseRef}`);
    }
    const doc = readFileSync(resolve(root, docPath), 'utf8');
    writeFileSync(
      resolve(root, docPath),
      setChangelogEntry(doc, { baseTopVersion, version: bump.to, entry: title })
    );
  }

  console.log(
    bumps.length > 0
      ? `Applied ${level} version plan to: ${bumps.map(({ package: name }) => name).join(', ')}.`
      : 'No existing packages need a version change.'
  );
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
