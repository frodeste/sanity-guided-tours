import {afterEach, describe, expect, test} from 'bun:test'

import {cleanup, fireEvent, render} from '@testing-library/react'
import axe, {type Result} from 'axe-core'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourEmbedValue,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourLeadCapture,
  GuidedTourLeadCaptureField,
  GuidedTourOutro,
  GuidedTourOutroCta,
  GuidedTourPortableText,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTextOverlay,
  GuidedTourTheme,
  GuidedTourThemeFrame,
  GuidedTourTooltip,
} from '../../src/queries/types'
import {GuidedTour} from '../../src/react/GuidedTour'
import {GuidedTourEmbed} from '../../src/react/GuidedTourEmbed'
import {GuidedTourModal} from '../../src/react/GuidedTourModal'

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

function outroCta(overrides: Partial<GuidedTourOutroCta> & {_key: string}): GuidedTourOutroCta {
  return {
    label: 'Book a demo',
    href: 'https://example.com/demo',
    style: 'primary',
    ...overrides,
  }
}

function outro(overrides: Partial<GuidedTourOutro> = {}): GuidedTourOutro {
  return {
    heading: 'All done!',
    body: plainText('Thanks for taking the tour.'),
    ctas: [
      outroCta({_key: 'cta-1', label: 'Book a demo', style: 'primary'}),
      outroCta({
        _key: 'cta-2',
        label: 'Read the docs',
        href: 'https://example.com/docs',
        style: 'secondary',
      }),
    ],
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

function frame(overrides: Partial<GuidedTourThemeFrame> = {}): GuidedTourThemeFrame {
  return {
    style: 'mac',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    radiusTopLeft: null,
    radiusTopRight: null,
    radiusBottomRight: null,
    radiusBottomLeft: null,
    ...overrides,
  }
}

function theme(overrides: Partial<GuidedTourTheme> = {}): GuidedTourTheme {
  return {
    accent: '#7c3aed',
    surface: '#ffffff',
    text: '#0f172a',
    overlay: '#1e1b4b',
    dark: null,
    frame: null,
    elements: null,
    radius: 12,
    hotspotSize: 24,
    fontFamily: null,
    googleFont: null,
    brand: null,
    logo: null,
    ...overrides,
  }
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

/** Same shape as {@link fixtureTour}, but with an `outro` (M4 Task 2) to reach the outro state below. */
function fixtureTourWithOutro(): GuidedTourDoc {
  return tour({...fixtureTour(), outro: outro()})
}

function leadField(
  overrides: Partial<GuidedTourLeadCaptureField> & {_key: string},
): GuidedTourLeadCaptureField {
  return {name: 'name', label: 'Name', type: 'text', required: false, ...overrides}
}

function leadCapture(overrides: Partial<GuidedTourLeadCapture> = {}): GuidedTourLeadCapture {
  return {
    enabled: true,
    trigger: 'afterStep',
    afterStepIndex: 0,
    fields: [
      leadField({_key: 'f1', name: 'name', label: 'Full name', type: 'text', required: true}),
      leadField({_key: 'f2', name: 'email', label: 'Email', type: 'email', required: true}),
      leadField({_key: 'f3', name: 'notes', label: 'Notes', type: 'textarea', required: false}),
    ],
    consentText: 'I agree to be contacted about this product.',
    submitLabel: null,
    ...overrides,
  }
}

/** Same shape as {@link fixtureTour}, but with a lead-capture form (M4 Task 3) gated after the first step. */
function fixtureTourWithLeadCapture(): GuidedTourDoc {
  return tour({...fixtureTour(), leadCapture: leadCapture()})
}

/** A `guidedTourEmbedProjection` result wrapping {@link fixtureTour} (M6). */
function embedValue(overrides: Partial<GuidedTourEmbedValue> = {}): GuidedTourEmbedValue {
  return {
    _key: 'embed-1',
    _type: 'guidedTourEmbed',
    displayMode: 'inline',
    buttonLabel: null,
    tour: fixtureTour(),
    ...overrides,
  }
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

  // M4 Task 2: the outro screen that replaces `.gt-stage` once Next
  // completes a tour that has one — heading, PT body, and both CTA styles
  // (real `<a>`s, per the same accessibility carve-out as a link hotspot).
  test('outro screen has no violations', async () => {
    const {container} = render(<GuidedTour tour={fixtureTourWithOutro()} />)
    clickNext(container)
    clickNext(container)
    clickNext(container)
    clickNext(container) // -> outro
    expect(container.querySelector('.gt-outro')).not.toBeNull()
    expect(container.querySelectorAll('a.gt-cta')).toHaveLength(2)

    await assertNoAxeViolations(container)
  })

  // M4 Task 3: the lead-capture interstitial that replaces `.gt-stage` at
  // its configured trigger point — a freshly-opened form (no errors yet).
  test('lead-capture form has no violations when freshly opened', async () => {
    const {container} = render(<GuidedTour tour={fixtureTourWithLeadCapture()} />)
    clickNext(container) // -> gated step, form shows instead
    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(container.querySelectorAll('.gt-lead-field')).toHaveLength(3)

    await assertNoAxeViolations(container)
  })

  // Same form, but after a failed submit — exercises the `aria-invalid`/
  // `aria-describedby` error-wiring state, not just the pristine one above.
  test('lead-capture form has no violations with validation errors shown', async () => {
    const {container} = render(<GuidedTour tour={fixtureTourWithLeadCapture()} />)
    clickNext(container) // -> gated step
    fireEvent.submit(query(container, '.gt-lead-form'))
    expect(container.querySelectorAll('.gt-lead-error')).toHaveLength(2) // the two required fields

    await assertNoAxeViolations(container)
  })

  // M4 Task 4: GuidedTourModal's open state — backdrop, dialog panel, close
  // button, and the wrapped tour all together.
  test('the modal has no violations when open', async () => {
    const {container} = render(
      <GuidedTourModal tour={fixtureTour()} open onOpenChange={() => {}} />,
    )
    expect(container.querySelector('.gt-modal')).not.toBeNull()
    expect(query(container, '.gt-modal').getAttribute('role')).toBe('dialog')

    await assertNoAxeViolations(container)
  })

  // M6: GuidedTourEmbed's inline mode — just the .gt-embed wrapper around
  // an ordinary tour, verifying the wrapper itself introduces no violation.
  test('an inline embed has no violations', async () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({displayMode: 'inline'})} />)
    expect(query(container, '.gt-embed').querySelector('.gt-tour')).not.toBeNull()

    await assertNoAxeViolations(container)
  })

  // M6: GuidedTourEmbed's modal mode, opened from its own trigger button —
  // the button, backdrop, dialog panel, and wrapped tour all together.
  test('a modal opened from an embed trigger has no violations', async () => {
    const {container} = render(<GuidedTourEmbed value={embedValue({displayMode: 'modal'})} />)
    fireEvent.click(queryButton(container, '.gt-embed-start'))
    expect(query(container, '.gt-modal').getAttribute('role')).toBe('dialog')

    await assertNoAxeViolations(container)
  })
})

