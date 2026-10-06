---
languages:
  - JavaScript
  - TypeScript
requiredPackages: []
---

# index-reexport-only

Require `index.ts` files to contain only re-exports, and use `index.ts` instead of `index.tsx`.

## Files to copy

- `eslint-rules/index-reexport-only/index-reexport-only.ts`
- `eslint-rules/index-reexport-only/index-reexport-only.test.ts` (optional)
- `eslint-rules/shared/file-name.ts`

## Enable this rule

After copying these files and registering the copied rule in your plugin as described in [Setup](../../README.md#setup), add this entry to the TypeScript flat-config block:

```js
'custom/index-reexport-only': 'error',
```

## What it checks

In files named exactly `index.ts`, every top-level statement must re-export from another module. `export *`, named exports with a `from` source, and type-only re-exports are allowed. Imports, declarations, local exports, and default exports are reported.

An `index.tsx` file always reports an error. The rule assumes barrel files contain no JSX, so rename it to `index.ts`. Other filenames, including `index.d.ts`, are ignored.

## Valid

These `index.ts` statements and files are covered by valid cases in the rule tests:

```ts
export { Button } from './button';
export * from './utils';
export type { ButtonProps } from './button';
export * as icons from './icons';
```

An empty `index.ts` also passes.

## Invalid

Each statement that is not a re-export gets an error:

```ts
import { x } from './x';
export { x };
```

An `index.tsx` file fails even if it contains only re-exports:

```tsx
export { Button } from './button';
```

## Why

Keeping `index.ts` files to re-exports makes a barrel's public API visible without hiding implementation code or side effects in the entrypoint.

## Changelog

### 1.0.0

- Initial release.
