import {afterEach, describe, expect, test} from 'bun:test'

import {act, cleanup, fireEvent, render} from '@testing-library/react'

import type {
  GuidedTourChapter,
  GuidedTourDoc,
  GuidedTourElement,
  GuidedTourHotspot,
  GuidedTourImage,
  GuidedTourSettings,
  GuidedTourStep,
  GuidedTourTextOverlay,
  GuidedTourTooltip,
} from '../../src/queries/types'
import {GuidedTour, type GuidedTourProps} from '../../src/react/GuidedTour'
import {buildSrcSet, buildSrcSetWidths, withWidth} from '../../src/react/Image'
import {applyMobileOverride} from '../../src/react/Step'
import type {GuidedTourImageProps} from '../../src/react/types'
import {installMatchMedia} from '../setup/matchMedia'

const MOBILE_QUERY = '(max-width: 640px)'

afterEach(() => {
  cleanup()
})

// Fixture builders — same convention as test/react/elements.test.tsx and
// test/react/advance.test.tsx: narrow hand types matching the query
// result shapes exactly (`as` casts are banned by oxlint), every nullable
// field explicit so fixtures compile without surprises.

function image(overrides: Partial<GuidedTourImage> = {}): GuidedTourImage {
  return {
    url: 'https://cdn.sanity.io/images/proj/ds/abc-100x100.png',
    dimensions: {width: 100, height: 50, aspectRatio: 2},
    lqip: null,
    alt: null,
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

function tooltip(overrides: Partial<GuidedTourTooltip> & {_key: string}): GuidedTourTooltip {
  return {
    _type: 'guidedTourTooltip',
    x: 50,
    y: 50,
    mobile: null,
    width: 200,
    content: [],
    placement: 'auto',
    trigger: 'click',
    ...overrides,
  }
}

function textOverlay(
  overrides: Partial<GuidedTourTextOverlay> & {_key: string},
): GuidedTourTextOverlay {
  return {
    _type: 'guidedTourTextOverlay',
    x: 50,
    y: 50,
    mobile: null,
    width: 30,
    content: [],
    background: 'surface',
    opacity: 90,
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

// Narrowing `Element | null` to `Element` with `as` is banned (oxlint);
// throwing keeps every call site a plain assertion instead.
function query(container: ParentNode, selector: string): Element {
  const element = container.querySelector(selector)
  if (!element) throw new Error(`expected to find ${selector}`)
  return element
}

function queryAll(container: ParentNode, selector: string): Element[] {
  return [...container.querySelectorAll(selector)]
}

describe('buildSrcSetWidths', () => {
  test('no known dimensions falls back to the full fixed bucket list', () => {
    expect(buildSrcSetWidths(null)).toEqual([640, 960, 1280, 1920, 2560])
  })

  test('native width between two buckets: larger buckets dropped, native folded back in', () => {
    expect(buildSrcSetWidths(1500)).toEqual([640, 960, 1280, 1500])
  })

  test('native width exactly matching a bucket: that bucket is not duplicated', () => {
    expect(buildSrcSetWidths(1920)).toEqual([640, 960, 1280, 1920])
  })

  test('native width at or above the largest bucket: fixed list unchanged, native not appended', () => {
    expect(buildSrcSetWidths(2560)).toEqual([640, 960, 1280, 1920, 2560])
    expect(buildSrcSetWidths(3000)).toEqual([640, 960, 1280, 1920, 2560])
  })

  test('native width below the smallest bucket: every bucket dropped, only native remains', () => {
    expect(buildSrcSetWidths(100)).toEqual([100])
  })
})

describe('withWidth / buildSrcSet', () => {
  test('joins the CDN query with "?" when the URL has none', () => {
    expect(withWidth('https://cdn.sanity.io/img.png', 640)).toBe(
      'https://cdn.sanity.io/img.png?w=640&auto=format&q=80',
    )
  })

  test('joins with "&" when the URL already carries a query string', () => {
    expect(withWidth('https://cdn.sanity.io/img.png?foo=bar', 640)).toBe(
      'https://cdn.sanity.io/img.png?foo=bar&w=640&auto=format&q=80',
    )
  })

  test('builds one "url width" candidate per bucket, comma-separated', () => {
    expect(buildSrcSet('https://cdn.sanity.io/img.png', 960)).toBe(
      'https://cdn.sanity.io/img.png?w=640&auto=format&q=80 640w, ' +
        'https://cdn.sanity.io/img.png?w=960&auto=format&q=80 960w',
    )
  })
})

describe('applyMobileOverride', () => {
  test('desktop viewport: element returned unchanged even with an override present', () => {
    const element = hotspot({_key: 'h1', x: 10, y: 20, mobile: {x: 90, y: 80, width: null}})
    expect(applyMobileOverride(element, false)).toBe(element)
  })

  test('mobile viewport, no override on the element: returned unchanged', () => {
    const element = hotspot({_key: 'h1', x: 10, y: 20, mobile: null})
    expect(applyMobileOverride(element, true)).toBe(element)
  })

  test('mobile viewport, partial override: only the overridden member changes (per-member, not all-or-nothing)', () => {
    const element = hotspot({_key: 'h1', x: 10, y: 20, mobile: {x: 90, y: null, width: null}})
    const result = applyMobileOverride(element, true)
    expect(result.x).toBe(90)
    expect(result.y).toBe(20) // falls back to the desktop value — not overridden
  })

  test('tooltip width override applies alongside x/y', () => {
    const element = tooltip({
      _key: 't1',
      x: 10,
      y: 20,
      width: 200,
      mobile: {x: 15, y: 25, width: 300},
    })
    const result = applyMobileOverride(element, true)
    expect(result).toEqual({...element, x: 15, y: 25, width: 300})
  })

  test('text overlay width override applies alongside x/y', () => {
    const element = textOverlay({
      _key: 'o1',
      x: 10,
      y: 20,
      width: 30,
      mobile: {x: 15, y: 25, width: 60},
    })
    const result = applyMobileOverride(element, true)
    expect(result).toEqual({...element, x: 15, y: 25, width: 60})
  })

  test('a hotspot has no width field to override — only x/y are ever touched', () => {
    const element: GuidedTourElement = hotspot({
      _key: 'h1',
      x: 10,
      y: 20,
      mobile: {x: 90, y: 80, width: 999},
    })
    const result = applyMobileOverride(element, true)
    expect(result).toEqual({...element, x: 90, y: 80})
    expect('width' in result).toBe(false)
  })
})

describe('Image: default renderer', () => {
  test('current step screenshot: src/srcset/sizes, eager loading, high fetchpriority', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            screenshot: image({
              url: 'https://cdn.sanity.io/images/proj/ds/shot.png',
              dimensions: {width: 1920, height: 1080, aspectRatio: 16 / 9},
            }),
          }),
        ])}
      />,
    )

    const img = query(container, '.gt-screenshot')
    expect(img.getAttribute('src')).toBe(
      'https://cdn.sanity.io/images/proj/ds/shot.png?w=1920&auto=format&q=80',
    )
    expect(img.getAttribute('srcset')).toBe(
      buildSrcSet('https://cdn.sanity.io/images/proj/ds/shot.png', 1920),
    )
    expect(img.getAttribute('sizes')).toBe('100vw')
    expect(img.getAttribute('width')).toBe('1920')
    expect(img.getAttribute('height')).toBe('1080')
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('fetchpriority')).toBe('high')
  })

  test('alt is coalesced from null to an empty string', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', screenshot: image({alt: null})})])} />,
    )

    expect(query(container, '.gt-screenshot').getAttribute('alt')).toBe('')
  })

  test('LQIP renders as an inline background-image before load, and is removed after', () => {
    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', screenshot: image({lqip: 'data:image/png;base64,tiny'})}),
        ])}
      />,
    )

    const img = query(container, '.gt-screenshot')
    const style = img.getAttribute('style') ?? ''
    expect(style).toContain('background-image')
    expect(style).toContain('data:image/png;base64,tiny')

    fireEvent.load(img)

    expect(img.getAttribute('style') ?? '').not.toContain('background-image')
  })

  test('no LQIP: no background-image style at all', () => {
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1', screenshot: image({lqip: null})})])} />,
    )

    expect(query(container, '.gt-screenshot').getAttribute('style')).toBeNull()
  })
})

