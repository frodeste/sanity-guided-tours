import {describe, expect, mock, spyOn, test} from 'bun:test'

import {AccessibilityInfo, Image, Pressable, ScrollView, Text, View} from 'react-native'

import {GuidedTour} from '../../src/native/GuidedTourNative'
import type {GuidedTourEvent} from '../../src/react/events'
import {actNative, renderNative} from '../support/react-native-stub/renderNative'
import {chapter, image, step, theme, threeStepTour, token, tour} from './fixtures'

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, entry) => Object.assign(acc, flattenStyle(entry)),
      {},
    )
  }
  if (style && typeof style === 'object') return {...style}
  return {}
}

/** Finds the labeled control button (Prev/Next) by its accessibilityLabel — `findAllByType(Pressable)` alone can't distinguish them from hotspot/dot/chapter-chip Pressables in a bigger tree. */
function findByLabel(renderer: ReturnType<typeof renderNative>, label: string) {
  return renderer.root.findAllByType(Pressable).find((p) => p.props.accessibilityLabel === label)
}

describe('GuidedTourNative: navigation', () => {
  test('Next/Prev advance and retreat the current step (uncontrolled)', () => {
    const renderer = renderNative(<GuidedTour tour={threeStepTour()} />)
    const stepText = () => JSON.stringify(renderer.toJSON())

    expect(stepText()).toContain('1 / 3')
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    expect(stepText()).toContain('2 / 3')
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    expect(stepText()).toContain('3 / 3')
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress()) // last step, no outro: stays put
    expect(stepText()).toContain('3 / 3')
    actNative(() => findByLabel(renderer, 'Previous')?.props.onPress())
    expect(stepText()).toContain('2 / 3')
  })

  test('dots jump directly to a step', () => {
    const renderer = renderNative(<GuidedTour tour={threeStepTour()} />)
    const dots = renderer.root
      .findAllByType(Pressable)
      .filter((p) => p.props.accessibilityLabel?.includes('/ 3'))
    actNative(() => dots[2]?.props.onPress())
    expect(JSON.stringify(renderer.toJSON())).toContain('3 / 3')
  })

  test('chapter chips jump to the first step of that chapter', () => {
    const twoChapterTour = tour({
      chapters: [
        chapter({_key: 'ch-1', title: 'First', steps: [step({_key: 's1'}), step({_key: 's2'})]}),
        chapter({_key: 'ch-2', title: 'Second', steps: [step({_key: 's3'})]}),
      ],
    })
    const renderer = renderNative(<GuidedTour tour={twoChapterTour} />)
    const chipLabel = renderer.root.findAllByType(Text).find((t) => t.props.children === 'Second')
    const chip = chipLabel?.parent
    actNative(() => chip?.props.onPress())
    expect(JSON.stringify(renderer.toJSON())).toContain('3 / 3')
  })

  test('controlled step: navigation calls onStepChange instead of moving internally', () => {
    const onStepChange = mock((_step: number) => {})
    const renderer = renderNative(
      <GuidedTour tour={threeStepTour()} step={0} onStepChange={onStepChange} />,
    )
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    expect(onStepChange).toHaveBeenCalledWith(1)
    // Still showing step 1 — the parent never re-rendered with the new `step`.
    expect(JSON.stringify(renderer.toJSON())).toContain('1 / 3')
  })

  test('controlled step: an external step prop change updates the rendered step', () => {
    const renderer = renderNative(
      <GuidedTour tour={threeStepTour()} step={0} onStepChange={() => {}} />,
    )
    actNative(() =>
      renderer.update(<GuidedTour tour={threeStepTour()} step={2} onStepChange={() => {}} />),
    )
    expect(JSON.stringify(renderer.toJSON())).toContain('3 / 3')
  })

  test('the last step completes the tour and shows the outro when one exists', () => {
    const withOutro = tour({
      chapters: [chapter({_key: 'ch-1', steps: [step({_key: 's1'})]})],
      outro: {heading: 'Done!', body: null, ctas: null},
    })
    const renderer = renderNative(<GuidedTour tour={withOutro} />)
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    expect(JSON.stringify(renderer.toJSON())).toContain('Done!')
  })

  test('Previous from the outro returns to the last step, not past it', () => {
    const withOutro = tour({
      chapters: [chapter({_key: 'ch-1', steps: [step({_key: 's1'}), step({_key: 's2'})]})],
      outro: {heading: 'Done!', body: null, ctas: null},
    })
    const renderer = renderNative(<GuidedTour tour={withOutro} />)
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    expect(JSON.stringify(renderer.toJSON())).toContain('Done!')
    actNative(() => findByLabel(renderer, 'Previous')?.props.onPress())
    expect(JSON.stringify(renderer.toJSON())).toContain('2 / 2')
  })

  // Regression (M4, mirrored from web's test/react/outro.test.tsx "Outro:
  // controlled step reconciliation" suite): `showOutro` used to be
  // reconciled only by the component's own transitions (`goTo`) — a
  // controlled consumer changing `step` EXTERNALLY (a route change, a
  // "restart" action) left the outro rendered on top of a counter that had
  // already moved on to the new step. `GuidedTourNative.tsx`'s render-time
  // controlled-sync block (mirrors web's `GuidedTour.tsx`) clears
  // `showOutro` whenever it detects `step` actually changed, independent of
  // whether `onStepChange` was ever called to leave the outro itself.
  test('an external step prop change dismisses the outro, even though onStepChange was never called to leave it', () => {
    const withOutro = tour({
      chapters: [chapter({_key: 'ch-1', steps: [step({_key: 's1'}), step({_key: 's2'})]})],
      outro: {heading: 'Done!', body: null, ctas: null},
    })
    const renderer = renderNative(<GuidedTour tour={withOutro} step={1} onStepChange={() => {}} />)
    expect(JSON.stringify(renderer.toJSON())).toContain('2 / 2')

    // Completes the tour and shows the outro; the controlled `step` (1) is
    // never touched by this — `onStepChange` isn't called on the
    // last-step Next once `showOutro` takes over.
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    expect(JSON.stringify(renderer.toJSON())).toContain('Done!')

    // The consumer drives `step` back to 0 itself — entirely independent of
    // the component's own Prev/goTo path (which never fires here).
    actNative(() =>
      renderer.update(<GuidedTour tour={withOutro} step={0} onStepChange={() => {}} />),
    )

    const json = JSON.stringify(renderer.toJSON())
    expect(json).not.toContain('Done!')
    expect(json).toContain('1 / 2')
  })
})

