export type BumpLevel = 'major' | 'minor' | 'patch';
export type VersionLevel = BumpLevel | 'none';

export interface PackageVersion {
  package: string;
  from: string;
  to: string;
}

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | undefined;
} {
  const match = semverPattern.exec(version);
  if (!match) {
    throw new Error(`Invalid semantic version "${version}"`);
  }
  const [, major, minor, patch, prerelease] = match;
  const components = [major, minor, patch].map(Number);
  if (components.some((component) => !Number.isSafeInteger(component))) {
    throw new Error(`Semantic version "${version}" exceeds the safe integer range`);
  }
  return {
    major: components[0] ?? 0,
    minor: components[1] ?? 0,
    patch: components[2] ?? 0,
    prerelease,
  };
}

function comparePrerelease(left: string, right: string): number {
  const leftParts = left.split('.');
  const rightParts = right.split('.');
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const a = leftParts[index];
    const b = rightParts[index];
    if (a === undefined) {
      return -1;
    }
    if (b === undefined) {
      return 1;
    }
    if (a === b) {
      continue;
    }
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) {
      return Number(a) < Number(b) ? -1 : 1;
    }
    if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1;
    }
    return a < b ? -1 : 1;
  }
  return 0;
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) {
      return a[key] < b[key] ? -1 : 1;
    }
  }
  if (a.prerelease === b.prerelease) {
    return 0;
  }
  if (a.prerelease === undefined) {
    return 1;
  }
  if (b.prerelease === undefined) {
    return -1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function levelFromLabels(labels: string[]): VersionLevel | undefined {
  const versionLabels = labels.filter((label) => label.startsWith('version:'));
  if (versionLabels.length > 1) {
    throw new Error(`Expected one version label, found: ${versionLabels.join(', ')}`);
  }
  if (versionLabels.length === 0) {
    return undefined;
  }

  const level = versionLabels[0]?.slice('version:'.length).trim();
  if (level === 'major' || level === 'minor' || level === 'patch' || level === 'none') {
    return level;
  }
  throw new Error(`Unknown version label "${versionLabels[0]}"`);
}

export function bumpVersion(version: string, level: BumpLevel): string {
  const { major, minor, patch } = parseVersion(version);
  if (level === 'major') {
    return `${major + 1}.0.0`;
  }
  if (level === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

export function packageForPath(
  path: string
): { kind: 'rule' | 'shared' | 'plugin'; name: string } | null {
  if (path === 'eslint-rules/plugin.ts') {
    return { kind: 'plugin', name: 'plugin' };
  }

  const ruleMatch = /^eslint-rules\/([\w-]+)\/([\w-]+)(?:\.test)?\.ts$/.exec(path);
  if (ruleMatch?.[1] && ruleMatch[1] === ruleMatch[2]) {
    return { kind: 'rule', name: ruleMatch[1] };
  }

  const sharedMatch = /^eslint-rules\/shared\/([\w-]+)(?:\.test)?\.ts$/.exec(path);
  if (sharedMatch?.[1]) {
    return { kind: 'shared', name: sharedMatch[1] };
  }

  return null;
}

export function planBumps(input: {
  changedPaths: string[];
  level: VersionLevel;
  baseVersions: Map<string, string>;
  sharedDependents: Map<string, string[]>;
}): PackageVersion[] {
  const affected = new Set<string>();
  for (const path of input.changedPaths) {
    const changedPackage = packageForPath(path);
    if (!changedPackage) {
      continue;
    }

    const key =
      changedPackage.kind === 'plugin' ? 'plugin' : `${changedPackage.kind}:${changedPackage.name}`;
    affected.add(key);
    if (changedPackage.kind === 'shared') {
      const sharedPath = path.replace(/\.test\.ts$/, '.ts');
      for (const dependent of input.sharedDependents.get(sharedPath) ?? []) {
        affected.add(`rule:${dependent}`);
      }
    }
  }

  return [...affected].sort().flatMap((key) => {
    const version = input.baseVersions.get(key);
    if (version === undefined) {
      return [];
    }
    return [
      {
        package: key,
        from: version,
        to: input.level === 'none' ? version : bumpVersion(version, input.level),
      },
    ];
  });
}

export function setHeaderVersion(source: string, version: string): string {
  parseVersion(version);
  const lines = source.split(/\r?\n/);
  const firstLine = lines[0] ?? '';
  const match = /^(\/\/ @(?:rule [\w-]+|shared [\w-]+|plugin) v)(\S+)(.*)$/.exec(firstLine);
  if (!match) {
    throw new Error(`Missing or malformed version header on line 1: ${firstLine}`);
  }
  lines[0] = `${match[1]}${version}${match[3]}`;
  return lines.join(source.includes('\r\n') ? '\r\n' : '\n');
}

export function setChangelogEntry(
  doc: string,
  input: { baseTopVersion: string; version: string; entry: string }
): string {
  const comparison = compareVersions(input.version, input.baseTopVersion);
  if (comparison < 0) {
    throw new Error(
      `Version ${input.version} is below the base changelog version ${input.baseTopVersion}`
    );
  }
  if (/[\r\n]/.test(input.entry)) {
    throw new Error('Changelog entry must be a single line');
  }

  const changelogHeading = /^## Changelog[ \t]*$/m.exec(doc);
  if (!changelogHeading) {
    throw new Error('Missing "## Changelog" section');
  }
  let bodyStart = changelogHeading.index + changelogHeading[0].length;
  if (doc.startsWith('\r\n', bodyStart)) {
    bodyStart += 2;
  } else if (doc[bodyStart] === '\n') {
    bodyStart += 1;
  }

  const body = doc.slice(bodyStart);
  const firstSection = /^### ([^\r\n]+)[ \t]*$/m.exec(body);
  const lineEnding = doc.includes('\r\n') ? '\r\n' : '\n';
  if (!firstSection) {
    if (comparison === 0) {
      return doc;
    }
    return `${doc.slice(0, bodyStart)}### ${input.version}${lineEnding}${lineEnding}- ${input.entry}${lineEnding}${lineEnding}${body}`;
  }

  const currentVersion = firstSection[1]?.trim() ?? '';
  const currentComparison = compareVersions(currentVersion, input.baseTopVersion);
  const sectionStart = bodyStart + firstSection.index;
  const nextSection = /^### [^\r\n]+[ \t]*$/gm;
  nextSection.lastIndex = firstSection.index + firstSection[0].length;
  const following = nextSection.exec(body);
  const sectionEnd = following ? bodyStart + following.index : doc.length;

  if (comparison === 0) {
    return currentComparison > 0 ? `${doc.slice(0, sectionStart)}${doc.slice(sectionEnd)}` : doc;
  }

  const section = `### ${input.version}${lineEnding}${lineEnding}- ${input.entry}${lineEnding}${lineEnding}`;
  if (currentComparison <= 0) {
    return `${doc.slice(0, sectionStart)}${section}${doc.slice(sectionStart)}`;
  }
  return `${doc.slice(0, sectionStart)}${section}${doc.slice(sectionEnd)}`;
}
