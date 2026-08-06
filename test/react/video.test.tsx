import {afterEach, describe, expect, spyOn, test} from 'bun:test'

import {act, cleanup, render} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourStepVideo,
} from '../../src/queries/types'
import {GuidedTour} from '../../src/react/GuidedTour'
import {Video, type VideoProps} from '../../src/react/Video'
import {installIntersectionObserver} from '../setup/intersectionObserver'
import {installMatchMedia} from '../setup/matchMedia'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/image.test.tsx and
// test/react/elements.test.tsx: narrow hand types matching the query
// result shapes exactly (`as` casts are banned by oxlint).

function image(overrides: Partial<GuidedTourImage> = {}): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 50, aspectRatio: 2},
    lqip: null,
    alt: null,
    ...overrides,
  }
}

function video(overrides: Partial<GuidedTourStepVideo> = {}): GuidedTourStepVideo {
  return {
    source: 'file',
    fileUrl: 'https://cdn.sanity.io/files/proj/ds/clip.mp4',
    url: null,
    ...overrides,
  }
}

function hotspot(overrides: Partial<GuidedTourHotspot> & {_key: string}): GuidedTourHotspot {
  return {
    _type: 'guidedTourHotspot',
    x: 50,
    y: 50,
    mobile: null,
    label: null,
    action: 'advance',
    href: null,
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

function tour(overrides: Partial<GuidedTourDoc> = {}): GuidedTourDoc {
  return {
    _id: 'tour-1',
    title: 'Test tour',
    slug: 'test-tour',
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

/** A single-chapter tour from the given steps — the common case here. */
function oneChapterTour(steps: GuidedTourStep[]): GuidedTourDoc {
  return tour({chapters: [chapter(steps)]})
}

function videoProps(overrides: Partial<VideoProps> = {}): VideoProps {
  return {
    fileUrl: 'https://cdn.sanity.io/files/proj/ds/clip.mp4',
    url: null,
    posterUrl: 'https://cdn.sanity.io/images/proj/ds/shot.png',
    ariaLabel: 'Intro video',
    className: 'gt-video',
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

function queryVideoEl(container: ParentNode): HTMLVideoElement {
  const element = container.querySelector('video')
  if (!element) throw new Error('expected to find a <video> element')
  return element
}

describe('Video: src/poster resolution', () => {
  test('fileUrl takes precedence over url when both are somehow present', () => {
    const {container} = render(
      <Video
        {...videoProps({
          fileUrl: 'https://cdn.sanity.io/files/proj/ds/clip.mp4',
          url: 'https://example.com/fallback.mp4',
        })}
      />,
    )

    expect(queryVideoEl(container).getAttribute('src')).toBe(
      'https://cdn.sanity.io/files/proj/ds/clip.mp4',
    )
  })

  test('falls back to url when fileUrl is null (the "url" source variant)', () => {
    const {container} = render(
      <Video {...videoProps({fileUrl: null, url: 'https://example.com/direct.mp4'})} />,
    )

    expect(queryVideoEl(container).getAttribute('src')).toBe('https://example.com/direct.mp4')
  })

  test('poster is the resolved screenshot URL passed in, regardless of source', () => {
    const {container} = render(
      <Video {...videoProps({posterUrl: 'https://cdn.sanity.io/images/proj/ds/poster.png'})} />,
    )

    expect(queryVideoEl(container).getAttribute('poster')).toBe(
      'https://cdn.sanity.io/images/proj/ds/poster.png',
    )
  })

  test('defensive: both fileUrl and url null (an unvalidated document) renders with no src rather than throwing', () => {
    expect(() =>
      render(<Video {...videoProps({fileUrl: null, url: null})} />),
    ).not.toThrow()
  })

  test('renders the given aria-label verbatim', () => {
    const {container} = render(<Video {...videoProps({ariaLabel: 'Dashboard walkthrough'})} />)
    expect(queryVideoEl(container).getAttribute('aria-label')).toBe('Dashboard walkthrough')
  })
})

describe('Video: fixed attribute matrix', () => {
  test('muted, loop, playsInline, preload=metadata always present; controls absent while motion is allowed', () => {
    const mm = installMatchMedia()
    const {container} = render(<Video {...videoProps()} />)
    const videoEl = queryVideoEl(container)

    expect(videoEl.hasAttribute('muted')).toBe(true)
    expect(videoEl.hasAttribute('loop')).toBe(true)
    expect(videoEl.hasAttribute('playsinline')).toBe(true)
    expect(videoEl.getAttribute('preload')).toBe('metadata')
    expect(videoEl.hasAttribute('controls')).toBe(false)

    mm.restore()
  })

  test('controls appears once reduced motion is (live-)detected — the fixed defaults stay put alongside it', () => {
    const mm = installMatchMedia()
    const {container} = render(<Video {...videoProps()} />)
    const videoEl = queryVideoEl(container)

    act(() => {
      mm.setMatches(REDUCED_MOTION_QUERY, true)
    })

    expect(videoEl.hasAttribute('controls')).toBe(true)
    expect(videoEl.hasAttribute('muted')).toBe(true)
    expect(videoEl.hasAttribute('loop')).toBe(true)
    expect(videoEl.hasAttribute('playsinline')).toBe(true)

    mm.restore()
  })
})

describe('Video: autoplay gating', () => {
  test('visible and motion allowed: play() is called once the observer reports ≥50% intersecting', () => {
    const mm = installMatchMedia()
    const io = installIntersectionObserver()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    try {
      render(<Video {...videoProps()} />)

      act(() => {
        io.latest()?.fire(true)
      })

      expect(playSpy).toHaveBeenCalledTimes(1)
    } finally {
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      io.restore()
      mm.restore()
    }
  })

  test('not (yet) visible: play() is never called — the default state before any observer report matches a real, not-yet-intersecting IntersectionObserver', () => {
    const mm = installMatchMedia()
    const io = installIntersectionObserver()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    try {
      render(<Video {...videoProps()} />)

      expect(playSpy).not.toHaveBeenCalled()
    } finally {
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      io.restore()
      mm.restore()
    }
  })

  test('visibility lost after playing: pause() follows the observer report, no further play()', () => {
    const mm = installMatchMedia()
    const io = installIntersectionObserver()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    try {
      render(<Video {...videoProps()} />)

      act(() => {
        io.latest()?.fire(true)
      })
      expect(playSpy).toHaveBeenCalledTimes(1)

      act(() => {
        io.latest()?.fire(false)
      })
      expect(pauseSpy).toHaveBeenCalled()
      expect(playSpy).toHaveBeenCalledTimes(1)
    } finally {
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      io.restore()
      mm.restore()
    }
  })

  test('reduced motion: play() is never called even while ≥50% visible', () => {
    const mm = installMatchMedia()
    const io = installIntersectionObserver()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    try {
      render(<Video {...videoProps()} />)

      act(() => {
        mm.setMatches(REDUCED_MOTION_QUERY, true)
      })
      act(() => {
        io.latest()?.fire(true)
      })

      expect(playSpy).not.toHaveBeenCalled()
    } finally {
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      io.restore()
      mm.restore()
    }
  })

  test('reduced motion flips on mid-playback: an already-playing video is paused', () => {
    const mm = installMatchMedia()
    const io = installIntersectionObserver()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    try {
      render(<Video {...videoProps()} />)

      act(() => {
        io.latest()?.fire(true)
      })
      expect(playSpy).toHaveBeenCalledTimes(1)

      act(() => {
        mm.setMatches(REDUCED_MOTION_QUERY, true)
      })

      expect(pauseSpy).toHaveBeenCalled()
      expect(playSpy).toHaveBeenCalledTimes(1)
    } finally {
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      io.restore()
      mm.restore()
    }
  })

  test('a rejected play() promise (autoplay-policy denial) is swallowed — never thrown, never left unhandled', async () => {
    const mm = installMatchMedia()
    const io = installIntersectionObserver()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.reject(new Error('NotAllowedError')),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    try {
      render(<Video {...videoProps()} />)

      expect(() => {
        act(() => {
          io.latest()?.fire(true)
        })
      }).not.toThrow()

      // Lets the rejected promise's microtask (and its `.catch`) actually
      // run — same empty-act flush idiom `test/react/leadForm.test.tsx`'s
      // `flush()` uses for promise-chain settlement (see its doc comment):
      // an explicit, empty `act(async () => {})` intercepts already-queued
      // work through React's own act-queue rather than relying on a real
      // DOM/scheduler signal that isn't there for a promise that resolves
      // outside any DOM mutation.
      await act(async () => {})

      expect(playSpy).toHaveBeenCalledTimes(1)
    } finally {
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      io.restore()
      mm.restore()
    }
  })

  test('src change on an already-mounted, visible, motion-allowed video: play() is called again for the new source', () => {
    // Mirrors how `Step.tsx` renders `<Video>` without a `key` — navigating
    // between two consecutive video steps updates `fileUrl`/`url` props on
    // the SAME mounted `<Video>` rather than remounting it. Regression
    // coverage for the bug where the playback effect's deps
    // (`[visible, reducedMotion]`) never included the resolved source, so a
    // step-to-step source change never re-triggered `.play()`.
    const mm = installMatchMedia()
    const io = installIntersectionObserver()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    try {
      const {rerender} = render(
        <Video
          {...videoProps({fileUrl: 'https://cdn.sanity.io/files/proj/ds/a.mp4', url: null})}
        />,
      )

      act(() => {
        io.latest()?.fire(true)
      })
      expect(playSpy).toHaveBeenCalledTimes(1)

      rerender(
        <Video
          {...videoProps({fileUrl: 'https://cdn.sanity.io/files/proj/ds/b.mp4', url: null})}
        />,
      )

      expect(playSpy).toHaveBeenCalledTimes(2)
    } finally {
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      io.restore()
      mm.restore()
    }
  })

  test('src change while reduced motion is on: play() is still never called for the new source', () => {
    const mm = installMatchMedia()
    const io = installIntersectionObserver()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

    try {
      const {rerender} = render(
        <Video
          {...videoProps({fileUrl: 'https://cdn.sanity.io/files/proj/ds/a.mp4', url: null})}
        />,
      )

      act(() => {
        mm.setMatches(REDUCED_MOTION_QUERY, true)
      })
      act(() => {
        io.latest()?.fire(true)
      })
      expect(playSpy).not.toHaveBeenCalled()

      rerender(
        <Video
          {...videoProps({fileUrl: 'https://cdn.sanity.io/files/proj/ds/b.mp4', url: null})}
        />,
      )

      expect(playSpy).not.toHaveBeenCalled()
    } finally {
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      io.restore()
      mm.restore()
    }
  })

  test('IntersectionObserver unsupported: the video is treated as visible unconditionally (no permanent gate deadlock)', () => {
    const mm = installMatchMedia()
    const playSpy = spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    const pauseSpy = spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const original = globalThis.IntersectionObserver
    Reflect.deleteProperty(globalThis, 'IntersectionObserver')

    try {
      render(<Video {...videoProps()} />)

      expect(playSpy).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.IntersectionObserver = original
      playSpy.mockRestore()
      pauseSpy.mockRestore()
      mm.restore()
    }
  })
})

describe('Video: observer and listener cleanup on unmount', () => {
  test('disconnects the IntersectionObserver', () => {
    const io = installIntersectionObserver()

    try {
      const {unmount} = render(<Video {...videoProps()} />)
      const observer = io.latest()
      expect(observer).not.toBeNull()
      expect(observer?.disconnected).toBe(false)

      unmount()

      expect(observer?.disconnected).toBe(true)
    } finally {
      io.restore()
    }
  })

  test('removes the matchMedia change listener', () => {
    const mm = installMatchMedia()
    const removeSpy = spyOn(EventTarget.prototype, 'removeEventListener')

    try {
      const {unmount} = render(<Video {...videoProps()} />)
      unmount()

      expect(removeSpy).toHaveBeenCalled()
    } finally {
      removeSpy.mockRestore()
      mm.restore()
    }
  })
})

describe('Step: video precedence over the screenshot', () => {
  test('a step with video renders <video>, not the screenshot <img>', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', video: video()})])} />,
    )

    expect(container.querySelector('video.gt-video')).not.toBeNull()
    expect(container.querySelector('img.gt-screenshot')).toBeNull()
  })

  test('video is never stacked alongside the screenshot — exactly one backdrop element renders', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', video: video()})])} />,
    )

    // `.gt-elements` and any preload siblings can contain further nodes;
    // this counts only the actual backdrop candidates.
    const backdrops = [
      ...container.querySelectorAll('.gt-step > .gt-video, .gt-step > .gt-screenshot'),
    ]
    expect(backdrops).toHaveLength(1)
  })

  test('poster resolves from the step\'s screenshot URL', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            screenshot: image({url: 'https://cdn.sanity.io/images/proj/ds/poster.png'}),
            video: video(),
          }),
        ])}
      />,
    )

    expect(query(container, '.gt-video').getAttribute('poster')).toBe(
      'https://cdn.sanity.io/images/proj/ds/poster.png',
    )
  })

  test('aria-label is taken from the step title', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([step({_key: 's1', title: 'Welcome aboard', video: video()})])}
      />,
    )

    expect(query(container, '.gt-video').getAttribute('aria-label')).toBe('Welcome aboard')
  })

  test('a null step title falls back to a non-empty generic aria-label, not an empty string', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', title: null, video: video()})])} />,
    )

    const label = query(container, '.gt-video').getAttribute('aria-label')
    expect(label).not.toBe('')
    expect(label).not.toBeNull()
  })

  test('a preloaded neighbor with its own video still renders as a screenshot <img> preload, never a preloaded <video>', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1'}),
          step({_key: 's2', video: video({fileUrl: 'https://cdn.sanity.io/files/next.mp4'})}),
        ])}
      />,
    )

    const preload = query(container, '.gt-preload')
    expect(preload.querySelector('video')).toBeNull()
    expect(preload.querySelector('img.gt-screenshot')).not.toBeNull()
  })

  test('regression: a step with no video renders exactly the screenshot <img>, unchanged', () => {
    const {container} = render(<GuidedTour tour={oneChapterTour([step({_key: 's1'})])} />)

    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('img.gt-screenshot')).not.toBeNull()
  })
})

describe('geometry: hotspot percent placement is unaffected on a video step', () => {
  // Extends the same invariant `test/react/image.test.tsx`'s mobile-override
  // suite asserts for the screenshot case — `.gt-elements` positions
  // against `.gt-step`, not against whichever backdrop element
  // (`.gt-screenshot` or `.gt-video`) happens to be rendered inside it, so
  // swapping one for the other must never move a hotspot.
  test('hotspot left/top percentages match the authored x/y regardless of the video backdrop', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            video: video(),
            elements: [hotspot({_key: 'h1', x: 25, y: 65})],
          }),
        ])}
      />,
    )

    expect(query(container, '.gt-video')).not.toBeNull()
    const style = query(container, '.gt-hotspot').getAttribute('style')
    expect(style).toContain('left: 25%')
    expect(style).toContain('top: 65%')
  })
})
