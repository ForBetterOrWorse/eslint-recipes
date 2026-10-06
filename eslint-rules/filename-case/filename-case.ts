// @rule filename-case v1.0.0
// Ported from eslint-plugin-unicorn v77.0.0, rule filename-case:
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v77.0.0/rules/filename-case.js
// Changes: TypeScript; ESLint 10 context API; change-case copied to ./shared/case; CSS support via @eslint/css.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse (changes)
//
// Original license:
// MIT License
//
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import path from 'node:path';
import { isRegExp } from 'node:util/types';
import type { Rule } from 'eslint';
import { camelCase, kebabCase, pascalCase, snakeCase } from '../shared/case';

type CaseName = 'camelCase' | 'camelCaseWithAcronyms' | 'snakeCase' | 'kebabCase' | 'pascalCase';

type CaseFunction = (value: string) => string;
type Pattern = string | RegExp;

interface FilenameCaseOptions {
  case?: CaseName;
  cases?: Partial<Record<CaseName, boolean>>;
  ignore?: Pattern[];
  multipleFileExtensions?: boolean;
  checkDirectories?: boolean;
  directoryRoots?: Pattern[];
}

interface NameWord {
  word: string;
  ignored: boolean;
}

const MESSAGE_ID = 'filename-case';
const MESSAGE_ID_DIRECTORY = 'directory-case';
const MESSAGE_ID_EXTENSION = 'filename-extension';

const messages = {
  [MESSAGE_ID]: 'Filename is not in {{chosenCases}}. Rename it to {{renamedFilenames}}.',
  [MESSAGE_ID_DIRECTORY]:
    'Directory name `{{directory}}` is not in {{chosenCases}}. Rename it to {{renamedDirectories}}.',
  [MESSAGE_ID_EXTENSION]:
    'File extension `{{extension}}` is not in lowercase. Rename it to `{{filename}}`.',
};

const isIgnoredChar = (char: string) => !/^[\w-]$/u.test(char);
const ignoredByDefault = new Set([
  'index.js',
  'index.mjs',
  'index.cjs',
  'index.ts',
  'index.tsx',
  'index.vue',
]);
const isLowerCase = (value: string) => value === value.toLowerCase();
const disjunctionListFormat = new Intl.ListFormat('en-US', { type: 'disjunction' });
const alphanumericRegex = /^[\da-z]+$/iu;
const leadingAcronymRegex = /^[A-Z]{3,}(?=\d*[A-Z](?:[a-z]|\d+[a-z]))/u;

const isAsciiDigit = (char: string) => char >= '0' && char <= '9';
const isAsciiLowercaseLetter = (char: string) => char >= 'a' && char <= 'z';
const isAsciiUppercaseLetter = (char: string) => char >= 'A' && char <= 'Z';

function camelCaseWithoutAcronyms(value: string): string {
  return camelCase(camelCase(value));
}

function isCamelCaseWithAcronyms(value: string): boolean {
  if (!isAsciiLowercaseLetter(value[0] ?? '')) {
    return false;
  }

  for (let index = 1; index < value.length; index++) {
    const char = value[index] ?? '';

    if (isAsciiLowercaseLetter(char) || isAsciiDigit(char)) {
      continue;
    }

    if (!isAsciiUppercaseLetter(char)) {
      return false;
    }

    const uppercaseStartIndex = index;

    while (isAsciiUppercaseLetter(value[index + 1] ?? '')) {
      index++;
    }

    if (index === uppercaseStartIndex) {
      continue;
    }

    if (isAsciiLowercaseLetter(value[index + 1] ?? '')) {
      index--;
      continue;
    }

    while (isAsciiDigit(value[index + 1] ?? '')) {
      index++;
    }

    if (index === value.length - 1) {
      return true;
    }

    if (!isAsciiUppercaseLetter(value[index + 1] ?? '')) {
      return false;
    }
  }

  return true;
}

function camelCaseWithAcronyms(value: string): string {
  if (isCamelCaseWithAcronyms(value)) {
    return value;
  }

  const converted = camelCase(value);

  if (isCamelCaseWithAcronyms(converted)) {
    return converted;
  }

  return camelCase(converted);
}

function hasValidLeadingAcronym(value: string): boolean {
  if (!alphanumericRegex.test(value)) {
    return false;
  }

  const leadingAcronym = leadingAcronymRegex.exec(value)?.[0];
  const suffix = leadingAcronym && value.slice(leadingAcronym.length);

  return Boolean(suffix && pascalCase(suffix) === suffix);
}

function pascalCaseWithLeadingAcronym(value: string): string {
  if (hasValidLeadingAcronym(value)) {
    return value;
  }

  const converted = pascalCase(value);

  if (hasValidLeadingAcronym(converted)) {
    return converted;
  }

  return pascalCase(converted);
}

const cases: Record<CaseName, { fn: CaseFunction; name: string }> = {
  camelCase: {
    fn: camelCaseWithoutAcronyms,
    name: 'camel case',
  },
  camelCaseWithAcronyms: {
    fn: camelCaseWithAcronyms,
    name: 'camel case with acronyms',
  },
  kebabCase: {
    fn: kebabCase,
    name: 'kebab case',
  },
  snakeCase: {
    fn: snakeCase,
    name: 'snake case',
  },
  pascalCase: {
    fn: pascalCaseWithLeadingAcronym,
    name: 'pascal case',
  },
};

