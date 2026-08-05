# M4 — Trimmings: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Theming, lead capture, outro/CTAs and the modal mount mode — the four v1 features layered on the finished viewer, closing milestone M4.

**Architecture:** All viewer work stays in `src/react/` under the established constraints (client components, no Studio deps, plain CSS custom properties, events via the tracker, tokens never in URLs). Theme compiles the projected theme object to inline `--gt-*` properties composed with the consumer `style` prop (theme first, consumer wins — spec §8.1 amendment).

**Tech Stack:** unchanged (React 19/18.3, bun test + happy-dom + Testing Library + axe-core).

## Global Constraints

All M1–M3 constraints hold (memory `guided-tours-m1-execution-facts`). Additions:
- Theme custom-property names and defaults are already pinned in `styles.css` (`--gt-accent #2276fc`, `--gt-surface #ffffff`, `--gt-text #1a1a1a`, `--gt-overlay #0f172a`, `--gt-radius 8px`, `--gt-hotspotSize`→`--gt-hotspot-size 24px`, `--gt-font-family inherit`) and mirrored in `src/queries/defaults.ts` — `theme.ts` must import from the single defaults module, never re-declare values.
- Lead capture stores nothing, calls no network — `onLeadSubmit` gets a plain object (spec §8.5). A test asserts no fetch/XHR fires from the plugin during submission.
- Tokens personalize lead/outro **text** fields (labels, consent, headings, PT body) but never `href` (spec §8.3) — regression tests extend to the new surfaces.
- The M2 carry-forward flag closes here: nav-key guard (`isNavigationExempt`) must be verified against REAL inputs once the lead form exists — DOM-level tests, not just fabricated elements.
- axe suite gains the new states (lead form open, outro, modal open).

---

### Task 1: theme.ts + viewer wiring

**Files:** Create `src/react/theme.ts`; Modify `src/react/GuidedTour.tsx` (apply), `src/react/index.ts` (no new exports needed — theme is data-driven); Test `test/react/theme.test.ts` + extend `test/react/GuidedTour.test.tsx`

**Interfaces (produces):**
```ts
export function themeToStyle(theme: GuidedTourTheme | null): Record<string, string>
// null → {} (stylesheet defaults rule). Non-null → {'--gt-accent': theme.accent, '--gt-surface': ..., '--gt-text': ..., '--gt-overlay': ..., '--gt-radius': `${theme.radius}px`, '--gt-hotspot-size': `${theme.hotspotSize}px`, ...(theme.fontFamily ? {'--gt-font-family': theme.fontFamily} : {})}
// Values are already non-null (GROQ coalesce) — import the defaults module ONLY for the test that asserts parity; the function maps projected values 1:1.
```

Wiring: `GuidedTour` composes root style as `{...themeToStyle(tour.theme), ...props.style}` (consumer wins). Theme `logo`: when `tour.theme?.logo` is non-null, render `<img class="gt-logo">` in `.gt-header` (height capped via CSS `--gt-radius`-independent rule; `alt=""` — decorative, the tour title is adjacent text). Add `.gt-logo` to styles.css.

TDD: themeToStyle null/full/partial-fontFamily; parity test (stylesheet defaults == defaults module values — parse styles.css or assert against the constants); GuidedTour test: theme colors land on the root inline style; consumer style overrides theme; logo renders when present, absent otherwise.

- [ ] Tests → implement → green → commit `feat: tour theming via css custom properties`

### Task 2: Outro + CTAs

