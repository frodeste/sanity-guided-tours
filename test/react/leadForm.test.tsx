import {afterEach, describe, expect, spyOn, test} from 'bun:test'

import {act, cleanup, fireEvent, render, waitFor} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourImage,
  GuidedTourLeadCapture,
  GuidedTourLeadCaptureField,
  GuidedTourOutro,
  GuidedTourSettings,
  GuidedTourStep,
} from '../../src/queries/types'
import type {GuidedTourEvent} from '../../src/react/events'
import {GuidedTour} from '../../src/react/GuidedTour'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/outro.test.tsx and
// test/react/axe.test.tsx: narrow hand types matching the query result
// shapes exactly (`as` casts are banned by oxlint).

function image(): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 50, aspectRatio: 2},
    lqip: null,
    alt: null,
  }
}

function step(overrides: Partial<GuidedTourStep> & {_key: string}): GuidedTourStep {
  return {
    title: null,
    advance: 'hotspot',
    duration: null,
    screenshot: image(),
    screenshotMobile: null,
    video: null,
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

function outro(overrides: Partial<GuidedTourOutro> = {}): GuidedTourOutro {
  return {heading: 'All done!', body: null, ctas: null, ...overrides}
}

function leadField(
  overrides: Partial<GuidedTourLeadCaptureField> & {_key: string},
): GuidedTourLeadCaptureField {
  return {name: 'name', label: 'Name', type: 'text', required: false, ...overrides}
}

function leadCapture(overrides: Partial<GuidedTourLeadCapture> = {}): GuidedTourLeadCapture {
  return {
    enabled: true,
    trigger: 'atEnd',
    afterStepIndex: null,
    fields: [
      leadField({_key: 'f-email', name: 'email', label: 'Email', type: 'email', required: true}),
    ],
    consentText: null,
    submitLabel: null,
    ...overrides,
  }
}

function tour(overrides: Partial<GuidedTourDoc> = {}): GuidedTourDoc {
  return {
    _id: 'tour-1',
    title: 'Test tour',
    slug: 'test-tour',
    description: null,
    poster: null,
    theme: null,
    tokens: null,
    chapters: [chapter([step({_key: 'step-1'}), step({_key: 'step-2'}), step({_key: 'step-3'})])],
    leadCapture: null,
    outro: null,
    settings: settings(),
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

function queryInput(container: ParentNode, selector: string): HTMLInputElement {
  const element = container.querySelector<HTMLInputElement>(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

function clickNext(container: ParentNode): void {
  fireEvent.click(queryButton(container, '.gt-next'))
}

function clickPrev(container: ParentNode): void {
  fireEvent.click(queryButton(container, '.gt-prev'))
}

function collector(): {events: GuidedTourEvent[]; handler: (event: GuidedTourEvent) => void} {
  const events: GuidedTourEvent[] = []
  return {events, handler: (event) => events.push(event)}
}

/**
 * Settles the microtask-driven state updates from `LeadForm`'s submit
 * promise chain (`invokeLeadSubmit().then(...)`), fired from OUTSIDE any
 * `fireEvent.*`-provided `act()` scope. CI review fix, PR 102 (CI 2-core
 * flake): the natural-looking `await waitFor(() => expect(container
 * .querySelector('.gt-lead')).toBeNull())` was measured to take 1.5-2.7
 * REAL seconds per call in this suite — not a timing coincidence,
 * reproduced consistently. Root cause: happy-dom's `MutationObserver`
 * doesn't reliably notice `.gt-lead`'s removal (`waitFor`'s other
 * predicates — an element APPEARING, or a plain array's contents — were
 * measured fast, only "wait for this element to be GONE" was slow), so
 * `waitFor` falls through to its `setInterval` polling fallback outside
 * any active `act()` window; the pending React update it's waiting on
 * then sits queued until the `scheduler` package's own ~5s normal-
 * priority task-expiry watchdog force-flushes it (`scheduler`'s dev
 * build hardcodes `5e3` for that case) — happy-dom's real, working
 * `MessageChannel` isn't the bottleneck; the update just never asks to be
 * scheduled through it because nothing is "inside" `act()` when the
 * promise resolves. An explicit, EMPTY `act(async () => {})` call — a
 * no-op callback, deliberately — resolves the identical state change in
 * under a millisecond: while it's active, any state update already
 * queued (regardless of DOM visibility) is intercepted by React's own
 * act-queue flushing instead of falling back to the scheduler/DOM path
 * at all. Verified empirically before landing this (see the fix note in
 * the task-3 report) — this isn't a guess.
 */
async function flush(): Promise<void> {
  await act(async () => {})
}

describe('LeadForm: afterStep trigger', () => {
  test('entering afterStepIndex + 1 shows the form INSTEAD of the step', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
      />,
    )

    clickNext(container) // step 0 -> step index 1, gated

    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(container.querySelector('.gt-stage')).toBeNull()
  })

  test('does not show on step 0, or on a later step past the gated index once dismissed', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
      />,
    )

    expect(container.querySelector('.gt-lead')).toBeNull()

    clickNext(container) // -> gated step, form shows
    fireEvent.click(queryButton(container, '.gt-lead-skip'))
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(container.querySelector('.gt-stage')).not.toBeNull()

    clickNext(container) // -> step 2, no gate here
    expect(container.querySelector('.gt-lead')).toBeNull()
  })

  test('once dismissed (skip), navigating back and forward does not re-show it (once per mount)', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
      />,
    )

    clickNext(container) // -> gated step
    fireEvent.click(queryButton(container, '.gt-lead-skip'))
    expect(container.querySelector('.gt-lead')).toBeNull()

    clickPrev(container) // -> step 0
    clickNext(container) // -> gated step again
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(container.querySelector('.gt-stage')).not.toBeNull()
  })

  test('navigating away without dismissing leaves it undismissed — returning shows it again', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
      />,
    )

    clickNext(container) // -> gated step, form shows
    expect(container.querySelector('.gt-lead')).not.toBeNull()

    clickPrev(container) // -> step 0, away from the gate
    expect(container.querySelector('.gt-lead')).toBeNull()

    clickNext(container) // -> gated step again
    expect(container.querySelector('.gt-lead')).not.toBeNull()
  })

  test('Next is a no-op while the interstitial is showing (must Skip or submit)', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
        onEvent={handler}
      />,
    )

    clickNext(container) // -> gated step
    const eventCountAtGate = events.length
    clickNext(container) // no-op

    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(events).toHaveLength(eventCountAtGate)
  })
})

