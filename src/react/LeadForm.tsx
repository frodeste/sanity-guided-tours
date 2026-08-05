'use client'

import {useEffect, useState, type FormEvent, type ReactNode} from 'react'

import type {GuidedTourLeadCapture, GuidedTourLeadCaptureField} from '../queries/types'
import {useGuidedTourContext} from './context'
import {formatLabel} from './labels'
import {personalizeText} from './personalize'

export interface LeadFormProps {
  /** Non-null and `.enabled` — `GuidedTour.tsx` only ever mounts this once both are already true. */
  leadCapture: GuidedTourLeadCapture
  onLeadSubmit?: (lead: Record<string, string>) => void | Promise<void>
  /**
   * Called once the interstitial should close and the tour should resume —
   * on Skip, and after a successful submit (post `lead_submitted`).
   * Deliberately the SAME callback for both: this component has no notion
   * of which trigger (`afterStep`/`atEnd`) put it on screen, or what
   * "resume" means for that trigger (re-show the just-passed step; or
   * complete the tour and advance to the outro) — that decision belongs
   * entirely to `GuidedTour.tsx`, which already tracks it via `showAtEndLead`.
   */
  onDismiss: () => void
  /**
   * Fired whenever `pending` (the async submit's in-flight state) changes —
   * CI review fix: `GuidedTour.tsx` needs to know a submit is in flight so
   * it can ignore navigation (Prev/Home/End/dots/chapter jumps) until it
   * settles, otherwise a viewer could navigate away mid-submit and have the
   * resolution fire `lead_submitted`/`complete()` against a UI that's moved
   * on. `pending` itself stays local state here (it drives this
   * component's own disabled-button rendering); this is purely a
   * notification channel, not a controlled prop.
   */
  onPendingChange?: (pending: boolean) => void
}

/** Simple RFC-lite pattern, per the design spec — not a full RFC 5322 validator. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function fieldId(field: GuidedTourLeadCaptureField): string {
  return `gt-lead-field-${field._key}`
}

function fieldErrorId(field: GuidedTourLeadCaptureField): string {
  return `${fieldId(field)}-error`
}

/**
 * The interstitial lead-capture form `GuidedTour` swaps in for `.gt-stage`
 * at the configured trigger point (design spec §8.5, plan M4 Task 3).
 * Renders one control per `leadCapture.fields[]` entry (`text`/`email`/
 * `tel` → `<input type>`, `textarea` → `<textarea>`), validates on submit
 * (required non-empty; `type: 'email'` fields additionally against a
 * simple email pattern), and shows errors inline via `aria-invalid` +
 * `aria-describedby`; a required field's control also carries
 * `aria-required` up front (the visual `*` marker is `aria-hidden`, so
 * this is what actually conveys requiredness to assistive tech before any
 * validation has run). Submit awaits `onLeadSubmit` (disabled while
 * pending), emits `lead_submitted` and calls `onDismiss` on success, or
 * shows a generic `leadSubmitError` and stays open on rejection. A Skip
 * button (controller ruling — the design spec is silent, but a form a
 * viewer can't get past is a wall) calls `onDismiss` directly, with no
 * validation and no event. Consent text and the submit label are
 * personalized (spec §8.3's token pipeline) but rendered as plain text,
 * never Portable Text — "verbatim" in the plan means "as authored", not
 * "unpersonalized".
 *
 * @public
 */
