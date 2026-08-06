# Contributing

Thanks for considering a contribution! This document covers the workflow; the
[design spec](docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md)
covers what we're building and why.

## Development setup

[Bun](https://bun.sh) is the package manager and test runner.

```bash
bun install                  # workspace root — installs plugin + example apps
bun test                     # unit and component tests (coverage-gated)
bun run build                # build the plugin package
bun run lint                 # oxlint
bun run typecheck            # tsc --noEmit
cd examples/web && bun run dev      # example web app with embedded Studio at /studio
cd examples/native && bunx expo start   # example Expo app (device/simulator)
```

There is no root-level `dev` script — each example app's `dev` script lives in
its own `package.json` and needs the plugin already built (see
[`examples/web/README.md`](examples/web/README.md) and
[`examples/native/README.md`](examples/native/README.md) for full local setup).
The web example needs a Sanity dataset to show real content — copy
`examples/web/.env.example` to `.env.local`, point it at your own project, and
run `bun run seed` (from the repository root) to populate the sample tours.

## Branches and pull requests

- `main` is protected: no direct pushes, all changes arrive by pull request.
- Branch from `main`, keep PRs focused on one issue, and link it
  (`Closes #NN`).
- PRs are squash-merged. **The PR title becomes the commit message on `main`**,
  so it must be a valid Conventional Commit — CI enforces this.
- Merging requires green required checks — there is no bypass:
  - **`gates`** — lint, typecheck, build, tests with a coverage floor,
    [attw](https://github.com/arethetypeswrong/arethetypeswrong.github.io)
    type-resolution soundness, `plugin-kit verify-package`, and both example
    apps (including a two-platform `expo export`).
  - **`quality`** — [knip](https://knip.dev) (dead exports/dependencies) and
    [madge](https://github.com/pahen/madge) (circular imports), plus an
    informational duplication report.
  - **`Conventional Commit title`**.
- Every PR also gets an automated review from Claude Code in addition to
  maintainer review, and all review threads must be resolved before merge.
  Treat its findings like any reviewer's: address or rebut.

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

Releases are cut by semantic-release from commits on `main`, following
[semver 2.0.0](https://semver.org):

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
first. Web viewer components get Testing Library tests including the axe-core
accessibility assertions; native components render through the lightweight
React Native stub in `test/support/react-native-stub/` with
`react-test-renderer`; Studio UI gets render smoke tests.

Coverage is enforced **per file** (`bunfig.toml` sets the floor) — a new file
that lands under-tested fails `bun test --coverage`. Write tests that pin real
behavior (an input→output contract, an event, a rendered semantic), not tests
that merely execute lines.

Invariants with dedicated regression tests — do not weaken them:

1. Personalization tokens are never substituted into `href`, `src` or any
   URL-valued field.
2. Importing `/react`, `/native` or `/queries` must not resolve `sanity`,
   `@sanity/ui` or `styled-components`, and `/native` must never import
   DOM-touching modules.
3. `dist/react/index.js` carries the `'use client'` banner; no other entry
   does.

If you spy on the shared React Native stub (e.g. `Linking`), always
`mockRestore()` — it's a module singleton and a leaked spy breaks other test
files under CI's file ordering.

## Issues

Use the issue forms: **Bug report**, **Feature request**, **Change request**
or **Task** — blank issues are disabled so that everything filed is
actionable. Questions and early ideas belong in
[Discussions](https://github.com/frodeste/sanity-guided-tours/discussions).
Features on the [project board](https://github.com/users/frodeste/projects/1)
are broken into task sub-issues; pick an unassigned task and comment before
starting work. Issues labeled `good first issue` are scoped to be approachable
without deep repo knowledge.

## Code of conduct

Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
