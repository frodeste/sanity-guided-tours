import type {StringRule} from 'sanity'

/**
 * Matches a 6-digit hex color (`#rrggbb`, case-insensitive) or a CSS custom
 * property reference — `var(--token)` or `var(--token, <fallback>)` — so
 * theme color fields can bind to a host site's own design tokens instead of
 * only accepting hard-coded hex values. The fallback segment excludes `)`
 * entirely, which also rejects a nested `var(...)` fallback (its inner `)`
 * closes the match early, leaving a trailing `)` that fails the end anchor).
 * Exported so schema fields and their tests share one definition rather than
 * two regexes drifting apart.
 */
export const CSS_COLOR_VALUE_PATTERN = /^(#[0-9a-fA-F]{6}|var\(--[\w-]+(\s*,\s*[^)]{1,64})?\))$/

const CSS_COLOR_VALUE_ERROR =
  'must be a 6-digit hex color (e.g. #7c3aed) or a CSS variable, e.g. var(--brand-primary) or var(--brand-primary, #7c3aed)'

/** Applies `CSS_COLOR_VALUE_PATTERN` to a Sanity string validation rule with an error explaining both accepted forms. */
export function cssColorValue(rule: StringRule): StringRule {
  return rule.regex(CSS_COLOR_VALUE_PATTERN).error(CSS_COLOR_VALUE_ERROR)
}
