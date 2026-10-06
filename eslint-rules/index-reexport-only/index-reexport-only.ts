// @rule index-reexport-only v1.0.0
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse

import type { Rule } from 'eslint';
import { parseFileName } from '../shared/file-name';

const create: Rule.RuleModule['create'] = (context) => {
  const { base } = parseFileName(context.physicalFilename);

  if (base !== 'index.ts' && base !== 'index.tsx') {
    return {};
  }

  return {
    Program(node) {
      if (base === 'index.tsx') {
        context.report({
          node,
          messageId: 'useTsExtension',
        });
        return;
      }

      for (const statement of node.body) {
        if (
          statement.type !== 'ExportAllDeclaration' &&
          (statement.type !== 'ExportNamedDeclaration' || statement.source === null)
        ) {
          context.report({
            node: statement,
            messageId: 'notReexport',
          });
        }
      }
    },
  };
};

export const indexReexportOnly: Rule.RuleModule = {
  create,
  meta: {
    type: 'problem',
    docs: {
      description: 'Require index.ts files to contain only re-exports.',
    },
    languages: ['js/js'],
    schema: [],
    messages: {
      notReexport: 'Only re-exports are allowed in index.ts.',
      useTsExtension: 'Barrel files contain no JSX; rename to index.ts.',
    },
  },
};