// Code review fix (M4 Task 3, round 2): the gated step's content is
// replaced by the interstitial — `step_viewed` used to fire for it anyway
// (keyed only on `currentIndex`, which does change on entry) even though
// the viewer never actually saw it. Fixed in `GuidedTour.tsx`'s view-
// tracking effect by gating the emit (and the `viewedStepsRef` write feeding
// `complete()`'s `stepsViewed`) on `!showAfterStepLead`.
describe('LeadForm: step_viewed suppression while gated', () => {
  test('entering the gated index emits no step_viewed; dismissing it then fires one', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
        onEvent={handler}
      />,
    )

    clickNext(container) // step 0 -> gated index 1, form shows instead
    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(
      events.filter((event) => event.type === 'step_viewed').map((event) => event.stepIndex),
    ).toEqual([0]) // only the real step 0 — nothing for the gated index yet

    fireEvent.click(queryButton(container, '.gt-lead-skip')) // dismiss — the step is now visible
    expect(container.querySelector('.gt-stage')).not.toBeNull()
    expect(
      events.filter((event) => event.type === 'step_viewed').map((event) => event.stepIndex),
    ).toEqual([0, 1])
  })

  test('a submit-dismissal also fires step_viewed for the now-visible step', async () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            trigger: 'afterStep',
            afterStepIndex: 0,
            fields: [],
          }),
        })}
        onEvent={handler}
      />,
    )

    clickNext(container) // -> gated index 1
    fireEvent.submit(query(container, '.gt-lead-form'))

    // Waiting on the DOM alone (`.gt-stage` appearing) isn't enough here:
    // that reflects the synchronous state update in the promise's `.then`,
    // but `step_viewed` for the now-visible step fires from a `useEffect`
    // (keyed on `showAfterStepLead`) — a passive effect, which React may
    // flush on a later tick than the commit `waitFor`'s DOM predicate would
    // already be satisfied by. Poll the event itself instead.
    await waitFor(() => {
      expect(
        events.filter((event) => event.type === 'step_viewed').map((event) => event.stepIndex),
      ).toEqual([0, 1])
    })
    expect(container.querySelector('.gt-stage')).not.toBeNull()
  })

  test('a step only ever seen behind the still-undismissed interstitial is excluded from stepsViewed', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({
          chapters: [
            chapter([
              step({_key: 's1'}),
              step({_key: 's2'}), // gated, never dismissed below — must not count
              step({_key: 's3'}),
              step({_key: 's4'}),
            ]),
          ],
          leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0}),
        })}
        onEvent={handler}
      />,
    )

    clickNext(container) // -> gated index 1 (s2), form shows, undismissed
    expect(container.querySelector('.gt-lead')).not.toBeNull()

    // Bypass the gate entirely via a dot jump to index 3 (s4) — leaves the
    // gated step's content unseen and the interstitial still undismissed.
    const dots = container.querySelectorAll<HTMLButtonElement>('.gt-dot')
    const fourthDot = dots[3]
    if (!fourthDot) throw new Error('expected a fourth dot')
    fireEvent.click(fourthDot)
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(query(container, '.gt-counter').textContent).toBe('4 / 4')

    clickNext(container) // last step's Next -> complete (no outro, no atEnd gate)

    const completedEvents = events.filter((event) => event.type === 'tour_completed')
    expect(completedEvents).toHaveLength(1)
    // Only index 0 (s1) and index 3 (s4) were ever actually seen — index 1
    // (gated, bypassed) and index 2 (s3, never visited) are excluded.
    expect(completedEvents[0]).toMatchObject({stepsViewed: 2})
  })
})

