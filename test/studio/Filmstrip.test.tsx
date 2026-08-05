import {afterEach, describe, expect, mock, test} from 'bun:test'

// Direct render tests for `Filmstrip` (as opposed to `smoke.test.tsx`, which
// only ever exercises it through `CanvasInput`). Like `Canvas.test.tsx`,
// this renders the component standalone with plain callback spies
// (`StepMutationCallbacks`) — `Filmstrip` never builds patches itself, it
// only ever reports intent upward (see `Filmstrip.tsx`'s module comment),
// so these tests assert on which callback fired with which arguments, not
// on any `PatchEvent`/`onChange` shape (that's `patches.test.ts`'s and
// `smoke.test.tsx`'s job).
import {LayerProvider, ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import type {ReactNode} from 'react'

import type {UploadedAsset} from '../../src/studio/bulkUpload'
import {
  Filmstrip,
  type FilmstripProps,
  type StepMutationCallbacks,
} from '../../src/studio/Filmstrip'
import type {EditorSelection} from '../../src/studio/useEditorState'

afterEach(() => {
  cleanup()
})

const theme = buildTheme()

function renderWithTheme(ui: ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <LayerProvider>{ui}</LayerProvider>
    </ThemeProvider>,
  )
}

// --- fixtures ------------------------------------------------------------

interface FixtureImage {
  _type: 'image'
  asset: {_type: 'reference'; _ref: string}
  alt?: string
}

function image(ref: string, alt?: string): FixtureImage {
  return alt === undefined
    ? {_type: 'image', asset: {_type: 'reference', _ref: ref}}
    : {_type: 'image', asset: {_type: 'reference', _ref: ref}, alt}
}

function step(overrides: {
  _key: string
  title?: string
  screenshot?: FixtureImage
  elements?: unknown[]
}) {
  return {_type: 'guidedTourStep', elements: [], ...overrides}
}

function chapter(overrides: {_key: string; title?: string; steps: unknown[]}) {
  return {_type: 'guidedTourChapter', ...overrides}
}

function twoChapterFixture() {
  return [
    chapter({
      _key: 'c1',
      title: 'Intro',
      steps: [
        step({
          _key: 's1',
          title: 'Welcome',
          screenshot: image('image-aaa-800x600-png', 'Welcome screenshot'),
          elements: [
            {_type: 'guidedTourHotspot', _key: 'e1', x: 10, y: 10},
            {_type: 'guidedTourHotspot', _key: 'e2', x: 20, y: 20},
          ],
        }),
        step({
          _key: 's2',
          title: 'Features',
          screenshot: image('image-bbb-800x600-png', 'Features screenshot'),
        }),
      ],
    }),
    chapter({
      _key: 'c2',
      title: 'Advanced',
      steps: [
        step({
          _key: 's3',
          title: 'Wrap up',
          screenshot: image('image-ccc-800x600-png', 'Wrap up screenshot'),
        }),
      ],
    }),
  ]
}

function noopSelection(): EditorSelection {
  return {chapterKey: 'c1', stepKey: 's1', elementKey: null}
}

function noopCallbacks(): StepMutationCallbacks {
  return {
    onAddStep: () => {},
    onAddChapter: () => {},
    onDuplicateStep: () => {},
    onDeleteStep: () => {},
    onReorderStep: () => {},
    onMoveStepToChapter: () => {},
  }
}

function baseProps(overrides: Partial<FilmstripProps> = {}): FilmstripProps {
  return {
    callbacks: noopCallbacks(),
    chapters: twoChapterFixture(),
    dataset: null,
    onSelectStep: () => {},
    onUploadBatch: () => {},
    projectId: null,
    selection: noopSelection(),
    uploader: null,
    ...overrides,
  }
}

function openStepMenu(chapterKey: string, stepKey: string): void {
  fireEvent.click(screen.getByTestId(`filmstrip-step-menu-${chapterKey}-${stepKey}`))
}

