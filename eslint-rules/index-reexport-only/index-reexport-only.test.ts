// @rule index-reexport-only v1.0.0 test
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { indexReexportOnly } from './index-reexport-only';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
  },
});

describe('index-reexport-only', () => {
  tester.run('index-reexport-only', indexReexportOnly, {
    valid: [
      {
        code: "export { Button } from './button';",
        filename: '/p/index.ts',
      },
      {
        code: "export * from './utils';",
        filename: '/p/index.ts',
      },
      {
        code: "export type { ButtonProps } from './button';",
        filename: '/p/index.ts',
      },
      {
        code: "export * as icons from './icons';",
        filename: '/p/index.ts',
      },
      {
        code: '',
        filename: '/p/index.ts',
      },
      {
        code: 'const value: number = 1;',
        filename: '/p/index.d.ts',
      },
      {
        code: 'const value: number = 1;',
        filename: '/p/barrel.ts',
      },
    ],
    invalid: [
      {
        code: "import { x } from './x'; export { x };",
        filename: '/p/index.ts',
        errors: [{ messageId: 'notReexport' }, { messageId: 'notReexport' }],
      },
      {
        code: 'export const a = 1;',
        filename: '/p/index.ts',
        errors: [{ messageId: 'notReexport' }],
      },
      {
        code: 'function f() {}',
        filename: '/p/index.ts',
        errors: [{ messageId: 'notReexport' }],
      },
      {
        code: 'export default Button;',
        filename: '/p/index.ts',
        errors: [{ messageId: 'notReexport' }],
      },
      {
        code: "export { Button } from './button';",
        filename: '/p/index.tsx',
        errors: [{ messageId: 'useTsExtension' }],
      },
    ],
  });
});
