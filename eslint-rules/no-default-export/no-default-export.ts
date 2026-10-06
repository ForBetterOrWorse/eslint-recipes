// @rule no-default-export v1.0.0
// Ported from eslint-plugin-import-x v4.17.1, rule no-default-export:
// https://github.com/un-ts/eslint-plugin-import-x/blob/v4.17.1/src/rules/no-default-export.ts
// Changes: Replaced createRule with Rule.RuleModule; inlined sourceType and getValue.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse (changes)
//
// Original license:
// The MIT License (MIT)
//
// Copyright (c) 2015 Ben Mosher
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import type { Rule } from 'eslint';

const getValue = (node: { name?: string; value?: unknown }): string =>
  node.name ?? String(node.value);

const create: Rule.RuleModule['create'] = (context) => {
  if (context.sourceCode.ast.sourceType !== 'module') {
    return {};
  }

  const { sourceCode } = context;

  return {
    ExportDefaultDeclaration(node) {
      const loc = sourceCode.getFirstTokens(node)[1]?.loc;
      context.report({
        node,
        messageId: 'preferNamed',
        ...(loc ? { loc } : {}),
      });
    },

    ExportNamedDeclaration(node) {
      for (const specifier of node.specifiers) {
        if (getValue(specifier.exported) !== 'default') {
          continue;
        }

        const loc = sourceCode.getFirstTokens(node)[1]?.loc;
        const specifierType: string = specifier.type;

        if (specifierType === 'ExportDefaultSpecifier') {
          context.report({
            node,
            messageId: 'preferNamed',
            ...(loc ? { loc } : {}),
          });
        } else {
          context.report({
            node,
            messageId: 'noAliasDefault',
            data: { local: getValue(specifier.local) },
            ...(loc ? { loc } : {}),
          });
        }
      }
    },
  };
};

export const noDefaultExport: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Forbid default exports.',
    },
    schema: [],
    messages: {
      preferNamed: 'Prefer named exports.',
      noAliasDefault:
        'Do not alias `{{local}}` as `default`. Just export `{{local}}` itself instead.',
    },
  },
  create,
};
