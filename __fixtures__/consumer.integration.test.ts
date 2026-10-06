import { spawn } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = path.join(projectRoot, '.fixture-out');
const consumerRoot = path.join(fixtureRoot, 'consumer');

function run(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let output = '';
    let errorOutput = '';

    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      errorOutput += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`${command} exited with code ${code}.\n${output}${errorOutput}`));
      }
    });
  });
}

async function writeConsumerFile(relativePath: string, contents: string): Promise<void> {
  const filePath = path.join(consumerRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}

async function lintConsumer(): Promise<ESLint.LintResult[]> {
  try {
    return await new ESLint({ cwd: consumerRoot }).lintFiles([
      'src/**/*.{ts,tsx,css}',
      'tests/**/*.{ts,tsx}',
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/(?:jiti|eslint\.config\.ts|typescript config|could not find config)/iu.test(message)) {
      throw error;
    }

    const output = await run(
      path.join(projectRoot, 'node_modules/.bin/eslint'),
      ['--format', 'json', 'src', 'tests'],
      consumerRoot
    );
    return JSON.parse(output) as ESLint.LintResult[];
  }
}

describe('consumer fixture', () => {
  beforeAll(async () => {
    await rm(consumerRoot, { recursive: true, force: true });
    await mkdir(path.join(consumerRoot, 'eslint-rules'), { recursive: true });
    await cp(path.join(projectRoot, 'eslint-rules'), path.join(consumerRoot, 'eslint-rules'), {
      recursive: true,
    });
    await writeConsumerFile(
      'eslint.config.ts',
      `import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import css from '@eslint/css';
import { plugin as custom } from './eslint-rules/plugin';

export default defineConfig([
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.base],
    plugins: { custom },
    rules: {
      'custom/colocated-files': 'error',
      'custom/filename-case': 'error',
      'custom/index-reexport-only': 'error',
      'custom/no-default-export': 'error',
    },
  },
  {
    files: ['**/*.css'],
    language: 'css/css',
    plugins: { css, custom },
    rules: {
      'custom/colocated-files': 'error',
      'custom/filename-case': 'error',
    },
  },
]);
`
    );
    await writeConsumerFile('vitest.config.ts', 'export default {};\n');
    await writeConsumerFile(
      'src/components/cta-button.tsx',
      'export const CtaButton = () => null;\n'
    );
    await writeConsumerFile('src/components/cta-button.module.css', '.button {}\n');
    await writeConsumerFile(
      'src/components/CtaButton.tsx',
      'export const CtaButton = () => null;\n'
    );
    await writeConsumerFile(
      'src/components/banner.tsx',
      'export default function Banner() { return null; }\n'
    );
    await writeConsumerFile('tests/cta-button.test.tsx', 'export {};\n');
    await writeConsumerFile(
      'src/index.ts',
      "export { CtaButton } from './components/cta-button';\n"
    );
    await writeConsumerFile(
      'src/widgets/index.tsx',
      "export { CtaButton } from '../components/cta-button';\n"
    );
  }, 60_000);

  afterAll(async () => {
    await rm(consumerRoot, { recursive: true, force: true });
  });

  it('should lint copied rules and run their tests', async () => {
    const results = await lintConsumer();
    const diagnostics = results.flatMap((result) =>
      result.messages.map((message) => ({
        file: path.relative(consumerRoot, result.filePath),
        ruleId: message.ruleId,
        severity: message.severity,
      }))
    );

    expect(diagnostics).toEqual([
      { file: 'src/components/CtaButton.tsx', ruleId: 'custom/filename-case', severity: 2 },
      { file: 'src/components/banner.tsx', ruleId: 'custom/no-default-export', severity: 2 },
      { file: 'src/widgets/index.tsx', ruleId: 'custom/index-reexport-only', severity: 2 },
      { file: 'tests/cta-button.test.tsx', ruleId: 'custom/colocated-files', severity: 2 },
    ]);

    const vitestOutput = await run(
      path.join(projectRoot, 'node_modules/.bin/vitest'),
      [
        'run',
        '--reporter=dot',
        '--config',
        path.join(consumerRoot, 'vitest.config.ts'),
        '--root',
        path.join(consumerRoot, 'eslint-rules'),
      ],
      consumerRoot
    );
    expect(vitestOutput).toMatch(/Test Files\s+6 passed\s+\(6\)/u);
  }, 60_000);
});
