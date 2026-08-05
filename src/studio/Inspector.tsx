// The inspector pane (master plan Task 7): a read-only summary of the
// selected element (or, with no element selected, the selected step) drawn
// straight from the platform's own member tree, plus an action that hands
// off editing to Sanity's own real item-editing surface for that exact
// array item.
//
// MECHANISM CHOSEN (recorded per the master plan's Task 7 ask, and the
// brief's explicit "document the chosen mechanism and its tradeoff"):
// `arrayProps.onItemOpen(node.path)` — NOT inline rendering of the located
// member via `ArrayOfObjectsItem`/`MemberField`, even though both are real,
// importable values from `sanity` (`import {ArrayOfObjectsItem, MemberField}
// from 'sanity'` resolves and type-checks; they're marked `@internal`/`@beta`
// in their JSDoc but ARE re-exported from the package root). *Locating* the
// selected step/element's own FormNode by walking `arrayProps.members` below
// (chapter item -> `steps` field -> step item -> `elements` field -> element
// item) uses only public, documented `sanity` types
// (`ArrayOfObjectsMember`/`ObjectMember`/`FieldMember`/`ArrayOfObjectsItemMember`)
// and is stable. *Rendering* a located member through `ArrayOfObjectsItem`/
// `MemberField`, however, is not something this component can do safely:
// reading the compiled `sanity` source (`useBundleDocuments-*.js`) shows both
// components pull `useFormCallbacks()`, `useTranslation()`, `useCopyPaste()`,
// `useTelemetry()`, `useEnhancedObjectDialog()`, `useToast()`,
// `useGetFormValue()` and `useResolveInitialValueForType()` — a chain of
// Studio-root-level context providers that exist in the real running Studio
// (`CanvasInput` is genuinely mounted inside that whole provider tree at
// `components: {input}`) but that this component would otherwise have to
// fake by hand-building the `onChange`/`elementProps`/upload-handler wiring
// those hooks supply. That hand-built wiring is exactly the
// "re-implementation" the brief's REQUIREMENT rules out (a PT `content`
// field, in particular, would additionally need `PortableTextEditor`
// context that only `PortableTextInput`'s own wrapper sets up), and exactly
// the version-fragility the brief's fallback anticipates ("if member
// drilling proves unstable across sanity minor versions").
//
// `onItemOpen`, by contrast, is a single already-wired callback CanvasInput
// receives directly off `props` (`ArrayOfObjectsInputProps.onItemOpen: (path:
// Path) => void`, documented "for array inputs using modal open/close
// semantics for items"). Calling it hands the ENTIRE editing surface to
// Sanity's own dialog machinery, so PT editing, validation display,
// presence and undo are the platform's, unreimplemented — with zero
// internal-component imports and zero hand-rolled patch/onChange wiring.
// The path handed to it is the FormNode's own `.path` (read directly off the
// drilled-to member, not reconstructed by hand), which the compiled source
// confirms is exactly the path Sanity's own internal `onItemOpen`/`onPathOpen`
// proxies expect at any depth (`onItemOpen(memberItem.node.path)`,
// `onItemOpen(path.concat(relativePath))`).
//
// TRADEOFF: editing happens in Sanity's own item dialog, not inline in this
// pane — a real UX cost against the brief's stated preference for fully
// inline member rendering. This pane still surfaces a read-only summary
// (element type/label, or step title) and a validation-marker count read
// straight off the located node (`node.validation`, already computed by the
// platform) so an author gets orientation without opening the dialog;
// "Edit fields" is the one click needed to reach the real form.
//
// STEP CASE: the brief's stated fallback ("if per-field scoping is brittle,
// rendering the step's full object member is acceptable") is taken literally
// here too — rather than drilling into the step's own `title`/`advance`/
// `duration`/`notes` FieldMembers individually, the whole step item's own
// node/path is used, so "Edit step fields" opens the step's own item dialog
// (all four scalar fields, plus screenshot/elements) rather than one field
// at a time.
//
// ORPHAN SELECTION (SDD ledger follow-up bound to this task): a selection
// that doesn't resolve against `arrayProps.members` — a pending insert
// `members` hasn't caught up with yet, or a stale key `useEditorState`'s own
// heal hasn't caught up to (see `useEditorState.ts`'s doc comment on why
// heals lag by one render) — renders the same neutral pane text as "nothing
// selected" rather than a broken/stale one. `drillToStep`/`drillToElement`
// return `null` on any hop that doesn't resolve, and every caller below
// treats `null` as "render the neutral state", never as "something to
// render anyway".
import {Badge, Button, Card, Stack, Text} from '@sanity/ui'
import type {ReactNode} from 'react'
import type {
  ArrayOfObjectsInputProps,
  ArrayOfObjectsItemMember,
  ArrayOfObjectsMember,
  BaseFormNode,
  FieldMember,
  ObjectArrayFormNode,
  ObjectMember,
} from 'sanity'

import {elementAccessibleName} from './canvasHandlers'
import type {EditorSelection} from './useEditorState'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isArrayOfObjectsMemberArray(value: unknown): value is ArrayOfObjectsMember[] {
  return Array.isArray(value)
}

/**
 * `FieldMember.field` is generically typed `BaseFormNode` — `sanity`'s own
 * types erase which concrete FormNode subtype a given field's value actually
 * carries (there's no public union that would express "this specific field
 * is an array-of-objects field with `.members`"), so this is the one
 * legitimate `unknown`-narrowing step in an otherwise fully `sanity`-typed
 * walk. Confirmed against the platform's own internal wiring: `MemberField`'s
 * compiled implementation builds a nested array field's props from
 * `member.field.members` the same way, for the same reason.
 */
