# M10 — Frames & Element Design (Theming v3): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors choose the window chrome around a tour — **Mac** (new default), **Windows**, **simple** (configurable border), or **none** — and style buttons and tooltip bubbles per element, with Material-inspired modern defaults (issues #141–#145).

**Architecture:** Pure theming extension. Schema `guidedTourTheme` gains `frame` and `elements` objects; defaults single-sourced in `src/queries/defaults.ts`; projection follows the coalesce policy; web viewer renders chrome + element vars; native applies element styles and the simple border (chrome is web-only, documented). No new dependencies — "Material-inspired" means our own CSS (filled buttons, subtle elevation), never a component library.

## Global Constraints

All accumulated constraints hold (memory `guided-tours-m1-execution-facts`). Additions:
- Every new color field accepts hex OR `var(--token[, fallback])` via the existing `cssColorValue` validator; every var() consumed OUTSIDE `.gt-tour` scope needs a literal fallback (M7 transparent-computed-value lesson).
- Dark pairing mirrors v2: new color fields get optional members in the theme's existing `dark` shape, resolved viewer-side against new `THEME_DARK_DEFAULTS` keys — never coalesced in GROQ.
- Chrome bars are decorative: traffic lights / caption glyphs are `aria-hidden`, inert (no focusable fakes), and must not trip axe.
- Coverage floor is per-file — every new file ships ≥90/90 tests.

### Task 1: Schema, defaults, projection, types (#143)

**Files:** `src/schema/theme.ts` (add `frame`: `style` list mac|windows|simple|none, initialValue `'mac'`; `border` group used by simple — `width` number 0–12 default 1, `color` cssColorValue default `#e2e8f0`, `radius` number 0–48 default 12, optional per-corner `radiusTopLeft/TopRight/BottomRight/BottomLeft` 0–48 no initialValue; add `elements`: `button` — `background`, `textColor` cssColorValue no initialValue (falls back to accent/white at consumption), `radius` 0–32 no initialValue (falls back to theme radius × button scale); `bubble` — same fields for tooltip panels; extend `dark` with optional `frameBorder`, `buttonBackground`, `buttonText`, `bubbleBackground`, `bubbleText`); `src/queries/defaults.ts` (FRAME_DEFAULTS {style:'mac', borderWidth:1, borderColor:'#e2e8f0', borderRadius:12}, THEME_DARK_DEFAULTS gains frameBorder/button/bubble keys with sensible dark values); `src/queries/projections.ts` (explicit sub-projections `frame{...}` / `elements{button{...}, bubble{...}}` with coalesces for initialValue-bearing fields ONLY; optional fields project as nullable); `src/queries/types.ts`; `src/studio/draftToTour.ts` parity.

Tests: groq-js projection evaluation (coalesce behavior incl. absent frame object → defaults, per-corner nulls), draftToTour agreement, schema validation ranges.

- [ ] TDD → implement → green → commit `feat: frame and element design schema with projection defaults`

### Task 2: Web viewer — chrome + element styling (#144, #142)

**Files:** `src/react/Frame.tsx` (new: renders mac title bar with three traffic lights / windows title bar with caption glyphs / simple border wrapper / none — all around the stage, title text = tour title, decorations aria-hidden), wire into `GuidedTour.tsx` (stage wrapper) so embed + modal inherit it; `src/react/theme.ts` (`themeToStyle` emits paired `--gt-light-*`/`--gt-dark-*` props for frame border color + button/bubble colors; radius + width props scheme-independent; per-corner radius composes a `border-radius` shorthand — one value when uniform, four when any corner overrides); `src/react/styles.css` (chrome styling driven by surface/text vars so dark mode Just Works; Material-inspired defaults: buttons filled accent, subtle shadow, hover elevation, active press; bubbles surface + elevation shadow; `.gt-frame--simple` consumes the border vars; scheme-mapping sections extended for the new vars with literal fallbacks in modal/embed sections per the parity test).

Tests: Frame per style (chrome inert + aria-hidden, simple border vars incl. per-corner shorthand, none renders nothing), themeToStyle new paired props, parity test extension (zero unfallback'd var() in modal/embed), axe on all frame styles, existing snapshots updated deliberately (default look changes to mac — expected).

- [ ] TDD → implement → green → commit `feat: window chrome frames and element styling in the web viewer`

### Task 3: Native, preview, seed, docs (#145)

**Files:** `src/native/nativeTheme.ts` (NativeTheme gains buttonBackground/buttonText/buttonRadius/bubbleBackground/bubbleText/bubbleRadius/frame {style, borderWidth, borderColor, borderRadius} — var() falls back with warn as established; chrome policy: mac/windows render NO chrome on native, simple renders a plain border — record in spec §17), `src/native/styles.ts` + components consume them; seed (`seed/builders.ts`): demo theme stays on mac default implicitly; Acme sample theme gets `frame: simple` with brand-pink border + per-corner radius (rounded top only) to showcase; meta tour keeps defaults; README theming section + spec §17 (frame styles, element controls, native policy, Material-inspired-not-Material-UI note).

Tests: resolveNativeTheme new fields (hex/var/dark/null), native components carry element styles, seed builder shapes.

- [ ] TDD → implement → green → commit `feat: element styles on native, frame showcase seed and docs`

## PR grouping

| PR | Tasks | Closes |
|---|---|---|
| feat: window chrome frames and per-element design | 1, 2, 3 (+ this plan) | #141 #142 #143 #144 #145 |

## Verification

Post-merge the controller seeds live and verifies: demo-tour shows mac chrome by default, sample-tour shows the Acme simple frame, dark mode intact, embed/modal pages still render (frame inside embeds too).
