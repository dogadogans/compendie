# Push to Figma — Design Spec

**Date:** 2026-05-09
**Status:** Ready for implementation

---

## Overview

When inside a collection, users can push any or all of its images directly into a Figma file. Images land on the current Figma page as a named, grouped frame — ready to reference, annotate, or build on top of.

Entry point: `...` (ActionsDropdown) in the collection view top nav → "Push to Figma".

---

## User Flow

### Step 1 — Intent dialog

A small modal opens immediately:

> **Push to Figma**
> *"UI Patterns" · 47 images*
>
> [Push All 47]   [Pick Images]

- "Push All" skips straight to Step 3.
- "Pick Images" opens the picker.

### Step 2 — Image picker (only if "Pick Images")

A modal showing all images in the collection as thumbnails in a grid. All are selected by default. User clicks to deselect individual images. A "Select All / None" toggle at the top. Confirm button shows live count: "Push 12 images →".

### Step 3 — Ready state

Tome:
1. Starts a local HTTP server on a random available port (via Tauri Rust command).
2. Copies a small JSON token to the system clipboard.
3. Closes the modal and shows a toast:

> "Ready. Open the Tome plugin in Figma and click Paste."

The server stays alive for 30 seconds. If the plugin doesn't connect in time, it shuts down and a second toast says "Export expired — try again."

### Step 4 — In Figma

User opens the Tome Figma plugin (installed once, available always). Plugin UI reads the clipboard, detects the Tome token, shows:

> *12 images from "UI Patterns"*
> [Place in Figma]

User clicks Place. Plugin fetches images one by one from localhost, creates image nodes, lays them out in a grid, wraps them in a named frame, and signals done. Server shuts down.

---

## Clipboard Token Format

```json
{
  "tome": true,
  "port": 9374,
  "session": "abc123",
  "collection": "UI Patterns",
  "count": 12
}
```

This is plain JSON text on the clipboard. Small enough to not interfere with normal clipboard use. The plugin checks for `tome: true` to confirm it's a Tome export before acting.

---

## Local HTTP Server (Tauri / Rust)

Two new Tauri commands:

**`start_figma_server(image_paths: Vec<String>) -> Result<u16>`**
- Registers the image list (ID → file path mapping).
- Binds `axum` HTTP server on a random available port.
- Returns the port number.
- Shuts down automatically after 30s if not manually stopped.

**`stop_figma_server()`**
- Called automatically when all images in the session have been fetched (server tracks a counter).
- Also called by the 30s timeout as fallback.

**Server endpoints:**

| Endpoint | Response |
|---|---|
| `GET /manifest` | JSON: `{ session, collection, images: [{id, filename}] }` |
| `GET /image/:id` | Raw image file (original resolution) |

CORS headers set to allow `null` origin (Figma plugin iframe origin).

**Dependency:** `axum` added to `src-tauri/Cargo.toml`. Tokio is already present via Tauri 2.

---

## Figma Plugin (`figma-plugin/` folder in repo)

A standard Figma plugin with no special permissions needed beyond network access.

### Files

- `manifest.json` — plugin metadata, declares UI
- `ui.html` — plugin UI thread (HTML + inline JS)
- `code.js` — plugin main thread (Figma API access)

### `ui.html` responsibilities

1. On open: reads clipboard text via `navigator.clipboard.readText()`.
2. Parses JSON, checks for `tome: true`. If not found, shows "Nothing to paste from Tome."
3. Shows collection name + image count with a "Place in Figma" button.
4. On click: fetches `/manifest` from `localhost:PORT` to get image list.
5. Fetches each image as `ArrayBuffer` from `GET /image/:id`.
6. Sends each image's bytes + metadata to `code.js` via `parent.postMessage`.
7. After all images sent, sends a "done" message.

### `code.js` responsibilities

1. Receives image bytes via `onmessage`.
2. Calls `figma.createImage(new Uint8Array(bytes))` per image.
3. Creates a `Rectangle` node per image with the image as fill, maintaining original aspect ratio (target width: 400px, height calculated from ratio).
4. After all images received: arranges nodes in a grid (4 columns, 20px gap).
5. Groups all nodes into a `Frame` named `"[Collection Name] — Tome"`.
6. Centers the frame on the current viewport.
7. Sends a `{ done: true }` message back to `ui.html`.

### `ui.html` on done

Shows a success state: "✓ Placed in Figma" and closes after 2s.

---

## Tome App Changes

### `ActionsDropdown.jsx`

- Add "Push to Figma" menu item.
- Only rendered when `currentCollection` is not null (i.e., user is inside a collection view).

### `FigmaExportModal.jsx` (new)

- Intent dialog: shows collection name, image count, two buttons.
- On "Push All": calls `startExport(allImages)`.
- On "Pick Images": opens `FigmaPickerModal`.

### `FigmaPickerModal.jsx` (new)

- Thumbnail grid of all images in the collection.
- Checkboxes overlaid on each thumbnail.
- All selected by default.
- "Select All / None" toggle.
- "Push X images →" confirm button (disabled if 0 selected).
- On confirm: calls `startExport(selectedImages)`.

### `startExport(images)` (shared logic, could live in a hook)

1. Calls Tauri command `start_figma_server(imagePaths)` → gets port.
2. Generates a session ID (`crypto.randomUUID()`).
3. Writes the clipboard token via `navigator.clipboard.writeText(JSON.stringify(token))`.
4. Closes the modal.
5. Shows toast: "Ready. Open the Tome plugin in Figma and click Paste."
6. Sets a 30s timeout → on expiry calls `stop_figma_server()` + shows "Export expired" toast.

---

## Layout Logic (Figma Plugin)

Grid calculation:
- **Columns:** 4 (fixed)
- **Image width:** 400px (fixed), height calculated from original aspect ratio
- **Gap:** 20px between images horizontally and vertically
- **Frame padding:** 40px on all sides

For example, 12 images → 3 rows × 4 columns, frame is ~1780px × (3 × avg_height + gaps + padding).

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Server fails to start | Toast: "Couldn't start export — try again." Modal stays open. |
| Plugin can't read clipboard | Plugin shows: "Clipboard access denied. Copy again from Tome." |
| Clipboard doesn't contain Tome token | Plugin shows: "Nothing to paste from Tome." |
| Image fetch fails (404, timeout) | Plugin skips that image, continues with rest, notes count in success message: "Placed 11 of 12 images." |
| 30s timeout in Tome | `stop_figma_server()` called, toast: "Export expired — try again." |

---

## Out of Scope (this version)

- Pushing flows (only individual images)
- Choosing which Figma file to target (always lands on whichever file + page the plugin is open in)
- Layout options (grid only, 4 columns fixed)
- Syncing back from Figma to Tome
- Publishing the plugin to the Figma Community (personal development install only for v1)
