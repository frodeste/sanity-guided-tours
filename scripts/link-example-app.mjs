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
// This `postinstall` script runs after every `bun install` and replaces
// that copy with a real symlink back to the repository root, so the
// example app always resolves the live package — `bun run build` (root)
// followed by `cd examples/web && bun run build` picks up fresh output
// with no extra install step in between.
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