/** The "Move to chapter" `MenuGroup` is itself a nested submenu trigger — its target-chapter `MenuItem`s only mount once it's clicked open (verified empirically: `@sanity/ui`'s `MenuGroup` doesn't eagerly render its `menu` children). Call after `openStepMenu`. */
function openMoveToChapterSubmenu(): void {
  const trigger = screen.getByText('Move to chapter').closest('button')
  if (!trigger) throw new Error('expected the Move to chapter trigger to be a <button>')
  fireEvent.click(trigger)
}

describe('Filmstrip: grouping and rendering', () => {
  test('renders one group per chapter, with its steps nested under it', () => {
    renderWithTheme(<Filmstrip {...baseProps()} />)

    expect(screen.getByTestId('filmstrip-group-c1')).toBeTruthy()
    expect(screen.getByTestId('filmstrip-group-c2')).toBeTruthy()
    expect(screen.getByTestId('filmstrip-chapter-c1').textContent).toContain('Intro')
    expect(screen.getByTestId('filmstrip-chapter-c2').textContent).toContain('Advanced')

    expect(
      within(screen.getByTestId('filmstrip-group-c1')).getByTestId('filmstrip-step-c1-s1'),
    ).toBeTruthy()
    expect(
      within(screen.getByTestId('filmstrip-group-c1')).getByTestId('filmstrip-step-c1-s2'),
    ).toBeTruthy()
    expect(
      within(screen.getByTestId('filmstrip-group-c2')).getByTestId('filmstrip-step-c2-s3'),
    ).toBeTruthy()
    // s3 doesn't leak into c1's group.
    expect(
      within(screen.getByTestId('filmstrip-group-c1')).queryByTestId('filmstrip-step-c2-s3'),
    ).toBeNull()
  })

  test('shows the element-count badge per step', () => {
    renderWithTheme(<Filmstrip {...baseProps()} />)

    expect(screen.getByTestId('filmstrip-count-c1-s1').textContent).toContain('2 elements')
    expect(screen.getByTestId('filmstrip-count-c1-s2').textContent).toContain('0 elements')
  })

  test('highlights the selected step', () => {
    renderWithTheme(
      <Filmstrip
        {...baseProps({selection: {chapterKey: 'c1', stepKey: 's2', elementKey: null}})}
      />,
    )

    expect(screen.getByTestId('filmstrip-step-c1-s1').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('filmstrip-step-c1-s2').getAttribute('aria-pressed')).toBe('true')
  })

  test('clicking a step row calls onSelectStep', () => {
    const onSelectStep = mock((_chapterKey: string, _stepKey: string) => {})
    renderWithTheme(<Filmstrip {...baseProps({onSelectStep})} />)

    fireEvent.click(screen.getByTestId('filmstrip-step-c1-s2'))

    expect(onSelectStep).toHaveBeenCalledWith('c1', 's2')
  })

  test('renders "No steps yet." when there are no steps at all, with an add-chapter button', () => {
    const onAddChapter = mock((_afterChapterKey: string | null) => {})
    renderWithTheme(
      <Filmstrip
        {...baseProps({
          callbacks: {...noopCallbacks(), onAddChapter},
          chapters: [],
          selection: {chapterKey: null, stepKey: null, elementKey: null},
        })}
      />,
    )

    expect(screen.getByText('No steps yet.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('filmstrip-add-chapter-empty'))
    expect(onAddChapter).toHaveBeenCalledWith(null)
  })
})

describe('Filmstrip: the amended validation-warning heuristic', () => {
  test('warns when the screenshot is missing entirely', () => {
    const chapters = [chapter({_key: 'c1', steps: [step({_key: 's1', screenshot: undefined})]})]
    renderWithTheme(<Filmstrip {...baseProps({chapters})} />)

    expect(screen.getByTestId('filmstrip-warning-c1-s1')).toBeTruthy()
  })

  test('warns when the screenshot is present but alt is missing', () => {
    const chapters = [
      chapter({
        _key: 'c1',
        steps: [step({_key: 's1', screenshot: image('image-aaa-800x600-png')})],
      }),
    ]
    renderWithTheme(<Filmstrip {...baseProps({chapters})} />)

    expect(screen.getByTestId('filmstrip-warning-c1-s1')).toBeTruthy()
  })

  test('warns when alt is present but empty/whitespace', () => {
    const chapters = [
      chapter({
        _key: 'c1',
        steps: [step({_key: 's1', screenshot: image('image-aaa-800x600-png', '   ')})],
      }),
    ]
    renderWithTheme(<Filmstrip {...baseProps({chapters})} />)

    expect(screen.getByTestId('filmstrip-warning-c1-s1')).toBeTruthy()
  })

  test('no warning when screenshot and a non-empty alt are both present', () => {
    const chapters = [
      chapter({
        _key: 'c1',
        steps: [step({_key: 's1', screenshot: image('image-aaa-800x600-png', 'A screenshot')})],
      }),
    ]
    renderWithTheme(<Filmstrip {...baseProps({chapters})} />)

    expect(screen.queryByTestId('filmstrip-warning-c1-s1')).toBeNull()
  })
})

describe('Filmstrip: thumbnails', () => {
  test('renders a real <img> thumbnail with the w=160&auto=format params when projectId/dataset resolve', () => {
    renderWithTheme(<Filmstrip {...baseProps({dataset: 'production', projectId: 'proj123'})} />)

    const img = screen.getByTestId('filmstrip-thumbnail-c1-s1')
    expect(img.getAttribute('src')).toBe(
      'https://cdn.sanity.io/images/proj123/production/aaa-800x600.png?w=160&auto=format',
    )
  })

  test('falls back to a placeholder block when projectId/dataset are null', () => {
    renderWithTheme(<Filmstrip {...baseProps()} />)

    expect(screen.queryByTestId('filmstrip-thumbnail-c1-s1')).toBeNull()
    expect(screen.getByTestId('filmstrip-thumbnail-placeholder-c1-s1')).toBeTruthy()
  })
})

describe('Filmstrip: add step / add chapter per chapter header', () => {
  test("the add-step button calls onAddStep with that chapter's key", () => {
    const onAddStep = mock((_chapterKey: string) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onAddStep}})} />)

    fireEvent.click(screen.getByTestId('filmstrip-add-step-c2'))

    expect(onAddStep).toHaveBeenCalledWith('c2')
  })

  test("the add-chapter button calls onAddChapter with that chapter's key (inserts after it)", () => {
    const onAddChapter = mock((_afterChapterKey: string | null) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onAddChapter}})} />)

    fireEvent.click(screen.getByTestId('filmstrip-add-chapter-c1'))

    expect(onAddChapter).toHaveBeenCalledWith('c1')
  })
})