describe('GuidedTourNative: event sequence parity with web', () => {
  test('tour_started precedes the first step_viewed; Next emits step_viewed per step; the last step (no outro) emits tour_completed', () => {
    const events: GuidedTourEvent[] = []
    const renderer = renderNative(
      <GuidedTour tour={threeStepTour()} onEvent={(event) => events.push(event)} />,
    )
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())

    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'step_viewed',
      'step_viewed',
    ])

    actNative(() => findByLabel(renderer, 'Next')?.props.onPress()) // last step's Next, no outro
    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'step_viewed',
      'step_viewed',
      'tour_completed',
    ])
  })

  test('a tour with an outro: the last step Next emits tour_completed THEN the outro shows (no separate event for the outro itself)', () => {
    const events: GuidedTourEvent[] = []
    const withOutro = tour({
      chapters: [chapter({_key: 'ch-1', steps: [step({_key: 's1'})]})],
      outro: {heading: 'Done', body: null, ctas: null},
    })
    const renderer = renderNative(
      <GuidedTour tour={withOutro} onEvent={(event) => events.push(event)} />,
    )
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    expect(events.map((event) => event.type)).toEqual([
      'tour_started',
      'step_viewed',
      'tour_completed',
    ])
  })

  test('unmounting mid-tour emits tour_abandoned with the last-viewed step index', async () => {
    const events: GuidedTourEvent[] = []
    const renderer = renderNative(
      <GuidedTour tour={threeStepTour()} onEvent={(event) => events.push(event)} />,
    )
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    actNative(() => renderer.unmount())
    // `scheduleAbandon` (session.ts) fires via a REAL `setTimeout(..., 0)` —
    // react-test-renderer has no fake-timer flushing, so this waits for an
    // actual macrotask tick past it.
    await new Promise((resolve) => setTimeout(resolve, 10))

    const abandoned = events.find((event) => event.type === 'tour_abandoned')
    expect(abandoned).toEqual({
      type: 'tour_abandoned',
      lastStepIndex: 1,
      durationMs: expect.any(Number),
    })
  })

  test('a hotspot click emits element_clicked with elementType hotspot', () => {
    const events: GuidedTourEvent[] = []
    const withHotspot = tour({
      chapters: [
        chapter({
          _key: 'ch-1',
          steps: [
            step({
              _key: 's1',
              advance: 'button',
              elements: [
                {
                  _type: 'guidedTourHotspot',
                  _key: 'h1',
                  x: 50,
                  y: 50,
                  mobile: null,
                  label: null,
                  action: 'reveal',
                  href: null,
                  pulse: false,
                },
              ],
            }),
          ],
        }),
      ],
    })
    const renderer = renderNative(
      <GuidedTour tour={withHotspot} onEvent={(event) => events.push(event)} />,
    )
    const hotspotPressable = renderer.root
      .findAllByType(Pressable)
      .find((p) => p.props.accessibilityLabel === 'Show information')
    actNative(() => hotspotPressable?.props.onPress())
    expect(events).toContainEqual({
      type: 'element_clicked',
      elementType: 'hotspot',
      elementKey: 'h1',
    })
  })
})

