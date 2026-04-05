# Spec: Multi-select, Drag-to-Collection, and Collection Tabs
**Date:** 2026-04-02
**Branch:** feat/flows

---

## Scope

Three features completing the remaining spec for Tome v1:

1. **Rubber band multi-select** — click-drag on grid background to select multiple cards
2. **Drag selection to sidebar** — drag selected cards onto a collection to assign them
3. **Collection view tabs** — Images / Flows tabs when viewing a collection

Collection icon flavors (reference vs project) are **out of scope** — dropped in favour of freeform emoji per user preference.

---

## Feature 1: Rubber Band Multi-select

### State
`selectedIds: Set<string>` lives in `App.jsx`. Passed into `Grid` as a prop. Grid reports changes back via `onSelectionChange(ids: Set)`.

### Gesture — Grid.jsx
- `mousedown` on the grid background (not on a `.card` or `.flow-card`) → start rubber band. Record origin `{ x, y }`.
- `mousemove` → if displacement from origin >5px, draw selection rectangle as an absolutely-positioned overlay `<div className="rubber-band">` on the grid. On each frame, test each card's `getBoundingClientRect()` against the rubber band rect and update `selectedIds` in real time via `onSelectionChange`.
- `mouseup` → finalize. If total displacement <5px, treat as a background click and clear selection. Remove overlay.
- `mousedown` on `.card` or `.flow-card` → rubber band does NOT start; normal click/drag proceeds.
- Pressing `Escape` → clears selection.

### Card visual state
Selected cards receive a `selected` CSS class — a soft accent ring (`outline: 2px solid var(--accent); outline-offset: 2px`). Nothing else changes visually.

### Conflict avoidance
- Click on card: `mousedown` target check prevents rubber band from starting.
- FlowBuilder multi-select: separate fullscreen overlay, no interaction.
- Existing card context menu: right-click is unaffected; rubber band only starts on left `mousedown`.

---

## Feature 2: Drag Selection to Sidebar

### Gesture start
`mousedown` on any **selected** card (when `selectedIds.size > 0`) starts a collection-assignment drag instead of rubber band. This is detected in Grid.jsx: if `mousedown` target is a card and that card's id is in `selectedIds`, fire `onSelectionDragStart`.

### Ghost
App.jsx renders a fixed-position ghost `<div className="drag-ghost">` reading `+N` (count of selected items). It follows the cursor via `mousemove` on `window`. Rendered at the App level so it floats freely over the sidebar.

### Drop target detection
On `mousemove`, App.jsx calls `document.elementFromPoint(x, y)` and traverses with `.closest('[data-collection-id]')` to find a hovered sidebar collection. This id is stored as `dragOverCollectionId` in App state and passed to Sidebar as a prop.

### Sidebar highlight
Sidebar renders `data-collection-id={col.id}` on each collection row. When `dragOverCollectionId` matches, the row gets a `drag-target` CSS class — a soft highlight.

### Drop
On `mouseup`:
- If `dragOverCollectionId` is set: for each selected item, merge the collection id into its `collections[]` array (no duplicates) via `handleUpdate`.
- Clear `selectedIds`, `dragOverCollectionId`, hide ghost.
- If dropped outside a collection: no change, selection clears.

### Callbacks (Grid → App)
```
onSelectionDragStart()
onSelectionDragMove(x, y)
onSelectionDragEnd()
```
App attaches `mousemove`/`mouseup` listeners to `window` when drag is active, removes them on end.

---

## Feature 3: Collection View Tabs

### State
`activeTab: "images" | "flows"` is local state in `Grid.jsx`. Resets to `"images"` via `useEffect` whenever `activeView` changes.

### When tabs appear
Only when `activeView.type === "collection"`. All other views render normally with no tabs.

### Tab placement
Two small text tabs in the toolbar row, left-aligned after the view title. Underline on active tab. No heavy chrome.

### Images tab
Same masonry grid as today, filtered to `item.type === "image"`.

### Flows tab
Mobbin-style layout — each flow is a horizontal row:
- Flow title on the left (fixed, non-scrolling)
- Screens scroll horizontally to the right
- Each row is independently scrollable (`overflow-x: auto`)
- Clicking a screen fires `onCardClick(flow)` → opens FlowDetail as today

### Empty states
- No images: "No images in this collection."
- No flows: "No flows in this collection."

---

## Component changes summary

| Component | Changes |
|-----------|---------|
| `App.jsx` | Add `selectedIds`, `dragOverCollectionId`, ghost rendering, drag window listeners, `onSelectionChange`, `onSelectionDragStart/Move/End` handlers |
| `Grid.jsx` | Add rubber band mousedown/move/up logic, tab state + rendering, pass `selectedIds` to cards, emit drag callbacks |
| `Sidebar.jsx` | Add `dragOverCollectionId` prop, `data-collection-id` attrs, `drag-target` CSS class |
| `App.css` | `.rubber-band`, `.drag-ghost`, `.selected`, `.drag-target`, `.flows-tab-layout` styles |

No new files needed. No new dependencies.

---

## Out of scope
- Rubber band on touch/trackpad (mouse events only for v1)
- Keyboard multi-select (Shift+click, Cmd+click)
- Collection icon flavors
