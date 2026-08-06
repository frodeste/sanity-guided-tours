// The fixture "tour being edited" every capture state renders — real
// `CanvasInput`/`GuidedTourPreviewView` components, fed a plain in-memory
// value so the harness never depends on a running Studio (`entry.tsx`'s
// module comment). Screenshot images inside these captures are the ALREADY
// SEEDED `sample-tour` demo's own asset refs, fetched live from the public
// demo dataset (`build.ts`'s `fetchDemoAssetRefs`) and inlined at bundle
// time — real `cdn.sanity.io` thumbnails, not broken links or placeholders,
// per the task brief's "prefer the live CDN" call.
//
// `chapters` (the plain value `CanvasInput`'s `value` prop takes) and
// `members` (the real Sanity form member tree `Inspector.tsx` walks) are
// built from ONE shared list of typed fixture records below so the two
// can't drift apart — the same risk `test/studio/smoke.test.tsx`'s own
// module comment flags for its near-identical `buildMembers`, whose
// chapter/step/element-item shape this mirrors (kept local here rather than
// imported: it's `test/`-only code, not exported).
import type {
  ArrayOfObjectsInputProps,
  ArrayOfObjectsItemMember,
  ArrayOfObjectsMember,
  FieldMember,
  ObjectArrayFormNode,
  ObjectMember,
} from 'sanity'

// Injected by `build.ts` via `Bun.build`'s `define` — a JSON-encoded
// `{step1, step2, step3}` of real `image-<id>-<w>x<h>-<ext>` refs queried
// live from the public demo dataset just before bundling. `declare`d rather
// than imported: there's no module backing this identifier, `define` is a
// textual substitution the bundler performs at build time (same mechanism
// `process.env.NODE_ENV` replacement uses in most bundlers).
declare const __DEMO_ASSET_REFS_JSON__: string