describe('GuidedTourNative: personalization', () => {
  test('the title is personalized from tokens (viewer-supplied, falling back to defaultValue)', () => {
    const personalized = tour({
      title: 'Hi {{name}}',
      tokens: [token({key: 'name', defaultValue: 'there'})],
    })
    const withDefault = renderNative(<GuidedTour tour={personalized} />)
    expect(JSON.stringify(withDefault.toJSON())).toContain('Hi there')

    const withProvided = renderNative(<GuidedTour tour={personalized} tokens={{name: 'Ada'}} />)
    expect(JSON.stringify(withProvided.toJSON())).toContain('Hi Ada')
  })
})

describe('GuidedTourNative: theming and colorScheme', () => {
  test('theme colors land in the header title style object', () => {
    const themed = tour({theme: theme({text: '#123456'})})
    const renderer = renderNative(<GuidedTour tour={themed} />)
    const title = renderer.root.findAllByType(Text).find((t) => t.props.children === 'Test tour')
    expect(flattenStyle(title?.props.style).color).toBe('#123456')
  })

  test('colorScheme="dark" forces the dark theme fields regardless of the (stubbed) system scheme', () => {
    const themed = tour({
      theme: theme({
        text: '#light',
        dark: {accent: null, surface: null, text: '#dark', overlay: null},
      }),
    })
    const renderer = renderNative(<GuidedTour tour={themed} colorScheme="dark" />)
    const title = renderer.root.findAllByType(Text).find((t) => t.props.children === 'Test tour')
    expect(flattenStyle(title?.props.style).color).toBe('#dark')
  })

  test('colorScheme="light" (and "auto", since the stub\'s useColorScheme() returns "light") resolves the light theme fields', () => {
    const themed = tour({
      theme: theme({
        text: '#light',
        dark: {accent: null, surface: null, text: '#dark', overlay: null},
      }),
    })
    for (const colorScheme of ['light', 'auto'] as const) {
      const renderer = renderNative(<GuidedTour tour={themed} colorScheme={colorScheme} />)
      const title = renderer.root.findAllByType(Text).find((t) => t.props.children === 'Test tour')
      expect(flattenStyle(title?.props.style).color).toBe('#light')
    }
  })
})

