# Releasing the plugin

Releases run on GitHub Actions from `main` through the manually dispatched
Release workflow. Semantic-release determines the version from Conventional
Commits, publishes the package with provenance, and creates the GitHub release.
Keep `package.json` at `0.0.0-development` in Git; do not bump it manually.

## Verify the package

Use Node 24.19.0 and Bun 1.4.2, matching the workflows and committed lockfile:

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run check:quality
bun run build
bun test --coverage
bunx --no-install --bun @arethetypeswrong/cli --pack . --profile esm-only --exclude-entrypoints ./react/styles.css
bun run verify
npm pack --dry-run
```

The shared gates workflow also builds the Next.js example and typechecks and
exports the native example for iOS and Android. The Release workflow repeats
code-health checks before running semantic-release.

## Plan a release

Dispatch Release on `main` with `dry_run` checked, which is the default. This
runs all gates and computes the next version and release notes. The planning
command loads only the commit analyzer and notes generator, so npm publishing
credentials are not needed. It does not verify npm authentication.

On a clean checkout of `main` with GitHub repository access, the equivalent is:

```bash
bun run release:plan --no-ci
```

Do not use `bun run release` for planning: it enables the publishing plugins.

## Bootstrap npm publishing

For the first release, the package does not yet have npm settings in which to
configure a trusted publisher. The npm account that will own
`sanity-plugin-guided-tours` must provide a granular access token with permission
to create and publish the public package. Its authentication settings must allow
the unattended GitHub Actions publish. Store it in the repository's `NPM_TOKEN`
Actions secret; do not put credentials in the repository or issue comments.

After the pp-internt pilot is verified and the release changes are merged,
dispatch Release on `main` with `dry_run` unchecked. The workflow uses the
lockfile-installed semantic-release 25 toolchain. Its npm plugin checks
authentication before publishing.

## Configure trusted publishing

After the first package is published, configure its npm trusted publisher for:

- GitHub owner: `frodeste`
- Repository: `sanity-guided-tours`
- Workflow filename: `release.yml`
- Allowed action: direct publishing with `npm publish`

The workflow already grants `id-token: write` and uses a GitHub-hosted runner.
Semantic-release's npm plugin supports OIDC publishing. Verify a subsequent
release with trusted publishing, then remove the bootstrap `NPM_TOKEN` secret.
See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/)
and [semantic-release's npm authentication documentation](https://github.com/semantic-release/npm#npm-registry-authentication).

## Verify distribution

Install the published version in a fresh Studio and in pp-internt. Check that
the editor, Preview view, viewer stylesheet, and queries resolve from the
published package. Replace any local pilot tarball dependency with that npm
version. Submit the plugin to [Sanity Exchange](https://community.sanity.tools/)
after the public installation instructions work.
