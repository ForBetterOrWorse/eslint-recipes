# Versioning

Every rule in eslint-recipes has its own version, like a package in a monorepo. The repo itself has no version, creates no git tags, and has no release PRs. Merging a PR into `main` is the release.

## Packages

A package is a set of files that consumers copy together. Each one carries a version.

| Package                | Files                                                                 | Changelog                                       |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| Rule `<name>`          | `eslint-rules/<name>/<name>.ts`, `eslint-rules/<name>/<name>.test.ts` | `## Changelog` in `eslint-rules/<name>/README.md` |
| Shared helper `<name>` | `eslint-rules/shared/<name>.ts`, `eslint-rules/shared/<name>.test.ts` | None. Logged in each dependent rule's changelog |
| Plugin                 | `eslint-rules/plugin.ts`                                              | None                                            |

Rule READMEs are not part of the copyable package. A PR that only edits `eslint-rules/<name>/README.md` never bumps anything.

## Where versions live

The first line of every rule, test, shared-helper, and plugin TypeScript file holds the version:

```ts
// @rule filename-case v1.0.0          (rule)
// @rule filename-case v1.0.0 test     (rule test)
// @shared case v1.0.0                 (shared helper; its test adds " test")
// @plugin v1.0.0                      (plugin.ts)
```

A rule and its test always share a version, and so do a shared helper and its test. Each rule doc's changelog lists versions newest first, and its top `### <version>` heading must match the rule header. The `checkRepo` test in `lib/attribution.ts` fails the build when any of these disagree.

Every package starts at `1.0.0`. That includes new rules.

## Choosing the bump

Pick the level by what changes for a consumer who copies the new version, using [ESLint's semver policy](https://github.com/eslint/eslint#semantic-versioning-policy). The kind of work doesn't decide it. A bug fix can be a patch or a minor bump depending on its effect.

| Level   | Use when                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `patch` | The rule reports the same or fewer errors. Covers bug fixes that stop false positives, crash fixes, and message wording.    |
| `minor` | A bug fix makes the rule report more errors, or a new option arrives whose default keeps today's behavior.                  |
| `major` | An option or message id is removed or renamed, an option's default changes, or new behavior reports more errors by default. |
| `none`  | The copyable files changed, but consumers see no difference. Covers refactors, added test cases, comments, and formatting.  |

`minor` for a bug fix that adds errors is ESLint's own convention, and it surprises people who know general semver. A consumer's lint run can start failing after a minor update. The changelog entry is how they find out why.

## Releasing a change

1. Open a PR. Write the title as a conventional commit (`fix(filename-case): handle dotfiles`). The title becomes the squash commit and the changelog entry. Its prefix has no effect on the version.
2. If the PR touches any file in `eslint-rules/`, add exactly one label: `version: major`, `version: minor`, `version: patch`, or `version: none`. The workflow fails when the label is missing or there are two.
3. The workflow (`.github/workflows/pull-request-checks.yml`) works out which packages changed and pushes a `chore: bump versions` commit to your branch. That commit:
   - bumps the header of every file in each changed package,
   - bumps every rule that imports a changed shared helper, at the same level,
   - adds `### <version>` and a `- <PR title>` entry, with the title copied exactly, to each bumped rule's changelog.
4. The workflow runs tests, lint, and typecheck on the bumped commit and reports a `checks` status.
5. Squash-merge. The new versions are live on `main`.

The workflow always computes versions from `main`, not from your branch. Pushing again, swapping the label, or editing the title reruns it, and the rerun overwrites the earlier bump instead of stacking a second one. Switching to `version: none` undoes the bump.

New packages are the exception. When you add a rule or shared helper, write `1.0.0` in its headers and add a `### 1.0.0` changelog section yourself. The workflow skips packages that don't exist on `main`.

All packages bumped in one PR get the same level. If you fix one rule and add a feature to another, the fix ships as `minor` too. Split the PR if that matters.

### Bumping locally

You can run the bump yourself before opening the PR:

```sh
VERSION_LABELS='version: patch' PR_TITLE='fix(filename-case): handle dotfiles' BASE_REF=main pnpm bump
```

The PR still needs the matching label. When you add it, the workflow computes the same versions from `main`, finds them already in place, and commits nothing. It only pushes a commit when the label or the PR title differs from what you used locally. The label and the title on the PR always win.

For fork PRs, the workflow runs the bump and checks with a read-only token, then fails with instructions because it cannot push to the fork or post a status. A maintainer picks the level. The author runs the command above and pushes the result, and a maintainer verifies it.

## Repository settings

These settings make the flow above safe. Apply them when the repo is created.

- Labels `version: major`, `version: minor`, `version: patch`, and `version: none` exist.
- Only squash merging is allowed, and the squash commit message defaults to the PR title.
- `main` requires the `checks` status, with GitHub Actions as its expected source.
- `main` requires branches to be up to date before merging. Without this, two PRs that bump the same rule could both claim the same next version.

The workflow reports `checks` as a commit status instead of relying on a normal CI run. GitHub doesn't start a normal run for a commit pushed with the workflow's own `GITHUB_TOKEN`; the run waits for someone to approve it. Posting the status directly avoids that wait without a personal access token or GitHub App.

## Updating a copied rule

Copied files never update on their own. To check for an update, compare the version on line 1 of your copy with the same file on `main`. If it's higher, read the rule's changelog in `eslint-rules/<name>/README.md` for every version since yours, then copy the rule, its test, and every shared file in its "Files to copy" list. A rule bump caused by a shared helper change lists that change in the rule's changelog, so you don't need to track shared helper versions separately.