describe('LeadForm: live region announcement', () => {
  test('announces leadFormAnnouncement once the interstitial shows, via mouse (Next click)', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
      />,
    )

    expect(query(container, '.gt-live').textContent).not.toBe(
      'Before you continue: please fill in the form',
    )

    clickNext(container) // -> gated, mouse-driven
    expect(query(container, '.gt-live').textContent).toBe(
      'Before you continue: please fill in the form',
    )
  })

  test('announces leadFormAnnouncement once the interstitial shows, via keyboard (ArrowRight)', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
      />,
    )

    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'ArrowRight'}) // -> gated, keyboard-driven
    expect(query(container, '.gt-live').textContent).toBe(
      'Before you continue: please fill in the form',
    )
  })

  test('announces it for the atEnd trigger too, and reverts once dismissed', () => {
    const {container} = render(
      <GuidedTour tour={tour({leadCapture: leadCapture({trigger: 'atEnd'})})} />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container) // -> gated (atEnd)
    expect(query(container, '.gt-live').textContent).toBe(
      'Before you continue: please fill in the form',
    )

    fireEvent.click(queryButton(container, '.gt-lead-skip'))
    expect(query(container, '.gt-live').textContent).not.toBe(
      'Before you continue: please fill in the form',
    )
  })

  test('a custom leadFormAnnouncement label override is honored', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 0})})}
        labels={{leadFormAnnouncement: 'One more thing before you continue'}}
      />,
    )

    clickNext(container)
    expect(query(container, '.gt-live').textContent).toBe('One more thing before you continue')
  })
})

describe('LeadForm: afterStepIndex out of range', () => {
  test('afterStepIndex equal to the last index never shows the form — afterStepIndex + 1 is out of range (ruling: use atEnd instead)', () => {
    const {events, handler} = collector()
    const {container} = render(
      // 3-step tour (indices 0-2); afterStepIndex: 2 (the last index) means
      // the would-be gated index is 3, which doesn't exist. Per the
      // documented ruling (schema field description + GuidedTour.tsx's
      // showAfterStepLead comment) this silently never fires, exactly like
      // a null afterStepIndex.
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 2})})}
        onEvent={handler}
      />,
    )

    clickNext(container)
    clickNext(container) // -> last step (index 2); would-be gate is index 3
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(query(container, '.gt-counter').textContent).toBe('3 / 3')

    clickNext(container) // last step's Next: completes normally, never gated
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)
  })

  test('an afterStepIndex further beyond the tour also never fires', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'afterStep', afterStepIndex: 10})})}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(container.querySelector('.gt-lead')).toBeNull()
  })
})

