// Pure module — no imports. Single definition of `_key` generation shared by
// every patch builder that creates a new chapter/step/element (design spec
// §7, master plan Global Constraints).

/**
 * Generates a 12-character lowercase hex `_key`, derived from
 * `crypto.randomUUID()` with its dashes stripped.
 */
export function randomKey(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