function getChosenCases(options: FilenameCaseOptions): CaseName[] {
  if (options.case) {
    return [options.case];
  }

  if (options.cases) {
    const chosenCases = (Object.keys(options.cases) as CaseName[]).filter(
      (caseName) => options.cases?.[caseName]
    );

    return chosenCases.length > 0 ? chosenCases : ['kebabCase'];
  }

  return ['kebabCase'];
}

function isValidName(words: NameWord[], caseFunctions: CaseFunction[]): boolean {
  return words
    .filter(({ ignored }) => !ignored)
    .every(({ word }) => caseFunctions.some((caseFunction) => caseFunction(word) === word));
}

function getRenamedNames(
  words: NameWord[],
  caseFunctions: CaseFunction[],
  { leading, trailing }: { leading: string; trailing: string }
): string[] {
  const names = caseFunctions.map((caseFunction) => {
    const name = words.map(({ word, ignored }) => (ignored ? word : caseFunction(word))).join('');

    return `${leading}${name}${trailing}`;
  });

  return [...new Set(names)];
}

function getFilenameParts(
  basename: string,
  { multipleFileExtensions }: { multipleFileExtensions: boolean }
) {
  const extension = path.extname(basename);
  const filename = path.basename(basename, extension);

  const parts = {
    filename,
    additionalExtensions: '',
    extension,
  };

  if (multipleFileExtensions) {
    const [firstPart] = filename.split('.', 1);
    Object.assign(parts, {
      filename: firstPart ?? '',
      additionalExtensions: filename.slice(firstPart?.length ?? 0),
    });
  }

  return parts;
}