describe('LeadForm: atEnd trigger and complete()/outro ordering', () => {
  test('Next on the last step shows the form INSTEAD of completing — complete() has not fired yet', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour tour={tour({leadCapture: leadCapture({trigger: 'atEnd'})})} onEvent={handler} />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container) // -> last step's Next: gated

    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(0)
  })

  test('dismissing (skip) fires complete() and, without an outro, complete-and-stays', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour tour={tour({leadCapture: leadCapture({trigger: 'atEnd'})})} onEvent={handler} />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container) // -> gated

    fireEvent.click(queryButton(container, '.gt-lead-skip'))

    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(container.querySelector('.gt-outro')).toBeNull()
    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)
  })

  test('with an outro: complete() fires, THEN the outro shows — both after dismissal', () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'atEnd'}), outro: outro()})}
        onEvent={handler}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container) // -> gated, no outro yet
    expect(container.querySelector('.gt-outro')).toBeNull()

    fireEvent.click(queryButton(container, '.gt-lead-skip'))

    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)
    expect(container.querySelector('.gt-outro')).not.toBeNull()
    expect(container.querySelector('.gt-lead')).toBeNull()
  })

  test('a successful submit also completes the tour and advances to the outro', async () => {
    const {events, handler} = collector()
    const onLeadSubmit = () => Promise.resolve()
    const {container} = render(
      <GuidedTour
        tour={tour({leadCapture: leadCapture({trigger: 'atEnd'}), outro: outro()})}
        onEvent={handler}
        onLeadSubmit={onLeadSubmit}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container) // -> gated

    fireEvent.change(queryInput(container, 'input[name="email"]'), {
      target: {value: 'ada@example.com'},
    })
    fireEvent.submit(query(container, '.gt-lead-form'))

    await waitFor(() => {
      expect(container.querySelector('.gt-outro')).not.toBeNull()
    })

    expect(events.filter((event) => event.type === 'lead_submitted')).toHaveLength(1)
    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)
    // lead_submitted -> tour_completed -> outro, in that order.
    const types = events.map((event) => event.type)
    expect(types.indexOf('lead_submitted')).toBeLessThan(types.indexOf('tour_completed'))
  })

  test('Prev from the gated atEnd interstitial returns to the last step, undismissed', () => {
    const {container} = render(
      <GuidedTour tour={tour({leadCapture: leadCapture({trigger: 'atEnd'})})} />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container) // -> gated
    expect(container.querySelector('.gt-lead')).not.toBeNull()

    clickPrev(container)
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(query(container, '.gt-counter').textContent).toBe('3 / 3')

    clickNext(container) // -> gated again, still undismissed
    expect(container.querySelector('.gt-lead')).not.toBeNull()
  })
})

describe('LeadForm: field rendering', () => {
  test('renders an <input type> for text/email/tel, a <textarea> for textarea, with labels and required markers', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({
                _key: 'f1',
                name: 'name',
                label: 'Full name',
                type: 'text',
                required: true,
              }),
              leadField({_key: 'f2', name: 'email', label: 'Email', type: 'email', required: true}),
              leadField({_key: 'f3', name: 'phone', label: 'Phone', type: 'tel', required: false}),
              leadField({
                _key: 'f4',
                name: 'notes',
                label: 'Notes',
                type: 'textarea',
                required: false,
              }),
            ],
          }),
        })}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(queryInput(container, 'input[name="name"]').type).toBe('text')
    expect(queryInput(container, 'input[name="email"]').type).toBe('email')
    expect(queryInput(container, 'input[name="phone"]').type).toBe('tel')
    expect(container.querySelector('textarea[name="notes"]')).not.toBeNull()

    const labels = Array.from(container.querySelectorAll('.gt-lead-label')).map((el) =>
      el.textContent?.trim(),
    )
    expect(labels).toEqual(['Full name *', 'Email *', 'Phone', 'Notes'])
  })

  // CI review fix: the `*` marker is `aria-hidden` (it's a visual-only
  // convention), so nothing previously told assistive tech a field was
  // required before the viewer actually tried to submit and saw a
  // validation error. `aria-required` fixes that — present up front,
  // independent of validation state.
  test('a required field carries aria-required="true"; a non-required one carries "false"', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({_key: 'f1', name: 'name', label: 'Name', type: 'text', required: true}),
              leadField({
                _key: 'f2',
                name: 'notes',
                label: 'Notes',
                type: 'textarea',
                required: false,
              }),
            ],
          }),
        })}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(queryInput(container, 'input[name="name"]').getAttribute('aria-required')).toBe('true')
    expect(query(container, 'textarea[name="notes"]').getAttribute('aria-required')).toBe('false')
  })
})

