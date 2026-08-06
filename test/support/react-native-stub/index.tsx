/**
 * A minimal, test-only stand-in for the `react-native` package (M8 Task 3).
 *
 * `src/native/*.tsx` imports real `react-native` types (via the
 * `react-native` devDependency's bundled `.d.ts` files, per Task 2's
 * decision — `tsc --noEmit` resolves those for real). At RUNTIME, though,
 * the actual `react-native` package can't run under Bun/Node at all (it
 * assumes a Hermes/JSC host with native modules) — so `bun test` never
 * loads the real package. Instead, `test/setup/reactNativeStub.ts` (a
 * `bunfig.toml` `[test] preload` entry, registered via a `Bun.plugin`
 * `onLoad` hook — see that file's own doc comment for the mechanism and why
 * `onLoad` rather than `onResolve`) rewrites every `from 'react-native'`
 * import to resolve to THIS file's exports instead, for the whole test run.
 *
 * Each export below is a plain function/object with just enough runtime
 * behavior for `react-test-renderer` to build an inspectable tree and for
 * `src/native/*.tsx`'s logic to actually run against it — NOT a faithful
 * reimplementation of React Native. Host components (`View`, `Text`, ...)
 * are ordinary function components rendering literal, custom JSX tags
 * (`<rn-view>` etc., declared as `JSX.IntrinsicElements` below purely so
 * these can be real JSX rather than `createElement(...)` calls, which the
 * shared oxlint config forbids) — react-test-renderer doesn't render to a
 * real platform, so any string tag works as a "host component" for its
 * purposes. Tests inspect the tree via `renderer.root.findAllByType(View)`
 * (importing the same `View` function this file exports) and read `.props`
 * off the result, or call `.props.onPress()` / `.props.onLayout(...)` etc.
 * directly to simulate an interaction, rather than using
 * `@testing-library/react-native` (not a dependency here) or firing real
 * touch events (there are none to fire).
 */
import type {ReactNode} from 'react'

// `jsx: 'react-jsx'` (tsconfig) resolves `JSX.IntrinsicElements` through
// `react/jsx-runtime`'s own re-exported `JSX` namespace (which is
// `React.JSX`, itself nested inside `declare namespace React {...}` in
// `@types/react`) — NOT a bare ambient `declare global { namespace JSX
// {...} } `, which the classic (`jsx: 'react'`) transform used and this
// repo no longer does. Augmenting `declare module 'react'` (rather than
// `'react/jsx-runtime'` directly) is enough since the runtime module only
// re-exports the very same namespace object; either would work, but this
// keeps the augmentation next to where `@types/react` itself declares it.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'rn-view': Record<string, unknown>
      'rn-text': Record<string, unknown>
      'rn-image': Record<string, unknown>
      'rn-pressable': Record<string, unknown>
      'rn-modal': Record<string, unknown>
      'rn-scrollview': Record<string, unknown>
    }
  }
}

/** Broad enough for every stub component below — `unknown` rather than RN's real `StyleProp<T>` since this file is never typechecked against real RN types (it's a runtime stand-in only, resolved in at the Bun plugin layer, never imported by `src/native` source itself). Covers both a plain style object/array AND a `Pressable`-style `(state) => style` function — narrowed with `typeof` at the one call site (`Pressable`, below) that needs to tell them apart, so no separate function-typed union member is declared (oxlint's `no-redundant-type-constituents` correctly flags unioning anything with `unknown`, since `unknown` already admits it). */
export type StubStyle = unknown

export interface StubLayoutEvent {
  nativeEvent: {
    layout: {x: number; y: number; width: number; height: number}
  }
}

export interface ViewProps {
  style?: StubStyle
  children?: ReactNode
  onLayout?: (event: StubLayoutEvent) => void
  testID?: string
  accessible?: boolean
  accessibilityRole?: string
  accessibilityLabel?: string
  accessibilityState?: Record<string, boolean | undefined>
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive'
  accessibilityViewIsModal?: boolean
  [prop: string]: unknown
}

export function View(props: ViewProps): ReactNode {
  return <rn-view {...props} />
}

export function Text(props: ViewProps): ReactNode {
  return <rn-text {...props} />
}

export interface ImageProps extends ViewProps {
  source?: {uri: string} | number
  resizeMode?: string
}

