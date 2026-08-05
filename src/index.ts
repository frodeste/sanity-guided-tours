export type {GuidedToursConfig} from './config'
export {guidedTours} from './plugin'

/**
 * The `guidedTourEmbed` object type's schema name — reference it in a
 * consumer's own array `of:` lists (Portable Text or page-builder sections)
 * to place a tour on a page, e.g. `of: [{type: guidedTourEmbedTypeName}]`.
 * The type is registered unconditionally by `guidedTours()`; it stays inert
 * until a consumer wires it in like this.
 *
 * @public
 */
export const guidedTourEmbedTypeName = 'guidedTourEmbed'

/**
 * A live, in-Studio preview view for the `guidedTour` document type (master
 * plan Task 8) — maps the DRAFT document straight into `<GuidedTour>` (see
 * `./studio/draftToTour.ts` for what it can't faithfully preview: theme,
 * LQIP, and steps without a resolvable screenshot).
 *
 * Nothing is wired by default — register it yourself via `structureTool`'s
 * `defaultDocumentNode`, e.g.:
 *
 *   import {defineConfig} from 'sanity'
 *   import {structureTool} from 'sanity/structure'
 *   import {guidedTours, GuidedTourPreviewView} from 'sanity-plugin-guided-tours'
 *
 *   export default defineConfig({
 *     plugins: [
 *       guidedTours(),
 *       structureTool({
 *         defaultDocumentNode: (S, {schemaType}) =>
 *           schemaType === 'guidedTour'
 *             ? S.document().views([
 *                 S.view.form(),
 *                 S.view.component(GuidedTourPreviewView).title('Preview'),
 *               ])
 *             : S.document(),
 *       }),
 *     ],
 *   })
 */
export {GuidedTourPreviewView} from './studio/PreviewView'
