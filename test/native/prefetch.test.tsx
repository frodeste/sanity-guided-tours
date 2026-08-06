import {afterEach, describe, expect, spyOn, test} from 'bun:test'

import type {ReactNode} from 'react'
import {Image} from 'react-native'

import {usePrefetchSiblings} from '../../src/native/prefetch'
import {actNativeAsync, renderNative} from '../support/react-native-stub/renderNative'

function Probe({
  previousUrl,
  nextUrl,
}: {
  previousUrl: string | null
  nextUrl: string | null
}): ReactNode {
  usePrefetchSiblings(previousUrl, nextUrl)
  return null
}

// `spyOn` on an already-spied method returns the SAME mock (it doesn't
// reset call history) — without restoring between tests, a later test's
// `.toHaveBeenCalledTimes(...)` would count every earlier test's calls too.
// `mockRestore()` reverts to the stub's real (unmocked) `Image.prefetch`,
// so the next test's `spyOn` starts a genuinely fresh mock.
afterEach(() => {
  spyOn(Image, 'prefetch').mockRestore()
})

describe('usePrefetchSiblings (Ruling A)', () => {
  test('prefetches BOTH the previous and next step screenshot URLs', () => {
    const prefetchSpy = spyOn(Image, 'prefetch').mockImplementation(() => Promise.resolve(true))

    renderNative(
      <Probe
        previousUrl="https://cdn.example.com/prev.png"
        nextUrl="https://cdn.example.com/next.png"
      />,
    )

    expect(prefetchSpy).toHaveBeenCalledTimes(2)
    expect(prefetchSpy.mock.calls.map((call) => call[0]).sort()).toEqual([
      'https://cdn.example.com/next.png',
      'https://cdn.example.com/prev.png',
    ])
  })

  test('skips null URLs (the ends of the tour)', () => {
    const prefetchSpy = spyOn(Image, 'prefetch').mockImplementation(() => Promise.resolve(true))

    renderNative(<Probe previousUrl={null} nextUrl="https://cdn.example.com/next.png" />)

    expect(prefetchSpy).toHaveBeenCalledTimes(1)
    expect(prefetchSpy).toHaveBeenCalledWith('https://cdn.example.com/next.png')
  })

  test('dedupes per URL per mount — re-rendering with the SAME urls does not re-prefetch', async () => {
    const prefetchSpy = spyOn(Image, 'prefetch').mockImplementation(() => Promise.resolve(true))

    const renderer = renderNative(
      <Probe previousUrl="https://cdn.example.com/a.png" nextUrl="https://cdn.example.com/b.png" />,
    )
    expect(prefetchSpy).toHaveBeenCalledTimes(2)

    await actNativeAsync(async () => {
      renderer.update(
        <Probe
          previousUrl="https://cdn.example.com/a.png"
          nextUrl="https://cdn.example.com/b.png"
        />,
      )
    })

    expect(prefetchSpy).toHaveBeenCalledTimes(2) // no new calls — both URLs already attempted this mount
  })

  test('a NEW url (step change) is prefetched, but a previously-seen one is not re-attempted even if it recurs', async () => {
    const prefetchSpy = spyOn(Image, 'prefetch').mockImplementation(() => Promise.resolve(true))

    const renderer = renderNative(
      <Probe previousUrl="https://cdn.example.com/a.png" nextUrl="https://cdn.example.com/b.png" />,
    )
    expect(prefetchSpy).toHaveBeenCalledTimes(2)

    // Simulates stepping forward: the old "next" (b.png) becomes irrelevant,
    // a genuinely new "next" (c.png) appears — "a.png" recurs as the new
    // "previous" (the step we just left) and must NOT be re-attempted.
    await actNativeAsync(async () => {
      renderer.update(
        <Probe
          previousUrl="https://cdn.example.com/a.png"
          nextUrl="https://cdn.example.com/c.png"
        />,
      )
    })

    expect(prefetchSpy).toHaveBeenCalledTimes(3)
    expect(prefetchSpy.mock.calls.at(-1)).toEqual(['https://cdn.example.com/c.png'])
  })

  test('ignores a rejected prefetch silently (no throw, no unhandled rejection)', async () => {
    spyOn(Image, 'prefetch').mockImplementation(() => Promise.reject(new Error('offline')))

    expect(() =>
      renderNative(<Probe previousUrl="https://cdn.example.com/a.png" nextUrl={null} />),
    ).not.toThrow()

    // Let the rejected promise's `.catch` settle before the test ends, so a
    // stray unhandled-rejection doesn't leak into a LATER test.
    await actNativeAsync(async () => {
      await Promise.resolve()
    })
  })
})