describe('preload wrappers (±1 steps)', () => {
  function threeStepTour(): GuidedTourDoc {
    return oneChapterTour([
      step({_key: 's1', screenshot: image({url: 'https://cdn.sanity.io/img1.png'})}),
      step({_key: 's2', screenshot: image({url: 'https://cdn.sanity.io/img2.png'})}),
      step({_key: 's3', screenshot: image({url: 'https://cdn.sanity.io/img3.png'})}),
    ])
  }

  test('first step: only a next-step preload, none for a nonexistent previous step', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)

    const preloads = queryAll(container, '.gt-preload')
    expect(preloads).toHaveLength(1)
    expect(preloads[0]?.getAttribute('aria-hidden')).toBe('true')
    const preloadImg = query(preloads[0] ?? container, 'img')
    expect(preloadImg.getAttribute('src')).toContain('img2.png')
  })

  test('middle step: both a previous- and a next-step preload', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} step={1} />)

    const preloads = queryAll(container, '.gt-preload')
    expect(preloads).toHaveLength(2)
    const urls = preloads.map((preload) => query(preload, 'img').getAttribute('src'))
    expect(urls.some((url) => url?.includes('img1.png'))).toBe(true)
    expect(urls.some((url) => url?.includes('img3.png'))).toBe(true)
  })

  test('last step: only a previous-step preload', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} step={2} />)

    const preloads = queryAll(container, '.gt-preload')
    expect(preloads).toHaveLength(1)
    expect(query(preloads[0] ?? container, 'img').getAttribute('src')).toContain('img2.png')
  })

  test('preloaded images use eager loading and low fetchpriority — never lazy', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} />)

    const preloadImg = query(query(container, '.gt-preload'), 'img')
    expect(preloadImg.getAttribute('loading')).toBe('eager')
    expect(preloadImg.getAttribute('fetchpriority')).toBe('low')
  })

  test('the current screenshot is not itself wrapped in .gt-preload', () => {
    const {container} = render(<GuidedTour tour={threeStepTour()} step={1} />)

    expect(query(container, '.gt-screenshot').closest('.gt-preload')).toBeNull()
  })
})

