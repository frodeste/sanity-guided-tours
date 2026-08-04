// Small, defensive helpers shared by the element preview `prepare()`
// functions. Studio calls `prepare()` with whatever the document currently
// contains, which may be an empty draft — every helper here must tolerate
// missing or malformed input without throwing.

/** Formats an x/y position pair as a preview subtitle, or `undefined` if incomplete. */
export function positionSubtitle(x: unknown, y: unknown): string | undefined {
  if (typeof x !== 'number' || typeof y !== 'number') return undefined
  return `${x}%, ${y}%`
}

function isTextBlockWithChildren(value: unknown): value is {children: Array<{text?: unknown}>} {
  if (typeof value !== 'object' || value === null) return false
  if (!('_type' in value) || value._type !== 'block') return false
  return 'children' in value && Array.isArray(value.children)
}

/** Extracts the first block's plain text from a Portable Text value, if any. */
export function firstPlainText(blocks: unknown): string | undefined {
  if (!Array.isArray(blocks)) return undefined
  const block = blocks.find(isTextBlockWithChildren)
  if (!block) return undefined
  const text = block.children
    .map((child) =>
      typeof child === 'object' &&
      child !== null &&
      'text' in child &&
      typeof child.text === 'string'
        ? child.text
        : '',
    )
    .join('')
    .trim()
  return text || undefined
}