describe('Filmstrip: duplicate', () => {
  test('the Duplicate menu item calls onDuplicateStep with the chapter/step key', () => {
    const onDuplicateStep = mock((_chapterKey: string, _stepKey: string) => {})
    renderWithTheme(
      <Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onDuplicateStep}})} />,
    )

    openStepMenu('c1', 's1')
    fireEvent.click(screen.getByTestId('filmstrip-duplicate-c1-s1'))

    expect(onDuplicateStep).toHaveBeenCalledWith('c1', 's1')
  })
})

describe('Filmstrip: reorder up/down', () => {
  test('Move down on the first step targets index 1', () => {
    const onReorderStep = mock((_chapterKey: string, _stepKey: string, _targetIndex: number) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onReorderStep}})} />)

    openStepMenu('c1', 's1')
    fireEvent.click(screen.getByTestId('filmstrip-move-down-c1-s1'))

    expect(onReorderStep).toHaveBeenCalledWith('c1', 's1', 1)
  })

  test('Move up on the second step targets index 0', () => {
    const onReorderStep = mock((_chapterKey: string, _stepKey: string, _targetIndex: number) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onReorderStep}})} />)

    openStepMenu('c1', 's2')
    fireEvent.click(screen.getByTestId('filmstrip-move-up-c1-s2'))

    expect(onReorderStep).toHaveBeenCalledWith('c1', 's2', 0)
  })

  test('Move up is disabled on the first step of its chapter', () => {
    renderWithTheme(<Filmstrip {...baseProps()} />)

    openStepMenu('c1', 's1')

    const moveUp = screen.getByTestId('filmstrip-move-up-c1-s1')
    expect(moveUp.hasAttribute('disabled')).toBe(true)
  })

  test('Move down is disabled on the last step of its chapter', () => {
    renderWithTheme(<Filmstrip {...baseProps()} />)

    openStepMenu('c1', 's2')

    const moveDown = screen.getByTestId('filmstrip-move-down-c1-s2')
    expect(moveDown.hasAttribute('disabled')).toBe(true)
  })
})

