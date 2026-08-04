'use client'

import {Fragment, type ReactNode} from 'react'

import type {GuidedTourPortableText} from '../queries/types'
import {useGuidedTourContext} from './context'
import {personalizePT} from './personalize'

export interface PortableTextProps {
  /** Raw, unpersonalized content — this component personalizes internally. */
  value: GuidedTourPortableText | null
}

type PortableTextSpan = GuidedTourPortableText[number]['children'][number]
type PortableTextMarkDef = NonNullable<GuidedTourPortableText[number]['markDefs']>[number]

/**
 * Drops spans without a string `.text` before anything else touches the
 * content. `personalizePT` (Task 2, `./personalize`) unconditionally calls
 * `.replace()` on every span's `.text` and throws on a span that's missing
 * it — a documented, deferred minor from that task that this renderer
 * works around here rather than by touching `personalize.ts` (out of scope
 * for this task, and `personalizePT` has its own well-tested contract to
 * preserve). Sanitizing first means `personalizePT` below never sees the
 * malformed shape that would trip it, so one bad span degrades to "not
 * rendered" instead of crashing the whole viewer.
 */
function sanitize(value: GuidedTourPortableText): GuidedTourPortableText {
  return value.map((block) => ({
    ...block,
    children: (block.children ?? []).filter(
      (span): span is PortableTextSpan => typeof span.text === 'string',
    ),
  }))
}

/**
 * Renders one span, innermost-out, wrapping it once per entry in
 * `span.marks`: the `strong`/`em` decorators become `<strong>`/`<em>`, and
 * any other mark is looked up against `markDefs` — a `link` markDef with a
 * string `href` becomes an `<a target="_blank" rel="noopener noreferrer">`.
 * An unresolvable mark (references neither a decorator nor a known
 * markDef) is silently skipped rather than thrown on, the same
 * defensiveness `sanitize` applies to missing `.text`.
 */
function renderSpan(span: PortableTextSpan, markDefs: PortableTextMarkDef[]): ReactNode {
  let node: ReactNode = span.text

  for (const mark of span.marks ?? []) {
    if (mark === 'strong') {
      node = <strong>{node}</strong>
    } else if (mark === 'em') {
      node = <em>{node}</em>
    } else {
      const markDef = markDefs.find((def) => def._key === mark)
      if (markDef?._type === 'link' && typeof markDef.href === 'string') {
        node = (
          <a href={markDef.href} target="_blank" rel="noopener noreferrer">
            {node}
          </a>
        )
      }
    }
  }

  return node
}

/**
 * Minimal internal Portable Text renderer for the plugin's rich text
 * fields (Tooltip and TextOverlay content) — not `@portabletext/react` or
 * any general-purpose PT engine, deliberately: the design spec keeps
 * `/react` free of any dependency beyond React itself, and
 * `GuidedTourPortableText` (`../queries/types`) only ever admits the
 * `strong`/`em`/`link` vocabulary this covers. Every block renders as
 * `<p class="gt-pt-block">`; there is nothing else in the narrowed type
 * (headings, lists, images) to handle.
 *
 * Reads personalization tokens from context and applies `personalizePT`
 * internally — callers (`Tooltip`, `TextOverlay`) pass their element's raw
 * `content` straight through and get personalization, and the
 * missing-`.text` defensiveness above, for free rather than each
 * duplicating the pipeline. `href` is never personalized: `personalizePT`
 * only ever touches span text (design spec §8.3), and nothing here adds a
 * second substitution path over `markDefs`.
 *
 * Not part of the public `/react` surface — `index.ts` never exports it.
 */
export function PortableText({value}: PortableTextProps): ReactNode {
  const {tokens} = useGuidedTourContext()
  if (!value) return null

  const content = personalizePT(sanitize(value), tokens) ?? []

  return (
    <>
      {content.map((block) => (
        <p key={block._key} className="gt-pt-block">
          {block.children.map((span) => (
            <Fragment key={span._key}>{renderSpan(span, block.markDefs ?? [])}</Fragment>
          ))}
        </p>
      ))}
    </>
  )
}