describe('LeadForm: validation', () => {
  function renderGated() {
    return render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({_key: 'f1', name: 'name', label: 'Name', type: 'text', required: true}),
              leadField({
                _key: 'f2',
                name: 'email',
                label: 'Email',
                type: 'email',
                required: false,
              }),
            ],
          }),
        })}
      />,
    )
  }

  test('a required empty field blocks submit and wires aria-invalid/aria-describedby to an inline error', () => {
    const {container} = renderGated()
    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.submit(query(container, '.gt-lead-form'))

    const nameInput = queryInput(container, 'input[name="name"]')
    expect(nameInput.getAttribute('aria-invalid')).toBe('true')
    const describedBy = nameInput.getAttribute('aria-describedby')
    expect(describedBy).not.toBeNull()
    if (!describedBy) throw new Error('expected aria-describedby')
    const errorEl = document.getElementById(describedBy)
    expect(errorEl?.textContent).toBe('Name is required.')

    // still on the interstitial — nothing was dismissed
    expect(container.querySelector('.gt-lead')).not.toBeNull()
  })

  test('an invalid email value on a type=email field blocks submit even when not required', () => {
    const {container} = renderGated()
    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.change(queryInput(container, 'input[name="name"]'), {target: {value: 'Ada'}})
    fireEvent.change(queryInput(container, 'input[name="email"]'), {
      target: {value: 'not-an-email'},
    })
    fireEvent.submit(query(container, '.gt-lead-form'))

    const emailInput = queryInput(container, 'input[name="email"]')
    expect(emailInput.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('.gt-lead')).not.toBeNull()
  })

  test('a valid, non-empty email passes; an empty optional email field passes', async () => {
    const {container} = renderGated()
    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.change(queryInput(container, 'input[name="name"]'), {target: {value: 'Ada'}})
    fireEvent.change(queryInput(container, 'input[name="email"]'), {
      target: {value: 'ada@example.com'},
    })
    fireEvent.submit(query(container, '.gt-lead-form'))

    // Passing validation still routes through the async submit path (even
    // with no `onLeadSubmit` configured, `Promise.resolve(undefined)`
    // resolves on a later microtask, not synchronously) — see
    // `LeadForm.tsx`'s `handleSubmit` doc comment.
    await flush()
    expect(container.querySelector('.gt-lead')).toBeNull()
  })

  test('correcting a field after a failed submit and resubmitting succeeds', async () => {
    const {container} = renderGated()
    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.submit(query(container, '.gt-lead-form'))
    expect(queryInput(container, 'input[name="name"]').getAttribute('aria-invalid')).toBe('true')

    fireEvent.change(queryInput(container, 'input[name="name"]'), {target: {value: 'Ada'}})
    fireEvent.submit(query(container, '.gt-lead-form'))

    await flush()
    expect(container.querySelector('.gt-lead')).toBeNull()
  })
})

