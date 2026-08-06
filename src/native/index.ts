/**
 * The `sanity-plugin-guided-tours/native` entry (M8 Task 2): a React Native
 * / Expo viewer built from RN primitives, reusing the SAME DOM-free core
 * the web viewer (`../react`) already depends on — `navigation.ts`,
 * `personalize.ts`, `events.ts`/`session.ts`, and `../queries`' types — so
 * flattening, token substitution, event sequencing and session handling
 * behave identically on both runtimes instead of two independently
 * maintained copies drifting apart.
 *
 * Deliberately carries NO `'use client'` banner — unlike `../react/index.ts`
 * (React Server Components' client boundary directive) this entry has no
 * RSC boundary to mark: React Native has no server/client component split
 * at all, so the directive would be meaningless here (`package.config.ts`'s
 * Rollup banner scopes `'use client'` to exactly the `react/index.js`
 * output chunk for this same reason — see that file's own comment).
 *
 * Native viewer components (`GuidedTour`, `GuidedTourModal`) land in Task 3,
 * re-exported from here alongside `resolveNativeTheme` — the internal
 * pieces (`StepNative`, `HotspotNative`, `TooltipNative`, `OverlayNative`,
 * `OutroNative`, `PortableTextNative`, the layout/reduced-motion/prefetch
 * helpers) stay unexported, same "internal, not part of the public
 * surface" convention `../react/index.ts` uses for its own `Step`/
 * `Hotspot`/`Tooltip`/`TextOverlay`/`PortableText`.
 */
export {resolveNativeTheme} from './nativeTheme'
export type {NativeTheme} from './nativeTheme'
export {GuidedTour} from './GuidedTourNative'
export type {GuidedTourNativeProps, NativeColorScheme} from './GuidedTourNative'
export {GuidedTourModal} from './GuidedTourModalNative'
export type {GuidedTourModalNativeProps} from './GuidedTourModalNative'
export type {GuidedTourEvent, GuidedTourEventHandler} from '../react/events'
export {defaultLabels} from '../react/labels'
export type {GuidedTourLabels} from '../react/labels'
