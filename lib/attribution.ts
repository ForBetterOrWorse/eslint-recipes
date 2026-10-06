import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import {
  listExternalImports,
  parseHeader,
  parseRuleMetadata,
  resolveSharedImports,
} from './rule-files';
import type { FileHeader, RuleDocMetadata, RuleLanguage } from './rule-files';

const allowedImports = new Set(['@eslint/css', 'eslint', 'typescript-eslint', 'vitest']);

interface RepositoryFile {
  path: string;
  source: string;
  header?: FileHeader;
}

function listFiles(directory: string, extension: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFiles(path, extension);
    }
    return entry.isFile() && path.endsWith(extension) ? [path] : [];
  });
}

function repoPath(projectRoot: string, path: string): string {
  return relative(projectRoot, path).split(sep).join('/');
}

function normalizeLicense(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n+$/, '');
}

function getCopyList(doc: string): string[] {
  const headingStart = doc.search(/^## Files to copy\s*$/m);
  if (headingStart < 0) {
    return [];
  }
  const contentStart = doc.indexOf('\n', headingStart) + 1;
  const nextHeading = doc.indexOf('\n## ', contentStart);
  const section = doc.slice(contentStart, nextHeading < 0 ? undefined : nextHeading);
  return [...section.matchAll(/^- `([^`]+)`/gm)].map(([, path]) => path ?? '');
}

function getChangelogVersion(doc: string): string | undefined {
  const section = /^## Changelog\s*$([\s\S]*)/m.exec(doc)?.[1] ?? '';
  return /^### (\S+)\s*$/m.exec(section)?.[1];
}

function getPortedFromUrl(doc: string): string | undefined {
  return /^Ported from .*\((https?:\/\/[^)]+)\)/m.exec(doc)?.[1];
}

function getRuleLanguages(source: string): Set<RuleLanguage> | undefined {
  const declaration = /languages\s*:\s*\[([\s\S]*?)\]/.exec(source)?.[1];
  if (declaration === undefined) {
    return undefined;
  }

  const languageIds = [...declaration.matchAll(/['"]([^'"]+)['"]/g)].map(([, id]) => id);
  const languages = new Set<RuleLanguage>();
  for (const id of languageIds) {
    if (id === 'js/js') {
      languages.add('JavaScript');
      languages.add('TypeScript');
    } else if (id === 'css/css') {
      languages.add('CSS');
    }
  }
  return languages;
}

export function checkRepo(projectRoot: string): void {
  const root = resolve(projectRoot);
  const rulesDirectory = join(root, 'eslint-rules');
  const licensesDirectory = join(root, 'licenses');
  const problems: string[] = [];
  const ruleFiles = listFiles(rulesDirectory, '.ts').sort();
  const files: RepositoryFile[] = ruleFiles.map((absolutePath) => {
    const path = repoPath(root, absolutePath);
    const source = readFileSync(absolutePath, 'utf8');
    try {
      return { path, source, header: parseHeader(source) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      problems.push(`${path}: ${message}`);
      return { path, source };
    }
  });
  const docs = new Map(
    listFiles(rulesDirectory, '.md')
      .sort()
      .map((absolutePath) => [repoPath(root, absolutePath), readFileSync(absolutePath, 'utf8')])
  );
  const licenses = new Map(
    listFiles(licensesDirectory, '.txt')
      .sort()
      .map((absolutePath) => [repoPath(root, absolutePath), readFileSync(absolutePath, 'utf8')])
  );
  const referencedLicenses = new Set<string>();
  const rules = files.filter((file) => file.header?.kind === 'rule');
  const tests = files.filter((file) => file.header?.kind === 'rule-test');
  const plugin = files.find((file) => file.path === 'eslint-rules/plugin.ts');
  const pluginRules = /rules\s*:\s*\{([\s\S]*?)\}/.exec(plugin?.source ?? '')?.[1] ?? '';
  const registeredRules = new Set(
    [...pluginRules.matchAll(/['"]?([\w-]+)['"]?\s*:/g)].map(([, name]) => name)
  );

  if (!plugin) {
    problems.push('eslint-rules/plugin.ts: missing plugin file');
  } else if (plugin.header?.kind !== 'plugin') {
    problems.push('eslint-rules/plugin.ts: expected a plugin header');
  }

  for (const file of files) {
    const header = file.header;
    if (!header) {
      continue;
    }

    const fileName = file.path.split('/').at(-1) ?? '';
    if (header.kind !== 'plugin') {
      const expectedName = fileName.replace(/(?:\.test)?\.ts$/, '');
      if (header.name !== expectedName) {
        problems.push(`${file.path}: header name "${header.name}" does not match file name`);
      }
    }

    for (const specifier of listExternalImports(file.source)) {
      if (!specifier.startsWith('node:') && !allowedImports.has(specifier)) {
        problems.push(`${file.path}: disallowed external import "${specifier}"`);
      }
    }

    if (header.source) {
      const source = header.source;
      const licensePath = `licenses/${source.package}.txt`;
      const license = licenses.get(licensePath);
      referencedLicenses.add(licensePath);

      if (!license) {
        problems.push(`${file.path}: missing ${licensePath}`);
      } else if (
        header.licenseText === undefined ||
        normalizeLicense(header.licenseText) !== normalizeLicense(license)
      ) {
        problems.push(`${file.path}: Original license block does not match ${licensePath}`);
      }

      if (!source.url.includes(source.version)) {
        problems.push(
          `${file.path}: source URL does not contain upstream version ${source.version}`
        );
      }
    }
  }

  for (const file of files.filter((entry) => entry.header?.kind === 'shared')) {
    const test = files.find(
      (entry) => entry.header?.kind === 'shared-test' && entry.header.name === file.header?.name
    );
    if (test && test.header?.version !== file.header?.version) {
      problems.push(`${test.path}: shared version does not match ${file.path}`);
    } else if (test) {
      if (
        test.header?.source?.package !== file.header?.source?.package ||
        test.header?.source?.version !== file.header?.source?.version
      ) {
        problems.push(`${test.path}: upstream source does not match ${file.path}`);
      }
    }
  }

  for (const test of files.filter((entry) => entry.header?.kind === 'shared-test')) {
    if (
      !files.some(
        (entry) => entry.header?.kind === 'shared' && entry.header.name === test.header?.name
      )
    ) {
      problems.push(`${test.path}: no matching shared file`);
    }
  }

  for (const rule of rules) {
    const header = rule.header;
    if (!header) {
      continue;
    }
    const ruleTest = tests.find((test) => test.header?.name === header.name);
    if (!ruleTest) {
      problems.push(`${rule.path}: missing rule test file`);
    } else {
      if (ruleTest.header?.version !== header.version) {
        problems.push(`${ruleTest.path}: version does not match ${rule.path}`);
      }
      if (
        ruleTest.header?.source?.package !== header.source?.package ||
        ruleTest.header?.source?.version !== header.source?.version
      ) {
        problems.push(`${ruleTest.path}: upstream source does not match ${rule.path}`);
      }
    }

    const docPath = `eslint-rules/${header.name}/README.md`;
    const doc = docs.get(docPath);
    if (!doc) {
      problems.push(`${rule.path}: missing ${docPath}`);
      continue;
    }

    let metadata: RuleDocMetadata | undefined;
    try {
      metadata = parseRuleMetadata(doc);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      problems.push(`${docPath}: ${message}`);
    }
    if (metadata) {
      const ruleLanguages = getRuleLanguages(rule.source);
      if (
        ruleLanguages &&
        JSON.stringify([...metadata.languages].sort()) !== JSON.stringify([...ruleLanguages].sort())
      ) {
        problems.push(`${docPath}: languages frontmatter does not match ${rule.path}`);
      }
      if (
        metadata.languages.includes('CSS') &&
        !metadata.requiredPackages.includes('@eslint/css')
      ) {
        problems.push(`${docPath}: CSS rules must list @eslint/css in requiredPackages`);
      }
    }

    if (header.source) {
      const docUrl = getPortedFromUrl(doc);
      if (docUrl !== header.source.url) {
        problems.push(`${docPath}: Ported from URL does not match ${rule.path}`);
      }
    } else if (/^Ported from\b/m.test(doc)) {
      problems.push(`${docPath}: original rule must not have a Ported from line`);
    }

    const changelogVersion = getChangelogVersion(doc);
    if (changelogVersion !== header.version) {
      problems.push(
        `${docPath}: top changelog version "${changelogVersion ?? 'missing'}" does not match ${rule.path}`
      );
    }

    let expectedCopyList: string[];
    try {
      expectedCopyList = [
        rule.path,
        ...(ruleTest ? [ruleTest.path] : []),
        ...resolveSharedImports(rule.source, join(root, 'eslint-rules'), join(root, rule.path)),
      ];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      problems.push(`${rule.path}: unable to resolve shared imports: ${message}`);
      expectedCopyList = [rule.path, ...(ruleTest ? [ruleTest.path] : [])];
    }
    if (JSON.stringify(getCopyList(doc)) !== JSON.stringify(expectedCopyList)) {
      problems.push(`${docPath}: Files to copy does not match ${rule.path} and its dependencies`);
    }

    if (!registeredRules.has(header.name)) {
      problems.push(
        `${plugin?.path ?? 'eslint-rules/plugin.ts'}: missing registration for "${header.name}"`
      );
    }
  }

  for (const test of tests) {
    if (!rules.some((rule) => rule.header?.name === test.header?.name)) {
      problems.push(`${test.path}: no matching rule file`);
    }
  }

  for (const docPath of docs.keys()) {
    const ruleName = docPath.replace(/^eslint-rules\//, '').replace(/\/README\.md$/, '');
    if (!rules.some((rule) => rule.header?.name === ruleName)) {
      problems.push(`${docPath}: no matching rule file`);
    }
  }

  for (const licensePath of licenses.keys()) {
    if (!referencedLicenses.has(licensePath)) {
      problems.push(`${licensePath}: license is not referenced by any file header`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Repository consistency check failed:\n- ${problems.join('\n- ')}`);
  }
}