// M10: window chrome (`Frame.tsx`) wraps every step/outro/lead render — one
// state per style is enough here (the four states above already cover
// step/tooltip/overlay/outro/lead content thoroughly); this describe block
// is specifically about the CHROME itself never introducing a violation of
// its own (the mac dots / windows glyphs being `aria-hidden` + `inert`,
// never a focusable fake control — Global Constraint).
describe('axe: frame styles', () => {
  test('mac chrome (the default — no theme at all) has no violations', async () => {
    const {container} = render(<GuidedTour tour={fixtureTour()} />)
    expect(query(container, '.gt-frame').classList.contains('gt-frame--mac')).toBe(true)

    await assertNoAxeViolations(container)
  })

  test('windows chrome has no violations', async () => {
    const {container} = render(
      <GuidedTour
        tour={tour({...fixtureTour(), theme: theme({frame: frame({style: 'windows'})})})}
      />,
    )
    expect(query(container, '.gt-frame').classList.contains('gt-frame--windows')).toBe(true)

    await assertNoAxeViolations(container)
  })

  test('simple border chrome has no violations', async () => {
    const {container} = render(
      <GuidedTour
        tour={tour({...fixtureTour(), theme: theme({frame: frame({style: 'simple'})})})}
      />,
    )
    expect(query(container, '.gt-frame').classList.contains('gt-frame--simple')).toBe(true)

    await assertNoAxeViolations(container)
  })

  test('no chrome ("none") has no violations', async () => {
    const {container} = render(
      <GuidedTour tour={tour({...fixtureTour(), theme: theme({frame: frame({style: 'none'})})})} />,
    )
    expect(container.querySelector('.gt-frame')).toBeNull()

    await assertNoAxeViolations(container)
  })
})