function arrayFieldMembers(field: BaseFormNode): ArrayOfObjectsMember[] {
  const raw: unknown = field
  if (!isRecord(raw)) return []
  return isArrayOfObjectsMemberArray(raw.members) ? raw.members : []
}

function findItemMember(
  members: ArrayOfObjectsMember[],
  key: string,
): ArrayOfObjectsItemMember | null {
  for (const member of members) {
    if (member.kind === 'item' && member.key === key) return member
  }
  return null
}

function findFieldMember(members: ObjectMember[], name: string): FieldMember | null {
  for (const member of members) {
    if (member.kind === 'field' && member.name === name) return member
  }
  return null
}

/**
 * Chapter item -> `steps` field -> step item, or `null` if any hop doesn't
 * resolve (see this module's ORPHAN SELECTION note above).
 */
function drillToStep(
  members: ArrayOfObjectsMember[],
  chapterKey: string,
  stepKey: string,
): ObjectArrayFormNode | null {
  const chapterItem = findItemMember(members, chapterKey)
  if (!chapterItem) return null
  const stepsField = findFieldMember(chapterItem.item.members, 'steps')
  if (!stepsField) return null
  const stepItem = findItemMember(arrayFieldMembers(stepsField.field), stepKey)
  return stepItem ? stepItem.item : null
}

/** `elements` field -> element item, within an already-resolved step node. `null` if it doesn't resolve. */
function drillToElement(
  stepNode: ObjectArrayFormNode,
  elementKey: string,
): ObjectArrayFormNode | null {
  const elementsField = findFieldMember(stepNode.members, 'elements')
  if (!elementsField) return null
  const elementItem = findItemMember(arrayFieldMembers(elementsField.field), elementKey)
  return elementItem ? elementItem.item : null
}

function stepSummary(value: unknown): string {
  const title = isRecord(value) && typeof value.title === 'string' ? value.title.trim() : ''
  return title || 'Untitled step'
}

function elementSummary(value: unknown): string {
  return isRecord(value) ? elementAccessibleName(value) : 'Element'
}

function NeutralPane({message, testId}: {message: string; testId: string}): ReactNode {
  return (
    <Card borderLeft data-testid={testId} padding={3} style={{minWidth: 260}}>
      <Stack gap={3}>
        <Text size={1} weight="semibold">
          Inspector
        </Text>
        <Text muted size={1}>
          {message}
        </Text>
      </Stack>
    </Card>
  )
}

function ValidationBadge({count}: {count: number}): ReactNode {
  if (count === 0) return null
  return (
    <Badge data-testid="inspector-validation" tone="critical">
      {count} issue{count === 1 ? '' : 's'}
    </Badge>
  )
}

export interface InspectorProps {
  /**
   * The `chapters` field's own props — this is where `members` (the real
   * member tree) and `onItemOpen` (the platform's own item-editing entry
   * point) come from. Kept as the full `ArrayOfObjectsInputProps` rather
   * than narrowed to just the two fields this component reads, matching
   * `CanvasInput.tsx`'s own `CanvasInputProps` alias (same type, named
   * separately here only because this file doesn't import that alias).
   */
  arrayProps: ArrayOfObjectsInputProps
  selection: EditorSelection
}

/** The inspector pane: selected element's or step's real member, opened via Sanity's own item dialog — see this module's doc comment for the chosen mechanism and its tradeoff. */
export function Inspector({arrayProps, selection}: InspectorProps): ReactNode {
  const {chapterKey, stepKey, elementKey} = selection

  if (chapterKey === null || stepKey === null) {
    return <NeutralPane message="Select an element to edit its fields." testId="inspector-empty" />
  }

  const stepNode = drillToStep(arrayProps.members, chapterKey, stepKey)
  if (!stepNode) {
    return <NeutralPane message="Nothing selected — syncing…" testId="inspector-syncing" />
  }

  if (elementKey !== null) {
    const elementNode = drillToElement(stepNode, elementKey)
    if (!elementNode) {
      return <NeutralPane message="Nothing selected — syncing…" testId="inspector-syncing" />
    }

    return (
      <Card borderLeft data-testid="inspector-element" padding={3} style={{minWidth: 260}}>
        <Stack gap={3}>
          <Text size={1} weight="semibold">
            Inspector
          </Text>
          <Stack gap={2}>
            <Text data-testid="inspector-element-label" size={1}>
              {elementSummary(elementNode.value)}
            </Text>
            <ValidationBadge count={elementNode.validation.length} />
          </Stack>
          <Button
            data-testid="inspector-edit-element"
            onClick={() => arrayProps.onItemOpen(elementNode.path)}
            text="Edit fields"
            tone="primary"
          />
        </Stack>
      </Card>
    )
  }

  return (
    <Card borderLeft data-testid="inspector-step" padding={3} style={{minWidth: 260}}>
      <Stack gap={3}>
        <Text size={1} weight="semibold">
          Inspector
        </Text>
        <Stack gap={2}>
          <Text data-testid="inspector-step-title" size={1}>
            {stepSummary(stepNode.value)}
          </Text>
          <ValidationBadge count={stepNode.validation.length} />
        </Stack>
        <Button
          data-testid="inspector-edit-step"
          onClick={() => arrayProps.onItemOpen(stepNode.path)}
          text="Edit step fields"
          tone="primary"
        />
      </Stack>
    </Card>
  )
}
