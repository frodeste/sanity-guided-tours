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

export * from './types'
