import {describe, expect, test} from 'bun:test'
import {resolve} from 'node:path'

import {resolveWithinOutDir} from '../../../scripts/capture-editor-shots/build'

// `resolveWithinOutDir` is the containment check the capture harness's
// static file handler relies on (CI review, PR 106: the previous handler
// `join`'d the raw request pathname straight into `outDir` with no check at
// all, so a `..`-laden pathname could read anything readable by this
// process). Pure and I/O-free — no server, no filesystem, no temp
// directories needed to exercise every case.
describe('resolveWithinOutDir', () => {
  const outDir = '/tmp/guided-tours-capture-abc123'

  test('resolves an ordinary top-level file inside outDir', () => {
    expect(resolveWithinOutDir(outDir, '/entry.js')).toBe(resolve(outDir, 'entry.js'))
  })

  test('resolves a nested file inside outDir', () => {
    expect(resolveWithinOutDir(outDir, '/assets/logo.png')).toBe(resolve(outDir, 'assets/logo.png'))
  })

  test('resolves the bare root pathname to outDir itself', () => {
    expect(resolveWithinOutDir(outDir, '/')).toBe(resolve(outDir))
  })

  test('rejects a single-segment traversal above outDir', () => {
    expect(resolveWithinOutDir(outDir, '/../secret.txt')).toBeNull()
  })

  test('rejects a multi-segment traversal reaching outside outDir entirely', () => {
    expect(resolveWithinOutDir(outDir, '/../../../../etc/passwd')).toBeNull()
  })

  test('rejects a traversal encoded via a nested path that still escapes outDir', () => {
    expect(resolveWithinOutDir(outDir, '/assets/../../secret.txt')).toBeNull()
  })

  test('rejects a sibling directory that merely shares outDir as a string prefix', () => {
    // Guards the naive `candidate.startsWith(outDir)` version of this check
    // (no trailing separator) — `/tmp/guided-tours-capture-abc123-evil/x`
    // starts with the `outDir` STRING but is not a path INSIDE it.
    const sibling = `${outDir}-evil`
    expect(resolveWithinOutDir(outDir, `/../${sibling.split('/').pop()}/x`)).toBeNull()
  })

  test('accepts a path that legitimately reaches outDir via internal .. segments that cancel out', () => {
    expect(resolveWithinOutDir(outDir, '/assets/../entry.js')).toBe(resolve(outDir, 'entry.js'))
  })
})
