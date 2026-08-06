# M11 — Video Steps: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A step's backdrop can be a short video instead of (or on top of) its screenshot — uploaded to Sanity media storage as a file asset OR referenced by direct URL — across schema, canvas editor, projection, web viewer and docs (issues #146–#148).

**Architecture — backwards compatible by construction:** `screenshot` stays exactly as-is (it doubles as the poster and the editor canvas backdrop). A new optional `video` object on `step` takes rendering precedence in the web viewer when present. No migration, no union rewrite: existing tours are untouched, and the canvas editor keeps positioning elements over the screenshot.

## Global Constraints

All accumulated constraints hold (memory `guided-tours-m1-execution-facts`). Additions:
- **URL scope v1:** direct media-file URLs only (mp4/webm — whatever `<video src>` plays natively). NO YouTube/Vimeo/mux embed support (iframes inside the stage break the hotspot/overlay model) — record in spec §18 as a deliberate rejection with the rationale.
- Playback defaults are demo-appropriate and fixed in v1 (not schema-configurable): `muted`, `loop`, `playsInline`, autoplay **gated on** BOTH `prefers-reduced-motion: no-preference` AND stage visibility (IntersectionObserver; play when ≥50% visible, pause otherwise). Reduced-motion users get the poster with a standard play control (`controls` attribute shown only then). No audio in v1.
- The screenshot remains REQUIRED even on video steps — it is the poster, the reduced-motion fallback, the native fallback, and the editor backdrop. The schema description must say this.
- Native (pure-JS constraint, RN core has no `<Video>`): render the screenshot poster + a dev-only documented limitation; carry `video` through `NativeTheme`-adjacent types so an integrator can build playback with expo-video themselves. Record in spec §18.
- happy-dom does not implement HTMLMediaElement playback: `play()`/`pause()` are stubbed/spied in tests; IntersectionObserver needs the existing/stub pattern (check how the repo handles it — if unused so far, add a test stub with `__resetForTests`).
- Videos in seed: only if a tiny (<1 MB) sample can be generated locally (e.g. ffmpeg if available); otherwise seed a URL-variant step pointing at a small public sample and record the choice. Never commit binary video to git.

### Task 1: Schema, projection, types (#146 schema half)

**Files:** `src/schema/step.ts` (optional `video` object: `source` list ['file','url'] initialValue 'file'; `file` type file with `options.accept 'video/mp4,video/webm'`, hidden unless source=='file'; `url` type url with https-only validation, hidden unless source=='url'; validation: whichever source is selected, that member must be present — custom rule); `src/queries/projections.ts` (`"video": video{source, "fileUrl": file.asset->url, url}` — nullable object per the nested-object policy; note file deref makes the projection join-dependent like screenshot already is); `src/queries/types.ts` (`GuidedTourStepVideo {source, fileUrl, url} | null` + a resolved-URL helper type note); `src/queries/defaults.ts` only if any initialValue lands (source does → coalesce it).

Tests: groq-js (absent video → null; file variant derefs URL; url variant passes through; source coalesce), schema validation (https-only, member-presence rule), draftToTour parity (video maps like other step fields — check how screenshot flows through draftToTour and mirror).

- [ ] TDD → implement → green → commit `feat: video step media schema and projection`

### Task 2: Web viewer playback (#146 viewer half, #148 web part)

**Files:** `src/react/Video.tsx` (new: renders `<video>` with `muted loop playsInline preload="metadata"`, `poster` = the step's screenshot URL, `src` = fileUrl ?? url; autoplay orchestration: a `useReducedMotionMedia()` hook (matchMedia `prefers-reduced-motion`, listener + cleanup) + IntersectionObserver on the stage — play only when visible AND motion OK, else pause; reduced-motion → no autoplay, show `controls`; element fills the stage exactly like the screenshot `<img>` (same sizing classes) so hotspot/overlay percent positioning is unchanged); `src/react/Step.tsx` (video takes precedence over the screenshot img when `step.video` is non-null — the img is replaced by the video, NOT stacked); `src/react/styles.css` (.gt-video sizing matching .gt-screenshot). Events: fire the existing `step_viewed` unchanged; add NO new event types in v1 (record).

Tests: Video renders poster+src per variant, autoplay gating matrix (visible×motion — play/pause spies on the stubbed media element), reduced-motion shows controls + no autoplay, listener/observer cleanup on unmount, Step precedence (video replaces img; absent video keeps img — regression), axe (video needs no captions in v1 — muted demo loops are decorative; set `aria-label` from step title and record the a11y stance in spec §18), tooltip/hotspot positioning unaffected (existing geometry tests still bind — extend one to a video step).

- [ ] TDD → implement → green → commit `feat: video playback in the web viewer`

### Task 3: Canvas editor, native fallback, seed, docs (#147, #148 rest)

**Files:** `src/studio/Canvas.tsx`/`CanvasInput.tsx` (video steps: canvas backdrop stays the SCREENSHOT (positioning source of truth); add a small non-interactive "video" badge on the stage + the Inspector shows the video fields via the normal form — verify member rendering needs nothing special since video is a plain object field on step); `src/native/StepNative.tsx` (video steps render the screenshot poster exactly as today + carry `step.video` in props; doc comment: playback via expo-video is the consumer's integration point); seed (`seed/builders.ts` + `seed/seed.ts`): one video step added to the sample tour — URL variant pointing at a small public-domain mp4 (pick a stable, tiny one; if none is trustworthy-stable, generate with ffmpeg to the Sanity media library at seed time and use the file variant — record the choice); README (video steps section: sources, playback behavior, reduced-motion, native limitation); spec §18 (schema, precedence, playback gating, URL-scope rejection of embed providers, a11y stance, native policy).

Tests: canvas badge presence on video steps (and absence otherwise), native poster fallback (video step renders Image, no crash), seed builder shapes.

- [ ] TDD → implement → green → commit `feat: video steps in the editor, native fallback, seed and docs`

## PR grouping

| PR | Tasks | Closes |
|---|---|---|
| feat: video step media | 1, 2, 3 (+ this plan) | #146 #147 #148 |

## Verification

Post-merge the controller seeds live and verifies the sample tour's video step plays (markup check: `<video` with poster + src on the live page), reduced-motion behavior via the attribute matrix in tests, and existing tours unchanged.