**Files:** Create `src/react/Outro.tsx`; Modify `src/react/GuidedTour.tsx` (show outro after the last step when `tour.outro` non-null: Next on last step → `complete()` AND advances to the outro screen — reconcile with M2's complete-and-stay: complete-and-stay applies when there is NO outro; with an outro, Next moves to it after completing; Prev from outro returns to the last step), `src/react/labels.ts` (outroLabel? not needed — heading comes from content); Test `test/react/outro.test.tsx`

Behavior: `.gt-outro` panel replacing the stage: personalized heading (`personalizeText`), PT body via the internal renderer (`personalizePT`), CTA buttons — real `<a class="gt-cta gt-cta--primary|secondary">` with raw un-personalized `href`, `target="_blank" rel="noopener noreferrer"`, emitting `cta_clicked {label, href}` (label personalized in DISPLAY but the emitted label matches what's displayed; href raw). Progress/dots reflect the outro as a beyond-last position or freeze at 100% — pick freeze-at-100% (simplest, progressbar already at max), document. Keyboard: Prev/← returns to last step; Next/→ no-op on outro. Announce outro via the live region ("{heading}" or a new label template `outroAnnouncement` added to GuidedTourLabels).

TDD: outro renders after Next on last step + tour_completed emitted exactly once; no outro → complete-and-stay preserved (existing tests untouched); CTA event payloads; href never personalized (extend the URL-invariant regression); Prev returns; announcement.

- [ ] Tests → implement → green → commit `feat: outro screen with ctas`

### Task 3: Lead capture

**Files:** Create `src/react/LeadForm.tsx`; Modify `src/react/GuidedTour.tsx` (interstitial gating AND the `GuidedTourProps` interface, which lives inline in GuidedTour.tsx:28 — add `onLeadSubmit?: (lead: Record<string, string>) => void | Promise<void>` there; `types.ts` holds only `GuidedTourImageProps`), `src/react/labels.ts` (leadSubmit default "Submit", leadSkip "Skip", validation message templates `leadRequired`, `leadInvalidEmail`); Test `test/react/leadForm.test.tsx`

Behavior per spec §8.5 + schema: when `tour.leadCapture?.enabled`, an interstitial `.gt-lead` panel appears at the trigger point — `afterStep`: entering step index `afterStepIndex + 1` for the first time shows the form INSTEAD of the step until submitted or skipped (skip allowed — a form you can't pass is a wall; spec silent, controller ruling: skippable, `labels.leadSkip`); `atEnd`: between last step completion and the outro (or completion when no outro). Fields render from `leadCapture.fields[]` (text/email/tel→`<input type>`, textarea→`<textarea>`; label + required marker; `name` as the key). Validation on submit: required non-empty, email regex (simple RFC-lite `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`); errors inline per field (`aria-describedby`, `aria-invalid`) using label templates. Submit → `onLeadSubmit(values)` (await if promise — disable submit while pending, re-enable + show a generic error on rejection), emit `lead_submitted`, dismiss interstitial, continue. Consent text rendered verbatim below the fields when present (plain text). Personalization applies to labels/consent/submitLabel text. NO network from the plugin (test spies on global fetch).

Nav-guard carry-forward closes here: DOM tests that ←/→/Home/End/Space typed INSIDE the form's inputs neither navigate the tour nor get swallowed (isNavigationExempt already handles text-entry tags — these tests prove it against real inputs).

TDD: both triggers; field rendering per type; required + email validation with aria wiring; submit flow incl. async pending/rejection; skip; consent verbatim; personalized labels; no-fetch invariant; nav-key guard tests; axe state for the open form (extend axe suite here or in Task 4 — do it here).

- [ ] Tests → implement → green → commit `feat: lead capture interstitial`

### Task 4: GuidedTourModal

**Files:** Create `src/react/GuidedTourModal.tsx`; Modify `src/react/index.ts` (export), `src/react/styles.css` (`.gt-modal-backdrop`, `.gt-modal`); Test `test/react/modal.test.tsx`

**Interfaces (produces):**
```ts
export interface GuidedTourModalProps extends GuidedTourProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // close-button label overrides ONLY via labels.modalClose (default "Close tour")
  // — no standalone prop; labels is the codebase's single string-override channel.
}
export function GuidedTourModal(props: GuidedTourModalProps): ReactNode
```

Behavior: `open` renders a fixed backdrop (`--gt-overlay` at 80% via color-mix) + centered `.gt-modal` containing `<GuidedTour {...rest}>` and a close button. Focus trap (Tab cycles inside; on open, focus moves to the modal container; on close, focus returns to the previously-focused element — capture on open). Body scroll lock (`document.body.style.overflow` save/restore — guard SSR). Escape ordering: an open tooltip consumes Escape first (existing root handler marks it handled — coordinate: GuidedTour's root Escape returns whether it closed something; modal listens AFTER, i.e. modal's keydown checks `event.defaultPrevented` — have the tour's Escape call `preventDefault()` when it closes a tooltip, and the modal only closes when not defaultPrevented; add that preventDefault in GuidedTour, note it) then Escape closes the modal via `onOpenChange(false)`. Backdrop click closes; clicks inside don't. `role="dialog" aria-modal="true"` labeled by the tour title. Unmount-on-close (no hidden persistent tour — abandonment semantics from M2 fire naturally).

TDD: open/close cycle incl. focus capture/restore; trap wraps both directions; scroll lock set/restored; Escape-with-open-tooltip closes tooltip only, second Escape closes modal; backdrop vs inside clicks; axe on open modal state.

- [ ] Tests → implement → green → commit `feat: modal mount mode with focus trap`

### Task 5 (controller): example app + docs touch

Example tours page gains `?modal=1` demo? NO (YAGNI). Controller verifies example builds, updates nothing unless a task above required it. M4 wrap: milestone close, memory, report.

---

## PR grouping

| PR | Tasks | Closes |
|---|---|---|
| feat: theming and outro | 1, 2 | #72 #73 #76, #21 #23 |
| feat: lead capture and modal | 3, 4 | #74 #75 #77, #22 #24 |

## Verification (milestone definition of done)

- CI green; axe suite covers lead-form and modal states; URL-invariant regressions extended to outro/lead surfaces.
- Demo exercises theme/lead/outro/modal — **gated on #43** like all live checks; recorded there if still blocked.
