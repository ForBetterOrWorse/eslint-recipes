# eslint-recipes

`eslint-recipes` is a collection of ESLint rules you copy into your project and own.

## Table of contents

- [Rules](#rules)
- [Setup](#setup)
- [Usage](#usage)
  - [Adding a rule](#adding-a-rule)
  - [Updating copied rules](#updating-copied-rules)
- [Development](#development)
  - [Adding a rule to the collection](#adding-a-rule-to-the-collection)
- [License](#license)

## Rules

| Rule                                                              | Description                                                                    | Languages                   | Required packages | Ported from                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [colocated-files](eslint-rules/colocated-files/README.md)         | Require test files and CSS modules to sit beside a matching source file.       | JavaScript, TypeScript, CSS | `@eslint/css`     |                                                                                                                              |
| [filename-case](eslint-rules/filename-case/README.md)             | Enforce a case style for filenames and directories, with lowercase extensions. | JavaScript, TypeScript, CSS | `@eslint/css`     | [eslint-plugin-unicorn 77.0.0](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v77.0.0/rules/filename-case.js)    |
| [index-reexport-only](eslint-rules/index-reexport-only/README.md) | Keep `index.ts` files to re-exports and reject `index.tsx`.                    | JavaScript, TypeScript      | None              |                                                                                                                              |
| [no-default-export](eslint-rules/no-default-export/README.md)     | Forbid default exports.                                                        | JavaScript, TypeScript      | None              | [eslint-plugin-import-x 4.17.1](https://github.com/un-ts/eslint-plugin-import-x/blob/v4.17.1/src/rules/no-default-export.ts) |

## Setup

The supported setup is TypeScript with ESLint 10's flat config in `eslint.config.ts`. It uses `jiti` to load the TypeScript config and `typescript-eslint` for TypeScript files. Install `@eslint/css` only when a copied rule's `requiredPackages` frontmatter lists it. Other ESLint versions, JavaScript configs, and legacy configs are not supported.

Install the common setup packages:

```sh
pnpm add -D eslint@^10 jiti typescript typescript-eslint
```

Each rule README's `requiredPackages` frontmatter lists additional packages for that rule. An empty list means the common setup is enough.

For rules that list `@eslint/css` in their frontmatter, also install:

```sh
pnpm add -D @eslint/css
```

## Usage

### Adding a rule

1. Choose rules from the list above. For each one, copy the files listed in its README's **Files to copy** section into any directory in your project, preserving their relative layout. Skip the optional test files unless you want the tests.
2. Register the copied rules in a plugin file in that directory, import the plugin in your `eslint.config.ts`, then enable the rules using each README's **Enable this rule** snippet. Check the rule's `requiredPackages` frontmatter for any packages your setup needs.
3. Run ESLint with `pnpm exec eslint .`.

Keep copied file headers, including license blocks.

### Updating copied rules

Copied rules never update on their own. Compare each copied file's `@rule` version header with the corresponding file in the repository, then read that rule's changelog before copying an update.

## Development

To add an original rule, create `eslint-rules/<name>/` with its implementation, colocated test, and `README.md`. Give both source files versioned headers, then register the rule in `eslint-rules/plugin.ts`. The README needs `languages` and `requiredPackages` frontmatter, a rule-name heading, a one-line summary, a "Files to copy" list, a per-rule flat-config example, "What it checks", valid and invalid examples, a "Why" section, and a changelog. This format follows the rule pages in [eslint-plugin-unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn/tree/main/docs/rules), [typescript-eslint](https://typescript-eslint.io/rules/), and [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react/tree/master/docs/rules).

To port a rule, use code from an MIT-licensed upstream release. Pin the release tag in the source URL, copy its license verbatim into `licenses/`, and include the upstream source, version, changes, and license text in each ported file's header. Add a "Ported from" link to the rule README. Copy small dependencies into `eslint-rules/shared/` with their own source and license credit, and port the upstream tests. The `checkRepo` tests enforce these attribution and registration requirements.

Add one `version:` label to your PR. See [docs/versioning.md](docs/versioning.md). Do not edit versions by hand.

Run the project checks before submitting a change:

```sh
pnpm test
pnpm lint
pnpm typecheck
```

## License

eslint-recipes is MIT licensed. Ported code also retains the license terms in its file headers. The `licenses/` directory contains the upstream licenses for:

- `change-case` 5.4.4, used by `filename-case`.
- `eslint-plugin-unicorn` 77.0.0, source of `filename-case`.
- `eslint-plugin-import-x` 4.17.1, source of `no-default-export`.
