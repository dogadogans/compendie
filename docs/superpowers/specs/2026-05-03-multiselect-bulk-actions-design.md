# Multi-select Bulk Actions & Organize Mode

**Date:** 2026-05-03  
**Status:** Approved

---

## Overview

Two connected features:

1. **Expanded `...` menu** in the Grid top nav — adds collection-level actions (Organize, Edit, Archive) alongside the existing Sort and Delete.
2. **Multi-select + Actions bar** — users select items via Organize mode or rubber-band drag, then bulk-act on them via a "⌘ Actions" bar.

---

## 1. Expanded `...` Menu

Currently `handleGridOptionsMenu` in `App.jsx` opens a sort menu plus Delete Collection. Replace it with a richer menu, visible **only when inside a collection view** (`activeView.type === "collection"`).

### Menu structure

```
↕  Sort by               →  (submenu — existing buildSortMenuItems)
──────────────────────────
⊞  Organize images/flows    → enters organizeMode
✏️  Edit...                  → opens CreateCollectionModal (edit mode)
──────────────────────────
🗑  Delete collection        (danger) → existing handleDeleteCollection
📦  Archive collection       → existing handleArchiveCollection
```

On **All / Unorganized / Tag** views, the menu shows Sort by only (no collection-specific actions).

### Wiring

- `handleGridOptionsMenu` passes `activeView` and new callbacks (`onOrganize`, `onEditCollection`) to build the menu conditionally.
- "Edit..." calls `setEditingCollection(collections.find(c => c.id === activeView.id))` — reuses the existing `CreateCollectionModal` flow already in `App.jsx`.
- "Archive collection" calls existing `handleArchiveCollection(activeView.id)`.

---

## 2. Selection State

Add to `App.jsx`:

```js
const [selectedIds,   setSelectedIds]   = useState(new Set());  // selected item IDs
const [organizeMode,  setOrganizeMode]  = useState(false);       // true = selection mode active
```

`organizeMode` is entered by:
- Clicking "Organize images/flows" in the `...` menu
- Rubber-band drag selecting items (existing future work — out of scope here; the bar still appears when `selectedIds.size > 0`)

`organizeMode` is exited by:
- Clicking `×` in the selection bar → clears `selectedIds` and sets `organizeMode` to false
- All items deselected manually

Pass both down to `Grid` as `organizeMode` and `selectedIds`, with a `onToggleSelect(id)` callback.

---

## 3. Grid Changes

### Card click in organizeMode

When `organizeMode` is true, card click calls `onToggleSelect(item.id)` instead of `onCardClick`. Detail panel does not open.

### Selection ring

Each card gets a circular indicator overlay (top-right corner):
- Default: empty ring (`border: 1.5px solid rgba(255,255,255,0.3)`)
- Selected: filled blue circle with white checkmark

Use a CSS class `.card--selected` and a `.card-select-ring` overlay div inside each card. Only rendered when `organizeMode` is true or `selectedIds.has(item.id)`.

---

## 4. Selection Bar

Rendered inside `.main-area` in `App.jsx`, fixed at the bottom, visible when `selectedIds.size > 0`.

```
[ N Selected ]  [ × ]  [ ⌘ Actions ↓ ]
```

Styling: dark pill bar, centered, floating above grid content. Uses existing `.btn-icon` aesthetic. Animate in/out with `framer-motion` (`AnimatePresence`) — slide up from bottom.

### × button
Calls `setSelectedIds(new Set())` and `setOrganizeMode(false)`.

### ⌘ Actions button
Opens an inline dropdown (not `ContextMenu` — the ContextMenu is positioned by cursor coords; this one anchors to the button). New component: `ActionsDropdown` — a small positioned menu div.

---

## 5. Actions Dropdown

New component: `src/components/ActionsDropdown.jsx`

Menu items:

```
→  Move to...
⊞  Copy to...
📁  New folder here
──────────────────
🗑  Delete
```

**Move to...** and **Copy to...** both open the Collection Picker (see §6).

**New folder here** opens `QuickFolderModal` (see §7). Only shown when `activeView.type === "collection"`.

**Delete** opens `DeleteConfirmModal` with a generalized message (see §8).

---

## 6. Collection Picker

New component: `src/components/CollectionPicker.jsx`

A small dropdown panel (not a modal) that anchors below the Actions dropdown. Shows all non-archived collections. Items already containing **all** selected items are greyed out (they're already there).

Props:
- `mode: "move" | "copy"` — changes the header label
- `collections` — non-archived collections
- `selectedIds` — to determine which collections already contain all items
- `items` — full items list for membership check
- `onPick(collectionId)` — called when user taps a destination

**Move logic** (in App.jsx `handleBulkMove`):
- For each selected item: remove `activeView.id` from `item.collections`, add `targetId`
- Call `handleUpdate(id, { collections: newList })` for each

**Copy logic** (in App.jsx `handleBulkCopy`):
- For each selected item: add `targetId` to `item.collections` if not already present
- Call `handleUpdate(id, { collections: newList })` for each

After either action: clear `selectedIds`, exit `organizeMode`.

---

## 7. QuickFolderModal

New component: `src/components/QuickFolderModal.jsx`

Uses existing `Modal` + `Button` + `Input` UI primitives.

```
Title: "New folder"
Subtitle: "Inside [collection name] · N items will be added"
[ name input ]
[ Cancel ]  [ Create ]
```

On Create:
1. Call `handleAddCollection({ name, parentId: activeView.id })` with a default icon/color
2. Add selected items to the new collection: `handleUpdate(id, { collections: [...item.collections, newCol.id] })` for each
3. Close modal, clear `selectedIds`, exit `organizeMode`

Default icon: `"Folder"` (lucide). Default color: `"#888888"`.

---

## 8. Delete Confirmation (Items)

Generalize `DeleteConfirmModal` to accept optional `title` and `message` props, falling back to the current collection-delete wording when not provided.

For bulk item delete:
- title: `"Delete N items?"`
- message: `"This cannot be undone. Deleted items are removed from Tome permanently."`
- Button: `"Delete N items"` (danger)

On confirm: call `handleDelete(id)` for each selected ID in sequence. Clear `selectedIds`, exit `organizeMode`.

---

## Files Changed / Created

| File | Change |
|------|--------|
| `src/App.jsx` | Add `selectedIds`, `organizeMode` state; bulk action handlers; update `handleGridOptionsMenu`; render selection bar + modals |
| `src/components/Grid.jsx` | Accept `organizeMode`, `selectedIds`, `onToggleSelect`; modify card click; add selection ring overlay |
| `src/components/ActionsDropdown.jsx` | **New** — anchored dropdown for bulk actions |
| `src/components/CollectionPicker.jsx` | **New** — collection destination picker |
| `src/components/QuickFolderModal.jsx` | **New** — lightweight folder creation during organize flow |
| `src/components/DeleteConfirmModal.jsx` | Generalize to accept `title` / `message` overrides |
| `src/App.css` | Selection bar styles, card selection ring styles |

---

## Out of Scope

- Rubber-band (lasso) draw-to-select — future work
- Shift+click range select

## Notes

Flows are fully included — they have the same `collections[]` field as images, so all bulk actions (move, copy, delete, new folder) work identically for both content types. The "Organize images/flows" label in the menu reflects this.
