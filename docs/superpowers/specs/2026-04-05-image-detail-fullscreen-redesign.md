# Image Detail — Fullscreen Redesign

**Date:** 2026-04-05
**Status:** Approved

---

## Problem

The current `DetailPanel` is a right-side drawer that slides in alongside the grid. The image is small (capped at 240px), the layout is cramped, and there's no way to navigate between images without closing and reopening. It doesn't match the calm, focused feel of the app.

---

## Design

Replace the drawer with an **Are.na-style fullscreen split view** — the same pattern already used by `FlowDetail`.

### Layout

- **Fullscreen overlay:** `position: fixed; inset: 0; z-index: 100`. Takes over the entire window. Grid and sidebar disappear.
- **Left (65%):** Dark background (`#111`). Image centered, `object-fit: contain`, max width/height respects padding. Navigation arrows overlaid. Close button top-right. Position counter bottom-center.
- **Right (35%):** White background, `border-left: 1px solid var(--border)`. Scrollable. Contains all editable metadata.

### Left panel — image area

- Image is `object-fit: contain` so no cropping regardless of aspect ratio
- Background: `#111` (near-black, same as FlowDetail)
- **× close button** — top-right corner, white/muted, Escape key also closes
- **‹ › nav arrows** — overlaid on left and right edges, semi-transparent circle buttons (`rgba(255,255,255,0.1)`), visible on hover. Hidden if only one image in the filtered list.
- **"3 of 12" counter** — bottom-center, small muted white text. Shows position in the current filtered view.

### Right panel — metadata

Scrollable column with section labels in small uppercase. All fields are directly editable (no edit mode toggle).

```
[Title input — editable inline]
───────────────────────────────
Tags
  [tag pill] [tag pill] [+ input]

Collections
  [collection pill] [+ button → picker]

Note
  [textarea]

[April 5, 2026]          ← read-only, muted
[Delete]                 ← red, bottom
```

- Title: plain `<input>`, saves on blur
- Tags: type + Enter to add, × to remove
- Collections: pills with ×, + button opens picker dropdown
- Note: `<textarea>`, saves on blur
- Date: formatted `created_at`, read-only
- Delete: red text button, triggers `onDelete(item.id)` then `onClose()`

### Navigation

- **← → keyboard arrows** — navigate to prev/next item in the current filtered list
- **Escape** — close the detail view
- **‹ › overlay arrows** — same prev/next action, mouse-friendly
- Navigation order follows the same filtered + sorted order as the grid

---

## App.jsx changes

### Remove (no longer needed)
- `panelWidth` state
- `localStorage.getItem("compendie_panel_width")`
- `handlePanelResizeStart` callback

### Add
- Pass `filteredItems` (the already-computed `filtered` array) and `selectedItem` into `DetailPanel`
- `DetailPanel` computes its own index: `filtered.indexOf(selectedItem)` and calls `onNavigate(item)` to update `selectedItem` in App

### Props after redesign
```js
<DetailPanel
  item={selectedItem}
  allItems={filtered}          // for prev/next navigation
  imageUrls={imageUrls}
  collections={collections}
  onUpdate={handleUpdate}
  onDelete={handleDelete}
  onClose={() => setSelectedItem(null)}
  onNavigate={setSelectedItem} // replaces onResizeStart
/>
```

Remove `width` and `onResizeStart` props entirely.

---

## CSS changes

- Remove `.detail-panel-eagle`, `.panel-resize-handle`, all panel sizing/resize styles
- Add `.detail-fullscreen` — the fullscreen overlay
- Add `.detail-img-side` — left dark panel
- Add `.detail-meta-side` — right white panel, scrollable
- Add `.detail-nav-arrow` — overlay arrow buttons
- Add `.detail-counter` — "3 of 12" text
- Reuse existing: `.panel-title`, `.panel-tags-wrap`, `.tag-pill`, `.tag-input`, `.tag-remove`, `.panel-note`, `.panel-date`, `.panel-collections-wrap`, `.collection-pill`, `.collection-picker`, `.btn-danger`

---

## What doesn't change

- All save logic: title blur → `onUpdate`, tag add/remove, collection toggle, note blur → `onUpdate`
- `useEffect` for item sync on `item.id` change
- Collection picker outside-click handler
- `onDelete` → `onClose` flow
- The `DetailPanel` filename — just rewritten internally

---

## Out of scope

- Animation/transition on open (can add later)
- Zoom or pan on the image
- Keyboard shortcut hints overlay
