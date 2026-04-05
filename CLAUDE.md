# Tome
**tagline:** Your personal visual archive. Screenshots, flows, collections — all yours.
**version:** v1.0
**stack:** Tauri 2 + React + Vite
**font:** Inter

---

## The problem

You screenshot something interesting and it disappears into your downloads folder forever. You capture a UI flow and the screens pile up as unrelated images in Figma. No tags, no visual grid, no way to find things or see them in sequence. mymind costs money. Eagle is too heavy. Mobbin is too expensive. Tome is yours — calm, local, intentional, and open source.

---

## Appetite

**3–4 weeks**

---

## Naming

- **App name:** Tome
- **Inspired by:** The Hyrule Compendium from Breath of the Wild / Tears of the Kingdom — a personal visual archive of everything you've discovered
- **Architecture:** Built to support Mac later (Tauri 2 is cross-platform). Windows-first for v1.

---

## Content types

Tome has two content types:

**Image** — a single screenshot. Opens a right side drawer on click.

**Flow** — an ordered sequence of images that tell a story together. Think Mobbin. Order matters. Opens a horizontal scroll view on click. Shows as a single card in the grid with a "4 screens" indicator.

---

## Screens & flows

### 1. All view (main screen)

- Masonry grid of all saved items — both images and flows mixed
- Image card: just the image, no metadata
- Flow card: first image visible + subtle "4 screens" indicator — looks like a stacked card
- Hover state: subtle outline or dim, nothing more
- No tabs in All view — everything together

**Sidebar (left):**

```
All
Unorganized          ← images/flows not in any collection
─────────────────
Collections
  UI Patterns
    Navigation
    Modals
  Tome
  Anne's Spider
─────────────────
Archived             ← collapsed by default
  Broscars
```

- Collections can nest one level deep (max 2 levels in practice)
- Each collection has an icon — two flavors: reference (permanent) or project (temporary)
- Clicking a parent collection shows everything inside including sub-collections
- Active item highlighted softly

**Top bar:**
- Mini search — real-time filter by tag or note content
- Zoom slider — controls masonry column count, persists via localStorage
- Add button (top right)

---

### 2. Collection view (click a collection in sidebar)

When inside a collection, two tabs appear at the top of the content area:

- **Images** — masonry grid of single images in this collection
- **Flows** — Mobbin-style view. Flows stacked vertically. Each row is one flow, scroll horizontally to browse its screens.

Default tab is Images. Tab choice does not persist — resets on navigation.

---

### 3. Add image

Two entry points:
- Drag and drop an image file onto the app window
- Ctrl+V with an image copied to clipboard

What happens:
- Image saved to `~/tome/images/` via Tauri FS API
- Small inline form: tag input (type + enter = tag pill) + optional note field
- Save → appears in grid immediately

---

### 4. Add flow

Entry point: Add button → "New Flow"

What happens:
- Name the flow (e.g. "Spotify onboarding")
- Add images in order — drag from finder, Ctrl+V, or pick from existing images already in Tome
- Reorder by dragging within the flow builder
- Add tags and optional note to the whole flow
- Save → appears in grid as a flow card

---

### 5. Image detail — right side drawer

Click one image → drawer slides in from the right. Grid stays visible, slightly dimmed.

Drawer contains:
- Full image at top (constrained height, scrollable if tall)
- Title (editable inline)
- Tags (type + enter to add, click to remove)
- Collection membership
- Note (editable textarea, plain text)
- Date saved (read only, muted)
- Delete button (bottom, requires confirm)

Close: click outside or press Escape.

---

### 6. Flow detail — horizontal scroll view

Click a flow card → opens fullscreen horizontal scroll view.

- Flow name at top left
- Screens laid out horizontally — scroll to browse
- Click any screen → shows that screen's detail on the right (same drawer pattern)
- Escape to go back to grid

---

### 7. Multi-select & collection assignment

**Rubber band selection** — click and drag on empty space to draw a selection rectangle. Images inside get highlighted. No checkboxes.

**Drag to sidebar** — drag selection toward a collection. A "+4" ghost follows cursor. Drop → all assigned to that collection.

**Right-click context menu:**
- Add to collection → submenu
- Remove from current collection
- Delete (with confirm)