describe('LeadForm: submit flow', () => {
  test('calls onLeadSubmit with the field values keyed by name, emits lead_submitted, and dismisses', async () => {
    const {events, handler} = collector()
    const received: Record<string, string>[] = []
    const onLeadSubmit = (lead: Record<string, string>) => {
      received.push(lead)
    }
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({_key: 'f1', name: 'email', label: 'Email', type: 'email', required: true}),
            ],
          }),
        })}
        onEvent={handler}
        onLeadSubmit={onLeadSubmit}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.change(queryInput(container, 'input[name="email"]'), {
      target: {value: 'ada@example.com'},
    })
    fireEvent.submit(query(container, '.gt-lead-form'))

    await flush()
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(received).toEqual([{email: 'ada@example.com'}])
    expect(events.filter((event) => event.type === 'lead_submitted')).toHaveLength(1)
  })

  test('an async onLeadSubmit disables the submit button while pending, then dismisses on resolution', async () => {
    let resolveSubmit: (() => void) | undefined
    const onLeadSubmit = () =>
      new Promise<void>((resolve) => {
        resolveSubmit = resolve
      })
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({_key: 'f1', name: 'email', label: 'Email', type: 'email', required: true}),
            ],
          }),
        })}
        onLeadSubmit={onLeadSubmit}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.change(queryInput(container, 'input[name="email"]'), {
      target: {value: 'ada@example.com'},
    })
    fireEvent.submit(query(container, '.gt-lead-form'))

    expect(queryButton(container, '.gt-lead-submit').disabled).toBe(true)
    expect(container.querySelector('.gt-lead')).not.toBeNull()

    resolveSubmit?.()
    await flush()
    expect(container.querySelector('.gt-lead')).toBeNull()
  })

  test('a rejected onLeadSubmit re-enables submit, shows a generic error, and stays open', async () => {
    const onLeadSubmit = () => Promise.reject(new Error('network down'))
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({_key: 'f1', name: 'email', label: 'Email', type: 'email', required: true}),
            ],
          }),
        })}
        onEvent={handler}
        onLeadSubmit={onLeadSubmit}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.change(queryInput(container, 'input[name="email"]'), {
      target: {value: 'ada@example.com'},
    })
    fireEvent.submit(query(container, '.gt-lead-form'))

    await waitFor(() => {
      expect(container.querySelector('.gt-lead-submit-error')).not.toBeNull()
    })

    // Generic message — never the rejection's own message.
    expect(query(container, '.gt-lead-submit-error').textContent).not.toContain('network down')
    expect(queryButton(container, '.gt-lead-submit').disabled).toBe(false)
    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(events.filter((event) => event.type === 'lead_submitted')).toHaveLength(0)
  })

  // CI review fix: a non-async `onLeadSubmit` that throws SYNCHRONOUSLY
  // (as opposed to returning a rejected Promise) used to escape uncaught —
  // `onLeadSubmit?.(values)` was evaluated eagerly as the argument to
  // `Promise.resolve(...)`, before that Promise wrapper existed to catch
  // anything. Fixed by moving the call inside the first `.then()`, so a
  // synchronous throw there rejects the chain exactly like an async
  // rejection would, hitting the same `.catch()`.
  test('a synchronously-throwing onLeadSubmit is caught too — generic error, stays open, pending cleared', async () => {
    const onLeadSubmit = (): void => {
      throw new Error('boom')
    }
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({_key: 'f1', name: 'email', label: 'Email', type: 'email', required: true}),
            ],
          }),
        })}
        onEvent={handler}
        onLeadSubmit={onLeadSubmit}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.change(queryInput(container, 'input[name="email"]'), {
      target: {value: 'ada@example.com'},
    })

    // The throw must not propagate out of the submit handler itself.
    expect(() => {
      fireEvent.submit(query(container, '.gt-lead-form'))
    }).not.toThrow()

    await waitFor(() => {
      expect(container.querySelector('.gt-lead-submit-error')).not.toBeNull()
    })

    expect(query(container, '.gt-lead-submit-error').textContent).not.toContain('boom')
    // Pending is cleared, not stranded at `true` — the submit button is
    // re-enabled and the interstitial stays open (never dismissed).
    expect(queryButton(container, '.gt-lead-submit').disabled).toBe(false)
    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(events.filter((event) => event.type === 'lead_submitted')).toHaveLength(0)
  })

  test('skip dismisses without validating, without calling onLeadSubmit, and without emitting lead_submitted', () => {
    let called = false
    const onLeadSubmit = () => {
      called = true
    }
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({_key: 'f1', name: 'email', label: 'Email', type: 'email', required: true}),
            ],
          }),
        })}
        onEvent={handler}
        onLeadSubmit={onLeadSubmit}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.click(queryButton(container, '.gt-lead-skip'))

    expect(called).toBe(false)
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(events.filter((event) => event.type === 'lead_submitted')).toHaveLength(0)
  })

  test('submitting with no onLeadSubmit configured still succeeds (dismisses, emits lead_submitted)', async () => {
    const {events, handler} = collector()
    const {container} = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({fields: []}),
        })}
        onEvent={handler}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    fireEvent.submit(query(container, '.gt-lead-form'))

    await flush()
    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(events.filter((event) => event.type === 'lead_submitted')).toHaveLength(1)
  })
})

