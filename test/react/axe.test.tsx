import {afterEach, describe, expect, test} from 'bun:test'

import {cleanup, fireEvent, render} from '@testing-library/react'
import axe, {type Result} from 'axe-core'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourPortableText,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTextOverlay,
  GuidedTourTooltip,
} from '../../src/queries/types'
import {GuidedTour} from '../../src/react/GuidedTour'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/GuidedTour.test.tsx and
// test/react/elements.test.tsx: narrow hand types matching the query result
// shapes exactly (`as` casts are banned by oxlint).

function image(): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 50, aspectRatio: 2},
    lqip: null,
    // A real alt, not the null default other fixture files use — an empty
    // alt on a *content* image (this one stands in for the tour's actual
    // screenshot, not decoration) would itself be an `image-alt` violation
    // waiting to happen.
    alt: 'Product screenshot',
  }
}

function plainText(text: string): GuidedTourPortableText {
  return [
    {
      _type: 'block',
      _key: 'block-1',
      style: 'normal',
      children: [{_type: 'span', _key: 'span-1', text}],
    },
  ]
}

function tooltip(overrides: Partial<GuidedTourTooltip> & {_key: string}): GuidedTourTooltip {
  return {
    _type: 'guidedTourTooltip',
    x: 50,
    y: 50,
    mobile: null,
    width: 220,
    content: plainText('More about this feature.'),
    placement: 'auto',
    // 'auto' opens on mount (see test/react/elements.test.tsx's "Tooltip:
    // auto trigger" suite) — the fixture step below relies on that to reach
    // the "step with open tooltip" state without a synthetic click first.
    trigger: 'auto',
    ...overrides,
  }
}

function textOverlay(
  overrides: Partial<GuidedTourTextOverlay> & {_key: string},
): GuidedTourTextOverlay {
  return {
    _type: 'guidedTourTextOverlay',
    x: 10,
    y: 70,
    mobile: null,
    width: 35,
    content: plainText('A call-out about this part of the screen.'),
    background: 'surface',
    opacity: 90,
    ...overrides,
  }
}

function linkHotspot(overrides: Partial<GuidedTourHotspot> & {_key: string}): GuidedTourHotspot {
  return {
    _type: 'guidedTourHotspot',
    x: 80,
    y: 30,
    mobile: null,
    label: 'Open pricing in a new tab',
    action: 'link',
    href: 'https://example.com/pricing',
    pulse: false,
    ...overrides,
  }
}

function step(overrides: Partial<GuidedTourStep> & {_key: string}): GuidedTourStep {
  return {
    title: null,
    advance: 'hotspot',
    duration: null,
    screenshot: image(),
    screenshotMobile: null,
    elements: null,
    ...overrides,
  }
}

function chapter(steps: GuidedTourStep[]): GuidedTourChapter {
  return {_key: 'ch-1', title: 'Chapter', description: null, steps}
}

function settings(overrides: Partial<GuidedTourSettings> = {}): GuidedTourSettings {
  return {showProgress: true, showChapterMenu: true, showStepDots: true, ...overrides}
}

function tour(overrides: Partial<GuidedTourDoc> = {}): GuidedTourDoc {
  return {
    _id: 'tour-1',
    title: 'Accessibility fixture tour',
    slug: 'axe-fixture',
    description: null,
    poster: null,
    theme: null,
    tokens: null,
    chapters: [chapter([step({_key: 'step-1'})])],
    leadCapture: null,
    outro: null,
    settings: settings(),
    ...overrides,
  }
}

/**
 * One fixture tour exercising the four states the plan calls out: a plain
 * first step, a step whose tooltip is open, a step with a text overlay and
 * a link-action hotspot, and the final step (where Next must stay enabled
 * and labeled, not disable itself).
 */
function fixtureTour(): GuidedTourDoc {
  return tour({
    chapters: [
      chapter([
        step({_key: 'step-first', title: 'Welcome'}),
        step({
          _key: 'step-tooltip',
          title: 'A detail worth explaining',
          elements: [tooltip({_key: 't1'})],
        }),
        step({
          _key: 'step-overlay-link',
          title: 'Pricing',
          elements: [textOverlay({_key: 'o1'}), linkHotspot({_key: 'h1'})],
        }),
        step({_key: 'step-final', title: 'All done'}),
      ]),
    ],
  })
}

