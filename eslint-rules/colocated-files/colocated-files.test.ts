// @rule colocated-files v1.0.0 test
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse

import css from '@eslint/css';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { createColocatedFiles } from './colocated-files';

RuleTester.describe = describe;
RuleTester.it = it;

const jsTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
  },
});

const cssTester = new RuleTester({
  language: 'css/css',
  plugins: { css },
});

function withFiles(paths: string[]) {
  const files = new Set(paths);

  return createColocatedFiles((filePath) => files.has(filePath));
}

describe('colocated-files', () => {
  jsTester.run('colocated-files', withFiles(['/p/components/cta-button.tsx']), {
    valid: [
      {
        code: 'const value = 1;',
        filename: '/p/components/cta-button.tsx',
      },
      {
        code: 'const value = 1;',
        filename: '/p/components/cta-button.test.tsx',
      },
      {
        code: 'const value = 1;',
        filename: '/p/tests/checkout.integration.test.ts',
      },
      {
        code: 'const value = 1;',
        filename: '/p/tests/checkout.spec.ts',
      },
    ],
    invalid: [],
  });

  jsTester.run(
    'colocated-files when the source is in another directory',
    withFiles(['/p/components/cta-button.tsx']),
    {
      valid: [],
      invalid: [
        {
          code: 'const value = 1;',
          filename: '/p/tests/cta-button.test.tsx',
          errors: [
            {
              messageId: 'missingSource',
              data: { name: 'cta-button', dir: '/p/tests' },
            },
          ],
        },
      ],
    }
  );

  cssTester.run(
    'colocated-files',
    withFiles(['/p/components/cta-button.ts', '/p/components/cta-button.tsx']),
    {
      valid: [
        {
          code: '.button { color: red; }',
          filename: '/p/components/cta-button.module.css',
        },
      ],
      invalid: [
        {
          code: '.button { color: red; }',
          filename: '/p/styles/cta-button.module.css',
          errors: [
            {
              messageId: 'missingSource',
              data: { name: 'cta-button', dir: '/p/styles' },
            },
          ],
        },
      ],
    }
  );
});
