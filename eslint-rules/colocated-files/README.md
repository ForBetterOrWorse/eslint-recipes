---
languages:
  - JavaScript
  - TypeScript
  - CSS
requiredPackages:
  - '@eslint/css'
---

# colocated-files

Require test files and CSS modules to have a source file in the same directory.

## Files to copy

- `eslint-rules/colocated-files/colocated-files.ts`
- `eslint-rules/colocated-files/colocated-files.test.ts` (optional)
- `eslint-rules/shared/file-name.ts`

## Enable this rule

After copying these files and registering the copied rule in your plugin as described in [Setup](../../README.md#setup), add this entry to the relevant flat-config block:

```js
'custom/colocated-files': 'error',
```

Enable it in both the TypeScript block and the CSS block if you want to check CSS modules. CSS files need `@eslint/css` configured with the `css/css` language.

## What it checks

The rule checks `<name>.test.ts`, `<name>.test.tsx`, and `<name>.module.css`. Each must have a `<name>.ts` or `<name>.tsx` file in the same directory.

Files ending in `.integration.test.ts` or `.integration.test.tsx` are skipped. Other `.spec.ts` and `.spec.tsx` files are not checked either. JavaScript tests and CSS files other than `.module.css` are not checked.

## Why

Keeping a test or CSS module beside its source makes it easier to find and move related files together.

## Valid

These cases are covered by the rule tests:

```text
/p/components/cta-button.tsx
/p/components/cta-button.test.tsx
```

Integration tests are also skipped when there is no matching source:

```text
/p/tests/checkout.integration.test.ts
```

## Invalid

The source must be in the same directory. A source in `/p/components/` does not satisfy a test under `/p/tests/`:

```text
/p/tests/cta-button.test.tsx
```

Likewise, this CSS module fails when no `cta-button.ts` or `cta-button.tsx` exists in `/p/styles/`:

```text
/p/styles/cta-button.module.css
```

The rule checks the filesystem when ESLint runs. Some editors cache lint results, so creating or removing a source file may not update the warning until you save the checked file again.

## Changelog

### 1.0.0

- Initial release.