// Narrowing `Element | null` to `Element` with `as` is banned (oxlint);
// throwing keeps every call site a plain assertion instead.
function query(container: ParentNode, selector: string): Element {
  const element = container.querySelector(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

function queryButton(container: ParentNode, selector: string): HTMLButtonElement {
  const element = container.querySelector<HTMLButtonElement>(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

function clickNext(container: ParentNode): void {
  fireEvent.click(query(container, '.gt-next'))
}

/**
 * Rule IDs exempted from the assertion below because they proved
 * non-computable in this headless-DOM test environment (no real layout or
 * paint — see the doc comments on `test/setup/dom.ts` and
 * `test/setup/matchMedia.ts` for the same limitation elsewhere in this
 * suite), never because a violation was inconvenient to fix. Each entry
 * requires an inline comment naming the specific environmental reason.
 * Empty for now: the states below came back clean under happy-dom, and
 * axe correctly demotes checks it can't compute (e.g. `color-contrast`,
 * which needs real rendering) to `results.incomplete` rather than
 * `results.violations` — so nothing here needed exempting. Add to this
 * only if a genuinely non-computable rule starts reporting as a
 * violation (not `incomplete`) under this DOM.
 */
const ENVIRONMENTAL_ALLOWLIST: Set<string> = new Set()

function formatViolation(violation: Result): string {
  const targets = violation.nodes.map((node) => `  - ${node.target.join(' ')}`).join('\n')
  return `${violation.id} (${violation.impact ?? 'unknown impact'}): ${violation.help}\n${targets}`
}

/**
 * Runs axe against `container` and fails on ANY violation regardless of
 * impact (plan Task 9 amendment — spec §8.6 is a blocking gate, not a log
 * line), after dropping only the rule IDs named in
 * `ENVIRONMENTAL_ALLOWLIST`.
 */
async function assertNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container)
  const violations = results.violations.filter(
    (violation) => !ENVIRONMENTAL_ALLOWLIST.has(violation.id),
  )

  if (violations.length > 0) {
    throw new Error(
      `axe found ${violations.length} accessibility violation(s):\n\n${violations
        .map(formatViolation)
        .join('\n\n')}`,
    )
  }
}

describe('axe: accessibility states', () => {
  test('first step has no violations', async () => {
    const {container} = render(<GuidedTour tour={fixtureTour()} />)
    expect(query(container, '.gt-counter').textContent).toBe('1 / 4')

    await assertNoAxeViolations(container)
  })

  test('step with an open tooltip has no violations', async () => {
    const {container} = render(<GuidedTour tour={fixtureTour()} />)
    clickNext(container)
    expect(query(container, '.gt-counter').textContent).toBe('2 / 4')
    expect(query(container, '.gt-tooltip-trigger').getAttribute('aria-expanded')).toBe('true')

    await assertNoAxeViolations(container)
  })

  test('step with a text overlay and a link hotspot has no violations', async () => {
    const {container} = render(<GuidedTour tour={fixtureTour()} />)
    clickNext(container)
    clickNext(container)
    expect(query(container, '.gt-counter').textContent).toBe('3 / 4')
    expect(query(container, '.gt-overlay')).toBeDefined()
    expect(query(container, 'a.gt-hotspot').getAttribute('href')).toBe(
      'https://example.com/pricing',
    )

    await assertNoAxeViolations(container)
  })

  test('final step has no violations, and Next stays enabled and labeled', async () => {
    const {container} = render(<GuidedTour tour={fixtureTour()} />)
    clickNext(container)
    clickNext(container)
    clickNext(container)
    expect(query(container, '.gt-counter').textContent).toBe('4 / 4')

    const nextButton = queryButton(container, '.gt-next')
    expect(nextButton.disabled).toBe(false)
    expect(nextButton.textContent).toBe('Next')

    await assertNoAxeViolations(container)
  })
})
