# Flows — Design Spec
**Date:** 2026-04-01
**Status:** Approved

---

## Overview

Flows are ordered sequences of images that tell a story together (think Mobbin). They appear as a single card in the masonry grid alongside regular images and open into a dark fullscreen horizontal scroll view. Flows are the last major feature needed to reach Tome v1's done condition.

---

## Data Model

Flows live in the same `items[]` array as images, distinguished by `type: "flow"`. This means filtering, collections, search, and tagging all work on flows with no extra logic.

```json
{
  "id": "uuid",
  "type": "flow",
  "title": "Spotify onboarding",
  "screens": [
    { "id": "uuid", "image_path": "~/tome/images/foo.png", "note": "" },
    { "id": "uuid", "image_path": "~/tome/images/bar.png", "note": "" }
  ],
  "tags": ["onboarding", "mobile"],
  "collections": ["collection-id"],
  "note": "optional note on the whole flow",
  "created_at": "ISO timestamp"
}
```

Screens are owned by the flow — they are not standalone items. Each screen has its own `image_path` and optional per-screen `note`. Screen images are saved to `~/tome/images/` using the same path convention as regular images.

---

## Store Changes

Two new functions in `store.js`:

- `addFlow(data)` — saves a new flow item, writes images to `~/tome/images/`, persists to `data.json`. Returns the new item.
- `updateFlow(id, changes)` — merges changes into an existing flow, handles adding/removing/reordering screens (including saving any new screen images to disk). Returns the updated item.

`deleteItem` is reused as-is for flows. `getImageUrl` works unchanged since it operates on paths.

The `imageUrls` map in `App.jsx` (keyed by item/screen ID) must be extended to also load URLs for flow screen images. The existing image-load `useEffect` iterates `items` — it needs to additionally iterate each flow's `screens[]`, loading a URL per screen ID.

---

## Component Architecture

### New components

**`FlowBuilder.jsx`**
Full-screen overlay for creating and editing flows. Two zones: a screen tray (left/main) and a Tome picker panel (right, slides in on demand). Entry points: "New Flow" from the + button (create mode) and the Edit button in FlowDetail (edit mode). On save calls `onSave(flowData)` or `onUpdate(id, changes)`.

**`FlowDetail.jsx`**
Dark fullscreen overlay that opens when a flow card is clicked. Horizontal scroll of screens, right panel for selected screen details. Has an Edit button that opens FlowBuilder in edit mode.

**`FlowCard.jsx`**
The card rendered in the masonry grid for flow items. Offset shadow stack (two background layers shifted down-right), first screen image as the visible face, dark pill badge bottom-right ("4 screens").

**`ScreenDetailPanel.jsx`**
Right panel inside FlowDetail. Shows the selected screen's image, editable note (auto-saves), and position label ("Screen 2 of 4").

### Modified components

**`Grid.jsx`**
Renders `FlowCard` instead of a plain image card when `item.type === "flow"`.

**`App.jsx`**
Adds `flowBuilder` state (`null | { mode: "create" } | { mode: "edit", flow }`). Adds `flowDetail` state (`null | flow`). Renders `FlowBuilder` and `FlowDetail` overlays. Handles `onSaveFlow` and `onUpdateFlow`.

---

## FlowBuilder

### Layout
- Full-screen overlay, same z-index layer as AddOverlay
- Left/main zone: screen tray
- Right zone: Tome picker panel (hidden by default, slides in)

### Screen tray
- Flow title input at top (placeholder: "Flow name…")
- Ordered screen thumbnails — drag to reorder (mousedown → drag)
- Each thumbnail has an × button to remove it
- Three add buttons below the tray: "From files" (file input), "Paste" (triggers same clipboard logic as main app), "Pick from Tome" (opens picker panel)
- Ctrl+V anywhere in the overlay pastes a new screen at the end

### Tome picker panel
- Scrollable grid of all existing `type: "image"` items
- Click an image → appended to tray; clicking it again removes it from the tray (toggle)
- Images currently in the flow show a checkmark overlay to indicate selected state
- Close button dismisses the panel

### Bottom bar
- Tags input (same pill pattern as AddOverlay)
- Note textarea
- Collection picker dropdown (non-archived collections)
- Cancel and Save buttons

### Edit mode
Pre-populates title, screens, tags, note, and collection from the existing flow. Save calls `onUpdate` instead of `onSave`.

---

## FlowDetail

### Layout
- Dark fullscreen overlay (background ~`#111`)
- Top bar: flow title (left), screen count + "Esc to close" (right), Edit button (far right)
- Main area: screens laid out horizontally, overflow-x scroll
- Right panel: slides in when a screen is clicked, stays visible as you navigate

### Screen cards
- Tall portrait cards with the screen image
- Clicking selects the screen and opens/updates the right panel
- Selected screen has a subtle highlight border

### Right panel (ScreenDetailPanel)
- Selected screen image (large, constrained height)
- Editable note textarea (auto-saves on blur, same pattern as DetailPanel)
- Position label: "Screen 2 of 4"
- No delete-screen action here — screen management is in FlowBuilder

### Edit flow
- Edit button in top bar opens FlowBuilder in edit mode
- After saving, FlowDetail re-renders with the updated flow

### Keyboard
- Esc — close FlowDetail
- ← → arrow keys — navigate between screens

---

## FlowCard (grid)

- Renders in masonry grid alongside image cards
- Visual: two offset background layers (shifted 4px and 8px down-right, progressively lighter) behind the main card
- Main card shows the first screen's image
- Dark pill badge bottom-right: "N screens" (e.g. "4 screens")
- Hover and context menu behaviour identical to image cards
- Right-click opens same context menu (open details, add to collection, delete)

---

## Entry Points

| Action | How |
|---|---|
| Create a flow | + button → "New Flow" → opens FlowBuilder (create mode) |
| Open a flow | Click flow card in grid → opens FlowDetail |
| Edit a flow | FlowDetail → Edit button → opens FlowBuilder (edit mode) |
| Delete a flow | Right-click flow card → Delete, or FlowDetail → (no direct delete — use context menu) |

---

## Out of scope for this feature

- Picking from existing flows (only images can be screens)
- Rubber band multi-select (separate feature)
- Collection view Images/Flows tabs (can follow as a small addition after flows are working)
- Flow export or sharing
