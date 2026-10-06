import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

export type FileKind = 'rule' | 'rule-test' | 'shared' | 'shared-test' | 'plugin';

export interface UpstreamSource {
  package: string;
  version: string;
  rule?: string;
  url: string;
}

export interface FileHeader {
  kind: FileKind;
  name: string;
  version: string;
  source?: UpstreamSource;
  licenseText?: string;
}

export type RuleLanguage = 'JavaScript' | 'TypeScript' | 'CSS';

export interface RuleDocMetadata {
  languages: RuleLanguage[];
  requiredPackages: string[];
}

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function isSemver(version: string): boolean {
  return semverPattern.test(version);
}

function parseSource(lines: string[], fileVersion: string): UpstreamSource | undefined {
  const sourceLineIndex = lines.findIndex((line) => /^\/\/ Ported from /.test(line));
  if (sourceLineIndex < 0) {
    return undefined;
  }

  const sourceLine = lines[sourceLineIndex]?.replace(/^\/\/ Ported from /, '') ?? '';
  const sourceMatch =
    /^(?<package>(?:@[^/\s]+\/)?[^/\s]+) v(?<version>\S+?)(?:, rule (?<rule>[^:]+?)(?: test)?|, test)?:$/.exec(
      sourceLine
    );
  if (!sourceMatch?.groups) {
    throw new Error('Malformed Ported from header line');
  }

  const { package: packageName, version, rule } = sourceMatch.groups;
  if (!isSemver(version)) {
    throw new Error(`Ported from version "${version}" is not valid semver`);
  }

  const urlLine = lines[sourceLineIndex + 1] ?? '';
  const url = /^\/\/ (https?:\/\/\S+)$/.exec(urlLine)?.[1];
  if (!url) {
    throw new Error('Ported from header is missing its source URL');
  }

  if (!lines.includes('// Original license:')) {
    throw new Error('Ported from header is missing its Original license block');
  }
  if (!isSemver(fileVersion)) {
    throw new Error(`Header version "${fileVersion}" is not valid semver`);
  }

  return {
    package: packageName,
    version,
    ...(rule ? { rule } : {}),
    url,
  };
}

export function parseHeader(source: string): FileHeader {
  const lines = source.split(/\r?\n/);
  const headerLines: string[] = [];

  for (const line of lines) {
    if (!line.startsWith('//')) {
      break;
    }
    headerLines.push(line);
  }

  const headerLine = headerLines[0];
  const match =
    /^\/\/ @(?:(?<tag>rule|shared) (?<name>[\w-]+) v(?<version>\S+)(?<test> test)?|plugin v(?<pluginVersion>\S+))$/.exec(
      headerLine ?? ''
    );
  if (!match?.groups) {
    throw new Error('Missing or malformed file header');
  }

  const tag = match.groups.tag ?? 'plugin';
  const name = match.groups.name ?? 'plugin';
  const version = match.groups.version ?? match.groups.pluginVersion ?? '';
  const test = match.groups.test;
  if (!isSemver(version)) {
    throw new Error(`Header version "${version}" is not valid semver`);
  }

  const kind: FileKind =
    tag === 'plugin'
      ? 'plugin'
      : tag === 'rule'
        ? test
          ? 'rule-test'
          : 'rule'
        : test
          ? 'shared-test'
          : 'shared';
  const upstream = parseSource(headerLines, version);
  let licenseText: string | undefined;

  if (upstream) {
    const licenseStart = headerLines.indexOf('// Original license:');
    const licenseLines = headerLines.slice(licenseStart + 1);
    while (licenseLines.length > 0 && licenseLines.at(-1) === '//') {
      licenseLines.pop();
    }
    licenseText = licenseLines.map((line) => line.replace(/^\/\/ ?/, '')).join('\n');
    if (licenseText.length === 0) {
      throw new Error('Ported from header has an empty Original license block');
    }
  }

  return {
    kind,
    name,
    version,
    ...(upstream ? { source: upstream, licenseText } : {}),
  };
}