export function LeadForm({
  leadCapture,
  onLeadSubmit,
  onDismiss,
  onPendingChange,
}: LeadFormProps): ReactNode {
  const {tokens, labels, trackerRef} = useGuidedTourContext()
  const fields = leadCapture.fields ?? []

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, ''])),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Single source of truth for `pending` is this component's own state
  // (above) — this effect is purely the notification side-channel to
  // `GuidedTour.tsx` described on `onPendingChange`'s doc comment, kept as
  // an effect (rather than calling `onPendingChange` inline at every
  // `setPending` call site) so there's exactly one place this ever happens,
  // always in sync with what actually rendered.
  useEffect(() => {
    onPendingChange?.(pending)
  }, [pending, onPendingChange])

  function handleChange(name: string, value: string): void {
    setValues((prev) => ({...prev, [name]: value}))
  }

  function validate(): Record<string, string> {
    const nextErrors: Record<string, string> = {}
    for (const field of fields) {
      const value = (values[field.name] ?? '').trim()
      const label = personalizeText(field.label, tokens)

      if (field.required && value === '') {
        nextErrors[field.name] = formatLabel(labels.leadRequired, {label})
        continue
      }
      if (field.type === 'email' && value !== '' && !EMAIL_PATTERN.test(value)) {
        nextErrors[field.name] = formatLabel(labels.leadInvalidEmail, {label})
      }
    }
    return nextErrors
  }

  // `onLeadSubmit?.(values)` called synchronously, on purpose — deferring
  // it into a `.then()` (the chain's own microtask) would delay a
  // synchronous consumer handler's invocation by a tick from what firing
  // the form's `submit` event visibly did, for no benefit. The `try`/
  // `catch` is what actually matters (CI review fix): the previous shape,
  // `Promise.resolve(onLeadSubmit?.(values))`, evaluated the call EAGERLY
  // as part of building that expression's argument — before
  // `Promise.resolve` existed to catch anything — so a non-async consumer
  // handler that threw synchronously (as opposed to returning a rejected
  // `Promise`) threw straight out of this function, uncaught, skipping
  // `.catch()` below entirely and stranding `pending` at `true` forever.
  // Wrapping the call itself in `try`/`catch` and funneling a synchronous
  // throw into `Promise.reject(...)` puts both failure shapes — a
  // rejected `Promise` and a synchronous throw — on the exact same path
  // into the `.catch()` below, while a normal (non-throwing) return keeps
  // exactly its previous behavior and timing.
  function invokeLeadSubmit(): Promise<void> {
    try {
      return Promise.resolve(onLeadSubmit?.(values))
    } catch (error) {
      return Promise.reject(error)
    }
  }

  // `FormEvent<HTMLFormElement>` (not the `SubmitEvent` this briefly used
  // — CI fix, PR 102: `@types/react` marks `SubmitEvent` "recently added"
  // enough that it wasn't available in the `@types/react` resolution CI's
  // typecheck job actually got, even though it type-checked locally —
  // see the fix note in the report for the reconciliation). `FormEvent`
  // is `@deprecated` in the installed `@types/react` too (its JSDoc
  // suggests `ChangeEvent`/`InputEvent`/`SubmitEvent`/`SyntheticEvent`
  // instead), but it's the long-standing, universally-available React
  // typing for a form's `onSubmit` handler — the oxlint suppression right
  // below is deliberate, not an oversight.
  // oxlint-disable-next-line typescript/no-deprecated
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (pending) return

    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitError(null)
    setPending(true)
    invokeLeadSubmit()
      .then(() => {
        trackerRef.current?.leadSubmitted()
        setPending(false)
        onDismiss()
        return undefined
      })
      .catch(() => {
        setPending(false)
        setSubmitError(labels.leadSubmitError)
        return undefined
      })
  }

  function handleSkip(): void {
    onDismiss()
  }

  const submitLabel = leadCapture.submitLabel
    ? personalizeText(leadCapture.submitLabel, tokens)
    : labels.leadSubmit

  return (
    <div className="gt-lead-content">
      <form className="gt-lead-form" onSubmit={handleSubmit} noValidate>
        {fields.map((field) => {
          const hasError = Object.hasOwn(errors, field.name)
          const label = personalizeText(field.label, tokens)
          const value = values[field.name] ?? ''

          return (
            <div className="gt-lead-field" key={field._key}>
              <label className="gt-lead-label" htmlFor={fieldId(field)}>
                {label}
                {field.required && (
                  <span className="gt-lead-required" aria-hidden="true">
                    {' '}
                    *
                  </span>
                )}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  id={fieldId(field)}
                  name={field.name}
                  className="gt-lead-input"
                  value={value}
                  onChange={(event) => handleChange(field.name, event.target.value)}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? fieldErrorId(field) : undefined}
                  aria-required={field.required}
                />
              ) : (
                <input
                  id={fieldId(field)}
                  name={field.name}
                  type={field.type}
                  className="gt-lead-input"
                  value={value}
                  onChange={(event) => handleChange(field.name, event.target.value)}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? fieldErrorId(field) : undefined}
                  aria-required={field.required}
                />
              )}
              {hasError && (
                <p className="gt-lead-error" id={fieldErrorId(field)}>
                  {errors[field.name]}
                </p>
              )}
            </div>
          )
        })}
        {leadCapture.consentText && (
          <p className="gt-lead-consent">{personalizeText(leadCapture.consentText, tokens)}</p>
        )}
        {submitError && (
          <p className="gt-lead-submit-error" role="alert">
            {submitError}
          </p>
        )}
        <div className="gt-lead-actions">
          <button type="submit" className="gt-lead-submit" disabled={pending}>
            {submitLabel}
          </button>
          <button type="button" className="gt-lead-skip" onClick={handleSkip} disabled={pending}>
            {labels.leadSkip}
          </button>
        </div>
      </form>
    </div>
  )
}