export interface DemoAssetRefs {
  step1: string
  step2: string
  step3: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Narrows the `JSON.parse`d (so `any`-typed) build-time constant down to `DemoAssetRefs`, or throws — same `isRecord`-narrowing convention this whole codebase uses rather than an unsafe cast off `JSON.parse`'s `any`. Throwing (not returning `null`) is deliberate: a malformed value here means `build.ts`'s `define` step is broken, which every capture state depends on — there's no useful degraded rendering to fall back to. */
export function demoAssetRefs(): DemoAssetRefs {
  const parsed: unknown = JSON.parse(__DEMO_ASSET_REFS_JSON__)
  if (
    isRecord(parsed) &&
    typeof parsed.step1 === 'string' &&
    typeof parsed.step2 === 'string' &&
    typeof parsed.step3 === 'string'
  ) {
    return {step1: parsed.step1, step2: parsed.step2, step3: parsed.step3}
  }
  throw new Error('__DEMO_ASSET_REFS_JSON__ did not decode to {step1, step2, step3} strings')
}

function plainTextBlock(key: string, text: string): unknown[] {
  return [
    {
      _key: `${key}-block`,
      _type: 'block',
      style: 'normal',
      children: [{_key: `${key}-span`, _type: 'span', text}],
    },
  ]
}

function image(ref: string, alt: string): Record<string, unknown> {
  return {_type: 'image', asset: {_type: 'reference', _ref: ref}, alt}
}

/** Every fixture chapter/step/element carries a real `_key`, by construction below — this alias lets `canvasInputProps` hand its `value` prop straight to `ArrayOfObjectsInputProps['value']` (at its default `{_key: string}` generic) with no unsafe cast, while every internal helper here still narrows from `unknown` per this module's own convention. */
type FixtureChapter = {_key: string} & Record<string, unknown>

/**
 * The fixture `chapters` value: 2 chapters, 4 steps, reusing the demo's 3
 * real screenshots — enough variety (an empty step, a step needing
 * attention, elements of all three kinds) that every capture state has
 * something real to show without needing a 5th unique screenshot just for
 * this inner fixture.
 */
export function fixtureChapters(refs: DemoAssetRefs): FixtureChapter[] {
  return [
    {
      _key: 'c1',
      _type: 'guidedTourChapter',
      title: 'Getting started',
      description: 'The first things a new user sees.',
      steps: [
        {
          _key: 's1',
          _type: 'guidedTourStep',
          title: 'Welcome',
          advance: 'hotspot',
          screenshot: image(refs.step1, 'Product welcome screen with a highlighted action'),
          elements: [
            {
              _key: 'h1',
              _type: 'guidedTourHotspot',
              x: 28,
              y: 55,
              label: 'Continue',
              action: 'advance',
              pulse: true,
            },
            {
              _key: 't1',
              _type: 'guidedTourTooltip',
              x: 70,
              y: 30,
              width: 280,
              placement: 'left',
              trigger: 'click',
              content: plainTextBlock('t1', 'Click the highlighted button to get started.'),
            },
          ],
        },
        {
          _key: 's2',
          _type: 'guidedTourStep',
          title: 'Your dashboard',
          advance: 'button',
          screenshot: image(refs.step2, 'Dashboard overview with key metrics'),
          elements: [
            {
              _key: 'o1',
              _type: 'guidedTourTextOverlay',
              x: 55,
              y: 20,
              width: 32,
              background: 'accent',
              opacity: 92,
              content: plainTextBlock('o1', 'Everything about your account, at a glance.'),
            },
          ],
        },
      ],
    },
    {
      _key: 'c2',
      _type: 'guidedTourChapter',
      title: 'Wrap-up',
      description: 'Confirming setup and pointing to what is next.',
      steps: [
        {
          _key: 's3',
          _type: 'guidedTourStep',
          title: "You're all set",
          advance: 'auto',
          duration: 6,
          screenshot: image(refs.step3, 'Settings screen confirming setup is complete'),
          elements: [
            {
              _key: 'h2',
              _type: 'guidedTourHotspot',
              x: 50,
              y: 45,
              label: 'Learn more',
              action: 'link',
              href: 'https://example.com/docs',
              pulse: false,
            },
          ],
        },
        {
          // Deliberately screenshot-less, no elements: the filmstrip's own
          // "needs attention" heuristic (`Filmstrip.tsx`) flags this row,
          // giving the filmstrip-focused captures a second, visibly
          // different row rather than every step looking equally finished.
          _key: 's4',
          _type: 'guidedTourStep',
          title: 'One more thing',
          advance: 'button',
          elements: [],
        },
      ],
    },
  ]
}

// --- matching `ArrayOfObjectsMember[]` member tree (Inspector.tsx) ------
// Mirrors `test/studio/smoke.test.tsx`'s `buildMembers`/`chapterItemMember`/
// `stepItemMember`/`elementItemMember` — see that file's own module comment
// for why every node fills in the full real `sanity` shape rather than a
// hand-picked subset.

function keyOfFixture(value: unknown): string {
  return isRecord(value) && typeof value._key === 'string' ? value._key : 'missing'
}

function asKeyedRecord(value: unknown, key: string): {_key: string} & Record<string, unknown> {
  return isRecord(value) ? {...value, _key: key} : {_key: key}
}

function objectArrayFormNode(
  path: (string | {_key: string})[],
  value: {_key: string} & Record<string, unknown>,
  members: ObjectMember[],
): ObjectArrayFormNode {
  return {
    id: 'x',
    schemaType: {name: 'x', jsonType: 'object', fields: []},
    level: 0,
    path,
    presence: [],
    validation: [],
    value,
    focusPath: [],
    groups: [],
    members,
    __unstable_computeDiff: () => ({
      type: 'null',
      action: 'unchanged',
      isChanged: false,
      fromValue: null,
      toValue: null,
    }),
    changed: false,
    compareValue: undefined,
    hasUpstreamVersion: false,
  }
}

function arrayFieldMember(name: string, members: ArrayOfObjectsMember[]): FieldMember {
  const field = objectArrayFormNode([], {_key: 'field'}, [])
  const fieldWithMembers = {...field, members}
  return {
    kind: 'field',
    key: name,
    name,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: false,
    inSelectedGroup: true,
    groups: [],
    path: [],
    field: fieldWithMembers,
  }
}

function elementItemMember(
  chapterKey: string,
  stepKey: string,
  element: unknown,
): ArrayOfObjectsItemMember {
  const key = keyOfFixture(element)
  return {
    kind: 'item',
    key,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: false,
    parentSchemaType: {name: 'elements', jsonType: 'array', of: []},
    item: objectArrayFormNode(
      [{_key: chapterKey}, 'steps', {_key: stepKey}, 'elements', {_key: key}],
      asKeyedRecord(element, key),
      [],
    ),
  }
}

function stepItemMember(chapterKey: string, step: unknown): ArrayOfObjectsItemMember {
  const key = keyOfFixture(step)
  const elements = isRecord(step) && Array.isArray(step.elements) ? step.elements : []
  const elementsField = arrayFieldMember(
    'elements',
    elements.map((element) => elementItemMember(chapterKey, key, element)),
  )
  return {
    kind: 'item',
    key,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: false,
    parentSchemaType: {name: 'steps', jsonType: 'array', of: []},
    item: objectArrayFormNode(
      [{_key: chapterKey}, 'steps', {_key: key}],
      asKeyedRecord(step, key),
      [elementsField],
    ),
  }
}

function chapterItemMember(chapter: unknown): ArrayOfObjectsItemMember {
  const key = keyOfFixture(chapter)
  const steps = isRecord(chapter) && Array.isArray(chapter.steps) ? chapter.steps : []
  const stepsField = arrayFieldMember(
    'steps',
    steps.map((step) => stepItemMember(key, step)),
  )
  return {
    kind: 'item',
    key,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: false,
    parentSchemaType: {name: 'chapters', jsonType: 'array', of: []},
    item: objectArrayFormNode([{_key: key}], asKeyedRecord(chapter, key), [stepsField]),
  }
}

// File-local (M9 Task 2, `bunx knip`): only used by the exported fixture
// below in this same file — nothing outside this module imports it.
function fixtureMembers(chapters: unknown[]): ArrayOfObjectsMember[] {
  return chapters.map(chapterItemMember)
}

/**
 * A fully valid `ArrayOfObjectsInputProps` — same "fixture matches the
 * platform's full contract" convention `smoke.test.tsx`'s `baseInputProps()`
 * establishes, so `CanvasInput` (which calls `props.renderDefault(props)`
 * for its "Plain editor" escape hatch) never sees a partial props object.
 * `onChange` is a deliberate no-op: see `entry.tsx`'s module comment for why
 * no capture state needs a mutation to actually land.
 */
export function canvasInputProps(chapters: FixtureChapter[]): ArrayOfObjectsInputProps {
  return {
    id: 'chapters',
    schemaType: {name: 'chapters', jsonType: 'array', of: []},
    level: 0,
    path: [],
    presence: [],
    validation: [],
    value: chapters,
    focusPath: [],
    members: fixtureMembers(chapters),
    __unstable_computeDiff: () => ({
      type: 'null',
      action: 'unchanged',
      isChanged: false,
      fromValue: null,
      toValue: null,
    }),
    changed: false,
    hasUpstreamVersion: false,
    onChange: () => {},
    onItemAppend: () => {},
    onItemPrepend: () => {},
    onItemRemove: () => {},
    onItemMove: () => {},
    onInsert: () => {},
    resolveInitialValue: () => Promise.resolve({_key: 'x'}),
    resolveUploader: () => null,
    onPathFocus: () => {},
    onItemCollapse: () => {},
    onItemExpand: () => {},
    onItemOpen: () => {},
    onItemClose: () => {},
    renderField: () => null,
    renderInput: () => null,
    renderItem: () => null,
    renderPreview: () => null,
    elementProps: {
      'id': 'chapters',
      'onFocus': () => {},
      'onBlur': () => {},
      'ref': {current: null},
      'aria-describedby': undefined,
      'style': {},
    },
    renderDefault: () => <></>,
    displayInlineChanges: false,
  }
}

/**
 * The `document.displayed` fixture for `GuidedTourPreviewView` — a small,
 * finished-looking tour (title/outro included) so the "preview" capture
 * shows a real, complete-feeling viewer experience rather than a bare first
 * step. Reuses the same real demo screenshots as `fixtureChapters` above.
 */
export function previewFixtureDocument(refs: DemoAssetRefs): Record<string, unknown> {
  return {
    _id: 'preview-fixture',
    _type: 'guidedTour',
    title: 'How to build a guided tour',
    slug: {current: 'how-to-build-tours'},
    chapters: [
      {
        _type: 'guidedTourChapter',
        _key: 'pc1',
        title: 'Getting started',
        steps: [
          {
            _type: 'guidedTourStep',
            _key: 'ps1',
            title: 'Welcome',
            advance: 'button',
            screenshot: image(refs.step1, 'Product welcome screen with a highlighted action'),
            elements: [
              {
                _key: 'ph1',
                _type: 'guidedTourHotspot',
                x: 28,
                y: 55,
                label: 'Continue',
                action: 'advance',
                pulse: true,
              },
              {
                _key: 'pt1',
                _type: 'guidedTourTooltip',
                x: 70,
                y: 30,
                width: 280,
                placement: 'left',
                trigger: 'click',
                content: plainTextBlock('pt1', 'This is what viewers actually see.'),
              },
            ],
          },
        ],
      },
    ],
  }
}
