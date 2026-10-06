# AI Agent Instructions

## Stack and workflow

- TypeScript library; use ESLint 10, Vitest, and pnpm.
- Each rule lives in `eslint-rules/<rule-name>/` with its implementation, colocated test, and `README.md`. Rule files are copied directly by consumers, so keep their relative imports valid when copied with the shared files listed in the README.

## Project structure

- `eslint-rules/<rule-name>/` contains each rule implementation, colocated test, and README.
- Each rule README has YAML frontmatter listing `languages` and `requiredPackages`. The package list contains additions to the common target setup; CSS rules list `@eslint/css`.
- `eslint-rules/plugin.ts` registers the rules; `eslint-rules/shared/` contains shared helpers.
- `licenses/` contains verbatim upstream license files.
- `lib/` contains repository checks and support utilities.
- `__fixtures__/` contains consumer integration tests.

## Headers and porting

- Every TypeScript file in `eslint-rules/` starts with a versioned header. Do not edit header versions or changelog versions by hand; `.github/workflows/pull-request-checks.yml` writes them. New packages start at `1.0.0`. See `docs/versioning.md`.
- Ported files identify the upstream package, version, source URL, changes, and original license text.
- Preserve upstream rule names, options, message IDs, and behavior unless the implementation plan specifies a compatibility change.
- Do not add runtime dependencies to `eslint-rules/`; use ESLint types, approved imports, and relative imports within that directory.

## Code style

- Use named exports and kebab-case file names.
- Keep tests beside the code they cover. Use `*.test.ts` names.
- Remove dead code and unused imports. Add comments only for non-obvious behavior.

## Testing

- Add or update tests for behavior changes.
- Use Vitest in run mode, not watch mode: `pnpm vitest run --reporter=dot`.
- Run `pnpm lint` and `pnpm typecheck` before completing changes.
