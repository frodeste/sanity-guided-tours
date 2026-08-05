/**
 * UI strings the viewer renders. Every field is a plain string; three of
 * them (`stepCounter`, `stepAnnouncement`) are templates using `{name}`
 * placeholders — filled by the internal `formatLabel` helper below — which
 * is a deliberately different syntax from the `{{key}}` personalization tokens in
 * `./personalize`: labels are consumer-authored UI strings resolved
 * entirely client-side, never viewer-supplied content, so there is no
 * injection surface to guard here the way there is for `href`/`src`.
 *
 * @public
 */
export interface GuidedTourLabels {
  next: string
  previous: string
  /** Template: `"{current} / {total}"`. */
  stepCounter: string
  chapterMenuLabel: string
  progressLabel: string
  closeTooltip: string
  /** Template: `"Step {current} of {total}: {title}"`. */
  stepAnnouncement: string
  hotspotAdvance: string
  hotspotReveal: string
  hotspotLink: string
  /** Template: `"Tour complete: {heading}"` — announced via the live region when the outro screen appears (M4). */
  outroAnnouncement: string
  /** Announced via the live region when the lead-capture interstitial replaces the step — either trigger, and regardless of whether it was reached by keyboard or mouse (the announcement, like `outroAnnouncement`, is recomputed from render state, not from the input event itself) (M4). */
  leadFormAnnouncement: string
  /** The lead-capture form's submit button, when `leadCapture.submitLabel` is unset (M4). */
  leadSubmit: string
  /** The lead-capture form's Skip button — controller ruling: the interstitial is always skippable (M4). */
  leadSkip: string
  /** Template: `"{label} is required."` — a required lead-capture field left empty (M4). */
  leadRequired: string
  /** A `type: 'email'` lead-capture field whose value doesn't match the simple email pattern (M4). */
  leadInvalidEmail: string
  /** Shown, in place of the form, when `onLeadSubmit` rejects — generic by design, never the rejection's own message (M4). */
  leadSubmitError: string
}

/**
 * @public
 */
export const defaultLabels: GuidedTourLabels = {
  next: 'Next',
  previous: 'Previous',
  stepCounter: '{current} / {total}',
  chapterMenuLabel: 'Chapters',
  progressLabel: 'Progress',
  closeTooltip: 'Close',
  stepAnnouncement: 'Step {current} of {total}: {title}',
  hotspotAdvance: 'Continue',
  hotspotReveal: 'Show information',
  hotspotLink: 'Open link',
  outroAnnouncement: 'Tour complete: {heading}',
  leadFormAnnouncement: 'Before you continue: please fill in the form',
  leadSubmit: 'Submit',
  leadSkip: 'Skip',
  leadRequired: '{label} is required.',
  leadInvalidEmail: 'Enter a valid email address.',
  leadSubmitError: 'Something went wrong. Please try again.',
}

/**
 * Fills a label template's `{name}` placeholders from `values`. Internal
 * helper — not part of the public surface (labels are consumer strings,
 * consumers don't call this directly).
 */
export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : '',
  )
}
