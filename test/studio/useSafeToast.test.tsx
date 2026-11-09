// Upload notifications must reach a real ToastProvider and safely degrade
// to a no-op in the smoke tests that render without Studio context.
import {afterEach, describe, expect, test} from 'bun:test'

import {LayerProvider, ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {ToastProvider} from '@sanity/ui/toast'
import {act, cleanup, renderHook, screen} from '@testing-library/react'
import type {ReactNode} from 'react'

import {useSafeToast} from '../../src/studio/useSafeToast'

afterEach(cleanup)

describe('useSafeToast', () => {
  test('delivers an upload notification through the UI 4 toast provider', () => {
    const wrapper = ({children}: {children: ReactNode}) => (
      <ThemeProvider theme={buildTheme()}>
        <LayerProvider>
          <ToastProvider>{children}</ToastProvider>
        </LayerProvider>
      </ThemeProvider>
    )
    const {result} = renderHook(() => useSafeToast(), {wrapper})

    act(() => result.current.push({title: '2 uploaded', status: 'success'}))

    expect(screen.getByText('2 uploaded')).toBeTruthy()
  })

  test('returns a no-op push instead of throwing when there is no ToastProvider ancestor', () => {
    const {result} = renderHook(() => useSafeToast())

    expect(typeof result.current.push).toBe('function')
    expect(() => result.current.push({title: 'x'})).not.toThrow()
  })
})
