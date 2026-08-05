import {tourProjection} from './projections'

/**
 * Fetches one `guidedTour` document by its slug, with images resolved to
 * concrete URLs and the theme resolved (falling back to the default theme).
 * Takes a `$slug` parameter.
 *
 * @public
 */
export const guidedTourBySlugQuery = /* groq */ `*[_type == "guidedTour" && slug.current == $slug][0]${tourProjection}`

/**
 * Fetches every defined slug for `generateStaticParams` / sitemap use.
 *
 * @public
 */
export const guidedTourSlugsQuery = /* groq */ `*[_type == "guidedTour" && defined(slug.current)].slug.current`

// Projection fragments are exported here too — design spec §5.1 lists
// "GROQ query and projection fragments" as part of this entry's public
// contents, and a consumer using the `extend` config hook (§7.4) needs
// `tourProjection` to compose a query against the same fields plus their
// own. See the doc comment on each in ./projections for what it does; the
// release tag has to live there, at the actual declaration, for
// api-extractor to recognize it on a re-export.
export {
  imageProjection,
  elementProjection,
  tourProjection,
  guidedTourEmbedProjection,
} from './projections'

export * from './types'
