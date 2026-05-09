# Push to Figma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Push to Figma" export flow so users can send collection images to Figma via a local HTTP server and a companion Figma plugin.

**Architecture:** Tome starts an `axum` HTTP server when export is triggered, copies a small JSON token to the clipboard. The Figma plugin reads the token, fetches images from `localhost`, and places them as a grid frame on the current Figma page. The server shuts down after all images are fetched or after 30s.

**Tech Stack:** Rust/axum (server), React (modals + hook), `@tauri-apps/api/core` (command bridge), vanilla HTML/JS (Figma plugin).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src-tauri/Cargo.toml` | Add `axum`, `tokio`, `uuid` deps |
| Create | `src-tauri/src/figma_server.rs` | axum server, `FigmaServerManager` struct |
| Modify | `src-tauri/src/lib.rs` | Register state + commands |
| Create | `src/hooks/useFigmaExport.js` | `startExport(images, collectionName)` logic |
| Create | `src/components/FigmaExportModal.jsx` | Intent dialog (Push All / Pick) |
| Create | `src/components/FigmaPickerModal.jsx` | Thumbnail picker with checkboxes |
| Modify | `src/globals.css` | Styles for FigmaExportModal and FigmaPickerModal |
| Modify | `src/components/ActionsDropdown.jsx` | Add "Push to Figma" item |
| Modify | `src/App.jsx` | State + modal render |
| Create | `figma-plugin/manifest.json` | Plugin metadata |
| Create | `figma-plugin/code.js` | Plugin main thread (Figma API) |
| Create | `figma-plugin/ui.html` | Plugin UI thread (fetch + render) |

---

## Task 1: Rust HTTP Server + Tauri Commands

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/figma_server.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add dependencies to `src-tauri/Cargo.toml`**

Add these three lines under `[dependencies]`:

```toml
axum = "0.7"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
```

Final `[dependencies]` block should look like:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
axum = "0.7"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 2: Create `src-tauri/src/figma_server.rs`**

```rust
use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tokio::{net::TcpListener, sync::oneshot, time::sleep};

#[derive(Clone, Serialize)]
pub struct ImageEntry {
    pub id: String,
    pub filename: String,
}

