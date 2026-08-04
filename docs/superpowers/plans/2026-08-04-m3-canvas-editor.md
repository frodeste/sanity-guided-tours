# M3 — Canvas Editor: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authoring becomes the product: a three-pane visual editor (filmstrip / canvas / inspector) mounted as the `chapters` field input, with bulk screenshot upload and a live Preview document view — a 10-step tour authorable start-to-finish without touching the plain form.

**Architecture:** Pure logic first (`geometry.ts`, `patches.ts`, `bulkUpload.ts` — TDD), Studio UI on top (render smoke tests only, per the master plan's testing§). The editor is a Sanity **object input component** for the `chapters` field (spec §7.1): the inspector renders the *real* Sanity member inputs via the form-builder's member rendering, so Portable Text, validation, presence and undo come from the platform. A "Open full editor" button expands the same three panes into a full-screen Sanity UI dialog. The Preview document view renders the draft through the real `/react` viewer.

**Tech Stack:** `sanity` ^6.8 form-builder APIs (`ObjectInputProps`, `ArrayOfObjectsInputProps`, member rendering via `props.renderInput`/`renderField`/`renderItem`, `useFormValue`, `useClient`, `PatchEvent`/`set`/`unset`/`insert`/`setIfMissing`), `@sanity/ui` ^3.5 primitives, `styled-components` (Studio side only — allowed there), Bun test + happy-dom smoke tests.

## Global Constraints

- Studio code lives under `src/studio/`; it MAY import `sanity`, `@sanity/ui`, `styled-components`. It must NEVER be imported from `src/react/` or `src/queries/` (guard test).
- All document mutations flow through Sanity form patches (`PatchEvent` / `props.onChange`) built by `src/studio/patches.ts` — no direct client mutations in the editor. (The bulk-upload asset creation uses `useClient` for asset uploads only; document changes still go through patches.)
- Percentage positioning invariant: x/y stored 0–100 with 1-decimal precision (`Math.round(v * 10) / 10`); clamping in geometry, not scattered.
- Keyboard nudge: arrows 0.5, Shift+arrows 5 (percentage points).
- `_key` generation: use a `randomKey()` helper (crypto.randomUUID-based, 12-char slice) — single definition in `src/studio/keys.ts`.
- No `as` casts (oxlint); tracker-style RefObject patterns for anything read in handlers.
- Conventional commits; PR-per-feature; CI + Claude-review threads resolved before merge.
- The M1/M2 facts hold (memory `guided-tours-m1-execution-facts`): build-script literal, `use client` banner (react entry only — studio entry needs NO banner), etc.
- Spec is authoritative: `docs/superpowers/specs/2026-08-04-guided-tours-plugin-design.md` §7.

## File structure (target)

```
src/studio/
  keys.ts                randomKey()                                  [pure]
  geometry.ts            px↔%, clamp, hit-test, nudge                 [pure]
  patches.ts             element/step/chapter patch builders          [pure]
  bulkUpload.ts          File[] → ordered step scaffolds              [pure]
  CanvasInput.tsx        chapters field input — three-pane shell + dialog
  Canvas.tsx             screenshot + draggable elements + tools
  CanvasElement.tsx      one positioned element (drag/nudge/select)
  Filmstrip.tsx          chapter-grouped step thumbnails + DnD + menus
  Inspector.tsx          selected element/step via real member inputs
  PreviewView.tsx        document view rendering /react viewer
  useEditorState.ts      selection {chapterKey, stepKey, elementKey|null}, device toggle
src/index.ts             registers the input component + preview view via plugin config
test/studio/             geometry.test.ts, patches.test.ts, bulkUpload.test.ts,
                         smoke.test.tsx (render smoke for the UI components)
```

---

### Task 1: keys.ts + geometry.ts

**Files:** Create `src/studio/keys.ts`, `src/studio/geometry.ts`; Test `test/studio/geometry.test.ts`

**Interfaces (produces):**
```ts
// keys.ts
export function randomKey(): string          // 12 lowercase hex/alnum chars from crypto.randomUUID

// geometry.ts
export interface Rect { left: number; top: number; width: number; height: number }
export function pointToPercent(clientX: number, clientY: number, rect: Rect): {x: number; y: number}
  // relative to rect, clamped 0–100, 1-decimal rounding
export function clampPercent(v: number): number              // 0–100, 1-decimal
export function nudge(value: number, direction: -1 | 1, big: boolean): number
  // ±0.5 or ±5, clamped, 1-decimal
export function hitTest(elements: {_key: string; x: number; y: number}[], x: number, y: number, tolerancePercent: number): string | null
  // nearest element _key within tolerance (Euclidean, percent space), else null
export function nearestKey(elements: {_key: string; x: number; y: number}[], x: number, y: number): string | null
```

TDD: rect at offset (letterboxed canvas — rect.left/top nonzero); pointer outside rect clamps; rounding to 1 decimal; nudge at bounds (99.8 + 0.5 → 100); nudge big; hitTest picks nearest within tolerance, null outside; ties broken by first-in-array; empty arrays.

- [ ] Failing tests → implement → green → commit `feat: canvas geometry and key helpers`

### Task 2: patches.ts

**Files:** Create `src/studio/patches.ts`; Test `test/studio/patches.test.ts`

**Interfaces (produces):** All builders return `PatchEvent`-compatible arrays of patch objects (`import {set, unset, insert, setIfMissing} from 'sanity'` — these are plain data constructors usable in tests without a Studio). Paths are keyed segments: `[{_key: chapterKey}, 'steps', {_key: stepKey}, 'elements', {_key: elementKey}]` relative to the `chapters` array field the input owns.

```ts
export function insertElementPatch(chapterKey: string, stepKey: string, element: {_type: string; _key: string; x: number; y: number} & Record<string, unknown>): unknown[]
export function moveElementPatch(chapterKey: string, stepKey: string, elementKey: string, pos: {x: number; y: number}, device: 'desktop' | 'mobile'): unknown[]
  // desktop → set x/y; mobile → setIfMissing mobile {} then set mobile.x/mobile.y
export function setElementWidthPatch(chapterKey: string, stepKey: string, elementKey: string, width: number, device: 'desktop' | 'mobile'): unknown[]
export function removeElementPatch(chapterKey: string, stepKey: string, elementKey: string): unknown[]
export function insertStepPatch(chapterKey: string, step: Record<string, unknown>, afterStepKey: string | null): unknown[]   // null → append at end (insert after last / into empty)
export function duplicateStepPatch(chapterKey: string, step: Record<string, unknown>, newKey: string, elementKeyGen: () => string): unknown[]
  // deep-copies the step, regenerating _key on step AND every element (and any nested arrays)
export function removeStepPatch(chapterKey: string, stepKey: string): unknown[]
export function moveStepPatch(fromChapterKey: string, stepKey: string, step: Record<string, unknown>, toChapterKey: string, afterStepKey: string | null): unknown[]
  // remove from source + insert into target preserving the step object identically (SAME _keys — it's a move)
export function insertChapterPatch(chapter: Record<string, unknown>, afterChapterKey: string | null): unknown[]
export function setStepFieldPatch(chapterKey: string, stepKey: string, field: string, value: unknown): unknown[]
```

TDD: exact patch shapes (type/path/value) asserted with `toEqual`; cross-chapter move preserves `_key`s; duplicate regenerates every `_key` (assert no key from the source survives); mobile move creates the object before setting members; append-to-empty semantics.

- [ ] Failing tests → implement → green → commit `feat: canvas patch builders`

### Task 3: bulkUpload.ts

**Files:** Create `src/studio/bulkUpload.ts`; Test `test/studio/bulkUpload.test.ts`

**Interfaces (produces):**
```ts
export interface UploadedAsset { fileName: string; assetId: string }
export function filesInUploadOrder(files: {name: string}[]): {name: string}[]
  // natural sort: img2 < img10 (numeric-aware, case-insensitive, locale-stable via localeCompare with numeric: true)
export function stepsFromAssets(assets: UploadedAsset[], keyGen: () => string): Record<string, unknown>[]
  // one guidedTourStep object per asset in given order: {_type:'guidedTourStep', _key, screenshot: {_type:'image', asset:{_type:'reference', _ref: assetId}}, elements: []}
export function partitionResults<T>(results: PromiseSettledResult<T>[]): {ok: T[]; failed: number}
```

TDD: natural ordering (1,2,10 not 1,10,2; mixed case; non-numeric names alphabetical); step scaffolds shape; partition counts; empty input.

- [ ] Failing tests → implement → green → commit `feat: bulk upload ordering and step scaffolds`

### Task 4: Editor state + CanvasInput shell + dialog

**Files:** Create `src/studio/useEditorState.ts`, `src/studio/CanvasInput.tsx`; Modify `src/plugin.ts` + `src/schema/guidedTour.ts` (wire `components: {input: CanvasInput}` onto the chapters field via the document factory — keep it behind the existing config, no new flag); Test `test/studio/smoke.test.tsx` (start it)

**Interfaces (produces):**
```ts
// useEditorState.ts
export interface EditorSelection { chapterKey: string | null; stepKey: string | null; elementKey: string | null }
export function useEditorState(chapters: unknown[]): {
  selection: EditorSelection
  selectStep(chapterKey: string, stepKey: string): void      // clears elementKey
  selectElement(elementKey: string | null): void
  device: 'desktop' | 'mobile'
  setDevice(d: 'desktop' | 'mobile'): void
  expanded: boolean
  setExpanded(b: boolean): void
}
// auto-heals: if the selected keys vanish from chapters (undo/remote edit), selection falls back to first step/null.
```

`CanvasInput` is the input component for the `chapters` array field (`ArrayOfObjectsInputProps`): renders a three-pane layout (Filmstrip | Canvas | Inspector placeholders for Tasks 5–7 — this task renders panes with minimal content: filmstrip = flat step list with titles, canvas = selected step's screenshot `<img>`, inspector = "select an element"), a header toolbar (device toggle, "Open full editor" button), and when `expanded` a full-screen `@sanity/ui` `Dialog` (width `"auto"`, `height="fill"` styling) containing the same three panes (single component instance — the dialog renders the same JSX tree, state carries over). The collapsed inline variant must also render the DEFAULT array input below in a collapsible "Plain editor" details section using `props.renderDefault(props)` — this is the plain-form escape hatch surfaced in-place (the Editor-tab form remains untouched anyway).

Smoke tests: renders with a fixture value (2 chapters/3 steps) inside a minimal mock of ArrayOfObjectsInputProps (value + onChange spy + renderDefault stub); step selection updates which screenshot shows; device toggle flips; expand opens dialog (portal — assert via screen queries); no crash with empty value.

**Studio-test caveat:** if `sanity`'s form-builder imports drag in Studio context providers that explode under happy-dom, wrap fixtures in `@sanity/ui`'s `ThemeProvider` (studioTheme); if it still explodes, mock at module boundary with `mock.module('sanity', ...)` from bun:test — record what was needed. If bun's module mocking proves unreliable here (M1 risk note), split these smoke tests into a Vitest sub-run for test/studio only per the master plan's fallback — do NOT contort.

- [ ] Smoke tests → implement → green → commit `feat: canvas input shell with three panes and dialog`

### Task 5: Canvas interactions

**Files:** Create `src/studio/Canvas.tsx`, `src/studio/CanvasElement.tsx`; Modify `src/studio/CanvasInput.tsx`; Test extend `test/studio/smoke.test.tsx` + `test/studio/canvasHandlers.test.ts` (pure handler logic where extractable)

Behavior:
- Canvas renders the selected step's screenshot (device-aware: `screenshotMobile ?? screenshot` when device='mobile') at natural aspect, `position: relative`, with a `ref`ed wrapper measured via `getBoundingClientRect` on demand (no ResizeObserver needed — measure in the pointer handlers).
- Tool palette (Sanity UI `Button`s): Select / +Hotspot / +Tooltip / +TextOverlay. With a +tool active, canvas click → `insertElementPatch` at `pointToPercent` position with type-appropriate defaults (hotspot: action advance, pulse true; tooltip: width 300, placement auto, trigger click, content []; textOverlay: width 30, background surface, opacity 90, content []) → `onChange(PatchEvent.from(...))` → tool resets to Select → new element selected.
- Elements render as absolutely positioned chips (type icon + drag handle): pointerdown starts drag (setPointerCapture), pointermove → live local position state (no patch per move), pointerup → single `moveElementPatch` (device-aware: writes mobile override members when device='mobile').
- Selected element: arrow keys nudge (geometry.nudge; Shift = big) → `moveElementPatch` per keypress (device-aware); Delete/Backspace → `removeElementPatch`; Escape deselects. Keyboard attached to the focused element chip (`tabIndex=0`, `role="button"`, accessible name = element type + label/content snippet).
- Width resize for tooltip/textOverlay: a right-edge handle; drag → local state → pointerup `setElementWidthPatch` (device-aware for mobile width override).
- Mobile device mode: elements position from `mobile.x ?? x` etc.; a small badge shows which elements carry overrides.

Tests: pure extraction — a `dragReducer`/handler module if it keeps logic testable; smoke: click-with-tool calls onChange with an insert patch (assert patch shape via the spy); nudge on selected element produces move patch; delete produces remove patch. (Full drag simulation not required — master plan: smoke only for Studio UI.)

- [ ] Tests → implement → green → commit `feat: canvas placement, drag, nudge and resize`

### Task 6: Filmstrip

**Files:** Create `src/studio/Filmstrip.tsx`; Modify `src/studio/CanvasInput.tsx`; Test extend smoke

Behavior: vertical list grouped by chapter (chapter title header with add-step + add-chapter buttons); step rows show thumbnail (screenshot CDN url + `?w=160`), title/index, element-count badge, validation warning marker (from `props.validation`/member validation if cheaply available — else a presence-of-required-fields check: screenshot missing → warning; record which). Selection highlight. Per-step menu (`MenuButton`): Duplicate (duplicateStepPatch with regenerated keys), Delete (removeStepPatch with confirm dialog), Move to chapter ▸ (list of other chapters → moveStepPatch append). Reorder within a chapter via up/down menu items + drag (HTML5 draggable with `insert`-based move patches); cross-chapter moves via the menu only (drag-across is a stretch, skip — record as deferred).

Tests: smoke — renders groups; duplicate menu action fires onChange with regenerated keys (spy + inspect); delete confirm flow; add step appends.

- [ ] Tests → implement → green → commit `feat: filmstrip with chapter grouping and step management`

### Task 7: Inspector via real member inputs

**Files:** Create `src/studio/Inspector.tsx`; Modify `src/studio/CanvasInput.tsx`; Test extend smoke

Behavior: when an element is selected, render THAT element's real Sanity form: from the `ArrayOfObjectsInputProps.members` tree, drill to the chapter member → steps array → step member → elements array → element member, and render it with `props.renderInput`/`renderItem`/`renderField` (the members carry their own render delegates — use the documented member-rendering pattern: `<MemberItem member={...}>` equivalents from `sanity` — investigate the exact public API: `ObjectInputMember` / member rendering via `props.renderDefault` on a scoped subtree is acceptable if drilling is fragile; the REQUIREMENT is that PT editing, validation display and presence come from the platform, not re-implementation). When no element selected but a step is: render the step's scalar fields (title, advance, duration, notes) the same way. Fallback: if member drilling proves unstable across sanity minor versions, render the DEFAULT input for the selected element's parent array scoped into a dialog via Sanity's own item-open mechanism (`onItemOpen`/path focus) — document the chosen mechanism and its tradeoff in the report.

Tests: smoke — selecting an element renders an inspector region containing the element's field labels (mock members tree fixtures will be involved; keep assertions loose — presence of the pane and delegation calls, not pixel detail).

- [ ] Tests → implement → green → commit `feat: inspector renders real member inputs`

### Task 8: Bulk upload drop zone + PreviewView + registration

**Files:** Create `src/studio/PreviewView.tsx`; Modify `src/studio/Filmstrip.tsx` (drop zone), `src/index.ts` + `src/plugin.ts` (export a `guidedTourPreviewView` helper for structure builders + document the default-registration story), README deferred to M5.

Behavior:
- Drop zone on the filmstrip (chapter header or footer target): drag-over highlight; on drop of image files → `filesInUploadOrder` → sequential `client.assets.upload('image', file)` via `useClient({apiVersion: '2026-08-01'})` with per-file progress (Sanity UI `Spinner`/text `n/m`), `Promise.allSettled`-style isolation (partitionResults) → single `PatchEvent` inserting all successful `stepsFromAssets` scaffolds → toast (useToast) reporting ok/failed counts. Also an "Upload screenshots…" button (file input) for keyboard/no-drag users.
- `PreviewView.tsx`: a document view component (`(props: {document: {displayed}}) => JSX`) that maps the DRAFT document (displayed) through a local mapper mimicking the GROQ projection shape (images resolved via `@sanity/image-url`-free manual CDN URL construction? NO — inside the Studio we DO have a client: use `useClient` + the documented `getImageDimensions`/URL builder from asset _ref parsing: implement a tiny `assetRefToUrl(ref, projectId, dataset)` pure helper (ref format `image-<id>-<WxH>-<ext>`) with tests — no network) → `GuidedTourDoc`-shaped object → renders `<GuidedTour tour={mapped}/>` from `../react` with tokens preview using defaults. Missing screenshots render placeholders (mapper drops steps without screenshot, shows a notice).
- Export `guidedToursStructure` helper? NO (YAGNI) — export `GuidedTourPreviewView` component + document `defaultDocumentNode` usage in code comment; wire nothing by default (structure is the consumer's).

Tests: `assetRefToUrl` pure tests (parse ref, dimensions, format; malformed → null); mapper tests (draft doc → viewer shape incl. coalesced defaults mirroring the projection — reuse constants; steps without screenshots dropped with count); smoke render of PreviewView with fixture draft.

- [ ] Tests → implement → green → commit `feat: bulk screenshot upload and live preview view`

---

## PR grouping

| PR | Tasks | Closes |
|---|---|---|
| feat: canvas editor logic core | 1, 2, 3 | #57 #58 #59 #69, #13 #14, part of #19 |
| feat: canvas input shell and interactions | 4, 5 | #60 #61 #62 #63 #64, #15 #16 |
| feat: filmstrip, inspector, upload, preview | 6, 7, 8 | #65 #66 #67 #68 #70 #71, #17 #18 #19 #20 |

## Verification (milestone definition of done)

- CI green; suite grows with pure-logic coverage; Studio components smoke-tested.
- Live authoring walkthrough (10-step tour start-to-finish without the plain form) **requires a running Studio with a dataset — #43 gates this**, as it gates M2's live check. If still blocked at M3 end: record the gap on #15/#16 and demo via the plain form remaining functional (escape-hatch guarantee) once access lands.
- The plain Sanity form remains fully functional (spec §7.5) — CanvasInput renders `renderDefault` as the in-place escape hatch and the Editor tab is untouched.
