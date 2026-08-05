// A live, in-Studio preview of the tour (master plan Task 8): renders the
// current DRAFT document (`props.document.displayed`) through the pure
// `draftToTour` mapper (`./draftToTour.ts`) and straight into `<GuidedTour>`
// — no GROQ round-trip, so it updates on every keystroke/patch the same way
// the rest of the Studio form does, at the cost of the three documented
// gaps `draftToTour.ts`'s module comment records (no real theme, no LQIP,
// steps without a resolvable screenshot hidden).
//
// This is a `UserViewComponent` (`sanity/structure`'s type for
// `S.view.component(...)`) — a Studio document-pane VIEW, not an input
// component, so it's registered separately and only where a consumer opts
// in via `defaultDocumentNode`, e.g.:
//
//   import {defineConfig} from 'sanity'
//   import {structureTool} from 'sanity/structure'
//   import {GuidedTourPreviewView} from 'sanity-plugin-guided-tours'
//
//   export default defineConfig({
//     plugins: [
//       structureTool({
//         defaultDocumentNode: (S, {schemaType}) =>
//           schemaType === 'guidedTour'
//             ? S.document().views([
//                 S.view.form(),
//                 S.view.component(GuidedTourPreviewView).title('Preview'),
//               ])
//             : S.document(),
//       }),
//     ],
//   })
//
// Nothing is wired by default (this file exports only the component, never
// a structure/`defaultDocumentNode` helper — YAGNI, and the same
// no-surprises convention `CanvasInput.tsx`'s "Plain editor" details keeps
// the plain form reachable rather than silently replacing it): the
// consumer's own structure decides whether and where this view appears.
//
// IMPORT PATH NOTE: `GuidedTour` is imported from `../react/GuidedTour` —
// the concrete component FILE — not `../react` (that entry's own `index.ts`,
// which is ALSO one of this package's separately-bundled `exports` entries,
// package.json). A static import of that exact index file made `npm run
// build` fail with a Rollup `INVALID_EXTERNAL_ID` error (confirmed
// empirically): this file lives in the `.` entry's own build graph, and
// pkg-utils tries to mark a same-package, cross-ENTRY import external, but
// Rollup can't do that for a module that's simultaneously registered as a
// DIFFERENT entry's own build input — the two are mutually exclusive in a
// single Rollup graph. Importing the component file directly sidesteps this
// entirely: `GuidedTour.tsx` (and its own transitive dependencies, e.g.
// `./navigation`, `./personalize`) isn't itself a declared entry, so
// pkg-utils' self-reference detection never matches it. Rollup's own
// multi-entry code-splitting then does the right thing on its own — no
// duplication and no config needed: since `GuidedTour.tsx` ends up imported
// by BOTH the `.` and `./react` entries, Rollup automatically factors it
// out into one shared `_chunks-es/GuidedTour.js` chunk that both
// `dist/index.js` and `dist/react/index.js` import (confirmed by inspecting
// the actual build output) — the exact same code the `./react` entry
// already ships, not a second copy.
import {Box, Card, Stack, Text} from '@sanity/ui'
import type {ReactNode} from 'react'
import type {UserViewComponent} from 'sanity/structure'

import {GuidedTour} from '../react/GuidedTour'
import {draftToTour} from './draftToTour'
import {useProjectDataset} from './useProjectDataset'

function Notice({children, testId}: {children: ReactNode; testId: string}): ReactNode {
  return (
    <Card data-testid={testId} padding={3} radius={2} tone="caution">
      <Text size={1}>{children}</Text>
    </Card>
  )
}

/**
 * A live preview of the tour, mapped straight from the draft document — see
 * this module's doc comment for the registration story (opt-in via
 * `defaultDocumentNode`) and `draftToTour.ts`'s doc comment for what this
 * preview can't faithfully show (theme, LQIP, screenshot-less steps).
 *
 * @public
 */
export const GuidedTourPreviewView: UserViewComponent = (props) => {
  const {projectId, dataset} = useProjectDataset()
  const {tour, droppedStepCount} = draftToTour(props.document.displayed, projectId, dataset)

  // Outside a real Studio workspace (this component's own smoke tests, or
  // any render that isn't inside a `WorkspaceProvider` — see
  // `useProjectDataset.ts`'s module comment) there's no `projectId`/
  // `dataset` to build a CDN URL from, so `draftToTour` drops every step
  // regardless of how many the document actually has. That's a materially
  // different situation from "this tour genuinely has no screenshots yet"
  // (the per-step-count notice below), so it gets its own, more specific
  // notice instead of being folded into `droppedStepCount`.
  const noWorkspaceContext = projectId === null || dataset === null

  return (
    <Stack gap={3} padding={3}>
      {noWorkspaceContext && (
        <Notice testId="preview-no-context">
          Preview can't resolve screenshot images outside a running Studio workspace.
        </Notice>
      )}
      {!noWorkspaceContext && droppedStepCount > 0 && (
        <Notice testId="preview-dropped-steps">
          {droppedStepCount} step{droppedStepCount === 1 ? '' : 's'} without a screenshot{' '}
          {droppedStepCount === 1 ? "isn't" : "aren't"} shown in this preview.
        </Notice>
      )}
      <Box style={{minHeight: 0}}>
        <GuidedTour tour={tour} />
      </Box>
    </Stack>
  )
}
