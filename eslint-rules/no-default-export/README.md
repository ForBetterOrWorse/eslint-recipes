---
languages:
  - JavaScript
  - TypeScript
requiredPackages: []
---

# no-default-export

Ported from [eslint-plugin-import-x 4.17.1, rule no-default-export](https://github.com/un-ts/eslint-plugin-import-x/blob/v4.17.1/src/rules/no-default-export.ts) (MIT).

Forbid default exports. Use named exports instead.

## Files to copy

- `eslint-rules/no-default-export/no-default-export.ts`
- `eslint-rules/no-default-export/no-default-export.test.ts` (optional)

## Enable this rule

After copying these files and registering the copied rule in your plugin as described in [Setup](../../README.md#setup), add this entry to the TypeScript flat-config block:

```js
'custom/no-default-export': 'error',
```

## What it checks

The rule reports `export default` declarations and named exports that alias a value as `default`. It also rejects re-exporting another module's default as a named `default` specifier. It does not inspect the exports of other modules.

The rule checks ES modules. It does not report CommonJS files configured with `sourceType: 'script'`.

## Valid

These patterns are covered by valid cases in the rule tests:

```ts
export const foo = 'foo';
export { foo };
export * from './foo';
```

## Invalid

These patterns are covered by invalid cases in the rule tests:

```ts
export default function bar() {}

let foo;
export { foo as default };

export { default } from './x';
```

## Why

Named exports keep the imported name tied to the name the module declares, so callers use a consistent name for the same export.

## Changelog

### 1.0.0

- Initial release.
