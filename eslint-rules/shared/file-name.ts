// @shared file-name v1.0.0
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse

import { basename, dirname } from 'node:path';

export interface ParsedFileName {
  dir: string;
  base: string;
  stem: string;
  suffixes: string[];
}

export function parseFileName(filePath: string): ParsedFileName {
  const base = basename(filePath);
  const parts = base.split('.');
  const hasLeadingDot = base.startsWith('.');

  return {
    dir: dirname(filePath),
    base,
    stem: hasLeadingDot ? '' : (parts.shift() ?? ''),
    suffixes: hasLeadingDot ? parts.slice(1) : parts,
  };
}