describe('Filmstrip: HTML5 drag reorder', () => {
  test('dragging one step onto another within the SAME chapter fires onReorderStep at the drop target index', () => {
    const onReorderStep = mock((_chapterKey: string, _stepKey: string, _targetIndex: number) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onReorderStep}})} />)

    const source = screen.getByTestId('filmstrip-step-c1-s1')
    const target = screen.getByTestId('filmstrip-step-c1-s2')

    fireEvent.dragStart(source)
    fireEvent.dragOver(target)
    fireEvent.drop(target)

    expect(onReorderStep).toHaveBeenCalledWith('c1', 's1', 1)
  })

  // SDD ledger Parked-thread A / this file's module comment: cross-chapter
  // drag is a deliberate deferral (the Move-to-chapter menu is the path
  // instead) — dragging into a different chapter's list must never register
  // as a reorder.
  test('dragging across chapters never fires onReorderStep', () => {
    const onReorderStep = mock((_chapterKey: string, _stepKey: string, _targetIndex: number) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onReorderStep}})} />)

    const source = screen.getByTestId('filmstrip-step-c1-s1')
    const target = screen.getByTestId('filmstrip-step-c2-s3')

    fireEvent.dragStart(source)
    fireEvent.dragOver(target)
    fireEvent.drop(target)

    expect(onReorderStep).not.toHaveBeenCalled()
  })
})

describe('Filmstrip: delete confirm flow', () => {
  test("deleting a step that is NOT its chapter's last one shows a plain confirm, then calls onDeleteStep", () => {
    const onDeleteStep = mock((_chapterKey: string, _stepKey: string) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onDeleteStep}})} />)

    openStepMenu('c1', 's1')
    fireEvent.click(screen.getByTestId('filmstrip-delete-c1-s1'))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete "Welcome"?')).toBeTruthy()
    expect(onDeleteStep).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('filmstrip-confirm-confirm'))

    expect(onDeleteStep).toHaveBeenCalledWith('c1', 's1')
  })

  test('cancelling the confirm dialog never calls onDeleteStep', () => {
    const onDeleteStep = mock((_chapterKey: string, _stepKey: string) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onDeleteStep}})} />)

    openStepMenu('c1', 's1')
    fireEvent.click(screen.getByTestId('filmstrip-delete-c1-s1'))
    fireEvent.click(screen.getByTestId('filmstrip-confirm-cancel'))

    expect(onDeleteStep).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // SDD ledger Parked C ruling: deleting a chapter's LAST step warns that
  // the chapter will also be deleted, and confirming still routes through
  // the same onDeleteStep callback — CanvasInput.tsx's handler is the one
  // that turns "was this the last step" into `removeChapterPatch` instead
  // of `removeStepPatch`; this component only needs to get the wording and
  // the callback invocation right.
  test("deleting a chapter's LAST step warns the chapter will also be deleted", () => {
    const onDeleteStep = mock((_chapterKey: string, _stepKey: string) => {})
    renderWithTheme(<Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onDeleteStep}})} />)

    // c2 has exactly one step (s3).
    openStepMenu('c2', 's3')
    fireEvent.click(screen.getByTestId('filmstrip-delete-c2-s3'))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Advanced')
    expect(dialog.textContent).toContain('also delete the chapter')

    fireEvent.click(screen.getByTestId('filmstrip-confirm-confirm'))

    expect(onDeleteStep).toHaveBeenCalledWith('c2', 's3')
  })
})

