# Spec: Add Overlay Redesign
**Date:** 2026-04-02
**Branch:** feat/flows

---

## Scope

Full rewrite of `AddOverlay.jsx`. No new files. No new dependencies.

The goal: replace the current left/right split layout (thumbnail strip + form column) with a centered modal that shows all content spatially — all images as editable cards simultaneously in Image mode, and a ClickUp-style form with collection toggle pills in Flow mode.

---

## Shell

Centered modal, ~640px wide, max-height 82vh, internal scroll on body. Full-width backdrop. Escape key cancels.

```
.add-panel
  .add-header
    .add-tabs  ← "Image" | "Flow" tab buttons
    button.add-close  ← × top-right
  .add-body  ← scrollable, grows between header and footer
    [flow content or image content]
  .add-footer
    button.btn-ghost  ← Cancel
    button.btn-primary  ← Save
```

The tab toggle is always visible regardless of how many files were added. Switching tabs preserves any data already entered (flow title stays when you switch to image mode and back).

---

## Image Mode

`.add-image-row` — a horizontally scrollable flex row, `overflow-x: auto`, `gap: 12px`, `padding: 16px`.

Each card (`.add-image-card`):
- ~200px wide, fixed height ~320px, flex-direction column
- Top ~55%: image preview, `object-fit: cover`, rounded top corners
- Bottom ~45%: always-visible fields, white background, slight border-top
  - `input` — Title, placeholder "Title"
  - `input` — Tags, placeholder "Tags, comma separated"
  - `select` — Collection dropdown, "No collection" default + one option per collection

If only 1 image: single card is centered in the row (justify-content: center).

**State per card:** `imageMetas[i] = { title, tagInput, collectionId }` — initialized empty, updated independently per index.

**Save:** builds `dataList` from all cards simultaneously (no "Next →" flow). Calls `onSave(dataList)`.

---

## Flow Mode

`.add-flow-body` — vertical flex column, `gap: 16px`, `padding: 16px`.

**Screen strip** — `.add-flow-strip`: horizontally scrollable row of thumbnails. Each thumbnail ~90px tall, aspect-ratio preserved (`object-fit: cover`), rounded, no click interaction needed (preview only).

**Fields below the strip (in order):**
1. `input.add-title-large` — prominent title input, larger font (~18px), placeholder "Flow name"
2. `input.field-input` — tags, placeholder "Tags, comma separated"
3. `textarea.field-textarea` — note, placeholder "Add a note…", 3 rows
4. **Collection pills** — `.add-collection-pills`: flex-wrap row of pill buttons, one per collection.
   - Inactive: outlined pill, muted color
   - Active: filled pill, accent background + white text
   - Clicking toggles membership. Multiple collections can be active.
   - State: `flowCollections: string[]` (array of active collection ids)
   - If `collections.length === 0`: hide the pills section entirely (no empty state message needed)

**Save:** calls `onSaveFlow({ title, tags, note, screens, collections: flowCollections })`.

Note: `onSaveFlow` currently expects `collectionId` (single). The save handler in `AddOverlay` will need to pass `collections: flowCollections` instead, and `App.jsx`'s `handleSaveNewFlow` will need to accept `collections[]` directly instead of wrapping a single `collectionId`.

---

## Data / Props

Props are unchanged: `{ imageFiles, collections, onSave, onSaveFlow, onCancel }`.

### State
| Name | Type | Purpose |
|------|------|---------|
| `mode` | `"image" \| "flow"` | Active tab |
| `imageMetas` | `[{ title, tagInput, collectionId }]` | Per-image fields |
| `flowTitle` | string | Flow-level title |
| `flowTagInput` | string | Flow-level tags (raw comma string) |
| `flowNote` | string | Flow-level note |
| `flowCollections` | `string[]` | Active collection ids for flow |
| `previewUrls` | `string[]` | Object URLs for previews |
| `saving` | boolean | Disables save during async |

### Save shape — Image mode
```js
onSave([
  { imageBytes, originalName, title, tags, note, collectionId },
  ...
])
```
`collectionId` is `imageMetas[i].collectionId || null`.

### Save shape — Flow mode
```js
onSaveFlow({
  title:       flowTitle,
  screens:     imageFiles.map(f => ({ file: f })),
  tags:        parseTags(flowTagInput),
  note:        flowNote,
  collections: flowCollections,   // ← array, replaces single collectionId
})
```

### App.jsx change required
`handleSaveNewFlow` currently does:
```js
const collectionIds = data.collectionId ? [data.collectionId] : ...
```
Change to:
```js
const collectionIds = data.collections?.length
  ? data.collections
  : activeView.type === "collection" ? [activeView.id] : [];
```

---

## CSS

All new classes — nothing existing is removed or renamed (existing `.overlay`, `.overlay-backdrop` reused as-is).

New classes needed:
- `.add-panel` — replaces current layout structure (centered, 640px, flex column)
- `.add-header` — flex row, space-between, border-bottom
- `.add-tabs` — flex row of tab buttons
- `.add-tab-btn` — tab pill, active state: underline or filled
- `.add-close` — icon button, top-right
- `.add-body` — flex-grow, overflow-y auto
- `.add-footer` — sticky bottom, flex row, justify end, border-top
- `.add-image-row` — horizontal scroll flex row
- `.add-image-card` — 200px wide, 320px tall, flex column, border, rounded
- `.add-card-preview` — top portion of card, image fills it
- `.add-card-fields` — bottom portion, padding, gap between inputs
- `.add-flow-body` — vertical flex, padding, gap
- `.add-flow-strip` — horizontal scroll thumbnails
- `.add-flow-thumb` — individual thumbnail in strip
- `.add-title-large` — prominent title input, larger font, no border chrome
- `.add-collection-pills` — flex-wrap row
- `.collection-pill` — pill button, inactive/active states

---

## Out of scope
- Drag-to-reorder screens within flow (handled in FlowBuilder)
- Adding more images after the overlay opens (already handled by the paste/drop events in App.jsx adding to `pendingFiles`)
- Per-screen metadata in flow mode (screens have notes, but those are edited in FlowDetail after saving)
