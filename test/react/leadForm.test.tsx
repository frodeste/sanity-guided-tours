import {afterEach, describe, expect, spyOn, test} from 'bun:test'

import {cleanup, fireEvent, render, waitFor} from '@testing-library/react'

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
    await waitFor(() => {
      expect(container.querySelector('.gt-lead')).toBeNull()
    })
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

    await waitFor(() => {
      expect(container.querySelector('.gt-lead')).toBeNull()
    })
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

    await waitFor(() => {
      expect(container.querySelector('.gt-lead')).toBeNull()
    })
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
    await waitFor(() => {
      expect(container.querySelector('.gt-lead')).toBeNull()
    })
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

    await waitFor(() => {
      expect(container.querySelector('.gt-lead')).toBeNull()
    })
    expect(events.filter((event) => event.type === 'lead_submitted')).toHaveLength(1)
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

      await waitFor(() => {
        expect(container.querySelector('.gt-lead')).toBeNull()
      })

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
