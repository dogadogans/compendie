# Phase 1 — Collections, Sidebar & Detail Panel

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Data layer rewrite, collections system, sidebar redesign, Eagle-style detail panel, resizable panes

---

## Overview

Phase 1 replaces the existing flat-folder system with a full collections hierarchy, redesigns the sidebar to match the new structure, and replaces the modal detail overlay with an Eagle-style persistent right panel. It also splits the existing monolithic `App.jsx` into focused components.

This is the foundation. Phase 2 (flows) and Phase 3 (multi-select) build on top of it.

---

## Data layer

### Clean slate
No migration. `~/tome/data.json` is rewritten to the new format on first run. Existing data (2 images) is discarded.

### New schema

```json
{
  "collections": [...],
  "items": [...]
}
```

**Item:**
```json
{
  "id": "uuid",
  "type": "image",
  "title": "",
  "image_path": "tome/images/filename.png",
  "tags": ["tag1", "tag2"],
  "collections": ["collection-id"],
  "note": "",
  "created_at": "ISO timestamp"
}
```
- `collections` is an array — an item can belong to multiple collections
- An item with an empty `collections[]` appears under Unorganized

**Collection:**
```json
{
  "id": "uuid",
  "name": "UI Patterns",
  "icon": "📁",
  "parent_id": null,
  "archived": false,
  "created_at": "ISO timestamp"
}
```
- `parent_id: null` = top-level collection
- `parent_id: <id>` = sub-collection (max 1 level deep enforced in UI)
- `archived: true` = moved to Archived section, hidden from main tree

### store.js — new exports
```
loadData()             internal
saveData(data)         internal
loadItems()
addItem({ imageBytes, originalName, title, tags, collections, note })
updateItem(id, changes)
deleteItem(id)         also removes image file from disk
getImageUrl(imagePath)
loadCollections()
addCollection({ name, icon, parentId })
updateCollection(id, changes)
deleteCollection(id)   removes collection from all items' collections[]
archiveCollection(id)  sets archived: true
```

**deleteCollection behaviour:** iterates all items, splices the collection id out of each item's `collections[]`. Items whose `collections[]` becomes empty are now Unorganized. The collection record is deleted. No items are deleted.

---

## File structure

```
src/
  components/
    Sidebar.jsx       collections tree, tags, archived
    Grid.jsx          masonry layout, image cards, drag-drop, paste
    DetailPanel.jsx   Eagle-style right panel
    AddOverlay.jsx    add image form (modal, kept as-is)
    ContextMenu.jsx   extracted, reusable
  store.js            rewritten for new schema
  App.jsx             state, event wiring, layout only
  globals.css
```

---

## Sidebar

### Structure (top to bottom)
```
Tome                          ← logo / app name

All                           ← shows everything
Unorganized                   ← items with collections: []

────────────────────────
Collections               [+]
  ▾ 📁 UI Patterns
      └ Navigation
      └ Modals
  ▸ 🗂️ Tome
    📁 Anne's Spider
────────────────────────
▸ Tags                        ← collapsed by default
────────────────────────
▸ Archived                    ← collapsed by default
    Broscars
```

### Behaviour
- Clicking a parent collection shows all items in it and its sub-collections
- Clicking a sub-collection shows only that sub-collection's items
- Clicking **All** clears all filters
- Clicking **Unorganized** filters to items with `collections: []`
- **+** button next to "Collections" header → inline name input, Enter to confirm, Esc to cancel
- Collapsed sections (Tags, Archived) expand/collapse on click, state persists in `localStorage`
- Active item has a soft background highlight

### Collection right-click menu
- **Rename** — inline edit in sidebar
- **Archive** — moves to Archived section; items unaffected
- **Delete** — confirmation dialog: *"Delete '[name]'? Your images won't be deleted — they'll stay in All and any other collections they belong to."* → on confirm, removes collection only

### Resizing
- Drag handle: 4px wide strip on the right edge of the sidebar
- Highlight on hover (subtle, `cursor: col-resize`)
- Min: **200px**, Max: **340px**
- Width persists in `localStorage` key `tome_sidebar_width`

---

## Grid

No structural changes from current implementation. Extracted into `Grid.jsx`.

- Masonry layout
- Drag-drop (Tauri `tauri://drag-drop` event) and Ctrl+V paste both trigger `AddOverlay`
- Image cards: image only, hover outline
- Clicking a card opens the detail panel (does not close on second click — switches content to that item)
- Right-click → context menu

### Context menu (card)
- Open details
- ─────
- Add to collection → submenu listing all collections
- Remove from current collection (only shown when viewing a specific collection)
- ─────
- Delete (no confirmation — immediate, matches current behaviour)

---

## Detail panel

Eagle-style persistent right panel. No backdrop. No dimming.

### Layout behaviour
- Panel closed: grid fills full remaining width
- Panel open: grid and panel share the space side by side; grid reflows its masonry columns naturally
- Clicking a card while panel is open switches the panel content to that item without closing
- Close: × button (top-right of panel) or Escape key
- Panel open/closed state does NOT persist (always closed on app start)

### Panel contents (top to bottom)
1. × close button (top right, small)
2. Image — full width, `max-height: 240px`, `object-fit: contain`, scrollable if taller
3. Title — editable inline input, `placeholder="Untitled"`
4. Tags — pill input: type + Enter adds a tag, click a pill to remove it
5. Collections — pill-style list of collections this item belongs to; click a pill to remove it, click + to open a small dropdown of available collections to add
6. Note — plain text textarea, `placeholder="Add a note…"`, auto-grows
7. Date saved — read-only, muted, formatted as "March 31, 2026"
8. Delete button — bottom, danger style, no confirmation (matches current behaviour)

### Auto-save
Fields save on blur (not on every keystroke). No explicit Save button in the panel.

### Resizing
- Drag handle: 4px wide strip on the left edge of the panel
- Min: **260px**, Max: **560px**
- Width persists in `localStorage` key `tome_panel_width`

---

## AddOverlay

Unchanged in behaviour. Slight update: the folder dropdown becomes a collections multi-select (or a single collection picker for simplicity in Phase 1 — adding to multiple collections at add time is not required, it can be done from the panel after).

---

## What's explicitly out of Phase 1

- Flows (Phase 2)
- Rubber band multi-select (Phase 3)
- Drag-to-sidebar assignment (Phase 3)
- Zoom slider (Phase 3)
- Collection view tabs (Phase 3)
- Icon library picker (V2)
- Sub-collection creation via drag (not in v1 at all — create via right-click on a collection)

---

## Open questions (resolved)

| Question | Decision |
|---|---|
| Migrate existing data? | No — clean slate |
| Detail view style | Eagle-style panel, no dimming |
| Tags in sidebar? | Yes, collapsed by default |
| Collection icons | Emojis for now, icon library in V2 |
| Sidebar resize bounds | 200px min / 340px max |
| Panel resize bounds | 260px min / 560px max |
