// A minimal stand-in for the runtime surface of the real `sanity` package
// that `src/studio/*` touches — NOT a mock of the whole package. Aliased in
// place of the bare `'sanity'` specifier by `build.ts`'s bundler plugin, so
// this file is the ONLY thing standing between the harness and actually
// bundling the real Studio runtime (which isn't meant to run outside a full
// Sanity Studio dev server — see `build.ts`'s module comment).
//
// Grep across `src/studio/*.ts(x)` confirms exactly four runtime symbols
// from `'sanity'` are ever imported (everything else pulled in from
// `'sanity'` there is `import type`, erased at build time and so never
// reaches this shim at all):
//   - `useWorkspace` (useProjectDataset.ts) — this harness's whole reason
//     for existing: return the REAL demo project/dataset ids so
//     `Canvas`/`Filmstrip`'s `assetRefToUrl` calls produce real
//     `cdn.sanity.io` URLs, the same "prefer the live CDN" call the task
//     brief makes.
//   - `useClient` (useUploader.ts) — only ever needs to not throw, so the
//     bulk-upload drop zone/button render (`Filmstrip.tsx` hides both
//     entirely when `uploader === null`). Its `assets.upload` is never
//     actually invoked: every capture state is reached by clicking existing
//     UI (tool buttons, canvas elements, filmstrip steps) or dispatching a
//     synthetic `dragover`, never by dropping a real file — the fixture
//     tour already contains whatever elements/screenshots a given capture
//     needs, so there's nothing to upload.
//   - `PatchEvent` (CanvasInput.tsx) — wraps the `FormPatch[]` arrays
//     `patches.ts`'s builders return, for `props.onChange`. The harness's
//     top-level `onChange` is a no-op (see `entry.tsx`'s module comment for
//     why the captures never depend on a patch actually landing), so this
//     only needs to exist and not throw when constructed — never to be
//     semantically correct.
//   - `insert`/`set`/`setIfMissing`/`unset` (patches.ts) — plain patch-object
//     constructors, called (indirectly, via `patches.ts`) only from code
//     paths this harness never exercises (a real onChange mutation), for
//     the same reason `PatchEvent` above only needs to exist.

export class PatchEvent {
  patches: unknown[]

  constructor(patches: unknown[]) {
    this.patches = patches
  }

  static from(...patches: unknown[]): PatchEvent {
    return new PatchEvent(patches.flat())
  }
}

/** The real demo project — same ids `README.md`'s Next.js example and `examples/web` point at (docs/superpowers/plans/2026-08-04-m1-foundation.md), a public-read dataset. */
export const DEMO_PROJECT_ID = '2xpymzdv'
export const DEMO_DATASET = 'production'

export function useWorkspace(): {projectId: string; dataset: string} {
  return {projectId: DEMO_PROJECT_ID, dataset: DEMO_DATASET}
}

export function useClient(_options?: unknown): {
  assets: {upload: (type: 'image', file: File) => Promise<{_id: string}>}
} {
  return {
    assets: {
      upload() {
        return Promise.reject(
          new Error(
            'capture-editor-shots: no capture state performs a real upload — this stub should never be called',
          ),
        )
      },
    },
  }
}

// --- patches.ts's plain data constructors -----------------------------
// Shapes loosely mirror `sanity`'s real `FormPatch` union closely enough to
// satisfy `patches.ts`'s call sites; never inspected by anything in this
// harness (see module comment above).

type PathSegment = string | number | {_key: string}

export function set(value: unknown, path: PathSegment[] = []): unknown {
  return {type: 'set', path, value}
}

export function setIfMissing(value: unknown, path: PathSegment[] = []): unknown {
  return {type: 'setIfMissing', path, value}
}

export function unset(path: PathSegment[] = []): unknown {
  return {type: 'unset', path}
}

export function insert(
  items: unknown[],
  position: 'before' | 'after' | 'replace',
  path: PathSegment[] = [],
): unknown {
  return {type: 'insert', items, position, path}
}
