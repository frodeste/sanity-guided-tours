import type {GuidedTourDoc, GuidedTourPortableText} from '../queries/types'

const TOKEN_PATTERN = /\{\{(\w+)\}\}/g

/**
 * Resolves the viewer-supplied token values against a tour's token
 * definitions: values are trimmed, an empty (or missing) value falls back
 * to the definition's `defaultValue`, and a `string[]` value (as query
 * params commonly arrive) takes its first element. Only keys present in
 * `defs` ever appear in the result — a resolved value that is still empty
 * after trimming and defaulting is dropped rather than stored as `''`.
 *
 * @public
 */
export function resolveTokens(
  defs: GuidedTourDoc['tokens'],
  provided: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const resolved: Record<string, string> = {}
  if (!defs) return resolved

  for (const def of defs) {
    const rawValue = provided[def.key]
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    const trimmed = value?.trim()

    if (trimmed) {
      resolved[def.key] = trimmed
      continue
    }

    const trimmedDefault = def.defaultValue?.trim()
    if (trimmedDefault) {
      resolved[def.key] = trimmedDefault
    }
  }

  return resolved
}

/**
 * Replaces every `{{key}}` placeholder in `text` with the matching value
 * from `tokens`. A placeholder whose key has no entry in `tokens` is
 * replaced with an empty string rather than left in place.
 *
 * @public
 */
export function personalizeText(text: string, tokens: Record<string, string>): string {
  return text.replace(TOKEN_PATTERN, (_match, key: string) => tokens[key] ?? '')
}

/**
 * Applies {@link personalizeText} to Portable Text span content only.
 * Every other part of the structure — block `_key`/`style`, `markDefs`
 * (including link `href`), and span `marks` arrays — passes through
 * unchanged. This is a security invariant, not a style choice: token
 * values are viewer-supplied (typically from URL query params) and must
 * never be substituted into a URL-valued field such as a link `href`,
 * where they could be used to redirect a click. See spec §8.3.
 *
 * @public
 */
export function personalizePT(
  content: GuidedTourPortableText | null,
  tokens: Record<string, string>,
): GuidedTourPortableText | null {
  if (content === null) return null

  return content.map((block) => ({
    ...block,
    children: block.children.map((span) => ({
      ...span,
      text: personalizeText(span.text, tokens),
    })),
  }))
}

/**
 * Returns the `key` of every required token definition that has no
 * resolved value, in definition order.
 *
 * @public
 */
export function missingRequired(
  defs: GuidedTourDoc['tokens'],
  resolved: Record<string, string>,
): string[] {
  if (!defs) return []
  return defs.filter((def) => def.required && resolved[def.key] === undefined).map((def) => def.key)
}
