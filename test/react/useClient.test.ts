import {describe, expect, test} from 'bun:test'
// Every module reachable from the published `/react` entry renders through
// React hooks (`useState`, `useEffect`, ...) and so must be a Client
// Component boundary — spec §8.1's own example renders `<GuidedTour>`
// directly from a Server Component, which crashes without this. The
// directive has to be present at the *source* level in every file that
// uses hooks (not just the entry): pkg-utils/Rollup bundles the whole
// `/react` entry into one chunk, and Rollup strips a module-level
// directive from any file that isn't left standalone — see
// `package.config.ts`'s `rollup.output.banner`, which re-adds it to the
// built `dist/react/index.js` chunk. This file is the source-level half of
// that guarantee (the bundler-level half is `dist/react/index.js starts
// with "use client" once built`, below — conditional on `dist/` actually
// existing, since CI runs `bun test` before `bun run build`).
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'

const REACT_DIR = 'src/react'

// Pure logic modules (no JSX, no hooks) don't need the directive — it's
// harmless on them, but pointless, so they're deliberately excluded here
// rather than asserted on: `context.ts`, `events.ts`, `helpers.ts` (despite
// `useIsMobile` being a hook — it's consumed only from an already-`'use
// client'` file, never itself a Server/Client boundary), `labels.ts`,
// `navigation.ts`, `personalize.ts`, `session.ts`, `types.ts`.
const COMPONENT_FILES = [
  'index.ts',
  'GuidedTour.tsx',
  'GuidedTourEmbed.tsx',
  'GuidedTourModal.tsx',
  'Outro.tsx',
  'LeadForm.tsx',
  'Step.tsx',
  'Hotspot.tsx',
  'Tooltip.tsx',
  'TextOverlay.tsx',
  'PortableText.tsx',
  'Image.tsx',
]

describe('"use client" directive', () => {
  test('every /react component module starts with it at the source level', () => {
    const filesOnDisk = new Set(readdirSync(REACT_DIR))
    for (const file of COMPONENT_FILES) {
      expect(filesOnDisk.has(file)).toBe(true) // catches a file renamed out from under this list
      const content = readFileSync(join(REACT_DIR, file), 'utf-8')
      expect(content.startsWith("'use client'")).toBe(true)
    }
  })

  test('every .tsx file under src/react is accounted for above (nothing new slipped in undirected)', () => {
    const tsxFiles = readdirSync(REACT_DIR).filter((name) => name.endsWith('.tsx'))
    expect(new Set(tsxFiles)).toEqual(
      new Set(COMPONENT_FILES.filter((name) => name.endsWith('.tsx'))),
    )
  })

  const distEntry = join('dist', 'react', 'index.js')
  test.skipIf(!existsSync(distEntry))(
    'the built dist/react/index.js starts with the directive (run `bun run build` first to exercise this)',
    () => {
      const content = readFileSync(distEntry, 'utf-8')
      expect(content.startsWith('"use client"') || content.startsWith("'use client'")).toBe(true)
    },
  )

  test.skipIf(!existsSync(join('dist', 'index.js')))(
    'the built dist/index.js (schema/plugin entry, no React) is NOT marked "use client"',
    () => {
      const content = readFileSync(join('dist', 'index.js'), 'utf-8')
      expect(content.startsWith('"use client"') || content.startsWith("'use client'")).toBe(false)
    },
  )

  test.skipIf(!existsSync(join('dist', 'queries', 'index.js')))(
    'the built dist/queries/index.js (query strings, no React) is NOT marked "use client"',
    () => {
      const content = readFileSync(join('dist', 'queries', 'index.js'), 'utf-8')
      expect(content.startsWith('"use client"') || content.startsWith("'use client'")).toBe(false)
    },
  )
})
