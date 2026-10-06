// @shared file-name v1.0.0 test
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse

import { describe, expect, it } from 'vitest';
import { parseFileName } from './file-name';

describe('parseFileName', () => {
  it('should parse a multi-extension CSS module filename', () => {
    expect(parseFileName('/a/b/cta-button.module.css')).toEqual({
      dir: '/a/b',
      base: 'cta-button.module.css',
      stem: 'cta-button',
      suffixes: ['module', 'css'],
    });
  });

  it('should parse a PascalCase TypeScript filename', () => {
    expect(parseFileName('/a/b/CtaButton.tsx')).toEqual({
      dir: '/a/b',
      base: 'CtaButton.tsx',
      stem: 'CtaButton',
      suffixes: ['tsx'],
    });
  });

  it('should parse a config filename with multiple suffixes', () => {
    expect(parseFileName('/a/b/vite.config.ts')).toEqual({
      dir: '/a/b',
      base: 'vite.config.ts',
      stem: 'vite',
      suffixes: ['config', 'ts'],
    });
  });

  it('should allow a dotfile to have an empty stem', () => {
    expect(parseFileName('/a/b/.prettierrc.ts')).toEqual({
      dir: '/a/b',
      base: '.prettierrc.ts',
      stem: '',
      suffixes: ['prettierrc', 'ts'],
    });
  });

  it('should parse a simple TypeScript filename', () => {
    expect(parseFileName('/a/b/index.ts')).toEqual({
      dir: '/a/b',
      base: 'index.ts',
      stem: 'index',
      suffixes: ['ts'],
    });
  });
});