export function parseRuleMetadata(source: string): RuleDocMetadata {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1];
  if (frontmatter === undefined) {
    throw new Error('Missing YAML frontmatter');
  }

  const fields = new Map<'languages' | 'requiredPackages', string[]>();
  let activeField: 'languages' | 'requiredPackages' | undefined;

  for (const line of frontmatter.split(/\r?\n/)) {
    if (line.trim() === '') {
      continue;
    }

    const fieldMatch = /^(languages|requiredPackages):(?:\s*(.*))?$/.exec(line);
    if (fieldMatch) {
      const field = fieldMatch[1];
      if (field !== 'languages' && field !== 'requiredPackages') {
        throw new Error(`Unknown rule frontmatter field "${field}"`);
      }
      if (fields.has(field)) {
        throw new Error(`Duplicate "${field}" frontmatter field`);
      }
      const value = fieldMatch[2]?.trim();
      if (value !== undefined && value !== '' && value !== '[]') {
        throw new Error(`"${field}" must be a YAML string list`);
      }
      fields.set(field, []);
      activeField = value === '[]' ? undefined : field;
      continue;
    }

    const itemMatch = /^\s+-\s+(.+?)\s*$/.exec(line);
    if (!itemMatch || !activeField) {
      throw new Error(`Malformed rule frontmatter line "${line}"`);
    }

    let value = itemMatch[1] ?? '';
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replaceAll("''", "'");
    } else if (value.startsWith('"')) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (typeof parsed !== 'string') {
          throw new Error();
        }
        value = parsed;
      } catch {
        throw new Error(`Malformed quoted value in "${activeField}" frontmatter`);
      }
    }

    if (!value) {
      throw new Error(`Empty value in "${activeField}" frontmatter`);
    }
    const values = fields.get(activeField);
    if (!values) {
      throw new Error(`Missing "${activeField}" frontmatter field`);
    }
    values.push(value);
  }

  const languages = fields.get('languages');
  const requiredPackages = fields.get('requiredPackages');
  if (!languages || !requiredPackages) {
    throw new Error('Frontmatter must include "languages" and "requiredPackages"');
  }
  if (languages.length === 0) {
    throw new Error('"languages" must contain at least one language');
  }

  const isRuleLanguage = (value: string): value is RuleLanguage =>
    value === 'JavaScript' || value === 'TypeScript' || value === 'CSS';
  if (languages.some((language) => !isRuleLanguage(language))) {
    throw new Error('"languages" contains an unsupported language');
  }
  if (new Set(languages).size !== languages.length) {
    throw new Error('"languages" contains duplicate values');
  }
  if (new Set(requiredPackages).size !== requiredPackages.length) {
    throw new Error('"requiredPackages" contains duplicate values');
  }

  return {
    languages: languages.filter(isRuleLanguage),
    requiredPackages,
  };
}

function resolveTypeScriptImport(importPath: string, directory: string): string {
  const candidate = resolve(directory, importPath);
  const candidates = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    join(candidate, 'index.ts'),
  ];
  const resolvedPath = candidates.find((path) => existsSync(path));
  if (!resolvedPath) {
    throw new Error(`Unable to resolve shared import "${importPath}" from "${directory}"`);
  }
  return resolvedPath;
}

export function resolveSharedImports(
  source: string,
  rulesDir: string,
  sourcePath?: string
): string[] {
  const resolvedRulesDir = resolve(rulesDir);
  const projectRoot = dirname(resolvedRulesDir);
  const discovered = new Set<string>();
  const visited = new Set<string>();

  function visit(sourceText: string, sourcePath?: string): void {
    const baseDirectory = sourcePath ? dirname(sourcePath) : resolvedRulesDir;
    const sharedImports = ts
      .preProcessFile(sourceText, true, true)
      .importedFiles.map(({ fileName }) => fileName)
      .filter((fileName) =>
        sourcePath ? fileName.startsWith('.') : fileName.startsWith('./shared/')
      );

    for (const importPath of sharedImports) {
      const resolvedPath = resolveTypeScriptImport(importPath, baseDirectory);
      if (visited.has(resolvedPath)) {
        continue;
      }
      visited.add(resolvedPath);
      discovered.add(relative(projectRoot, resolvedPath).split(sep).join('/'));
      visit(readFileSync(resolvedPath, 'utf8'), resolvedPath);
    }
  }

  visit(source, sourcePath ? resolve(sourcePath) : undefined);
  return [...discovered].sort();
}

export function listExternalImports(source: string): string[] {
  const imports = ts
    .preProcessFile(source, true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter((fileName) => !fileName.startsWith('.'));

  return [...new Set(imports)].sort();
}