describe('GuidedTourNative: accessibility', () => {
  test('the progress bar carries accessibilityRole progressbar and an accessibilityValue', () => {
    const renderer = renderNative(<GuidedTour tour={threeStepTour()} />)
    const progress = renderer.root
      .findAllByType(View)
      .find((v) => v.props.accessibilityRole === 'progressbar')
    expect(progress?.props.accessibilityValue).toEqual({min: 1, max: 3, now: 1})
  })

  test('AccessibilityInfo.announceForAccessibility fires on step change with the step announcement text', () => {
    const announceSpy = spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(
      () => {},
    )
    const renderer = renderNative(<GuidedTour tour={threeStepTour()} />)
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())

    const messages = announceSpy.mock.calls.map((call) => call[0])
    expect(messages.some((message) => message.includes('Step 2 of 3'))).toBe(true)
    announceSpy.mockRestore()
  })

  test('announces the outro heading once the tour completes into it', () => {
    const announceSpy = spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(
      () => {},
    )
    const withOutro = tour({
      chapters: [chapter({_key: 'ch-1', steps: [step({_key: 's1'})]})],
      outro: {heading: 'All done', body: null, ctas: null},
    })
    const renderer = renderNative(<GuidedTour tour={withOutro} />)
    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())

    const messages = announceSpy.mock.calls.map((call) => call[0])
    expect(messages.some((message) => message.includes('All done'))).toBe(true)
    announceSpy.mockRestore()
  })
})

describe('GuidedTourNative: Ruling A (sibling prefetch) integration', () => {
  test("prefetches the next step's screenshot on mount, and the (new) next after advancing", () => {
    // Distinct per-step screenshot URLs (unlike `threeStepTour()`'s default
    // fixture, where every step shares one URL — fine for navigation tests,
    // but it would make every "sibling" prefetch a dedup no-op here).
    const distinctTour = tour({
      chapters: [
        chapter({
          _key: 'ch-1',
          steps: [
            step({_key: 's1', screenshot: image({url: 'https://cdn.example.com/0.png'})}),
            step({_key: 's2', screenshot: image({url: 'https://cdn.example.com/1.png'})}),
            step({_key: 's3', screenshot: image({url: 'https://cdn.example.com/2.png'})}),
          ],
        }),
      ],
    })
    const prefetchSpy = spyOn(Image, 'prefetch').mockImplementation(() => Promise.resolve(true))
    const renderer = renderNative(<GuidedTour tour={distinctTour} />)
    expect(prefetchSpy).toHaveBeenCalledTimes(1) // only step 2's (index 1) screenshot — step 0 has no previous
    expect(prefetchSpy).toHaveBeenCalledWith('https://cdn.example.com/1.png')

    actNative(() => findByLabel(renderer, 'Next')?.props.onPress())
    // Now on step index 1: previous (0.png) and next (2.png) are BOTH new.
    expect(prefetchSpy).toHaveBeenCalledTimes(3)
    expect(prefetchSpy.mock.calls.map((call) => call[0]).sort()).toEqual([
      'https://cdn.example.com/0.png',
      'https://cdn.example.com/1.png',
      'https://cdn.example.com/2.png',
    ])
    prefetchSpy.mockRestore()
  })
})

describe('GuidedTourNative: chapter menu visibility', () => {
  test('settings.showChapterMenu=false hides the chapter row', () => {
    const twoChapterTour = tour({
      chapters: [
        chapter({_key: 'ch-1', title: 'First', steps: [step({_key: 's1'})]}),
        chapter({_key: 'ch-2', title: 'Second', steps: [step({_key: 's2'})]}),
      ],
      settings: {showProgress: true, showChapterMenu: false, showStepDots: true},
    })
    const renderer = renderNative(<GuidedTour tour={twoChapterTour} />)
    expect(renderer.root.findAllByType(ScrollView).length).toBe(0)
  })
})
