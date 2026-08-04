import type {GuidedTourDoc, GuidedTourPortableText} from '../queries/types'

const TOKEN_PATTERN = /\{\{(\w+)\}\}/g

/**
 * Creates a plain string-keyed record with no prototype chain. Token keys
 * come from schema-authored definitions matched against `^[a-z_]+$`, which
 * admits `__proto__` and `constructor` — ordinary-looking keys that collide
 * with `Object.prototype` on a normal `{}`. On a normal object, writing
 * `resolved['__proto__'] = someString` doesn't create an own property at
 * all (it's silently swallowed by the inherited `__proto__` setter, which
 * ignores non-object, non-null values), and reading an *absent* key like
 * `resolved['constructor']` returns the inherited `Object.prototype`
 * member instead of `undefined`. A null-prototype object has no inherited
 * members to collide with, so both directions behave like a plain map.
 */
function createNullRecord(): Record<string, string> {
  return Object.create(null)
}

/**
 * Resolves the viewer-supplied token values against a tour's token
 * definitions: values are trimmed, an empty (or missing) value falls back
 * to the definition's `defaultValue`, and a `string[]` value (as query
 * params commonly arrive) takes its first element. Only keys present in
 * `defs` ever appear in the result — a resolved value that is still empty
 * after trimming and defaulting is dropped rather than stored as `''`.
 *
 * `provided` is read with `Object.hasOwn` rather than a plain index too:
 * for a `def.key` of `'__proto__'`, `provided['__proto__']` on an ordinary
 * `{}` doesn't return `undefined` for a missing entry — it returns the
 * inherited `Object.prototype` object itself, which then fails `.trim()`.
 *
 * @public
 */
export function resolveTokens(
  defs: GuidedTourDoc['tokens'],
  provided: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const resolved = createNullRecord()
  if (!defs) return resolved

  for (const def of defs) {
    const rawValue = Object.hasOwn(provided, def.key) ? provided[def.key] : undefined
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
 * replaced with an empty string rather than left in place. The lookup is
 * own-property-safe (`Object.hasOwn`, not a plain index or `in`) so a key
 * like `constructor` or `__proto__` — absent from `tokens` — can't resolve
 * through the prototype chain to an inherited `Object.prototype` member.
 *
 * @public
 */
export function personalizeText(text: string, tokens: Record<string, string>): string {
  return text.replace(TOKEN_PATTERN, (_match, key: string) =>
    Object.hasOwn(tokens, key) ? tokens[key] : '',
  )
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
 * resolved value, in definition order. Presence is checked with
 * `Object.hasOwn` rather than `resolved[def.key] === undefined`: for a key
 * like `constructor`, a plain-object `resolved` with no own entry would
 * otherwise read the inherited `Object.prototype.constructor` function
 * (never `undefined`) and wrongly report the token as satisfied.
 *
 * @public
 */
export function missingRequired(
  defs: GuidedTourDoc['tokens'],
  resolved: Record<string, string>,
): string[] {
  if (!defs) return []
  return defs
    .filter((def) => def.required && !Object.hasOwn(resolved, def.key))
    .map((def) => def.key)
}
