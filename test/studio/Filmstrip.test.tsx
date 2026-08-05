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
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import type {ReactNode} from 'react'

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
    projectId: null,
    selection: noopSelection(),
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