describe('renderImage override', () => {
  // `Step` calls `renderImage` once per screenshot it renders (current +
  // up to two preloaded neighbors) on *every* invocation of its own render
  // function — and it is invoked twice per commit, an existing (pre-Task-7)
  // consequence of the "adjust state during render" pattern its
  // auto-tooltip reset uses (calling `setState` mid-render makes React
  // immediately re-invoke the function once more before committing; see
  // `Step`'s doc comment). Only the *second* invocation's output actually
  // reaches the DOM, so a raw `calls` array holds two entries per screenshot
  // — this keeps only the last (i.e. committed) call recorded for each
  // distinct `url`, which is what these tests actually want to assert on.
  function latestByUrl(calls: GuidedTourImageProps[]): GuidedTourImageProps[] {
    const byUrl = new Map<string, GuidedTourImageProps>()
    for (const call of calls) byUrl.set(call.url, call)
    return [...byUrl.values()]
  }

  function collectingRenderImage(): {
    calls: GuidedTourImageProps[]
    renderImage: NonNullable<GuidedTourProps['renderImage']>
  } {
    const calls: GuidedTourImageProps[] = []
    return {
      calls,
      renderImage: (props) => {
        calls.push(props)
        return (
          <img
            data-testid="custom-image"
            data-priority={String(props.priority ?? false)}
            src={props.url}
            alt={props.alt}
          />
        )
      },
    }
  }

  test('replaces the default renderer entirely — no plain <img class="gt-screenshot"> renders', () => {
    const {renderImage} = collectingRenderImage()
    const {container} = render(
      <GuidedTour tour={oneChapterTour([step({_key: 's1'})])} renderImage={renderImage} />,
    )

    expect(container.querySelector('img.gt-screenshot')).toBeNull()
    expect(container.querySelectorAll('[data-testid="custom-image"]')).toHaveLength(1)
  })

  test('receives the raw (un-decorated) url, coalesced alt, dimensions, and lqip', () => {
    const {calls, renderImage} = collectingRenderImage()
    render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            screenshot: image({
              url: 'https://cdn.sanity.io/images/proj/ds/shot.png',
              dimensions: {width: 800, height: 400, aspectRatio: 2},
              lqip: 'data:image/png;base64,tiny',
              alt: null,
            }),
          }),
        ])}
        renderImage={renderImage}
      />,
    )

    expect(latestByUrl(calls)).toHaveLength(1)
    expect(latestByUrl(calls)[0]).toMatchObject({
      url: 'https://cdn.sanity.io/images/proj/ds/shot.png',
      alt: '',
      width: 800,
      height: 400,
      lqip: 'data:image/png;base64,tiny',
    })
  })

  test('current step gets priority: true, preloaded neighbors get priority: false', () => {
    const {calls, renderImage} = collectingRenderImage()
    render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', screenshot: image({url: 'https://cdn.sanity.io/img1.png'})}),
          step({_key: 's2', screenshot: image({url: 'https://cdn.sanity.io/img2.png'})}),
        ])}
        renderImage={renderImage}
      />,
    )

    const finalCalls = latestByUrl(calls)
    expect(finalCalls).toHaveLength(2)
    const current = finalCalls.find((call) => call.url.includes('img1.png'))
    const preload = finalCalls.find((call) => call.url.includes('img2.png'))
    expect(current?.priority).toBe(true)
    expect(preload?.priority).toBeFalsy()
  })
})

