# Public release and pp internt adoption

Prepare `sanity-plugin-guided-tours` for public distribution and prove it with one
real tour in the ProsessPilotene public Studio and website. Complete the pilot
before publishing 1.0.0; use a packed package while npm publishing access is being
configured. Semantic-release owns versioning.

## Studio compatibility

- [x] Migrate menu and toast imports to Sanity UI 4 and update removed props.
- [x] Update development dependencies and supported Studio peer ranges to the
  tested pp-internt versions: Sanity 6.16, UI 4.2.7, React 19.3.
- [x] Update Sanity form fixtures for the current document-variant fields.
- [x] Load the UI and viewer stylesheets in the example Studio and screenshot
  harness; expose the live Preview document view in the example.
- [x] Verify editor menus, mutations, upload notifications, and preview with
  behavior tests, including a real UI 4 toast-provider regression test.
- [x] Verify the editor's responsive panes, full editor, keyboard navigation,
  empty states, and light/dark themes in the collaborative browser using real
  components and fixture data. Automated accessibility checks passed.
- [ ] Verify Sanity item-dialog layering, live uploads, and Preview against an
  authenticated Studio and actual dataset.

## Editor usability review

- [x] Obtain a live UI review from Claude Opus 5.5 with high effort.
- [x] Replace cramped columns with Steps/Canvas/Details tabs at narrow widths;
  keep stable sidebars and use the full dialog height at wide widths.
- [x] Fit the screenshot to the available canvas space and render recognizable
  hotspots and tooltip/text-overlay widths with accessible selection state.
- [x] Add a visible Remove element action, a selectable element list, and direct
  Add screenshot access to the real step form.
- [x] Add placement guidance, keyboard placement, a mobile-layout notice,
  chapter editing, and clearer screenshot/alt-text status badges.
- [x] Separate step selection from its action menu to remove nested controls.
- [ ] Consider a chapter action menu with explicit chapter deletion, a mobile
  override reset, and keyboard resizing in a subsequent usability pass.

Validated on 2026-10-07: 1,178 tests passed with 99.80% function and line
coverage. Lint, typechecking, code-health checks, and strict package build
passed. Browser checks covered 1280px, 768px, and 390px widths. The fixture
harness does not exercise actual Sanity form dialogs or dataset mutations.

## Release tooling

- [x] Pin compatible Node and Bun versions in CI and release, and declare Node
  typings directly so ancestor node_modules cannot change typechecking.
- [x] Run the code-health checks before a release as well as on pull requests.
- [x] Pin the release toolchain and provide a non-publishing release dry run.
- [x] Verify lint, typecheck, strict build, coverage, package exports, package
  contents, and the web/native examples from the committed lockfile.
- [x] Document npm bootstrap authentication, trusted publishing, and manual
  release dispatch in [the release runbook](../../releasing.md).
- [ ] Configure and verify publishing access before an actual release.

Validated locally on 2026-10-06: 1,167 tests passed, with 99.77% function and
99.78% line coverage; lint, typechecking, strict build, package verification,
ESM export checks, knip, and circular-import checks passed. The Next.js example
built, and the native example typechecked and exported for both iOS and Android.
A fresh React 18.3 consumer installed the packed package and imported `/react`
and `/queries` without installing Studio dependencies. A release planning run
against a local Git fixture computed 1.0.0 without publishing or creating tags.
GitHub-hosted CI and publishing authentication remain to be verified.

## pp internt pilot

- [ ] Refresh adoption [issue #31](https://github.com/frodeste/sanity-guided-tours/issues/31)
  and establish the implementation tracking required by pp-internt.
- [ ] Register the packed plugin in the ProsessPilotene public Studio only, with
  tour/theme desk navigation and the Preview document view.
- [ ] Add the web viewer using shared-sanity query contracts, generated types,
  and the app's existing preview/cache handling.
- [ ] Add product/content reference fields through `extend.tour`, brand theme
  values, Norwegian viewer labels, and the existing analytics callback.
- [ ] Review legacy content and drafts, then manually recreate one pilot tour.
  Leave legacy documents intact until their disposition is agreed.
- [ ] Verify authoring, screenshot upload, element editing, preview, publishing,
  web rendering, keyboard use, and mobile layout against the actual dataset.

## Public launch

- [ ] Publish the verified 1.0.0 through the release workflow with npm provenance.
- [ ] Replace the pp-internt pilot dependency with the published npm version.
- [ ] Submit the plugin to Sanity Exchange and verify the public installation
  instructions from a fresh consumer project.

## Separate follow ups

Norwegian Studio schema localization, cross-chapter drag-and-drop, native lead
capture, analytics dashboards, and controlled-mode lead-capture reconciliation
remain separate from the first web pilot.