describe('Filmstrip: move to chapter', () => {
  test("moving a step that is NOT its chapter's last one runs immediately, no confirm", () => {
    const onMoveStepToChapter = mock(
      (_fromChapterKey: string, _stepKey: string, _toChapterKey: string) => {},
    )
    renderWithTheme(
      <Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onMoveStepToChapter}})} />,
    )

    openStepMenu('c1', 's1')
    openMoveToChapterSubmenu()
    fireEvent.click(screen.getByTestId('filmstrip-move-to-c2-c1-s1'))

    expect(onMoveStepToChapter).toHaveBeenCalledWith('c1', 's1', 'c2')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // SDD ledger Parked C ruling: moving a chapter's LAST step warns (in the
  // confirm text) that the source chapter will also be removed, and only
  // calls onMoveStepToChapter after the author confirms.
  test("moving a chapter's LAST step to another chapter requires confirmation, warning the source chapter will be removed", () => {
    const onMoveStepToChapter = mock(
      (_fromChapterKey: string, _stepKey: string, _toChapterKey: string) => {},
    )
    renderWithTheme(
      <Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onMoveStepToChapter}})} />,
    )

    // c2 has exactly one step (s3) — moving it elsewhere would empty c2.
    openStepMenu('c2', 's3')
    openMoveToChapterSubmenu()
    fireEvent.click(screen.getByTestId('filmstrip-move-to-c1-c2-s3'))

    expect(onMoveStepToChapter).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Advanced')
    expect(dialog.textContent).toContain('also be deleted')

    fireEvent.click(screen.getByTestId('filmstrip-confirm-confirm'))

    expect(onMoveStepToChapter).toHaveBeenCalledWith('c2', 's3', 'c1')
  })

  test('cancelling the last-step move confirm never calls onMoveStepToChapter', () => {
    const onMoveStepToChapter = mock(
      (_fromChapterKey: string, _stepKey: string, _toChapterKey: string) => {},
    )
    renderWithTheme(
      <Filmstrip {...baseProps({callbacks: {...noopCallbacks(), onMoveStepToChapter}})} />,
    )

    openStepMenu('c2', 's3')
    openMoveToChapterSubmenu()
    fireEvent.click(screen.getByTestId('filmstrip-move-to-c1-c2-s3'))
    fireEvent.click(screen.getByTestId('filmstrip-confirm-cancel'))

    expect(onMoveStepToChapter).not.toHaveBeenCalled()
  })

  test('a step with no other chapters to move to omits the Move-to-chapter group', () => {
    const chapters = [chapter({_key: 'c1', steps: [step({_key: 's1'}), step({_key: 's2'})]})]
    renderWithTheme(
      <Filmstrip
        {...baseProps({chapters, selection: {chapterKey: 'c1', stepKey: 's1', elementKey: null}})}
      />,
    )

    openStepMenu('c1', 's1')

    expect(screen.queryByText('Move to chapter')).toBeNull()
  })
})

// Master plan Task 8 (ledger amendment): bulk screenshot upload — a drop
// zone plus an "Upload screenshots…" button on each chapter header. Uploads
// are strictly sequential (this file's/`Filmstrip.tsx`'s module comment); a
// fake `uploader` function prop is injected throughout (no `sanity`
// mocking needed for any of this — `Filmstrip` never calls `useClient()`
// itself), the same prop-injection convention `Canvas.test.tsx`/this file's
// other describe blocks use for `StepMutationCallbacks`.
describe('Filmstrip: bulk upload — no uploader (no Studio client available)', () => {
  test('renders no drop zone/upload button at all', () => {
    renderWithTheme(<Filmstrip {...baseProps({uploader: null})} />)

    expect(screen.queryByTestId('filmstrip-upload-button-c1')).toBeNull()
    expect(screen.queryByTestId('filmstrip-upload-input-c1')).toBeNull()
  })
})

