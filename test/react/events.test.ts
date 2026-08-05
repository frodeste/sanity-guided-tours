import {describe, expect, test} from 'bun:test'

import type {GuidedTourEvent} from '../../src/react/events'
import {createSession, createTracker} from '../../src/react/session'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function collector(): {events: GuidedTourEvent[]; handler: (event: GuidedTourEvent) => void} {
  const events: GuidedTourEvent[] = []
  return {events, handler: (event) => events.push(event)}
}

describe('createSession', () => {
  test('sessionId is a v4-shaped UUID from crypto.randomUUID()', () => {
    const session = createSession()
    expect(session.sessionId).toMatch(UUID_PATTERN)
  })

  test('each session gets a distinct id', () => {
    expect(createSession().sessionId).not.toBe(createSession().sessionId)
  })

  test('startedAt is a Date.now()-scale timestamp', () => {
    const before = Date.now()
    const session = createSession()
    const after = Date.now()
    expect(session.startedAt).toBeGreaterThanOrEqual(before)
    expect(session.startedAt).toBeLessThanOrEqual(after)
  })
})

describe('createTracker: start', () => {
  test('emits tour_started with the tour id and a UUID session id', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.start()

    expect(events).toHaveLength(1)
    const event = events[0]
    expect(event).toBeDefined()
    if (event?.type !== 'tour_started') throw new Error('expected tour_started')
    expect(event.tourId).toBe('tour-1')
    expect(event.sessionId).toMatch(UUID_PATTERN)
  })

  test('is idempotent — a second call emits nothing further', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.start()
    tracker.start()
    tracker.start()

    expect(events).toHaveLength(1)
  })
})

describe('createTracker: auto-start ordering', () => {
  test('stepViewed before start still emits tour_started first', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.stepViewed({stepIndex: 0, stepKey: 'step-1', chapterIndex: 0})

    expect(events).toHaveLength(2)
    expect(events.map((e) => e.type)).toEqual(['tour_started', 'step_viewed'])
  })

  test('an explicit start() before the first stepViewed does not double-emit', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.start()
    tracker.stepViewed({stepIndex: 0, stepKey: 'step-1', chapterIndex: 0})

    expect(events.map((e) => e.type)).toEqual(['tour_started', 'step_viewed'])
  })
})

describe('createTracker: payload passthrough', () => {
  test('stepViewed passes its fields through unchanged', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.stepViewed({stepIndex: 2, stepKey: 'step-3', chapterIndex: 1})

    const event = events[1]
    expect(event).toEqual({type: 'step_viewed', stepIndex: 2, stepKey: 'step-3', chapterIndex: 1})
  })

  test('elementClicked passes its fields through unchanged', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.elementClicked({elementType: 'hotspot', elementKey: 'el-1'})

    expect(events).toEqual([{type: 'element_clicked', elementType: 'hotspot', elementKey: 'el-1'}])
  })

  test('elementClicked does not auto-start the session', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.elementClicked({elementType: 'hotspot', elementKey: 'el-1'})

    expect(events.map((e) => e.type)).toEqual(['element_clicked'])
  })

  test('ctaClicked passes its fields through unchanged and does not auto-start', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.ctaClicked({label: 'Book a demo', href: 'https://example.com/demo'})

    expect(events).toEqual([
      {type: 'cta_clicked', label: 'Book a demo', href: 'https://example.com/demo'},
    ])
  })

  test('leadSubmitted emits lead_submitted with no payload and does not auto-start', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')

    tracker.leadSubmitted()

    expect(events).toEqual([{type: 'lead_submitted'}])
  })

  test('cta_clicked and lead_submitted satisfy the event union and reach the handler verbatim', () => {
    const {events, handler} = collector()

    handler({type: 'cta_clicked', label: 'Book a demo', href: 'https://example.com/demo'})
    handler({type: 'lead_submitted'})

    expect(events).toEqual([
      {type: 'cta_clicked', label: 'Book a demo', href: 'https://example.com/demo'},
      {type: 'lead_submitted'},
    ])
  })
})