An image can belong to multiple collections. Removing from a collection never deletes it — it always exists in All.

---

### 8. Collections management

**Create:** right-click in sidebar → New Collection. Name it, pick icon flavor.

**Sub-collections:** drag a collection onto another to nest it.

**Archive:** right-click → Archive. Moves to Archived, collapsed by default. Images and flows stay in grid, unaffected.

**Delete:** right-click → Delete Collection. Deleting a collection only removes the collection itself — all images and flows inside it are unaffected. They remain in All and in any other collections they belong to. If an item was only in this collection, it moves to Unorganized. The delete action requires a confirmation dialog that makes this behavior explicit: "This will delete the collection only. Your images and flows won't be deleted."

**No cascade delete** — you can never delete images or flows by deleting a collection. To delete an item, you must go to it directly (drawer or right-click) and delete it explicitly.

---

## Data schema

**Image:**
```json
{
  "id": "uuid",
  "type": "image",
  "title": "string",
  "image_path": "~/tome/images/filename.png",
  "tags": ["tag1", "tag2"],
  "collections": ["collection-id-1"],
  "note": "optional short text",
  "created_at": "ISO timestamp"
}
```

**Flow:**
```json
{
  "id": "uuid",
  "type": "flow",
  "title": "string",
  "screens": [
    { "id": "uuid", "image_path": "~/tome/images/filename.png", "note": "optional" }
  ],
  "tags": ["tag1", "tag2"],
  "collections": ["collection-id-1"],
  "note": "optional short text",
  "created_at": "ISO timestamp"
}
```

**Collection:**
```json
{
  "id": "uuid",
  "name": "string",
  "icon": "reference | project",
  "parent_id": "uuid or null",
  "archived": false,
  "created_at": "ISO timestamp"
}
```

Images saved to: `~/tome/images/`
Data file at: `~/tome/data.json`

---

## Design direction

- **References:** Are.na (grid feel), Eagle (interaction model), Mobbin (flow view), Notion (visual language)
- **Font:** Inter
- **Personality:** Calm, intentional, personal — not a power tool, a space you return to
- **Buttons:** small, minimal, no heavy borders
- **Colors:** near-monochrome — off-whites, soft grays, one accent for active/selected states
- **Flow cards in grid:** stacked card effect to signal "there's more inside"
- **No decorative elements** — the content is the design

---

## What's out in v1

- URL / link saving (v2)
- Auto-tagging / AI suggestions
- Cloud sync or backup
- Browser extension
- Text-only entries
- Smart folders / rule-based auto-organization
- Auto-tag from collection membership (blurs tags and collections — intentional decision)
- Sharing or export
- Dark mode (v2)
- Mac build (architecture supports it, build later)
- Duplicate detection

---

## Rabbit holes

**Tauri 2 file system permissions**
Requires explicit capability config in `tauri.conf.json`. Read the FS plugin docs before touching the file system — silently fails if misconfigured.

**Ctrl+V clipboard paste**
Listen for `paste` on `window`. Extract `event.clipboardData.files[0]`. Test early — clipboard APIs behave unexpectedly across OS versions.

**Rubber band selection**
Drag conflicts with normal click. Use a movement threshold (~5px) to distinguish click from drag.

**Flow screen ordering**
Screens are ordered — store as an array not a set. Reordering is a splice operation. Don't let this become a complex state management problem — keep it simple array manipulation.

**Collection deletion**
When deleting a collection, only remove the collection ID from each item's `collections[]` array — never delete the items themselves. If an item's `collections[]` becomes empty after removal, it naturally appears under Unorganized. No special flag needed.

**data.json at scale**
Fine for v1. Design save/load to be swappable for SQLite later.

---

## Done condition

You can:
1. Drag an image in or Ctrl+V a screenshot
2. Add tags and a note
3. Create a flow from ordered screenshots
4. Drop images and flows into collections
5. Browse flows horizontally inside a collection
6. Find anything by tag, collection, or search

That's shipped.

---

## V2 parking lot

- URL / link saving with OG image preview
- Dark mode
- Mac build
- Browser extension
- Duplicate detection
- Export / backup to zip
- SQLite migration
- Color palette detection per image
- Smart folders
- Drag to reorder / pin items in grid