function pngFile(name: string): File {
  return new File(['fake-image-bytes'], name, {type: 'image/png'})
}

/** A controllable fake uploader: each call is logged (by filename, in call order — the sequential-order proof) and returns a promise that stays pending until its matching entry in `pending` is resolved/rejected by the test. */
function makeControllableUploader(): {
  uploader: (file: File) => Promise<UploadedAsset>
  calls: string[]
  pending: {resolve: (asset: UploadedAsset) => void; reject: (error: unknown) => void}[]
} {
  const calls: string[] = []
  const pending: {resolve: (asset: UploadedAsset) => void; reject: (error: unknown) => void}[] = []
  const uploader = (file: File): Promise<UploadedAsset> => {
    calls.push(file.name)
    return new Promise((resolve, reject) => {
      pending.push({resolve, reject})
    })
  }
  return {uploader, calls, pending}
}

describe('Filmstrip: bulk upload — strictly sequential', () => {
  test('the second file is not uploaded until the first settles (call log proves one-in-flight, not a Promise.all)', async () => {
    const {uploader, calls, pending} = makeControllableUploader()
    renderWithTheme(<Filmstrip {...baseProps({uploader})} />)

    // Natural order (bulkUpload.ts's filesInUploadOrder): 'a.png' before 'b.png'.
    const files = [pngFile('b.png'), pngFile('a.png')]
    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {target: {files}})

    await waitFor(() => expect(calls).toEqual(['a.png']))
    expect(pending).toHaveLength(1)

    pending[0].resolve({fileName: 'a.png', assetId: 'asset-a'})

    await waitFor(() => expect(calls).toEqual(['a.png', 'b.png']))
  })

  test('progress text shows n/m, incrementing once per settled upload, then disappears', async () => {
    const {uploader, pending} = makeControllableUploader()
    renderWithTheme(<Filmstrip {...baseProps({uploader})} />)

    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {
      target: {files: [pngFile('a.png'), pngFile('b.png')]},
    })

    await waitFor(() =>
      expect(screen.getByTestId('filmstrip-upload-progress-c1').textContent).toBe('0/2'),
    )

    pending[0].resolve({fileName: 'a.png', assetId: 'asset-a'})
    await waitFor(() =>
      expect(screen.getByTestId('filmstrip-upload-progress-c1').textContent).toBe('1/2'),
    )

    pending[1].resolve({fileName: 'b.png', assetId: 'asset-b'})
    await waitFor(() => expect(screen.queryByTestId('filmstrip-upload-progress-c1')).toBeNull())
  })
})