describe('createTracker: terminal calls', () => {
  test('complete emits tour_completed exactly once', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    tracker.complete(5)
    tracker.complete(5)

    const completedEvents = events.filter((e) => e.type === 'tour_completed')
    expect(completedEvents).toHaveLength(1)
    expect(completedEvents[0]).toMatchObject({type: 'tour_completed', stepsViewed: 5})
  })

  test('abandon emits tour_abandoned exactly once', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    tracker.abandon(3)
    tracker.abandon(3)

    const abandonedEvents = events.filter((e) => e.type === 'tour_abandoned')
    expect(abandonedEvents).toHaveLength(1)
    expect(abandonedEvents[0]).toMatchObject({type: 'tour_abandoned', lastStepIndex: 3})
  })

  test('abandon after complete is silent', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    tracker.complete(5)
    tracker.abandon(2)

    expect(events.map((e) => e.type)).toEqual(['tour_started', 'tour_completed'])
  })

  test('complete after abandon is silent', () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    tracker.abandon(2)
    tracker.complete(5)

    expect(events.map((e) => e.type)).toEqual(['tour_started', 'tour_abandoned'])
  })

  test('durationMs is measured from session start', async () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    await new Promise((resolve) => setTimeout(resolve, 20))
    tracker.complete(1)

    const completedEvent = events.find((e) => e.type === 'tour_completed')
    expect(completedEvent).toBeDefined()
    if (completedEvent?.type !== 'tour_completed') throw new Error('expected tour_completed')
    expect(completedEvent.durationMs).toBeGreaterThanOrEqual(15)
  })
})

describe('createTracker: scheduleAbandon / cancelScheduledAbandon', () => {
  test('fires abandon after the timer runs', async () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    tracker.scheduleAbandon(4)
    expect(events.map((e) => e.type)).toEqual(['tour_started'])

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(events.map((e) => e.type)).toEqual(['tour_started', 'tour_abandoned'])
  })

  test('cancelling before the timer fires emits nothing', async () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    tracker.scheduleAbandon(4)
    tracker.cancelScheduledAbandon()

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(events.map((e) => e.type)).toEqual(['tour_started'])
  })

  test('schedule -> cancel -> schedule -> fire still emits exactly one abandon', async () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    tracker.scheduleAbandon(1)
    tracker.cancelScheduledAbandon()
    tracker.scheduleAbandon(4)

    await new Promise((resolve) => setTimeout(resolve, 20))

    const abandonedEvents = events.filter((e) => e.type === 'tour_abandoned')
    expect(abandonedEvents).toHaveLength(1)
    expect(abandonedEvents[0]).toMatchObject({lastStepIndex: 4})
  })

  test('cancelling with no scheduled abandon is a safe no-op', () => {
    const {handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    expect(() => tracker.cancelScheduledAbandon()).not.toThrow()
  })

  test('a completed tour ignores a pending scheduled abandon', async () => {
    const {events, handler} = collector()
    const tracker = createTracker(handler, 'tour-1')
    tracker.start()

    tracker.scheduleAbandon(4)
    tracker.complete(5)

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(events.map((e) => e.type)).toEqual(['tour_started', 'tour_completed'])
  })
})

describe('createTracker: undefined handler', () => {
  test('every method is a silent no-op without throwing', async () => {
    const tracker = createTracker(undefined, 'tour-1')

    expect(() => {
      tracker.start()
      tracker.stepViewed({stepIndex: 0, stepKey: 'step-1', chapterIndex: 0})
      tracker.elementClicked({elementType: 'hotspot', elementKey: 'el-1'})
      tracker.ctaClicked({label: 'Book a demo', href: 'https://example.com/demo'})
      tracker.leadSubmitted()
      tracker.scheduleAbandon(0)
      tracker.cancelScheduledAbandon()
      tracker.complete(1)
      tracker.abandon(0)
    }).not.toThrow()

    await new Promise((resolve) => setTimeout(resolve, 20))
  })
})
