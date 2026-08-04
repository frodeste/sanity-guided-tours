# Contributing

Thanks for considering a contribution! This document covers the workflow; the
[design spec](docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md)
covers what we're building and why.

## Development setup

[Bun](https://bun.sh) is the package manager and test runner.

```bash
bun install        # workspace root — installs plugin + example app
bun test           # unit and component tests
bun run build      # build the plugin package
bun run dev        # example app with embedded Studio at /studio
```

The example app in `examples/web` needs a Sanity dataset — copy
`examples/web/.env.example`, point it at your own project, and run
`bun run seed` to populate a sample tour.

## Branches and pull requests

- `main` is protected: no direct pushes, all changes arrive by pull request.
- Branch from `main`, keep PRs focused on one issue, and link it
  (`Closes #NN`).
- PRs are squash-merged. **The PR title becomes the commit message on `main`**,
  so it must be a valid Conventional Commit — CI enforces this.
- Every PR gets an automated review from Claude Code in addition to maintainer
  review. Treat its findings like any reviewer's: address or rebut.

## Conventional Commits and versioning

Commit messages (and therefore PR titles) follow
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```
feat: add device toggle to the canvas editor
fix: clamp element drag to canvas bounds
docs: document the labels prop
chore: bump @sanity/ui
feat!: rename tokens prop to personalization
```

Releases are cut automatically by semantic-release from commits on `main`,
following [semver 2.0.0](https://semver.org):

| Commit | Release |
|---|---|
| `fix:`, `perf:` | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE:` footer | major |
| `docs:`, `chore:`, `test:`, `ci:`, `refactor:`, `style:`, `build:` | none |

There is no manual version bumping — never edit `version` in `package.json`.

## Tests

Test-driven development for all pure logic modules (`geometry`, `patches`,
`navigation`, `personalize`, `theme`, `bulkUpload`): write the failing test
first. Viewer components get Testing Library tests including the axe-core
accessibility assertions; Studio UI gets render smoke tests. A PR that changes
behavior without touching tests will be asked to add them.

Two invariants have dedicated regression tests — do not weaken them:

1. Personalization tokens are never substituted into `href`, `src` or any
   URL-valued field.
2. Importing `/react` or `/queries` must not resolve `sanity`,
   `@sanity/ui` or `styled-components`.

## Issues

Use the issue templates: **Bug report**, **Feature request** or **Task**.
Features on the [project board](https://github.com/users/frodeste/projects/1)
are broken into task sub-issues; pick an unassigned task and comment before
starting work.

## Code of conduct

Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