describe('mobile screenshot and element position overrides', () => {
  afterEach(() => {
    cleanup()
  })

  test('desktop viewport (default): screenshot and element positions are the desktop ones', () => {
    const mm = installMatchMedia()

    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            screenshot: image({url: 'https://cdn.sanity.io/desktop.png'}),
            screenshotMobile: image({url: 'https://cdn.sanity.io/mobile.png'}),
            elements: [hotspot({_key: 'h1', x: 10, y: 20, mobile: {x: 90, y: 80, width: null}})],
          }),
        ])}
      />,
    )

    expect(query(container, '.gt-screenshot').getAttribute('src')).toContain('desktop.png')
    expect(query(container, '.gt-hotspot').getAttribute('style')).toContain('left: 10%')

    mm.restore()
  })

  test('mobile viewport: screenshotMobile replaces screenshot, and per-member overrides apply', () => {
    const mm = installMatchMedia()

    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({
            _key: 's1',
            screenshot: image({url: 'https://cdn.sanity.io/desktop.png'}),
            screenshotMobile: image({url: 'https://cdn.sanity.io/mobile.png'}),
            elements: [hotspot({_key: 'h1', x: 10, y: 20, mobile: {x: 90, y: null, width: null}})],
          }),
        ])}
      />,
    )

    act(() => {
      mm.setMatches(MOBILE_QUERY, true)
    })

    expect(query(container, '.gt-screenshot').getAttribute('src')).toContain('mobile.png')
    const style = query(container, '.gt-hotspot').getAttribute('style')
    expect(style).toContain('left: 90%') // overridden
    expect(style).toContain('top: 20%') // falls back to the desktop value

    mm.restore()
  })

  test('mobile viewport with no screenshotMobile authored: falls back to the desktop screenshot', () => {
    const mm = installMatchMedia()

    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', screenshot: image({url: 'https://cdn.sanity.io/desktop.png'})}),
        ])}
      />,
    )

    act(() => {
      mm.setMatches(MOBILE_QUERY, true)
    })

    expect(query(container, '.gt-screenshot').getAttribute('src')).toContain('desktop.png')

    mm.restore()
  })

  test('a preloaded neighbor also switches to its own mobile screenshot', () => {
    const mm = installMatchMedia()

    const {container} = render(
      <GuidedTour
        tour={oneChapterTour([
          step({_key: 's1', screenshot: image({url: 'https://cdn.sanity.io/s1-desktop.png'})}),
          step({
            _key: 's2',
            screenshot: image({url: 'https://cdn.sanity.io/s2-desktop.png'}),
            screenshotMobile: image({url: 'https://cdn.sanity.io/s2-mobile.png'}),
          }),
        ])}
      />,
    )

    act(() => {
      mm.setMatches(MOBILE_QUERY, true)
    })

    const preloadImg = query(query(container, '.gt-preload'), 'img')
    expect(preloadImg.getAttribute('src')).toContain('s2-mobile.png')

    mm.restore()
  })
})
