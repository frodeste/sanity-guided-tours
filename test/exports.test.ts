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
  for (const entry of ['src/queries', 'src/react', 'src/native']) {
    test(`${entry} never imports Studio dependencies`, () => {
      for (const file of sourceFiles(entry)) {
        expect(readFileSync(file, 'utf-8')).not.toMatch(FORBIDDEN)
      }
    })
  }
})

// src/native is a fourth runtime entry (M8 Task 2) built from RN
// primitives, reusing the DOM-free logic modules under src/react
// (navigation, personalize, events, session, labels, theme) plus anything
// from src/queries — but it must never reach into a DOM-touching react
// module: fontLoader.ts appends real `<link>` elements to `document.head`,
// styles.css is a CSS asset RN can't consume at all, and every component
// file (GuidedTour.tsx, Hotspot.tsx, ...) either renders DOM elements
// directly or pulls in styled-components/@sanity/ui transitively — all
// unusable under Hermes. The react ENTRY (`../react`/`../react/index`)
// is excluded too: it re-exports exactly those component files.
const ALLOWED_REACT_IMPORTS = new Set(
  ['navigation', 'personalize', 'events', 'session', 'labels', 'theme'].map(
    (mod) => `../react/${mod}`,
  ),
)
// Matches the imported module path itself (group 1), not the named
// bindings — `src/native` files may import type-only or value bindings
// from an allowed module freely; only the MODULE PATH is restricted.
const REACT_IMPORT = /from\s+['"](\.\.\/react[^'"]*)['"]/g

describe('src/native import isolation', () => {
  const files = sourceFiles('src/native')

  test('src/native has at least one source file (guard sanity check — an empty dir would pass every test below vacuously)', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  test('every ../react import in src/native resolves to an allowed pure logic module', () => {
    for (const file of files) {
      const contents = readFileSync(file, 'utf-8')
      for (const match of contents.matchAll(REACT_IMPORT)) {
        const importedPath = match[1]
        expect(ALLOWED_REACT_IMPORTS.has(importedPath ?? '')).toBe(true)
      }
    }
  })

  test('src/native never imports react-dom', () => {
    for (const file of files) {
      expect(readFileSync(file, 'utf-8')).not.toMatch(/from\s+['"]react-dom/)
    }
  })
})

// The shared logic modules power BOTH the web (`src/react`) and native
// (`src/native`) entries, so they must stay free of DOM globals everywhere
// in the file — not just at module (top) scope: a reference tucked inside a
// function body would still crash the first time a native caller exercised
// that branch under Hermes, where none of `window`/`document`/
// `localStorage`/`sessionStorage`/`navigator` exist. Checking the whole
// file, not only its top-level statements, is deliberately the stricter of
// the two readings.
describe('shared logic modules (navigation/personalize/events/session/labels/theme) reference no DOM global', () => {
  const SHARED_LOGIC_MODULES = [
    'src/react/navigation.ts',
    'src/react/personalize.ts',
    'src/react/events.ts',
    'src/react/session.ts',
    'src/react/labels.ts',
    'src/react/theme.ts',
  ]
  const DOM_GLOBAL_USAGE = /\b(window|document|localStorage|sessionStorage|navigator)\./

  for (const file of SHARED_LOGIC_MODULES) {
    test(`${file} has no DOM global usage`, () => {
      expect(readFileSync(file, 'utf-8')).not.toMatch(DOM_GLOBAL_USAGE)
    })
  }
})