// CI review fix: navigation used to be entirely unaware of an in-flight
// atEnd/afterStep submit — a viewer could press Prev (or Home/End/a dot/a
// chapter jump) mid-submit, and the eventual resolution would fire
// lead_submitted/complete()/the outro transition against a UI that had
// already moved elsewhere. `GuidedTour.tsx`'s `goTo` (and, defensively,
// `handleNext`/`handlePrev` directly) now no-op while `leadPending` is
// true, fed by `LeadForm`'s `onPendingChange`.
describe('LeadForm: navigation guard while a submit is pending', () => {
  function renderPendingAtEnd() {
    let resolveSubmit: (() => void) | undefined
    const onLeadSubmit = () =>
      new Promise<void>((resolve) => {
        resolveSubmit = resolve
      })
    const {events, handler} = collector()
    const rendered = render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            trigger: 'atEnd',
            fields: [
              leadField({_key: 'f1', name: 'email', label: 'Email', type: 'email', required: true}),
            ],
          }),
        })}
        onEvent={handler}
        onLeadSubmit={onLeadSubmit}
      />,
    )

    clickNext(rendered.container)
    clickNext(rendered.container)
    clickNext(rendered.container) // -> gated (atEnd)

    fireEvent.change(queryInput(rendered.container, 'input[name="email"]'), {
      target: {value: 'ada@example.com'},
    })
    fireEvent.submit(query(rendered.container, '.gt-lead-form'))
    expect(queryButton(rendered.container, '.gt-lead-submit').disabled).toBe(true) // now pending

    return {...rendered, events, resolveSubmit: () => resolveSubmit?.()}
  }

  test('Prev is a no-op while pending — the interstitial stays put, unresolved', () => {
    const {container} = renderPendingAtEnd()

    clickPrev(container)

    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(query(container, '.gt-counter').textContent).toBe('3 / 3')
  })

  test('Home/End/dots are no-ops while pending', () => {
    const {container} = renderPendingAtEnd()

    fireEvent.keyDown(query(container, '.gt-tour'), {key: 'Home'})
    expect(container.querySelector('.gt-lead')).not.toBeNull()

    const firstDot = container.querySelectorAll<HTMLButtonElement>('.gt-dot')[0]
    if (!firstDot) throw new Error('expected a first dot')
    fireEvent.click(firstDot)
    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(query(container, '.gt-counter').textContent).toBe('3 / 3')
  })

  test('once the pending submit resolves, the flow completes normally (lead_submitted then tour_completed)', async () => {
    const {container, events, resolveSubmit} = renderPendingAtEnd()

    clickPrev(container) // no-op, still pending
    resolveSubmit()

    await flush()
    expect(container.querySelector('.gt-lead')).toBeNull()

    expect(events.filter((event) => event.type === 'lead_submitted')).toHaveLength(1)
    expect(events.filter((event) => event.type === 'tour_completed')).toHaveLength(1)
    // Navigation is un-gated again once it's no longer pending — this Prev
    // actually moves, unlike the no-op one above while still pending.
    clickPrev(container)
    expect(query(container, '.gt-counter').textContent).toBe('2 / 3')
  })
})

// CI review fix (PR 102): same class of bug as the outro's own controlled-
// reconciliation fix (test/react/outro.test.tsx) — the render-time
// controlled-sync block only cleared `showOutro` on an external `step`
// change, not `showAtEndLead`, so a controlled consumer changing `step`
// while the atEnd interstitial was showing left it stuck rendered over
// whatever step the UI had actually moved on to.
describe('LeadForm: controlled step reconciliation (atEnd interstitial)', () => {
  test('an external step prop change dismisses the atEnd interstitial, even though onStepChange was never called to leave it', () => {
    const fixtureTour = tour({leadCapture: leadCapture({trigger: 'atEnd'})})
    const {container, rerender} = render(
      <GuidedTour tour={fixtureTour} step={2} onStepChange={() => {}} />,
    )
    expect(query(container, '.gt-counter').textContent).toBe('3 / 3')

    clickNext(container) // -> atEnd interstitial; controlled `step` (2) is never touched by this
    expect(container.querySelector('.gt-lead')).not.toBeNull()

    // The consumer drives `step` back to 0 itself — entirely independent
    // of the component's own Prev/goTo path (which never fires here).
    rerender(<GuidedTour tour={fixtureTour} step={0} onStepChange={() => {}} />)

    expect(container.querySelector('.gt-lead')).toBeNull()
    expect(query(container, '.gt-counter').textContent).toBe('1 / 3')
  })

  test('the reconciliation only fires on an actual step change, not every render', () => {
    const fixtureTour = tour({leadCapture: leadCapture({trigger: 'atEnd'})})
    const {container, rerender} = render(
      <GuidedTour tour={fixtureTour} step={2} onStepChange={() => {}} />,
    )

    clickNext(container) // -> atEnd interstitial
    expect(container.querySelector('.gt-lead')).not.toBeNull()

    // Re-rendering with the SAME `step` value must not disturb the
    // interstitial that's showing on top of it.
    rerender(<GuidedTour tour={fixtureTour} step={2} onStepChange={() => {}} />)

    expect(container.querySelector('.gt-lead')).not.toBeNull()
  })
})