interface ImageComponent {
  (props: ImageProps): ReactNode
  prefetch: (url: string) => Promise<boolean>
  getSize: (
    uri: string,
    success: (width: number, height: number) => void,
    failure?: (error: Error) => void,
  ) => void
}

function ImageImpl(props: ImageProps): ReactNode {
  return <rn-image {...props} />
}
ImageImpl.prefetch = (_url: string): Promise<boolean> => Promise.resolve(true)
ImageImpl.getSize = (_uri: string, success: (width: number, height: number) => void): void => {
  success(100, 100)
}

export const Image: ImageComponent = ImageImpl

export interface PressableStateCallback {
  pressed: boolean
}

export interface PressableProps extends Omit<ViewProps, 'style' | 'children'> {
  onPress?: () => void
  onLongPress?: () => void
  disabled?: boolean
  /** A plain style, or (real RN's own `Pressable` shape) a function of press state — see `StubStyle`'s own doc comment for why this stays a single `unknown`-typed member rather than an explicit union. */
  style?: StubStyle
  children?: ReactNode | ((state: PressableStateCallback) => ReactNode)
}

export function Pressable(props: PressableProps): ReactNode {
  const {style, children, ...rest} = props
  const resolvedStyle = typeof style === 'function' ? style({pressed: false}) : style
  const resolvedChildren = typeof children === 'function' ? children({pressed: false}) : children
  return (
    <rn-pressable {...rest} style={resolvedStyle}>
      {resolvedChildren}
    </rn-pressable>
  )
}

export function ScrollView(props: ViewProps): ReactNode {
  return <rn-scrollview {...props} />
}

export interface ModalProps extends ViewProps {
  visible?: boolean
  animationType?: 'none' | 'slide' | 'fade'
  transparent?: boolean
  onRequestClose?: () => void
}

/** Mirrors real RN `Modal`'s "not in the tree at all while `visible` is false" behavior — no portal machinery needed for a JSON-tree renderer. */
export function Modal(props: ModalProps): ReactNode {
  const {visible, children, ...rest} = props
  if (!visible) return null
  return <rn-modal {...rest}>{children}</rn-modal>
}

/**
 * `StyleSheet.flatten`'s real RN contract: a style prop can be a single
 * object, or an (arbitrarily nested) array of styles/falsy values, merged
 * left-to-right with later entries winning. Written as a plain
 * accumulator loop with `Object.assign` (not `Array.prototype.reduce`
 * building a fresh spread object per iteration) — oxlint's
 * `no-accumulating-spread` flags the reduce form as O(n²) for exactly this
 * shape.
 */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    const merged: Record<string, unknown> = {}
    for (const entry of style) Object.assign(merged, flattenStyle(entry))
    return merged
  }
  if (style && typeof style === 'object') return {...style}
  return {}
}

export const StyleSheet = {
  create<T extends Record<string, unknown>>(styles: T): T {
    return styles
  },
  flatten: flattenStyle,
  absoluteFill: {position: 'absolute', left: 0, right: 0, top: 0, bottom: 0},
}

export const Linking = {
  openURL: (_url: string): Promise<void> => Promise.resolve(),
  canOpenURL: (_url: string): Promise<boolean> => Promise.resolve(true),
}

export interface EventSubscription {
  remove: () => void
}

/**
 * Real RN's default (`isReduceMotionEnabled` resolves `false`, no listener
 * ever fires) — tests that need to exercise Ruling B's reduced-motion path
 * replace these two with `spyOn` per-test, restored in `afterEach`, the
 * same convention `test/setup/matchMedia.ts` uses for `window.matchMedia`.
 */
export const AccessibilityInfo = {
  isReduceMotionEnabled: (): Promise<boolean> => Promise.resolve(false),
  addEventListener: (
    _eventName: string,
    _handler: (enabled: boolean) => void,
  ): EventSubscription => ({
    remove: () => {},
  }),
  announceForAccessibility: (_message: string): void => {},
}

export function useColorScheme(): 'light' | 'dark' | null {
  return 'light'
}

export interface WindowDimensions {
  width: number
  height: number
  scale: number
  fontScale: number
}

export function useWindowDimensions(): WindowDimensions {
  return {width: 375, height: 667, scale: 2, fontScale: 1}
}

export const Platform = {
  OS: 'ios' as const,
  select<T>(spec: {ios?: T; android?: T; default?: T}): T | undefined {
    return spec.ios ?? spec.default
  },
}
