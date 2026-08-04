#!/usr/bin/env node
// Bun (as of 1.3.x) can't resolve a workspace member depending on the
// *workspace root* itself via the `workspace:*` protocol — only packages
// matched by a glob in `workspaces` are resolvable that way, and the root
// package can't glob-match itself (see the Bun issue tracker: "Workspace
// dependency ... not found" for a root-referencing-itself setup).
// `examples/web` therefore depends on `sanity-plugin-guided-tours` via
// `file:../..` instead, which Bun *does* accept — but Bun implements
// `file:` as a one-time copy taken at `bun install` time, not a live link.
// Left alone, that copy goes stale the moment `bun run build` regenerates
// `dist/`, and the example app silently builds against whatever `dist/`
// happened to exist when `bun install` last ran (frequently: nothing).
//
// This script replaces that copy with a real symlink back to the
// repository root, so the example app always resolves the live package —
// `bun run build` (root) followed by `cd examples/web && bun run build`
// picks up fresh output with no extra install step in between.
//
// It's chained in front of `examples/web/package.json`'s `dev`, `build`
// and `typecheck` scripts (`node ../../scripts/link-example-app.mjs &&
// next build`, etc.), deliberately NOT wired up as anyone's `postinstall`:
//
// - Not this root package's `postinstall`: this package gets published to
//   npm, and `scripts/` isn't in its `files` list, so a root `postinstall`
//   referencing this file would ship in package.json but the file it
//   points at wouldn't ship in the tarball — breaking `npm install
//   sanity-plugin-guided-tours` for every consumer with "Cannot find
//   module" before any of this file's own guards could even run.
// - Not `examples/web/package.json`'s `postinstall` either, even though
//   that package is `"private": true` and never published (so it can't
//   leak the same way): empirically, merely adding a `postinstall` key to
//   a workspace member's package.json — regardless of what it runs — makes
//   `bun install --frozen-lockfile` (what CI uses) unreliable. A plain
//   `bun install` followed immediately by `bun install --frozen-lockfile`
//   started failing with "lockfile had changes, but lockfile is frozen"
//   reproducibly (3/3 runs) the moment `examples/web` had *any*
//   `postinstall` script, and stopped failing (3/3 runs) the moment it
//   didn't — reproduced with this script, and separately with a trivial
//   `"postinstall": "true"`, so it's about the key's presence, not this
//   script's behavior. Root-level `postinstall` never showed the same
//   instability. Running this at build time instead sidesteps the bug
//   entirely and is arguably more correct anyway: it fixes the link
//   immediately before something needs it, rather than trusting that
//   whatever ran `bun install` last also happened to run scripts.
import {existsSync, lstatSync, readlinkSync, rmSync, symlinkSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const targetDir = resolve(repoRoot, 'examples/web/node_modules')
const linkPath = resolve(targetDir, 'sanity-plugin-guided-tours')

if (!existsSync(resolve(repoRoot, 'examples/web'))) {
  // Nothing to link — examples/web isn't installed as a workspace member.
  process.exit(0)
}

if (!existsSync(targetDir)) {
  // `bun install` hasn't created examples/web/node_modules yet (e.g. the
  // workspace member has no other deps to hoist). Nothing to fix up.
  process.exit(0)
}

const alreadyLinked =
  existsSync(linkPath) &&
  lstatSync(linkPath).isSymbolicLink() &&
  readlinkSync(linkPath) === repoRoot

if (!alreadyLinked) {
  rmSync(linkPath, {recursive: true, force: true})
  symlinkSync(repoRoot, linkPath, 'dir')
  // This repo's oxlint config only allows console.warn/error (see
  // oxlint.config.ts) — this is a one-line install-time notice, not
  // application logging, so warn is the closest fit.
  console.warn(
    `[link-example-app] linked examples/web/node_modules/sanity-plugin-guided-tours -> ${repoRoot}`,
  )
}
