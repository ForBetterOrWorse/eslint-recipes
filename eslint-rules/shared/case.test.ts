// @shared case v1.0.0 test
// Ported from change-case v5.4.4, test:
// https://github.com/blakeembrey/change-case/blob/change-case@5.4.4/packages/change-case/src/index.spec.ts
// Changes: Converted to Vitest; limited assertions to the four exported functions and split.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse (changes)
//
// Original license:
// The MIT License (MIT)
//
// Copyright (c) 2014 Blake Embrey (hello@blakeembrey.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { describe, expect, it } from 'vitest';
import type { Options } from './case';
import { camelCase, kebabCase, pascalCase, snakeCase, split } from './case';

const cases: [string, [string, string, string, string], Options?][] = [
  ['', ['', '', '', '']],
  ['test', ['test', 'test', 'test', 'Test']],
  ['test string', ['testString', 'test-string', 'test_string', 'TestString']],
  ['Test String', ['testString', 'test-string', 'test_string', 'TestString']],
  ['Test String', ['test$String', 'test$string', 'test$string', 'Test$String'], { delimiter: '$' }],
  ['TestV2', ['testV2', 'test-v2', 'test_v2', 'TestV2']],
  ['XMLHttpRequest', ['xmlHttpRequest', 'xml-http-request', 'xml_http_request', 'XmlHttpRequest']],
  ['_foo_bar_', ['fooBar', 'foo-bar', 'foo_bar', 'FooBar']],
  ['version 1.2.10', ['version_1_2_10', 'version-1-2-10', 'version_1_2_10', 'Version_1_2_10']],
  ['version 1.21.0', ['version_1_21_0', 'version-1-21-0', 'version_1_21_0', 'Version_1_21_0']],
  ['TestV2', ['testV_2', 'test-v-2', 'test_v_2', 'TestV_2'], { separateNumbers: true }],
  ['𝒳123', ['𝒳_123', '𝒳-123', '𝒳_123', '𝒳_123'], { separateNumbers: true }],
  ['1test', ['1Test', '1-test', '1_test', '1Test'], { separateNumbers: true }],
  [
    'Foo12019Bar',
    ['foo_12019Bar', 'foo-12019-bar', 'foo_12019_bar', 'Foo_12019Bar'],
    { separateNumbers: true },
  ],
  [
    'aNumber2in',
    ['aNumber_2In', 'a-number-2-in', 'a_number_2_in', 'ANumber_2In'],
    { separateNumbers: true },
  ],
  ['V1Test', ['v1Test', 'v1-test', 'v1_test', 'V1Test']],
  [
    'V1Test with separateNumbers',
    [
      'v_1TestWithSeparateNumbers',
      'v-1-test-with-separate-numbers',
      'v_1_test_with_separate_numbers',
      'V_1TestWithSeparateNumbers',
    ],
    { separateNumbers: true },
  ],
  [
    '__typename',
    ['__typename', '__typename', '__typename', '__Typename'],
    { prefixCharacters: '_$' },
  ],
  ['type__', ['type__', 'type__', 'type__', 'Type__'], { suffixCharacters: '_$' }],
  [
    '__type__',
    ['__type__', '__type__', '__type__', '__Type__'],
    { prefixCharacters: '_', suffixCharacters: '_' },
  ],
];

describe('case conversion', () => {
  for (const [input, expected, options] of cases) {
    it(`should convert ${JSON.stringify(input)} to the requested cases`, () => {
      expect([
        camelCase(input, options),
        kebabCase(input, options),
        snakeCase(input, options),
        pascalCase(input, options),
      ]).toEqual(expected);
    });
  }

  it('should split an empty string into no words', () => {
    expect(split('')).toEqual([]);
  });

  it('should merge ambiguous characters when requested', () => {
    const input = 'version 1.2.10';

    expect(camelCase(input, { mergeAmbiguousCharacters: true })).toBe('version1210');
    expect(pascalCase(input, { mergeAmbiguousCharacters: true })).toBe('Version1210');
  });
});
