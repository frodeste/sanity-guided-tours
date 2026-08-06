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
 * Native viewer components (`GuidedTour`, `Step`, `Hotspot`, ...) land in
 * Task 3 and get re-exported from here alongside `resolveNativeTheme`; this
 * file only exports the theme resolver for now.
 */
export {resolveNativeTheme} from './nativeTheme'
export type {NativeTheme} from './nativeTheme'
