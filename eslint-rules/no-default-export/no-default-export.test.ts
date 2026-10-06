// @rule no-default-export v1.0.0 test
// Ported from eslint-plugin-import-x v4.17.1, rule no-default-export test:
// https://github.com/un-ts/eslint-plugin-import-x/blob/v4.17.1/test/rules/no-default-export.spec.ts
// Changes: Converted from import-x's test harness to RuleTester; omitted Babel-only cases.
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

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { noDefaultExport } from './no-default-export';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester();

describe('no-default-export', () => {
  tester.run('no-default-export', noDefaultExport, {
    valid: [
      {
        code: 'module.exports = function foo() {}',
        languageOptions: { sourceType: 'script' },
      },
      { code: "export const foo = 'foo'; export const bar = 'bar';" },
      { code: "export const foo = 'foo'; export function bar() {};" },
      { code: "export const foo = 'foo';" },
      { code: 'const foo = "foo"; export { foo };' },
      { code: 'let foo, bar; export { foo, bar };' },
      { code: 'export const { foo, bar } = item;' },
      { code: 'export const { foo, bar: baz } = item;' },
      { code: 'export const { foo: { bar, baz } } = item;' },
      { code: 'let item; export const foo = item; export { item };' },
      { code: "export * from './foo';" },
      { code: 'export const { foo } = { foo: "bar" };' },
      { code: 'export const { foo: { bar } } = { foo: { bar: "baz" } };' },
      { code: 'export { a, b } from "foo.js";' },
      {
        code: 'export type UserId = number;',
        languageOptions: { parser: tseslint.parser },
      },
    ],
    invalid: [
      {
        code: 'export default function bar() {};',
        errors: [{ messageId: 'preferNamed' }],
      },
      {
        code: "export const foo = 'foo'; export default bar;",
        errors: [{ messageId: 'preferNamed' }],
      },
      {
        code: 'export default class Bar {};',
        errors: [{ messageId: 'preferNamed' }],
      },
      {
        code: 'export default function() {};',
        errors: [{ messageId: 'preferNamed' }],
      },
      {
        code: 'export default class {};',
        errors: [{ messageId: 'preferNamed' }],
      },
      {
        code: 'let foo; export { foo as default };',
        errors: [
          {
            messageId: 'noAliasDefault',
            data: { local: 'foo' },
          },
        ],
      },
      {
        code: "function foo() { return 'foo'; }\nexport default foo;",
        filename: 'foo.ts',
        languageOptions: { parser: tseslint.parser },
        errors: [{ messageId: 'preferNamed' }],
      },
      {
        code: "let foo; export { foo as 'default' };",
        errors: [
          {
            messageId: 'noAliasDefault',
            data: { local: 'foo' },
          },
        ],
      },
      {
        code: "export { default } from './x';",
        errors: [
          {
            messageId: 'noAliasDefault',
            data: { local: 'default' },
          },
        ],
      },
    ],
  });
});