function isInsideCwd(relativePath: string): boolean {
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function getPathSegments(filePath: string, cwd: string): string[] {
  const relativePath = path.relative(cwd, path.resolve(cwd, filePath));

  if (!isInsideCwd(relativePath)) {
    return [path.basename(filePath)];
  }

  return relativePath.split(path.sep).filter((segment) => segment !== '.');
}

function validatePatternOption(optionName: string, patterns: Pattern[]): void {
  if (patterns.some((pattern) => typeof pattern !== 'string' && !isRegExp(pattern))) {
    throw new TypeError(
      `The \`${optionName}\` option only accepts strings and regular expressions.`
    );
  }
}

function isDirectoryRoot(directoryPath: string, directoryRoots: Pattern[]): boolean {
  return directoryRoots.some((directoryRoot) => {
    if (typeof directoryRoot === 'string') {
      return directoryPath === directoryRoot;
    }

    return new RegExp(directoryRoot).test(directoryPath);
  });
}

function getDirectoriesToCheck(pathSegments: string[], directoryRoots: Pattern[]): string[] {
  const directories = pathSegments.slice(0, -1);
  let directoryPath = '';
  let directoryStartIndex = 0;

  for (const [index, directory] of directories.entries()) {
    directoryPath = directoryPath ? `${directoryPath}/${directory}` : directory;

    if (isDirectoryRoot(directoryPath, directoryRoots)) {
      directoryStartIndex = index + 1;
    }
  }

  return directories.slice(directoryStartIndex);
}

const leadingUnderscoresRegex = /^_+/u;

function splitName(name: string): { leading: string; words: NameWord[] } {
  const leading = leadingUnderscoresRegex.exec(name)?.[0] ?? '';
  const remainder = name.slice(leading.length);
  const words: NameWord[] = [];
  let lastWord: NameWord | undefined;

  for (const char of remainder) {
    const ignored = isIgnoredChar(char);

    if (lastWord?.ignored === ignored) {
      lastWord.word += char;
    } else {
      lastWord = { word: char, ignored };
      words.push(lastWord);
    }
  }

  return { leading, words };
}

const formatDisjunction = (words: string[]) => disjunctionListFormat.format(words);

function formatCaseNames(chosenCases: CaseName[]): string {
  return formatDisjunction(chosenCases.map((caseName) => cases[caseName].name));
}

function getInvalidDirectoryReport(
  directory: string,
  chosenCases: CaseName[],
  chosenCaseFunctions: CaseFunction[]
) {
  const { leading, words } = splitName(directory);

  if (directory.startsWith('$') || isValidName(words, chosenCaseFunctions)) {
    return;
  }

  const renamedDirectories = getRenamedNames(words, chosenCaseFunctions, {
    leading,
    trailing: '',
  });

  return {
    loc: { column: 0, line: 1 },
    messageId: MESSAGE_ID_DIRECTORY,
    data: {
      directory,
      chosenCases: formatCaseNames(chosenCases),
      renamedDirectories: formatDisjunction(renamedDirectories.map((name) => `\`${name}\``)),
    },
  };
}

function isVirtualFilename(filename: string): boolean {
  return filename === '<input>' || filename === '<text>';
}

function onRoot(
  listener: () => void
): Rule.RuleListener & { StyleSheet: Rule.RuleListener['Program'] } {
  const checkRoot = () => listener();

  return {
    Program: checkRoot,
    StyleSheet: checkRoot,
  };
}

const create: Rule.RuleModule['create'] = (context) => {
  const options = (context.options[0] ?? {}) as FilenameCaseOptions;
  const ignorePatterns = options.ignore ?? [];
  const directoryRoots = options.directoryRoots ?? [];

  validatePatternOption('ignore', ignorePatterns);
  validatePatternOption('directoryRoots', directoryRoots);

  const ignoreRegexps = ignorePatterns.map((pattern) =>
    typeof pattern === 'string' ? new RegExp(pattern, 'u') : new RegExp(pattern)
  );
  const { physicalFilename } = context;

  if (context.filename !== physicalFilename || isVirtualFilename(physicalFilename)) {
    return {};
  }

  const chosenCases = getChosenCases(options);
  const isMultipleFileExtensions = options.multipleFileExtensions !== false;
  const isCheckDirectories = options.checkDirectories !== false;
  const chosenCaseFunctions = chosenCases.map((caseName) => cases[caseName].fn);

  const checkFilename = () => {
    const pathSegments = getPathSegments(physicalFilename, context.cwd);
    const basename = pathSegments.at(-1);

    if (!basename) {
      return;
    }

    const { filename, additionalExtensions, extension } = getFilenameParts(basename, {
      multipleFileExtensions: isMultipleFileExtensions,
    });

    if (pathSegments.some((segment) => ignoreRegexps.some((regexp) => regexp.test(segment)))) {
      return;
    }

    if (isCheckDirectories) {
      for (const directory of getDirectoriesToCheck(pathSegments, directoryRoots)) {
        const report = getInvalidDirectoryReport(directory, chosenCases, chosenCaseFunctions);

        if (report) {
          context.report(report);
          return;
        }
      }
    }

    if (ignoredByDefault.has(basename)) {
      return;
    }

    const { leading, words } = splitName(filename);
    const isValid = filename.startsWith('$') || isValidName(words, chosenCaseFunctions);

    if (isValid) {
      if (!isLowerCase(extension)) {
        context.report({
          loc: { column: 0, line: 1 },
          messageId: MESSAGE_ID_EXTENSION,
          data: {
            filename: filename + additionalExtensions + extension.toLowerCase(),
            extension,
          },
        });
      }

      return;
    }

    const renamedFilenames = getRenamedNames(words, chosenCaseFunctions, {
      leading,
      trailing: additionalExtensions + extension.toLowerCase(),
    });

    context.report({
      loc: { column: 0, line: 1 },
      messageId: MESSAGE_ID,
      data: {
        chosenCases: formatCaseNames(chosenCases),
        renamedFilenames: formatDisjunction(renamedFilenames.map((name) => `\`${name}\``)),
      },
    });
  };

  return onRoot(checkFilename);
};

const commonOptionProperties = {
  ignore: {
    type: 'array',
    items: {
      type: ['string', 'object'],
      additionalProperties: true,
    },
    uniqueItems: true,
    description: 'Path segment patterns to ignore.',
  },
  multipleFileExtensions: {
    type: 'boolean',
    description:
      'Whether to treat additional, dot-separated parts of a filename as file extensions.',
  },
  checkDirectories: {
    type: 'boolean',
    description: 'Whether to check directory names.',
  },
  directoryRoots: {
    type: 'array',
    items: {
      type: ['string', 'object'],
      additionalProperties: true,
    },
    uniqueItems: true,
    description: 'Directory root paths or patterns, relative to the current working directory.',
  },
};

const schema = [
  {
    description: 'The rule options.',
    anyOf: [
      {
        type: 'object',
        properties: {
          case: {
            enum: ['camelCase', 'camelCaseWithAcronyms', 'snakeCase', 'kebabCase', 'pascalCase'],
            description: 'The filename and directory name case style.',
          },
          ...commonOptionProperties,
        },
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: {
          cases: {
            type: 'object',
            properties: {
              camelCase: {
                type: 'boolean',
                description: 'Whether to allow camelCase filenames and directory names.',
              },
              camelCaseWithAcronyms: {
                type: 'boolean',
                description:
                  'Whether to allow camelCase filenames and directory names with acronym segments.',
              },
              snakeCase: {
                type: 'boolean',
                description: 'Whether to allow snake_case filenames and directory names.',
              },
              kebabCase: {
                type: 'boolean',
                description: 'Whether to allow kebab-case filenames and directory names.',
              },
              pascalCase: {
                type: 'boolean',
                description: 'Whether to allow PascalCase filenames and directory names.',
              },
            },
            additionalProperties: false,
            description: 'The allowed filename and directory name case styles.',
          },
          ...commonOptionProperties,
        },
        additionalProperties: false,
      },
    ],
  },
];

export const filenameCase: Rule.RuleModule = {
  create,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce a case style for filenames and directory names.',
      recommended: true,
    },
    schema,
    defaultOptions: [],
    messages,
    languages: ['js/js', 'css/css'],
  },
};
