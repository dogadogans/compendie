# Drag-to-Reorder — Design Spec
**Date:** 2026-04-05
**Status:** Approved

---

## Overview

Pinterest-style drag-to-reorder for the masonry grid. Drag any card — other cards shift in real time to show where it will land. Order persists to `data.json`. Works in All view and inside collections (Images tab only).

---

## Ordering Model

One global order. The `data.items` array in `data.json` is the source of truth for order. Every view — All and all collection views — shows items in this same global order (filtered as needed).

Reordering in any view moves those items' positions in the global array. No per-collection sort order. No new schema fields.

**Example:** Global items [A, B, C, D, E]. Collection "X" contains [B, D]. Drag D before B inside collection X → global array becomes [A, D, B, C, E].

---

## Dependencies

Two packages from the dnd-kit ecosystem:
- `@dnd-kit/core` — drag context, sensors, pointer events
- `@dnd-kit/sortable` — sortable primitives (ghost card, transforms, collision detection)

No other new dependencies.

---

## Drag Interaction

- **Initiate:** Press and hold any card for ~150ms → drag begins (delay prevents accidental reorders on clicks)
- **During drag:** Semi-transparent ghost card follows cursor. Other cards animate out of the way (CSS `transform`, 200ms ease). A placeholder hole appears at the insertion point — same dimensions as the ghost, dashed border.
- **Drop:** Release → card snaps into position. Order saved immediately to `data.json`.
- **Cancel:** Press Escape during drag → everything snaps back, no save.

### Visual feedback
| Element | Style |
|---|---|
| Ghost card | 60% opacity, subtle drop shadow, slight scale-up (~1.03) |
| Placeholder hole | Same size as ghost, dashed border `#ccc`, transparent background |
| Shifting cards | `transition: transform 200ms ease` |
| Cursor | `grabbing` during drag |

---

## Gesture Coexistence

Drag-to-reorder must not break rubber-band selection or drag-to-collection.

| Gesture | Behaviour |
|---|---|
| No selection active → drag a card | Reorder (dnd-kit handles) |
| Selection active → drag a selected card | Assign to collection (existing behaviour, dnd-kit bypassed) |
| Selection active → drag an unselected card | Reorder that card only (selection cleared first) |
| Mousedown on background → drag | Rubber-band selection (unchanged — dnd-kit ignores background) |

The 150ms activation delay also ensures short clicks always register as clicks.

---

## Scope

- **In scope:** All view (masonry), Collection view → Images tab
- **Out of scope:** Collection view → Flows tab (different layout, not masonry)

---

## Components

### New: `src/hooks/useMasonryLayout.js`
Calculates absolute card positions given an items array and column count.
- Uses `ResizeObserver` to measure card heights after render
- Returns `{ positions: { [id]: { x, y, width } }, containerHeight }`
- Recalculates on item changes or container resize
- Column count driven by existing zoom slider value (same as today)

### New: `src/components/SortableCard.jsx`
Wraps existing card/FlowCard markup in dnd-kit's `useSortable` hook.
- Applies drag transform during drag (`style.transform` from dnd-kit)
- Accepts `disabled` prop — set `true` when card is part of an active rubber-band selection (bypasses dnd-kit, falls through to existing collection-drag logic)
- Renders the placeholder hole when this card is the active drag overlay target

### Modified: `src/components/Grid.jsx`
- Wrap masonry grid in `DndContext` + `SortableContext` from dnd-kit
- Replace CSS `columns` layout with absolutely-positioned cards using positions from `useMasonryLayout`
- Each item rendered as `SortableCard` instead of a plain `div`/`FlowCard`
- `SortableCard` receives `disabled={selectedIds.has(item.id)}` to bypass dnd-kit for selected items
- Add `onDragStart` / `onDragEnd` handlers:
  - `onDragStart`: if dragged item is in `selectedIds`, cancel dnd-kit drag and call `onSelectionDragStart()` instead
  - `onDragEnd`: compute new item order, call `onReorder(newOrderedIds)`
- Rubber-band mousedown logic (background only) remains untouched

### Modified: `src/store.js`
Add one new export:
```js
export async function reorderItems(newOrderedIds) {
  // loads data, reorders data.items to match newOrderedIds, saves
}
```

### Modified: `src/App.jsx`
- Add `handleReorder(newOrderedIds)`:
  1. Update `items` state optimistically (instant UI update)
  2. Call `reorderItems(newOrderedIds)` in the background
- Pass `onReorder={handleReorder}` prop to `Grid`

### Modified: `src/App.css`
- Remove `columns` and `column-gap` from `.grid`
- Add `position: relative` to `.grid`
- Cards get `position: absolute; left: Xpx; top: Ypx; width: Wpx` via inline style
- Add drag transition: `.card, .flow-card { transition: transform 200ms ease; }`

---

## Data Flow

```
User drags card
  → dnd-kit fires onDragEnd with { active.id, over.id }
  → Grid computes new ordered ID array
  → calls onReorder(newOrderedIds)
    → App updates items state (optimistic)
    → store.reorderItems(newOrderedIds) saves to data.json
```

---

## Out of Scope (v1)

- Per-collection independent sort order
- Drag reordering inside the Flows tab
- Drag reordering of screens within a flow (separate feature)
- Undo/redo for reorder actions