struct Inner {
    session: String,
    collection: String,
    images: Vec<ImageEntry>,
    id_to_path: HashMap<String, String>,
    fetched: usize,
    total: usize,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

#[derive(Clone)]
struct SharedInner(Arc<Mutex<Inner>>);

async fn get_manifest(State(inner): State<SharedInner>) -> impl IntoResponse {
    let g = inner.0.lock().unwrap();
    let body = serde_json::json!({
        "session": g.session,
        "collection": g.collection,
        "images": g.images,
    });
    (
        [(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"))],
        Json(body),
    )
}

async fn get_image(Path(id): Path<String>, State(inner): State<SharedInner>) -> Response {
    let (path, should_stop) = {
        let mut g = inner.0.lock().unwrap();
        let Some(path) = g.id_to_path.get(&id).cloned() else {
            return (StatusCode::NOT_FOUND, "not found").into_response();
        };
        g.fetched += 1;
        let done = g.fetched >= g.total;
        (path, done)
    };

    let resolved = resolve_path(&path);
    let bytes = match std::fs::read(&resolved) {
        Ok(b) => b,
        Err(_) => return (StatusCode::NOT_FOUND, "file not found").into_response(),
    };

    if should_stop {
        let mut g = inner.0.lock().unwrap();
        if let Some(tx) = g.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }

    let ext = std::path::Path::new(&resolved)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let content_type = match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };

    (
        [
            (header::CONTENT_TYPE, HeaderValue::from_static(content_type)),
            (header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*")),
        ],
        bytes,
    )
        .into_response()
}

fn resolve_path(path: &str) -> String {
    if path.starts_with("~/") {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_default();
        format!("{}{}", home, &path[1..])
    } else {
        path.to_string()
    }
}

pub struct FigmaServerManager {
    inner: Mutex<Option<SharedInner>>,
}

impl FigmaServerManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    pub async fn start(
        &self,
        session: String,
        collection: String,
        image_paths: Vec<String>,
    ) -> Result<u16, String> {
        self.stop();

        let mut images = Vec::new();
        let mut id_to_path = HashMap::new();
        for (i, path) in image_paths.iter().enumerate() {
            let filename = std::path::Path::new(path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("image")
                .to_string();
            let id = format!("img-{}", i);
            images.push(ImageEntry { id: id.clone(), filename });
            id_to_path.insert(id, path.clone());
        }

        let total = images.len();
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        let shared = SharedInner(Arc::new(Mutex::new(Inner {
            session,
            collection,
            images,
            id_to_path,
            fetched: 0,
            total,
            shutdown_tx: Some(shutdown_tx),
        })));

        let router = Router::new()
            .route("/manifest", get(get_manifest))
            .route("/image/:id", get(get_image))
            .with_state(shared.clone());

        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| e.to_string())?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();

        tokio::spawn(async move {
            tokio::select! {
                _ = axum::serve(listener, router) => {},
                _ = shutdown_rx => {},
                _ = sleep(Duration::from_secs(30)) => {},
            }
        });

        *self.inner.lock().unwrap() = Some(shared);
        Ok(port)
    }

    pub fn stop(&self) {
        let mut g = self.inner.lock().unwrap();
        if let Some(shared) = g.take() {
            if let Some(tx) = shared.0.lock().unwrap().shutdown_tx.take() {
                let _ = tx.send(());
            }
        }
    }
}
```

- [ ] **Step 3: Update `src-tauri/src/lib.rs`**

Replace the entire file contents with:

```rust
mod figma_server;

use figma_server::FigmaServerManager;
use std::sync::Arc;

#[tauri::command]
async fn start_figma_server(
    manager: tauri::State<'_, Arc<FigmaServerManager>>,
    session: String,
    collection: String,
    image_paths: Vec<String>,
) -> Result<u16, String> {
    let manager = Arc::clone(&manager);
    manager.start(session, collection, image_paths).await
}

#[tauri::command]
fn stop_figma_server(manager: tauri::State<'_, Arc<FigmaServerManager>>) {
    manager.stop();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(FigmaServerManager::new()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            start_figma_server,
            stop_figma_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify the Rust code compiles**

Run in the project root:

```powershell
cd src-tauri && cargo check 2>&1
```

Expected: no errors. If you see "axum not found" ensure the Cargo.toml edit from Step 1 was saved. If you see lifetime errors on `State<'_>` in the async command, confirm the `Arc::clone(&manager)` pattern is in place before the `.await`.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/Cargo.toml src-tauri/src/figma_server.rs src-tauri/src/lib.rs
git commit -m "feat: axum HTTP server for Figma image export"
```

---

## Task 2: `useFigmaExport` Hook

**Files:**
- Create: `src/hooks/useFigmaExport.js`

- [ ] **Step 1: Create the hooks directory and file**

```powershell
mkdir src/hooks -ErrorAction SilentlyContinue
```

Create `src/hooks/useFigmaExport.js`:

```js
import { invoke } from "@tauri-apps/api/core";
import { toast } from "../components/Toast";

export function useFigmaExport() {
  const startExport = async (images, collectionName) => {
    const imagePaths = images.map((img) => img.image_path);
    const session = crypto.randomUUID();

    let port;
    try {
      port = await invoke("start_figma_server", {
        session,
        collection: collectionName,
        imagePaths,
      });
    } catch {
      toast.error("Couldn't start export — try again.");
      return;
    }

    const token = JSON.stringify({
      tome: true,
      port,
      session,
      collection: collectionName,
      count: images.length,
    });

    try {
      await navigator.clipboard.writeText(token);
    } catch {
      await invoke("stop_figma_server").catch(() => {});
      toast.error("Clipboard access denied.");
      return;
    }

    toast.success("Ready. Open the Tome plugin in Figma and click Paste.");

    // 30s fallback — server auto-shuts on complete, but clean up if abandoned
    setTimeout(() => {
      invoke("stop_figma_server").catch(() => {});
      toast("Export expired — try again if needed.");
    }, 30_000);
  };

  return { startExport };
}
```

- [ ] **Step 2: Verify the import path for `invoke` exists**

`@tauri-apps/api/core` ships with `@tauri-apps/api` v2 which is already in `package.json`. No install needed.

- [ ] **Step 3: Commit**

```powershell
git add src/hooks/useFigmaExport.js
git commit -m "feat: useFigmaExport hook"
```

---

## Task 3: `FigmaExportModal` + `FigmaPickerModal`

**Files:**
- Create: `src/components/FigmaExportModal.jsx`
- Create: `src/components/FigmaPickerModal.jsx`
- Modify: `src/globals.css`

- [ ] **Step 1: Create `src/components/FigmaExportModal.jsx`**

```jsx
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import FigmaPickerModal from "./FigmaPickerModal";
import { useFigmaExport } from "../hooks/useFigmaExport";

export default function FigmaExportModal({ collection, images, imageUrls, onClose }) {
  const [showPicker, setShowPicker] = useState(false);
  const { startExport } = useFigmaExport();

  const handlePushAll = () => {
    startExport(images, collection.name);
    onClose();
  };

  if (showPicker) {
    return (
      <FigmaPickerModal
        collection={collection}
        images={images}
        imageUrls={imageUrls}
        onConfirm={(selected) => {
          startExport(selected, collection.name);
          onClose();
        }}
        onBack={() => setShowPicker(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal title="Push to Figma" onClose={onClose} width={320}>
      <div className="fem-body">
        <p className="fem-subtitle">
          "{collection.name}" · {images.length} {images.length === 1 ? "image" : "images"}
        </p>
        <div className="fem-actions">
          <Button variant="secondary" onClick={() => setShowPicker(true)}>
            Pick Images
          </Button>
          <Button variant="primary" onClick={handlePushAll}>
            Push All {images.length}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Create `src/components/FigmaPickerModal.jsx`**

```jsx
import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export default function FigmaPickerModal({ collection, images, imageUrls, onConfirm, onBack, onClose }) {
  const [selected, setSelected] = useState(() => new Set(images.map((img) => img.id)));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = selected.size === images.length;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(images.map((img) => img.id)));
  };

  const selectedImages = images.filter((img) => selected.has(img.id));

  return (
    <Modal title="Pick Images" onClose={onClose} width={560}>
      <div className="fpm-body">
        <div className="fpm-toolbar">
          <button className="fpm-toggle" onClick={toggleAll}>
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <span className="fpm-count">{selected.size} selected</span>
        </div>
        <div className="fpm-grid">
          {images.map((img) => (
            <div
              key={img.id}
              className={`fpm-thumb${selected.has(img.id) ? " fpm-thumb--selected" : ""}`}
              onClick={() => toggle(img.id)}
            >
              {imageUrls[img.id] && (
                <img src={imageUrls[img.id]} alt="" className="fpm-thumb-img" />
              )}
              {selected.has(img.id) && <div className="fpm-check">✓</div>}
            </div>
          ))}
        </div>
        <div className="fpm-footer">
          <Button variant="secondary" onClick={onBack}>Back</Button>
          <Button variant="primary" disabled={selected.size === 0} onClick={() => onConfirm(selectedImages)}>
            Push {selected.size} {selected.size === 1 ? "image" : "images"} →
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Add CSS to `src/globals.css`**

Append to the end of `src/globals.css`:

```css
/* ─── FigmaExportModal ───────────────────────────────────────────────────── */
.fem-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.fem-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}
.fem-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* ─── FigmaPickerModal ───────────────────────────────────────────────────── */
.fpm-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fpm-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.fpm-toggle {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
.fpm-toggle:hover {
  text-decoration: underline;
}
.fpm-count {
  font-size: 12px;
  color: var(--text-muted);
}
.fpm-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}
.fpm-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--surface-2);
  transition: border-color 0.12s ease;
}
.fpm-thumb:hover {
  border-color: var(--text-muted);
}
.fpm-thumb--selected {
  border-color: var(--accent);
}
.fpm-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.fpm-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: var(--accent);
  color: #000;
  border-radius: 50%;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.fpm-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 4px;
}
```

- [ ] **Step 4: Commit**

```powershell
git add src/components/FigmaExportModal.jsx src/components/FigmaPickerModal.jsx src/globals.css
git commit -m "feat: FigmaExportModal and FigmaPickerModal components"
```

---

## Task 4: Wire Up in `ActionsDropdown` + `App.jsx`

**Files:**
- Modify: `src/components/ActionsDropdown.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add "Push to Figma" to `ActionsDropdown.jsx`**

Add `FigmaIcon` import and `onPushToFigma` prop. The full updated file:

```jsx
import { useRef, useEffect } from "react";
import { ArrowRight, Copy, FolderPlus, Trash2, Upload } from "lucide-react";

export default function ActionsDropdown({ inCollection, onMoveTo, onCopyTo, onNewFolder, onDelete, onPushToFigma, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div className="actions-dropdown" ref={ref}>
      <button className="actions-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={onMoveTo}>
        <ArrowRight size={14} /> Move to…
      </button>
      <button className="actions-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={onCopyTo}>
        <Copy size={14} /> Copy to…
      </button>
      {inCollection && (
        <button className="actions-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={onNewFolder}>
          <FolderPlus size={14} /> New folder here
        </button>
      )}
      {inCollection && onPushToFigma && (
        <>
          <div className="actions-dropdown-sep" />
          <button className="actions-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={onPushToFigma}>
            <Upload size={14} /> Push to Figma
          </button>
        </>
      )}
      <div className="actions-dropdown-sep" />
      <button className="actions-dropdown-item danger" onMouseDown={(e) => e.stopPropagation()} onClick={onDelete}>
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add state and modal render to `App.jsx`**

Find the existing state declarations block (around line 65–75) and add one line:

```jsx
const [figmaExportOpen, setFigmaExportOpen] = useState(false);
```

- [ ] **Step 3: Import `FigmaExportModal` in `App.jsx`**

Find the import block near the top of `App.jsx` and add:

```jsx
import FigmaExportModal from "./components/FigmaExportModal";
```

- [ ] **Step 4: Add `onPushToFigma` prop to the existing `ActionsDropdown` render in `App.jsx`**

Find the existing `<ActionsDropdown` block (around line 799). Add the new prop:

```jsx
onPushToFigma={() => { setActionMenuOpen(false); setFigmaExportOpen(true); }}
```

The full updated `<ActionsDropdown` call should be:

```jsx
<ActionsDropdown
  inCollection={activeView.type === "collection"}
  onMoveTo={() => { setActionMenuOpen(false); setPickerMode("move"); }}
  onCopyTo={() => { setActionMenuOpen(false); setPickerMode("copy"); }}
  onNewFolder={() => { setActionMenuOpen(false); setQuickFolderOpen(true); }}
  onPushToFigma={() => { setActionMenuOpen(false); setFigmaExportOpen(true); }}
  onDelete={() => {
    setActionMenuOpen(false);
    const n = selectedIds.size;
    setAlertDialog({
      title: `Delete ${n} ${n === 1 ? "item" : "items"}?`,
      message: "This cannot be undone. Deleted items are removed from Tome permanently.",
      confirmLabel: `Delete ${n === 1 ? "item" : `${n} items`}`,
      onConfirm: async () => { setAlertDialog(null); await handleBulkDelete(); },
    });
  }}
  onClose={handleCloseActionMenu}
/>
```

- [ ] **Step 5: Render `FigmaExportModal` in the JSX return of `App.jsx`**

Find the block where other modals like `<AlertDialog` and `<CreateCollectionModal` are rendered (near the bottom of the JSX return). Add:

```jsx
{figmaExportOpen && activeView.type === "collection" && (() => {
  const col = collections.find((c) => c.id === activeView.id);
  const colImages = filtered.filter((item) => item.type === "image");
  if (!col) return null;
  return (
    <FigmaExportModal
      collection={col}
      images={colImages}
      imageUrls={imageUrls}
      onClose={() => setFigmaExportOpen(false)}
    />
  );
})()}
```

- [ ] **Step 6: Verify in dev mode**

Run the app:

```powershell
npm run tauri dev
```

1. Navigate to any collection with images.
2. Select one or more images (enter organize mode).
3. Click "⌘ Actions" → confirm "Push to Figma" appears.
4. Click it → intent dialog appears showing collection name + image count.
5. Click "Push All" → toast appears: "Ready. Open the Tome plugin in Figma and click Paste."
6. Click "Pick Images" → picker modal opens with thumbnails, Select All toggle, confirm button.
7. Deselect a few, click "Push X images →" → toast appears.

- [ ] **Step 7: Commit**

```powershell
git add src/components/ActionsDropdown.jsx src/App.jsx
git commit -m "feat: wire Push to Figma into ActionsDropdown and App"
```

---

## Task 5: Figma Plugin

**Files:**
- Create: `figma-plugin/manifest.json`
- Create: `figma-plugin/code.js`
- Create: `figma-plugin/ui.html`

- [ ] **Step 1: Create `figma-plugin/manifest.json`**

```json
{
  "name": "Tome",
  "id": "tome-local-export",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma", "figjam"],
  "networkAccess": {
    "allowedDomains": ["http://localhost"]
  }
}
```

- [ ] **Step 2: Create `figma-plugin/code.js`**

```js
figma.showUI(__html__, { width: 320, height: 260 });

const pending = [];
let meta = null;

figma.ui.onmessage = async (msg) => {
  if (msg.type === "image-data") {
    pending.push(msg);
    return;
  }

  if (msg.type === "place") {
    meta = msg.meta; // { collection, images: [{id, filename}] }
    figma.ui.postMessage({ type: "start-fetch" });
    return;
  }

  if (msg.type === "all-done") {
    await placeImages();
    figma.ui.postMessage({ type: "placed" });
    return;
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};

async function placeImages() {
  const TARGET_WIDTH = 400;
  const COLS = 4;
  const GAP = 20;
  const PADDING = 40;

  // Create frame first and add to page so child x/y are frame-relative
  const frame = figma.createFrame();
  frame.name = `${meta.collection} — Tome`;
  frame.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
  figma.currentPage.appendChild(frame);

  const nodes = [];

  for (const item of pending) {
    const bytes = new Uint8Array(item.buffer);
    const image = figma.createImage(bytes);

    // Preserve original aspect ratio at TARGET_WIDTH
    const { width: origW, height: origH } = await image.getSizeAsync();
    const h = Math.round((origH / origW) * TARGET_WIDTH);

    const rect = figma.createRectangle();
    rect.resize(TARGET_WIDTH, h);
    rect.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: image.hash }];
    rect.name = item.filename;

    // Append to frame before setting position — x/y become frame-relative
    frame.appendChild(rect);
    nodes.push({ node: rect, h });
  }

  // Position nodes in a grid within the frame
  let x = PADDING;
  let y = PADDING;
  let rowMaxH = 0;
  let col = 0;

  for (const { node, h } of nodes) {
    node.x = x;
    node.y = y;
    rowMaxH = Math.max(rowMaxH, h);
    col++;
    if (col >= COLS) {
      x = PADDING;
      y += rowMaxH + GAP;
      rowMaxH = 0;
      col = 0;
    } else {
      x += TARGET_WIDTH + GAP;
    }
  }

  // Resize frame to exact content bounds
  const totalCols = Math.min(nodes.length, COLS);
  const frameW = PADDING * 2 + totalCols * TARGET_WIDTH + (totalCols - 1) * GAP;
  const frameH = y + rowMaxH + PADDING;
  frame.resize(frameW, frameH);

  // Center on viewport
  const { x: vx, y: vy, width: vw, height: vh } = figma.viewport.bounds;
  frame.x = vx + (vw - frameW) / 2;
  frame.y = vy + (vh - frameH) / 2;

  figma.viewport.scrollAndZoomIntoView([frame]);
}
```

- [ ] **Step 3: Create `figma-plugin/ui.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, -apple-system, sans-serif;
      font-size: 13px;
      background: #1e1e1e;
      color: #fafafa;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    h2 { font-size: 14px; font-weight: 600; }
    .sub { color: #aaa; font-size: 12px; }
    .btn {
      width: 100%;
      padding: 9px 16px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
    }
    .btn-primary { background: #fafafa; color: #1e1e1e; }
    .btn-primary:disabled { opacity: 0.4; cursor: default; }
    .status { color: #aaa; font-size: 12px; min-height: 16px; }
    .success { color: #9AFF54; }
    .error { color: #f87171; }
    #progress { display: none; }
    .bar-bg { height: 4px; background: #333; border-radius: 2px; }
    .bar-fill { height: 4px; background: #9AFF54; border-radius: 2px; transition: width 0.2s; width: 0%; }
  </style>
</head>
<body>
  <div>
    <h2 id="title">Paste from Tome</h2>
    <p class="sub" id="subtitle">Reading clipboard…</p>
  </div>
  <button class="btn btn-primary" id="place-btn" disabled>Place in Figma</button>
  <div id="progress">
    <div class="bar-bg"><div class="bar-fill" id="bar"></div></div>
  </div>
  <p class="status" id="status"></p>

  <script>
    let token = null;
    let manifest = null;
    let loaded = 0;
    let total = 0;
    const buffers = [];

    const title = document.getElementById('title');
    const subtitle = document.getElementById('subtitle');
    const placeBtn = document.getElementById('place-btn');
    const statusEl = document.getElementById('status');
    const progress = document.getElementById('progress');
    const bar = document.getElementById('bar');

    async function init() {
      try {
        const text = await navigator.clipboard.readText();
        const parsed = JSON.parse(text);
        if (!parsed.tome) throw new Error('not a tome token');
        token = parsed;
        title.textContent = `Push to Figma`;
        subtitle.textContent = `"${token.collection}" · ${token.count} images`;
        placeBtn.disabled = false;
        placeBtn.textContent = `Place ${token.count} images`;
      } catch {
        subtitle.textContent = 'Nothing to paste from Tome.';
        statusEl.textContent = 'Copy again from the Tome app first.';
      }
    }

    placeBtn.addEventListener('click', async () => {
      placeBtn.disabled = true;
      statusEl.textContent = 'Fetching manifest…';
      progress.style.display = 'block';

      try {
        const res = await fetch(`http://127.0.0.1:${token.port}/manifest`);
        manifest = await res.json();
        total = manifest.images.length;
        statusEl.textContent = `Fetching ${total} images…`;

        parent.postMessage({ pluginMessage: { type: 'place', meta: { collection: manifest.collection, images: manifest.images } } }, '*');
      } catch {
        statusEl.className = 'status error';
        statusEl.textContent = 'Could not connect to Tome. Make sure Tome is open and try again.';
        placeBtn.disabled = false;
      }
    });

    window.onmessage = async (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'start-fetch') {
        let failed = 0;
        for (const img of manifest.images) {
          try {
            const res = await fetch(`http://127.0.0.1:${token.port}/image/${img.id}`);
            const buffer = await res.arrayBuffer();
            buffers.push({ buffer, filename: img.filename });
            parent.postMessage({ pluginMessage: { type: 'image-data', buffer, filename: img.filename } }, '*', [buffer]);
          } catch {
            failed++;
          }
          loaded++;
          bar.style.width = `${Math.round((loaded / total) * 100)}%`;
          statusEl.textContent = `${loaded} / ${total} fetched${failed > 0 ? ` (${failed} failed)` : ''}`;
        }
        parent.postMessage({ pluginMessage: { type: 'all-done' } }, '*');
      }

      if (msg.type === 'placed') {
        statusEl.className = 'status success';
        statusEl.textContent = `✓ Placed in Figma`;
        // Send close request to code.js — only code.js can call figma.closePlugin()
        setTimeout(() => parent.postMessage({ pluginMessage: { type: 'close' } }, '*'), 2000);
      }
    };

    init();
  </script>
</body>
</html>
```

- [ ] **Step 4: Install the plugin in Figma (development mode)**

1. Open Figma Desktop.
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Navigate to the `figma-plugin/` folder in this repo and select `manifest.json`.
4. The "Tome" plugin now appears under Plugins → Development → Tome.

- [ ] **Step 5: End-to-end test**

1. Open Tome, navigate to a collection with images.
2. Enter organize mode, click "⌘ Actions" → "Push to Figma".
3. Click "Push All" → toast: "Ready. Open the Tome plugin in Figma and click Paste."
4. In Figma Desktop, open the Tome plugin (Plugins → Development → Tome).
5. Plugin should show: *"[Collection Name] · N images"* and a "Place N images" button.
6. Click "Place" → progress bar fills → images appear on the Figma page as a grouped frame named *"[Collection] — Tome"*.

Expected: all images placed, frame centered in viewport, server shuts down.

- [ ] **Step 6: Commit**

```powershell
git add figma-plugin/
git commit -m "feat: Figma plugin for Tome image export"
```

---

## Self-Review Checklist (for executor)

Before marking complete, verify:

- [ ] `cargo check` passes with no errors
- [ ] App builds with `npm run tauri dev` without console errors
- [ ] "Push to Figma" only appears in ActionsDropdown when `inCollection` is true
- [ ] "Push All" and "Pick Images" both result in the clipboard token + toast
- [ ] Figma plugin reads clipboard and shows correct collection name + count
- [ ] Images land in Figma with correct aspect ratios
- [ ] Server no longer responds after 30s or after all images fetched