// CI review on PR 98 (Filmstrip.tsx:640 thread): the upload button is
// `disabled` while uploading, but the drop zone had no equivalent guard —
// `handleChapterDrop`/`handleFilesSelected` called `runUpload` unconditionally,
// so a second drop arriving mid-batch would clobber the single-slot
// `uploadProgress` state and run two sequential loops concurrently,
// interleaving their patches. Fixed with an early-return in `runUpload`
// itself (the one place both the drop and file-input paths funnel through)
// plus suppressing the drag-over highlight while a batch is running.
describe('Filmstrip: bulk upload — ignores a second drop/pick mid-batch (CI review, PR 98)', () => {
  test('a drop on a DIFFERENT chapter mid-batch never calls the uploader again, and the single progress slot is untouched', async () => {
    const {uploader, calls, pending} = makeControllableUploader()
    const onUploadBatch = mock((_c: string, _ok: UploadedAsset[], _failed: number) => {})
    renderWithTheme(<Filmstrip {...baseProps({onUploadBatch, uploader})} />)

    // c1's batch starts — 'a.png' is uploading, still pending.
    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {
      target: {files: [pngFile('a.png')]},
    })
    await waitFor(() => expect(calls).toEqual(['a.png']))
    expect(screen.getByTestId('filmstrip-upload-progress-c1').textContent).toBe('0/1')

    // A second drop arrives on c2 — a DIFFERENT chapter — while c1's batch
    // is still in flight. `uploadProgress` is one shared slot for the
    // whole pane (not one per chapter), so this must be ignored too, not
    // just a same-chapter drop.
    fireEvent.drop(screen.getByTestId('filmstrip-dropzone-c2'), {
      dataTransfer: {files: [pngFile('z.png')]},
    })

    // The uploader is never called for 'z.png' — the call log proves it,
    // not just an absence of a visible effect.
    expect(calls).toEqual(['a.png'])
    // c1's progress slot is untouched (still the first batch's count) and
    // no c2 progress ever appeared.
    expect(screen.getByTestId('filmstrip-upload-progress-c1').textContent).toBe('0/1')
    expect(screen.queryByTestId('filmstrip-upload-progress-c2')).toBeNull()

    // The in-flight c1 batch completes exactly as if the second drop had
    // never happened — one call, reporting only 'a.png'.
    pending[0].resolve({fileName: 'a.png', assetId: 'asset-a'})
    await waitFor(() => expect(onUploadBatch).toHaveBeenCalledTimes(1))
    expect(onUploadBatch).toHaveBeenCalledWith('c1', [{fileName: 'a.png', assetId: 'asset-a'}], 0)
    expect(calls).toEqual(['a.png'])
  })

  test('a second file-input pick on the SAME chapter mid-batch is also ignored', async () => {
    const {uploader, calls, pending} = makeControllableUploader()
    renderWithTheme(<Filmstrip {...baseProps({uploader})} />)

    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {
      target: {files: [pngFile('a.png')]},
    })
    await waitFor(() => expect(calls).toEqual(['a.png']))

    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {
      target: {files: [pngFile('b.png')]},
    })

    // Still just the one in-flight call — 'b.png' was never started.
    expect(calls).toEqual(['a.png'])

    pending[0].resolve({fileName: 'a.png', assetId: 'asset-a'})
    await waitFor(() => expect(screen.queryByTestId('filmstrip-upload-progress-c1')).toBeNull())
    expect(calls).toEqual(['a.png'])
  })

  test('the drag-over highlight is suppressed on any chapter while a batch is running', async () => {
    const {uploader, calls} = makeControllableUploader()
    renderWithTheme(<Filmstrip {...baseProps({uploader})} />)

    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {
      target: {files: [pngFile('a.png')]},
    })
    await waitFor(() => expect(calls).toEqual(['a.png']))

    const dropzone = screen.getByTestId('filmstrip-dropzone-c2')
    fireEvent.dragOver(dropzone, {dataTransfer: {types: ['Files']}})

    expect(dropzone.style.outline).toBe('')
  })
})

