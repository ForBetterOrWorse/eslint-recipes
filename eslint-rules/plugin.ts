// @plugin v1.0.0
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 For Better Or Worse

import type { ESLint } from 'eslint';
import { colocatedFiles } from './colocated-files/colocated-files';
import { filenameCase } from './filename-case/filename-case';
import { indexReexportOnly } from './index-reexport-only/index-reexport-only';
import { noDefaultExport } from './no-default-export/no-default-export';

export const plugin: ESLint.Plugin = {
  meta: { name: 'custom' },
  rules: {
    'colocated-files': colocatedFiles,
    'filename-case': filenameCase,
    'index-reexport-only': indexReexportOnly,
    'no-default-export': noDefaultExport,
  },
};
