import {describe, expect, test} from 'bun:test'
// The /queries and /react entries must be importable without Studio deps
// resolving. We assert their module graphs stay clean by scanning source
// imports — dist-level guarantees come from pkg-utils' strict mode.
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

const FORBIDDEN = /from\s+['"](sanity|@sanity\/ui|styled-components)/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return sourceFiles(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('entry isolation', () => {
  for (const entry of ['src/queries', 'src/react']) {
    test(`${entry} never imports Studio dependencies`, () => {
      for (const file of sourceFiles(entry)) {
        expect(readFileSync(file, 'utf-8')).not.toMatch(FORBIDDEN)
      }
    })
  }
})
