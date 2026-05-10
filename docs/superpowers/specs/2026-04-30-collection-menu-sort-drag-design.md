# Collection Menu: Edit, Sort, Drag Reorder

**Date:** 2026-04-30
**Status:** Approved

---

## Overview

Four related upgrades to the sidebar collection context menu:

1. **Edit** — opens the existing `CreateCollectionModal` pre-filled with the collection's current name, icon, and color. Header reads "Edit Collection" instead of "New Collection".
2. **Sort by submenu** — clicking "Sort by ▸" in the context menu closes it and opens a second `ContextMenu` with sort options: Manual, Name, Date Created, Date Updated. Active sort shows a checkmark and green highlight. Clicking the active sort again toggles ascending/descending direction.
3. **Drag to reorder (Manual mode)** — when sort is set to Manual, collection rows in the sidebar are draggable via dnd-kit. Dropping saves the new order to `data.json`. Drag is disabled when any non-manual sort is active.
4. **Delete** — already exists, no changes needed.

---

## Context Menu Layout

```
✎  Edit…
📦 Archive
↕  Sort by   ▸
─────────────
🗑 Delete
```

Clicking **Sort by** → closes current menu → opens new `ContextMenu` at same coordinates:

```
   Manual
─────────────
✓  Name      ↑       ← active sort: green highlight + checkmark
   Date Created
   Date Updated
```

- Clicking any inactive option → sets it as active sort, direction defaults to ascending
- Clicking the currently active option → toggles direction (↑ ↔ ↓)
- Clicking **Manual** → clears sort, re-enables drag reorder

---

## Edit Modal

`CreateCollectionModal` receives two new optional props:

| Prop | Type | Purpose |
|---|---|---|
| `title` | `string` | Header text. Defaults to `"New Collection"` |
| `initialData` | `{ name, icon, color }` | Pre-fills all fields. Defaults to empty/defaults |

When opened from "Edit…":
- `title` = `"Edit Collection"`
- `initialData` = current collection's `{ name, icon, color }`
- `onSave` calls `handleUpdateCollection(id, { name, icon, color })` instead of `handleAddCollection`

No other changes to the modal. Save button label stays "Save".

---

## Sort State

Stored in `localStorage` under `compendie_collection_sort`:

```json
{ "by": "name", "dir": "asc" }
```

`by` values: `"manual"` | `"name"` | `"date_created"` | `"date_updated"`
`dir` values: `"asc"` | `"desc"`

Default (if nothing in localStorage): `{ by: "manual", dir: "asc" }`.

Applied in Sidebar when rendering `topLevel` collections:

```js
// manual → use array order as-is
// name → sort by col.name locale-aware
// date_created → sort by col.created_at
// date_updated → sort by col.updated_at
```

Sort applies only to top-level collections. Sub-collections always follow their parent and are not independently sorted or dragged.

---

## Drag to Reorder

- Only active when `sort.by === "manual"`
- Uses `@dnd-kit/sortable` (already in project) on the top-level collections list in Sidebar
- On drag end: call new `reorderCollections(newOrderedIds)` in store — same pattern as existing `reorderItems()`
- Drag cursor shown on hover when manual mode is active; default cursor otherwise
- Sub-collections are not draggable

---

## Data Changes

### store.js

**`updateCollection(id, changes)`** — add `updated_at: new Date().toISOString()` to the merged changes on every call.

**New export: `reorderCollections(newOrderedIds)`**

```js
// Reorders data.collections to match newOrderedIds, then saves.
// Same pattern as reorderItems().
```

### Collection schema addition

Each collection gains `updated_at`. Existing collections without this field: treated as `created_at` value when sorting (graceful fallback, no migration needed).

---

## App.jsx Changes

- Add `handleUpdateCollection(id, { name, icon, color })` — calls `updateCollection()`, updates `collections` state
- Extend `handleCollectionContextMenu` to include Edit and Sort by entries
- Sort by entry: calls `openCtxMenu` again with sort options (same `x, y` coordinates)
- Pass `collectionSort` state + `onReorderCollections` down to Sidebar

---

## Sidebar Changes

- Accept `collectionSort`, `onSortChange`, `onReorderCollections` props
- Wrap top-level collection list in dnd-kit `SortableContext` when `sort.by === "manual"`
- Apply sort order to `topLevel` array before rendering when `sort.by !== "manual"`
- Individual collection rows become `SortableItem` wrappers (same pattern as `SortableCard` in Grid)

---

## Out of scope

- Sorting sub-collections independently
- "Move to…" / re-parenting via menu
- Sorting archived collections
- Undo/redo for sort or reorder

