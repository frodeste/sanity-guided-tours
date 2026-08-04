import {metadata, viewport} from 'next-sanity/studio'

import Studio from './Studio'

// Route segment config (`dynamic`) and the `metadata`/`viewport` exports
// below only take effect in a server module. This file deliberately has no
// 'use client' directive — `<NextStudio>` itself is entirely
// client-rendered, so it lives in the sibling ./Studio.tsx client
// component instead, following the official next-sanity pattern (see the
// doc comment on `next-sanity/studio`'s `metadata`/`viewport` exports).
// A prior version of this file put 'use client' and `export const dynamic`
// in the same module; Next silently ignored the route segment config there
// (server-module-only, no build error) rather than rejecting it, which is
// why the build previously showed this route as Dynamic (ƒ) instead of
// Static (○) despite the `force-static` export being present.
export {metadata, viewport}

// The Studio bundle is entirely client-rendered; prerender the shell at
// build time so this route doesn't need a server round trip.
export const dynamic = 'force-static'

export default function Page() {
  return <Studio />
}
