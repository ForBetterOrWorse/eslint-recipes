// @rule colocated-files v1.0.0
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Rule } from 'eslint';
import { parseFileName } from '../shared/file-name';

const messages = {
  missingSource: "No source file found for '{{name}}' in '{{dir}}'.",
};

function getName(base: string, suffix: string): string | undefined {
  const name = base.slice(0, -suffix.length);

  return name.length > 0 ? name : undefined;
}

export function createColocatedFiles(fileExists: (path: string) => boolean): Rule.RuleModule {
  const create: Rule.RuleModule['create'] = (context) => {
    const { physicalFilename } = context;
    const { base, dir, suffixes } = parseFileName(physicalFilename);
    let name: string | undefined;

    if (
      suffixes.length >= 2 &&
      suffixes.at(-2) === 'test' &&
      (suffixes.at(-1) === 'ts' || suffixes.at(-1) === 'tsx') &&
      suffixes.at(-3) !== 'integration'
    ) {
      name = getName(base, `.test.${suffixes.at(-1)}`);
    } else if (suffixes.length >= 2 && suffixes.at(-2) === 'module' && suffixes.at(-1) === 'css') {
      name = getName(base, '.module.css');
    }

    if (!name) {
      return {};
    }

    const checkForSource = () => {
      const sourceExists =
        fileExists(join(dir, `${name}.ts`)) || fileExists(join(dir, `${name}.tsx`));

      if (!sourceExists) {
        context.report({
          loc: { column: 0, line: 1 },
          messageId: 'missingSource',
          data: { name, dir },
        });
      }
    };

    return {
      Program: checkForSource,
      StyleSheet: checkForSource,
    } as Rule.RuleListener;
  };

  return {
    create,
    meta: {
      type: 'problem',
      docs: {
        description: 'Require tests and CSS modules to have a colocated source file.',
      },
      languages: ['js/js', 'css/css'],
      schema: [],
      messages,
    },
  };
}

export const colocatedFiles = createColocatedFiles(existsSync);