describe('LeadForm: consent, submit label, personalization', () => {
  test('renders consent text verbatim (personalized, plain text) below the fields', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          tokens: [
            {
              _key: 'company',
              key: 'company',
              label: 'Company',
              defaultValue: null,
              required: false,
            },
          ],
          leadCapture: leadCapture({consentText: 'I agree to {{company}}’s terms.'}),
        })}
        tokens={{company: 'Acme'}}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(query(container, '.gt-lead-consent').textContent).toBe('I agree to Acme’s terms.')
  })

  test('no consent element renders when consentText is null', () => {
    const {container} = render(
      <GuidedTour tour={tour({leadCapture: leadCapture({consentText: null})})} />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(container.querySelector('.gt-lead-consent')).toBeNull()
  })

  test('uses the default leadSubmit label when leadCapture.submitLabel is unset', () => {
    const {container} = render(
      <GuidedTour tour={tour({leadCapture: leadCapture({submitLabel: null})})} />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(queryButton(container, '.gt-lead-submit').textContent).toBe('Submit')
  })

  test('personalizes a custom submitLabel', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          tokens: [{_key: 'name', key: 'name', label: 'Name', defaultValue: null, required: false}],
          leadCapture: leadCapture({submitLabel: 'Get {{name}} a demo'}),
        })}
        tokens={{name: 'Ada'}}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(queryButton(container, '.gt-lead-submit').textContent).toBe('Get Ada a demo')
  })

  test('a custom leadSkip label override is honored', () => {
    const {container} = render(
      <GuidedTour tour={tour({leadCapture: leadCapture()})} labels={{leadSkip: 'No thanks'}} />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(queryButton(container, '.gt-lead-skip').textContent).toBe('No thanks')
  })

  test('personalizes field labels', () => {
    const {container} = render(
      <GuidedTour
        tour={tour({
          tokens: [{_key: 'name', key: 'name', label: 'Name', defaultValue: null, required: false}],
          leadCapture: leadCapture({
            fields: [
              leadField({
                _key: 'f1',
                name: 'email',
                label: "{{name}}'s email",
                type: 'email',
                required: false,
              }),
            ],
          }),
        })}
        tokens={{name: 'Ada'}}
      />,
    )

    clickNext(container)
    clickNext(container)
    clickNext(container)

    expect(query(container, '.gt-lead-label').textContent?.trim()).toBe("Ada's email")
  })
})

describe('LeadForm: no network from the plugin', () => {
  test('fetch is never called by the plugin during the submit flow', async () => {
    // No `mockImplementation` override needed — the assertion below is
    // purely "was it ever called", and the plugin genuinely never calls
    // `fetch` itself, so the real implementation is never reached either.
    const fetchSpy = spyOn(globalThis, 'fetch')
    try {
      const {container} = render(
        <GuidedTour
          tour={tour({
            leadCapture: leadCapture({
              fields: [
                leadField({
                  _key: 'f1',
                  name: 'email',
                  label: 'Email',
                  type: 'email',
                  required: true,
                }),
              ],
            }),
          })}
          onLeadSubmit={() => Promise.resolve()}
        />,
      )

      clickNext(container)
      clickNext(container)
      clickNext(container)

      fireEvent.change(queryInput(container, 'input[name="email"]'), {
        target: {value: 'ada@example.com'},
      })
      fireEvent.submit(query(container, '.gt-lead-form'))

      await flush()
      expect(container.querySelector('.gt-lead')).toBeNull()

      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('LeadForm: nav-key guard against real inputs', () => {
  function renderGated() {
    return render(
      <GuidedTour
        tour={tour({
          leadCapture: leadCapture({
            fields: [
              leadField({_key: 'f1', name: 'name', label: 'Name', type: 'text', required: false}),
            ],
          }),
        })}
      />,
    )
  }

  test('ArrowLeft/ArrowRight/Home/End/Space typed inside a real input neither navigate the tour nor get swallowed', () => {
    const {container} = renderGated()
    clickNext(container)
    clickNext(container)
    clickNext(container)

    const input = queryInput(container, 'input[name="name"]')
    input.focus()
    expect(document.activeElement).toBe(input)

    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', ' ']) {
      const notCanceled = fireEvent.keyDown(input, {key})
      // Not swallowed: the root handler never called `preventDefault`, so
      // the native default (cursor movement / a literal space) still runs —
      // `fireEvent`'s return value is `dispatchEvent`'s own, `false` only
      // when `preventDefault` was called on a cancelable event.
      expect(notCanceled).toBe(true)
    }

    // Not navigated: the interstitial is still showing, unchanged.
    expect(container.querySelector('.gt-lead')).not.toBeNull()
    expect(document.activeElement).toBe(input)
  })

  test('typing text into the field works normally alongside the guard', () => {
    const {container} = renderGated()
    clickNext(container)
    clickNext(container)
    clickNext(container)

    const input = queryInput(container, 'input[name="name"]')
    fireEvent.change(input, {target: {value: 'Ada Lovelace'}})
    expect(input.value).toBe('Ada Lovelace')
  })
})
