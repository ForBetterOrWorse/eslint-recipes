---
languages:
  - JavaScript
  - TypeScript
  - CSS
requiredPackages:
  - '@eslint/css'
---

# filename-case

Ported from [eslint-plugin-unicorn 77.0.0, rule filename-case](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v77.0.0/rules/filename-case.js) (MIT).

Enforce a case style for filenames and directory names. The rule also requires lowercase file extensions.

## Files to copy

- `eslint-rules/filename-case/filename-case.ts`
- `eslint-rules/filename-case/filename-case.test.ts` (optional)
- `eslint-rules/shared/case.ts`

## Enable this rule

After copying these files and registering the copied rule in your plugin as described in [Setup](../../README.md#setup), add this entry to the relevant flat-config block:

```js
'custom/filename-case': 'error',
```

Enable it in the CSS block as well as the TypeScript block if you want to check CSS filenames. CSS files need `@eslint/css` configured with the `css/css` language.

## What it checks

By default, filenames and directories use kebab-case. It ignores conventional entrypoint names such as `index.ts` and ignores path segments that start with `$`. It checks CSS filenames when enabled for `@eslint/css`.

The rule checks the filename and directory names for files inside the current working directory. Files outside it are checked by filename only. Set `checkDirectories` to `false` to skip directory checks everywhere.

## Options

The rule accepts one options object. Use either `case` to select one style or `cases` to allow several. If `cases` is empty or all values are `false`, the rule uses kebab-case.

### `case`

Type: `'camelCase' | 'camelCaseWithAcronyms' | 'snakeCase' | 'kebabCase' | 'pascalCase'`

Default: `'kebabCase'`

```js
'custom/filename-case': ['error', { case: 'camelCase' }]
```

### `cases`

Type: an object with optional boolean properties `camelCase`, `camelCaseWithAcronyms`, `snakeCase`, `kebabCase`, and `pascalCase`.

Use it to accept more than one style:

```js
'custom/filename-case': [
  'error',
  { cases: { camelCase: true, pascalCase: true } },
]
```

### `ignore`

Type: `Array<string | RegExp>`  
Default: `[]`

Each string is treated as a regular expression. If a pattern matches any path segment, the rule skips that file.

```js
'custom/filename-case': [
  'error',
  { ignore: ['FOOBAR\\.js', /^__fixtures__$/u] },
]
```

### `checkDirectories`

Type: `boolean`  
Default: `true`

Set this to `false` to check filenames without checking their directories.

### `directoryRoots`

Type: `Array<string | RegExp>`  
Default: `[]`

Paths are relative to the current working directory. The matched root and its ancestors are skipped; directory checks start below the deepest matching root.

```js
'custom/filename-case': [
  'error',
  { case: 'pascalCase', directoryRoots: ['app/javascript'] },
]
```

### `multipleFileExtensions`

Type: `boolean`  
Default: `true`

When enabled, dot-separated parts after the first part are treated as extensions, not as part of the filename. For example, `fooBar.test.js` checks `fooBar`, while `fooBar.testUtils.js` checks `fooBar` and treats `.testUtils.js` as extensions. Set this to `false` to check the full name before the final extension.

## Why

Consistent filename and directory casing makes imports easier to predict, including on case-sensitive filesystems.

## Valid

These names are covered by valid cases in the rule tests:

```text
src/foo/foo-bar.js
src/foo/fooBar.js        # with case: camelCase
src/foo/innerHTML.js     # with case: camelCaseWithAcronyms
src/foo/index.ts
app/javascript/Pages/Foo.vue  # with case: pascalCase and directoryRoots
```

## Invalid

These names are covered by invalid cases in the rule tests:

```text
src/foo/CtaButton.tsx        # default kebab-case expects cta-button.tsx
src/FooBar/file.js           # default kebab-case checks directories
src/foo/$userId.TSX          # extension must be lowercase
```

## Changelog

### 1.0.0

- Initial release.