describe('Filmstrip: bulk upload — partition and reporting', () => {
  test('2 ok + 1 fail: onUploadBatch gets 2 successes in natural order and a failed count of 1', async () => {
    const onUploadBatch = mock((_c: string, _ok: UploadedAsset[], _failed: number) => {})
    const calls: string[] = []
    const uploader = async (file: File): Promise<UploadedAsset> => {
      calls.push(file.name)
      if (file.name === 'b.png') throw new Error('upload failed')
      return {fileName: file.name, assetId: `asset-${file.name}`}
    }
    renderWithTheme(<Filmstrip {...baseProps({onUploadBatch, uploader})} />)

    // Dropped out of natural order on purpose — 'a.png' < 'b.png' < 'c.png'.
    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {
      target: {files: [pngFile('c.png'), pngFile('a.png'), pngFile('b.png')]},
    })

    await waitFor(() => expect(onUploadBatch).toHaveBeenCalledTimes(1))
    expect(onUploadBatch).toHaveBeenCalledWith(
      'c1',
      [
        {fileName: 'a.png', assetId: 'asset-a.png'},
        {fileName: 'c.png', assetId: 'asset-c.png'},
      ],
      1,
    )
    // Sequential order, natural-sorted, not upload-completion order.
    expect(calls).toEqual(['a.png', 'b.png', 'c.png'])
  })

  test('all failures: onUploadBatch gets an empty ok array and the full failed count', async () => {
    const onUploadBatch = mock((_c: string, _ok: UploadedAsset[], _failed: number) => {})
    const uploader = async (): Promise<UploadedAsset> => {
      throw new Error('nope')
    }
    renderWithTheme(<Filmstrip {...baseProps({onUploadBatch, uploader})} />)

    fireEvent.change(screen.getByTestId('filmstrip-upload-input-c1'), {
      target: {files: [pngFile('a.png'), pngFile('b.png')]},
    })

    await waitFor(() => expect(onUploadBatch).toHaveBeenCalledTimes(1))
    expect(onUploadBatch).toHaveBeenCalledWith('c1', [], 2)
  })
})

describe('Filmstrip: bulk upload — drag and drop', () => {
  test('dropping image files onto a chapter header uploads them to THAT chapter', async () => {
    const onUploadBatch = mock((_c: string, _ok: UploadedAsset[], _failed: number) => {})
    const uploader = async (file: File): Promise<UploadedAsset> => ({
      fileName: file.name,
      assetId: `asset-${file.name}`,
    })
    renderWithTheme(<Filmstrip {...baseProps({onUploadBatch, uploader})} />)

    const dropzone = screen.getByTestId('filmstrip-dropzone-c2')
    fireEvent.drop(dropzone, {dataTransfer: {files: [pngFile('z.png')]}})

    await waitFor(() => expect(onUploadBatch).toHaveBeenCalledTimes(1))
    expect(onUploadBatch).toHaveBeenCalledWith(
      'c2',
      [{fileName: 'z.png', assetId: 'asset-z.png'}],
      0,
    )
  })

  test('non-image files in the drop are filtered out before uploading', async () => {
    const onUploadBatch = mock((_c: string, _ok: UploadedAsset[], _failed: number) => {})
    const uploader = async (file: File): Promise<UploadedAsset> => ({
      fileName: file.name,
      assetId: `asset-${file.name}`,
    })
    renderWithTheme(<Filmstrip {...baseProps({onUploadBatch, uploader})} />)

    const textFile = new File(['not an image'], 'notes.txt', {type: 'text/plain'})
    const dropzone = screen.getByTestId('filmstrip-dropzone-c1')
    fireEvent.drop(dropzone, {dataTransfer: {files: [pngFile('a.png'), textFile]}})

    await waitFor(() => expect(onUploadBatch).toHaveBeenCalledTimes(1))
    expect(onUploadBatch).toHaveBeenCalledWith(
      'c1',
      [{fileName: 'a.png', assetId: 'asset-a.png'}],
      0,
    )
  })

  test('drag-over with a Files payload highlights the chapter as the drop target', () => {
    renderWithTheme(
      <Filmstrip
        {...baseProps({uploader: async (file) => ({fileName: file.name, assetId: 'x'})})}
      />,
    )

    const dropzone = screen.getByTestId('filmstrip-dropzone-c1')
    fireEvent.dragOver(dropzone, {dataTransfer: {types: ['Files']}})

    expect(dropzone.style.outline).not.toBe('')
  })

  test('drag-leave clears the highlight', () => {
    renderWithTheme(
      <Filmstrip
        {...baseProps({uploader: async (file) => ({fileName: file.name, assetId: 'x'})})}
      />,
    )

    const dropzone = screen.getByTestId('filmstrip-dropzone-c1')
    fireEvent.dragOver(dropzone, {dataTransfer: {types: ['Files']}})
    fireEvent.dragLeave(dropzone)

    expect(dropzone.style.outline).toBe('')
  })
})
