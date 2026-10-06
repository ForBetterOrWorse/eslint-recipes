// @rule filename-case v1.0.0 test
// Ported from eslint-plugin-unicorn v77.0.0, rule filename-case test:
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v77.0.0/test/filename-case.js
// Changes: Converted from unicorn's test harness to RuleTester; added CSS RuleTester cases.
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

import css from '@eslint/css';
import { ESLint, RuleTester } from 'eslint';
import { describe, expect, it } from 'vitest';
import { filenameCase } from './filename-case';

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

describe('filename-case', () => {
  tester.run('filename-case', filenameCase, {
    valid: [
      { code: 'const value = 1;', filename: 'src/foo/foo-bar.js' },
      { code: 'const value = 1;', filename: 'src/foo/fooBar.js', options: [{ case: 'camelCase' }] },
      {
        code: 'const value = 1;',
        filename: 'src/foo/foo_bar.js',
        options: [{ case: 'snakeCase' }],
      },
      {
        code: 'const value = 1;',
        filename: 'Src/Foo/FooBar.js',
        options: [{ case: 'pascalCase' }],
      },
      {
        code: 'const value = 1;',
        filename: 'Src/Foo/CtaButton.tsx',
        options: [{ case: 'pascalCase' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/innerHTML.js',
        options: [{ case: 'camelCaseWithAcronyms' }],
      },
      { code: 'const value = 1;', filename: 'src/foo/$userId.tsx' },
      { code: 'const value = 1;', filename: 'src/foo/$foo_bar.js' },
      { code: 'const value = 1;', filename: 'src/foo/index.ts' },
      { code: 'const value = 1;', filename: 'src/foo/foo-bar.test-utils.js' },
      {
        code: 'const value = 1;',
        filename: 'src/foo/foo_bar.test.js',
        options: [{ case: 'snakeCase' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/FOOBAR.js',
        options: [{ case: 'kebabCase', ignore: ['FOOBAR\\.js'] }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/FOOBAR.js',
        options: [{ case: 'kebabCase', ignore: [/^FOOBAR\.js$/gu] }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/FooBar/file.js',
        options: [{ checkDirectories: false }],
      },
      {
        code: 'const value = 1;',
        filename: 'app/javascript/Pages/Foo.vue',
        options: [{ case: 'pascalCase', directoryRoots: ['app/javascript'] }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/meta/BadName.js',
        options: [{ case: 'kebabCase', ignore: [/^meta$/u] }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/fooBar.test.js',
        options: [{ case: 'camelCase', multipleFileExtensions: false }],
      },
    ],
    invalid: [
      {
        code: 'const value = 1;',
        filename: 'src/foo/foo_bar.js',
        errors: [{ message: 'Filename is not in kebab case. Rename it to `foo-bar.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/CtaButton.tsx',
        errors: [{ message: 'Filename is not in kebab case. Rename it to `cta-button.tsx`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/foo_bar.js',
        options: [{ case: 'camelCase' }],
        errors: [{ message: 'Filename is not in camel case. Rename it to `fooBar.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/fooBar.js',
        options: [{ case: 'snakeCase' }],
        errors: [{ message: 'Filename is not in snake case. Rename it to `foo_bar.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/fooBar.testUtils.js',
        options: [{ case: 'kebabCase' }],
        errors: [
          { message: 'Filename is not in kebab case. Rename it to `foo-bar.testUtils.js`.' },
        ],
      },
      {
        code: 'const value = 1;',
        filename: 'Src/Foo/foo_bar.test.js',
        options: [{ case: 'pascalCase' }],
        errors: [{ message: 'Filename is not in pascal case. Rename it to `FooBar.test.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'Src/Foo/PageFAQ.js',
        options: [{ case: 'pascalCase' }],
        errors: [{ message: 'Filename is not in pascal case. Rename it to `PageFaq.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/FAQPage.js',
        options: [{ case: 'camelCase' }],
        errors: [{ message: 'Filename is not in camel case. Rename it to `faqPage.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/FAQPage.js',
        options: [{ case: 'camelCaseWithAcronyms' }],
        errors: [
          { message: 'Filename is not in camel case with acronyms. Rename it to `faqPage.js`.' },
        ],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/HTMLParser.js',
        options: [{ case: 'camelCaseWithAcronyms' }],
        errors: [
          { message: 'Filename is not in camel case with acronyms. Rename it to `htmlParser.js`.' },
        ],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/foo_bar.test.js',
        options: [{ case: 'camelCase', multipleFileExtensions: false }],
        errors: [{ message: 'Filename is not in camel case. Rename it to `fooBar.test.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/foo_bar.js',
        options: [{ cases: { camelCase: true, pascalCase: true } }],
        errors: [
          {
            message:
              'Filename is not in camel case or pascal case. Rename it to `fooBar.js` or `FooBar.js`.',
          },
        ],
      },
      {
        code: 'const value = 1;',
        filename: 'src/FooBar/file.js',
        errors: [
          { message: 'Directory name `FooBar` is not in kebab case. Rename it to `foo-bar`.' },
        ],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/FooBar.js',
        options: [{ checkDirectories: false }],
        errors: [{ message: 'Filename is not in kebab case. Rename it to `foo-bar.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/foo$Bar.js',
        errors: [{ message: 'Filename is not in kebab case. Rename it to `foo$bar.js`.' }],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/$userId.TSX',
        errors: [
          { message: 'File extension `.TSX` is not in lowercase. Rename it to `$userId.tsx`.' },
        ],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/foo_bar.js',
        options: [{ cases: { camelCase: true, pascalCase: true, kebabCase: true } }],
        errors: [
          {
            message:
              'Filename is not in camel case, pascal case, or kebab case. Rename it to `fooBar.js`, `FooBar.js`, or `foo-bar.js`.',
          },
        ],
      },
      {
        code: 'const value = 1;',
        filename: 'src/foo/1_.js',
        options: [{ cases: { camelCase: true, pascalCase: true, kebabCase: true } }],
        errors: [
          {
            message:
              'Filename is not in camel case, pascal case, or kebab case. Rename it to `1.js`.',
          },
        ],
      },
    ].map((testCase) => ({
      ...testCase,
      code: `/* ${testCase.filename} */`,
    })),
  });

  const cssTester = new RuleTester({
    language: 'css/css',
    plugins: { css },
  });

  cssTester.run('filename-case', filenameCase, {
    valid: [
      { code: '.a { color: red; }', filename: 'foo-bar.module.css' },
      { code: '.a { color: red; }', filename: 'CtaButton.css', options: [{ case: 'pascalCase' }] },
    ],
    invalid: [
      {
        code: '.a { color: red; }',
        filename: 'ctaButton.module.css',
        errors: [
          { message: 'Filename is not in kebab case. Rename it to `cta-button.module.css`.' },
        ],
      },
    ],
  });

  it('should match stateful ignore patterns consistently between lint runs', async () => {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [
        {
          plugins: {
            'rule-to-test': {
              rules: {
                'filename-case': filenameCase,
              },
            },
          },
          rules: {
            'rule-to-test/filename-case': ['error', { ignore: [/^FOOBAR$/gu] }],
          },
        },
      ],
    });

    const [reportedResult] = await eslint.lintText('const value = 1;', {
      filePath: 'FooBar.js',
    });
    const [firstIgnoredResult] = await eslint.lintText('const value = 1;', {
      filePath: 'FOOBAR/fooBar.js',
    });
    const [secondIgnoredResult] = await eslint.lintText('const value = 1;', {
      filePath: 'FOOBAR/fooBar.js',
    });

    expect(reportedResult?.messages[0]?.message).toBe(
      'Filename is not in kebab case. Rename it to `foo-bar.js`.'
    );
    expect(firstIgnoredResult?.messages).toEqual([]);
    expect(secondIgnoredResult?.messages).toEqual([]);
  });
});
