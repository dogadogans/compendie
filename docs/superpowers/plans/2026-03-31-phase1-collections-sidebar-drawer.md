# Phase 1 — Collections, Sidebar & Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat-folder system with a full collections hierarchy, redesign the sidebar, and replace the modal detail overlay with an Eagle-style persistent right panel — all built on a clean new data schema.

**Architecture:** Rewrite `store.js` for the new `{ collections, items }` schema, then extract `App.jsx`'s inline components into focused files under `src/components/`. App.jsx becomes a thin orchestration layer that holds state and wires components together. Each component is extracted one at a time so the app stays runnable after every task.

**Tech Stack:** Tauri 2, React 18, Vite, `@tauri-apps/plugin-fs`, `@tauri-apps/api/event`, `uuid`

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/store.js` | Rewrite | All data I/O — new schema, collections CRUD |
| `src/components/ContextMenu.jsx` | Create (extract) | Reusable context menu |
| `src/components/Sidebar.jsx` | Create | Collections tree, tags, archived, resize handle |
| `src/components/Grid.jsx` | Create (extract) | Masonry grid, toolbar, image cards |
| `src/components/DetailPanel.jsx` | Create | Eagle-style right panel, resize handle, auto-save |
| `src/components/AddOverlay.jsx` | Create (extract+update) | Add image form with collection picker |
| `src/App.jsx` | Rewrite | State, event wiring, layout only |
| `src/globals.css` | Modify | New layout classes, panel, resize handles, sidebar |

---

## Task 1: Rewrite store.js

**Files:**
- Modify: `src/store.js`

- [ ] **Step 1: Replace the full contents of `src/store.js`**

```js
// Data layer — reads/writes ~/tome/data.json
// Schema: { collections: [...], items: [...] }

import {
  BaseDirectory, readTextFile, writeTextFile,
  mkdir, exists, writeFile, remove, readFile,
} from "@tauri-apps/plugin-fs";
import { v4 as uuidv4 } from "uuid";

const IMAGES_DIR = "tome/images";
const DATA_FILE  = "tome/data.json";

async function ensureDirs() {
  if (!(await exists("tome",       { baseDir: BaseDirectory.Home })))
    await mkdir("tome",       { baseDir: BaseDirectory.Home, recursive: true });
  if (!(await exists(IMAGES_DIR,   { baseDir: BaseDirectory.Home })))
    await mkdir(IMAGES_DIR,   { baseDir: BaseDirectory.Home, recursive: true });
}

async function loadData() {
  await ensureDirs();
  if (!(await exists(DATA_FILE, { baseDir: BaseDirectory.Home })))
    return { collections: [], items: [] };
  const raw    = await readTextFile(DATA_FILE, { baseDir: BaseDirectory.Home });
  const parsed = JSON.parse(raw);
  // Old formats (plain array or folders-based) → start fresh
  if (Array.isArray(parsed) || parsed.folders !== undefined)
    return { collections: [], items: [] };
  return parsed;
}

async function saveData(data) {
  await ensureDirs();
  await writeTextFile(DATA_FILE, JSON.stringify(data, null, 2), {
    baseDir: BaseDirectory.Home,
  });
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function loadItems() {
  return (await loadData()).items;
}

async function saveImage(bytes, originalName) {
  await ensureDirs();
  const ext      = originalName.split(".").pop() || "png";
  const filename = `${uuidv4()}.${ext}`;
  await writeFile(`${IMAGES_DIR}/${filename}`, bytes, { baseDir: BaseDirectory.Home });
  return `tome/images/${filename}`;
}

export async function addItem({ imageBytes, originalName, title, tags, collections, note }) {
  const data      = await loadData();
  const imagePath = await saveImage(imageBytes, originalName);
  const item = {
    id:         uuidv4(),
    type:       "image",
    title:      title       || "",
    image_path: imagePath,
    tags:       tags        || [],
    collections: collections || [],
    note:       note        || "",
    created_at: new Date().toISOString(),
  };
  data.items.unshift(item);
  await saveData(data);
  return item;
}

export async function updateItem(id, changes) {
  const data = await loadData();
  const idx  = data.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error("Item not found");
  data.items[idx] = { ...data.items[idx], ...changes };
  await saveData(data);
  return data.items[idx];
}

export async function deleteItem(id) {
  const data = await loadData();
  const item = data.items.find((i) => i.id === id);
  if (!item) throw new Error("Item not found");
  try { await remove(item.image_path, { baseDir: BaseDirectory.Home }); }
  catch (e) { console.warn("Could not remove image file:", e); }
  data.items = data.items.filter((i) => i.id !== id);
  await saveData(data);
}

export async function getImageUrl(imagePath) {
  const bytes = await readFile(imagePath, { baseDir: BaseDirectory.Home });
  return URL.createObjectURL(new Blob([bytes]));
}

// ─── Collections ──────────────────────────────────────────────────────────────

export async function loadCollections() {
  return (await loadData()).collections;
}

export async function addCollection({ name, icon = "📁", parentId = null }) {
  const data       = await loadData();
  const collection = {
    id:         uuidv4(),
    name,
    icon,
    parent_id:  parentId,
    archived:   false,
    created_at: new Date().toISOString(),
  };
  data.collections.push(collection);
  await saveData(data);
  return collection;
}

export async function updateCollection(id, changes) {
  const data = await loadData();
  const idx  = data.collections.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Collection not found");
  data.collections[idx] = { ...data.collections[idx], ...changes };
  await saveData(data);
  return data.collections[idx];
}

export async function archiveCollection(id) {
  return updateCollection(id, { archived: true });
}

export async function deleteCollection(id) {
  const data = await loadData();
  // Collect ids to remove: this collection + its sub-collections
  const toRemove = new Set([id]);
  data.collections.forEach((c) => { if (c.parent_id === id) toRemove.add(c.id); });
  data.collections = data.collections.filter((c) => !toRemove.has(c.id));
  // Strip removed collection ids from every item
  data.items = data.items.map((item) => ({
    ...item,
    collections: item.collections.filter((cid) => !toRemove.has(cid)),
  }));
  await saveData(data);
}
```

- [ ] **Step 2: Verify the app still launches**

Run: `npm run tauri dev`
Expected: app opens, no console errors. Any existing `data.json` in old format is silently discarded and a fresh empty state appears.

- [ ] **Step 3: Commit**

```bash
git add src/store.js
git commit -m "feat: rewrite store for new collections schema"
```

---

## Task 2: Extract ContextMenu into its own component

**Files:**
- Create: `src/components/ContextMenu.jsx`
- Modify: `src/App.jsx` (update import only)

- [ ] **Step 1: Create `src/components/ContextMenu.jsx`**

Cut the `ContextMenu` function out of `src/App.jsx` and paste it into this new file:

```jsx
import { useState, useEffect, useRef } from "react";

export default function ContextMenu({ x, y, items: menuItems, onClose }) {
  const ref = useRef(null);
  const [inlineInput, setInlineInput] = useState(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    if (!ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    const vw = window.innerWidth, vh = window.innerHeight;
    setPos({
      x: x + w > vw ? Math.max(0, vw - w - 8) : x,
      y: y + h > vh ? Math.max(0, vh - h - 8) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onKey  = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown",   onKey);
    };
  }, [onClose]);

  const confirmInline = () => {
    if (!inlineInput) return;
    const val = inlineInput.value.trim();
    if (val) inlineInput.onConfirm(val);
    onClose();
  };

  return (
    <div ref={ref} className="ctx-menu" style={{ left: pos.x, top: pos.y }}>
      {menuItems.map((item, i) => {
        if (item === "---") return <div key={i} className="ctx-divider" />;

        if (inlineInput?.index === i) {
          return (
            <div key={i} className="ctx-inline-input-row">
              <input
                className="ctx-inline-input"
                value={inlineInput.value}
                onChange={(e) => setInlineInput((s) => ({ ...s, value: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  { e.preventDefault(); confirmInline(); }
                  if (e.key === "Escape") onClose();
                }}
                autoFocus
              />
              <button className="ctx-inline-confirm" onClick={confirmInline}>↵</button>
            </div>
          );
        }

        return (
          <button
            key={i}
            className={`ctx-item${item.danger ? " danger" : ""}`}
            onClick={() => {
              if (item.inputDefault !== undefined) {
                setInlineInput({ index: i, value: item.inputDefault, onConfirm: item.action });
              } else {
                onClose();
                item.action();
              }
            }}
          >
            {item.icon  && <span className="ctx-icon">{item.icon}</span>}
            <span className="ctx-label">{item.label}</span>
            {item.hint  && <span className="ctx-hint">{item.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Update the import in `src/App.jsx`**

Remove the `ContextMenu` function definition from `App.jsx` and add this import at the top:

```js
import ContextMenu from "./components/ContextMenu";
```

- [ ] **Step 3: Verify the app still works**

Run: `npm run tauri dev`
Expected: app opens, right-clicking a card still shows the context menu with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ContextMenu.jsx src/App.jsx
git commit -m "refactor: extract ContextMenu into its own component"
```

---

## Task 3: Create Sidebar.jsx and wire it into App.jsx

**Files:**
- Create: `src/components/Sidebar.jsx`
- Modify: `src/App.jsx`
- Modify: `src/globals.css`

- [ ] **Step 1: Create `src/components/Sidebar.jsx`**

```jsx
import { useState, useRef, useEffect } from "react";

export default function Sidebar({
  collections,
  items,
  activeView,
  onSelectAll,
  onSelectUnorganized,
  onSelectCollection,
  onSelectTag,
  onAddCollection,
  onRenameCollection,
  onContextMenu,
  width,
  onResizeStart,
}) {
  const [expandedIds,      setExpandedIds]      = useState(new Set());
  const [tagsExpanded,     setTagsExpanded]     = useState(
    () => localStorage.getItem("tome_tags_expanded") === "true"
  );
  const [archivedExpanded, setArchivedExpanded] = useState(
    () => localStorage.getItem("tome_archived_expanded") === "true"
  );
  const [addingCollection,    setAddingCollection]    = useState(false);
  const [newCollectionName,   setNewCollectionName]   = useState("");
  const [renamingId,          setRenamingId]          = useState(null);
  const [renameValue,         setRenameValue]         = useState("");
  const newInputRef = useRef(null);

  useEffect(() => {
    if (addingCollection) newInputRef.current?.focus();
  }, [addingCollection]);

  const allTags      = [...new Set(items.flatMap((i) => i.tags))].sort();
  const topLevel     = collections.filter((c) => !c.parent_id && !c.archived);
  const archived     = collections.filter((c) => c.archived);
  const getChildren  = (pid) => collections.filter((c) => c.parent_id === pid && !c.archived);
  const unorganized  = items.filter((i) => i.collections.length === 0).length;

  const submitNew = async () => {
    const name = newCollectionName.trim();
    if (name) await onAddCollection({ name, icon: "📁", parentId: null });
    setNewCollectionName("");
    setAddingCollection(false);
  };

  const submitRename = async (id) => {
    const name = renameValue.trim();
    if (name) await onRenameCollection(id, name);
    setRenamingId(null);
  };

  const startRename = (col) => { setRenamingId(col.id); setRenameValue(col.name); };

  const toggleExpand = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderCollection = (col, isChild = false) => {
    const children   = isChild ? [] : getChildren(col.id);
    const hasKids    = children.length > 0;
    const isExpanded = expandedIds.has(col.id);
    const isActive   = activeView.type === "collection" && activeView.id === col.id;

    return (
      <div key={col.id}>
        <div
          className={`nav-item collection-item${isActive ? " active" : ""}${isChild ? " sub-item" : ""}`}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col, () => startRename(col)); }}
        >
          {!isChild && (
            <button
              className={`expand-btn${hasKids ? "" : " invisible"}`}
              onClick={(e) => { e.stopPropagation(); if (hasKids) toggleExpand(col.id); }}
              tabIndex={-1}
            >
              {hasKids ? (isExpanded ? "▾" : "▸") : ""}
            </button>
          )}
          {isChild && <span className="sub-indent">└</span>}

          {renamingId === col.id ? (
            <input
              className="collection-name-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  submitRename(col.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
              onBlur={() => submitRename(col.id)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="collection-label" onClick={() => onSelectCollection(col.id)}>
              <span className="collection-icon">{col.icon}</span>
              <span className="collection-name">{col.name}</span>
            </span>
          )}
        </div>

        {hasKids && isExpanded && (
          <div className="sub-collections">
            {children.map((child) => renderCollection(child, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-logo">Tome</div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item${activeView.type === "all" ? " active" : ""}`}
          onClick={onSelectAll}
        >
          All
        </button>
        <button
          className={`nav-item${activeView.type === "unorganized" ? " active" : ""}`}
          onClick={onSelectUnorganized}
        >
          Unorganized
          {unorganized > 0 && <span className="sidebar-count">{unorganized}</span>}
        </button>
      </nav>

      <div className="sidebar-divider" />

      {/* Collections */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Collections</span>
          <button className="section-add-btn" onClick={() => setAddingCollection(true)}>+</button>
        </div>

        {addingCollection && (
          <div className="collection-new-row">
            <input
              ref={newInputRef}
              className="collection-name-input"
              placeholder="Collection name"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  submitNew();
                if (e.key === "Escape") { setAddingCollection(false); setNewCollectionName(""); }
              }}
              onBlur={submitNew}
            />
          </div>
        )}

        {topLevel.map((col) => renderCollection(col))}
      </div>

      {/* Tags (collapsed by default) */}
      {allTags.length > 0 && (
        <>
          <div className="sidebar-divider" />
          <div className="sidebar-section">
            <button
              className="sidebar-collapse-header"
              onClick={() => {
                const next = !tagsExpanded;
                setTagsExpanded(next);
                localStorage.setItem("tome_tags_expanded", next);
              }}
            >
              <span className="collapse-arrow">{tagsExpanded ? "▾" : "▸"}</span>
              Tags
            </button>
            {tagsExpanded && allTags.map((tag) => (
              <button
                key={tag}
                className={`nav-item${activeView.type === "tag" && activeView.tag === tag ? " active" : ""}`}
                onClick={() => onSelectTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Archived (collapsed by default) */}
      {archived.length > 0 && (
        <>
          <div className="sidebar-divider" />
          <div className="sidebar-section">
            <button
              className="sidebar-collapse-header"
              onClick={() => {
                const next = !archivedExpanded;
                setArchivedExpanded(next);
                localStorage.setItem("tome_archived_expanded", next);
              }}
            >
              <span className="collapse-arrow">{archivedExpanded ? "▾" : "▸"}</span>
              Archived
            </button>
            {archivedExpanded && archived.map((col) => (
              <div
                key={col.id}
                className={`nav-item collection-item muted${activeView.type === "collection" && activeView.id === col.id ? " active" : ""}`}
                onClick={() => onSelectCollection(col.id)}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col, () => startRename(col)); }}
              >
                <span className="collection-icon">{col.icon}</span>
                <span className="collection-name">{col.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Resize handle */}
      <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
    </aside>
  );
}
```

- [ ] **Step 2: Add Sidebar CSS to `src/globals.css`**

Append to the end of `globals.css`:

```css
/* ─── Sidebar ──────────────────────────────────────────────── */
.sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg, #141414);
  border-right: 1px solid var(--border, #222);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  min-width: 200px;
  max-width: 340px;
}

.sidebar-logo {
  padding: 14px 14px 10px;
  font-weight: 700;
  font-size: 0.95rem;
  border-bottom: 1px solid var(--border, #222);
  flex-shrink: 0;
}

.sidebar-nav {
  padding: 8px 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-divider {
  border-top: 1px solid var(--border, #222);
  margin: 4px 0;
}

.sidebar-section {
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sidebar-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px 3px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #555;
}

.section-add-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #555;
  font-size: 1rem;
  line-height: 1;
  padding: 0 2px;
}
.section-add-btn:hover { color: #aaa; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 5px 8px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  border-radius: 5px;
  font-size: 0.82rem;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-item:hover  { background: rgba(255,255,255,0.04); color: #ddd; }
.nav-item.active { background: rgba(255,255,255,0.08); color: #fff; }
.nav-item.muted  { color: #666; }

.collection-item { gap: 2px; }

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #555;
  font-size: 0.65rem;
  width: 14px;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}
.expand-btn.invisible { visibility: hidden; }
.expand-btn:hover { color: #aaa; }

.collection-label {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  overflow: hidden;
  cursor: pointer;
}
.collection-icon { flex-shrink: 0; font-size: 0.85rem; }
.collection-name { overflow: hidden; text-overflow: ellipsis; }

.sub-item { padding-left: 4px; }
.sub-indent { color: #444; font-size: 0.75rem; flex-shrink: 0; }

.sub-collections { padding-left: 10px; }

.collection-new-row { padding: 2px 4px; }
.collection-name-input {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid #444;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 0.82rem;
  color: #ddd;
  outline: none;
}
.collection-name-input:focus { border-color: #888; }

.sidebar-collapse-header {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #555;
  text-align: left;
  border-radius: 4px;
}
.sidebar-collapse-header:hover { color: #888; }
.collapse-arrow { font-size: 0.6rem; }

.sidebar-count {
  margin-left: auto;
  font-size: 0.68rem;
  color: #555;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  padding: 1px 5px;
}

/* Resize handle */
.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}
.sidebar-resize-handle:hover { background: rgba(255,255,255,0.08); }
```

- [ ] **Step 3: Replace Sidebar in `src/App.jsx`**

a) Add to imports at the top:
```js
import Sidebar from "./components/Sidebar";
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadCollections, addCollection, updateCollection, deleteCollection, archiveCollection,
} from "./store";
```

b) Replace the state initialization block — add `collections` and `activeView`, remove `activeFolder` / `activeTag`:
```js
const [items,        setItems]        = useState([]);
const [collections,  setCollections]  = useState([]);
const [imageUrls,    setImageUrls]    = useState({});
const [search,       setSearch]       = useState("");
const [activeView,   setActiveView]   = useState({ type: "all" });
const [selectedItem, setSelectedItem] = useState(null);
const [pendingFile,  setPendingFile]  = useState(null);
const [isDragging,   setIsDragging]   = useState(false);
const [ctxMenu,      setCtxMenu]      = useState(null);
const [sidebarWidth, setSidebarWidth] = useState(
  () => parseInt(localStorage.getItem("tome_sidebar_width") || "240")
);
const [panelWidth,   setPanelWidth]   = useState(
  () => parseInt(localStorage.getItem("tome_panel_width")   || "320")
);
```

c) Update the initial load effect:
```js
useEffect(() => {
  loadItems().then(setItems).catch(console.error);
  loadCollections().then(setCollections).catch(console.error);
}, []);
```

d) Add collection handlers (after `handleDelete`):
```js
const handleAddCollection = async ({ name, icon, parentId }) => {
  const col = await addCollection({ name, icon, parentId });
  setCollections((prev) => [...prev, col]);
};

const handleRenameCollection = async (id, name) => {
  const updated = await updateCollection(id, { name });
  setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
};

const handleArchiveCollection = async (id) => {
  const updated = await archiveCollection(id);
  setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
  if (activeView.type === "collection" && activeView.id === id)
    setActiveView({ type: "all" });
};

const handleDeleteCollection = async (id) => {
  const col = collections.find((c) => c.id === id);
  const ok  = window.confirm(
    `Delete "${col?.name}"? Your images won't be deleted — they'll stay in All and any other collections they belong to.`
  );
  if (!ok) return;
  await deleteCollection(id);
  const removedIds = new Set([id, ...collections.filter((c) => c.parent_id === id).map((c) => c.id)]);
  setCollections((prev) => prev.filter((c) => !removedIds.has(c.id)));
  setItems((prev) => prev.map((i) => ({
    ...i,
    collections: i.collections.filter((cid) => !removedIds.has(cid)),
  })));
  if (activeView.type === "collection" && activeView.id === id)
    setActiveView({ type: "all" });
};
```

e) Add sidebar resize handler (after `handleDeleteCollection`):
```js
const handleSidebarResizeStart = useCallback((e) => {
  e.preventDefault();
  const startX     = e.clientX;
  const startWidth = sidebarWidth;
  const onMove = (ev) => {
    const w = Math.min(340, Math.max(200, startWidth + ev.clientX - startX));
    setSidebarWidth(w);
    localStorage.setItem("tome_sidebar_width", w);
  };
  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup",   onUp);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup",   onUp);
}, [sidebarWidth]);
```

f) Add collection context menu handler:
```js
const handleCollectionContextMenu = (e, collection, startRename) => {
  openCtxMenu(e, [
    { icon: "✎", label: "Rename",  action: startRename },
    { icon: "📦", label: "Archive", action: () => handleArchiveCollection(collection.id) },
    "---",
    { icon: "🗑", label: "Delete", danger: true, action: () => handleDeleteCollection(collection.id) },
  ]);
};
```

g) Update the filtering logic to use `activeView`:
```js
const getDescendantIds = useCallback((id) => {
  const ids = new Set([id]);
  collections.forEach((c) => { if (c.parent_id === id) ids.add(c.id); });
  return ids;
}, [collections]);

const filtered = items.filter((item) => {
  if (activeView.type === "unorganized" && item.collections.length > 0) return false;
  if (activeView.type === "collection") {
    const ids = getDescendantIds(activeView.id);
    if (!item.collections.some((cid) => ids.has(cid))) return false;
  }
  if (activeView.type === "tag" && !item.tags.includes(activeView.tag)) return false;
  if (!search.trim()) return true;
  const q = search.toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    item.tags.some((t) => t.includes(q))  ||
    item.note.toLowerCase().includes(q)
  );
});
```

h) Replace the old `<Sidebar .../>` JSX in the return with:
```jsx
<Sidebar
  collections={collections}
  items={items}
  activeView={activeView}
  onSelectAll={() => setActiveView({ type: "all" })}
  onSelectUnorganized={() => setActiveView({ type: "unorganized" })}
  onSelectCollection={(id) => setActiveView({ type: "collection", id })}
  onSelectTag={(tag) => setActiveView({ type: "tag", tag })}
  onAddCollection={handleAddCollection}
  onRenameCollection={handleRenameCollection}
  onContextMenu={handleCollectionContextMenu}
  width={sidebarWidth}
  onResizeStart={handleSidebarResizeStart}
/>
```

- [ ] **Step 4: Verify**

Run: `npm run tauri dev`
Expected:
- New sidebar shows All, Unorganized, Collections header with +, Tags (collapsed), Archived (collapsed)
- Clicking + next to Collections → inline input appears
- Right-clicking a collection → Rename / Archive / Delete menu appears
- Drag handle on sidebar right edge lets you resize between 200–340px
- Width persists after reload

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.jsx src/App.jsx src/globals.css
git commit -m "feat: add Sidebar component with collections tree and resize"
```

---

## Task 4: Create Grid.jsx and wire it into App.jsx

**Files:**
- Create: `src/components/Grid.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `src/components/Grid.jsx`**

```jsx
export default function Grid({
  items,
  imageUrls,
  search,
  onSearch,
  onCardClick,
  onCardContextMenu,
  onAddClick,
  isDragging,
}) {
  return (
    <div className="grid-area">
      <header className="toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <button className="btn-add" onClick={onAddClick}>+ Add</button>
      </header>

      {items.length === 0 ? (
        <div className={`empty-state${isDragging ? " drop-active" : ""}`}>
          {isDragging
            ? "Drop to save"
            : "Drag an image in or paste with Ctrl+V to get started."}
        </div>
      ) : (
        <div className={`grid${isDragging ? " drop-active" : ""}`}>
          {isDragging && <div className="grid-drop-overlay"><span>Drop to save</span></div>}
          {items.map((item) => (
            <div
              key={item.id}
              className="card"
              onClick={() => onCardClick(item)}
              onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(e, item); }}
              title={item.title || undefined}
            >
              {imageUrls[item.id]
                ? <img src={imageUrls[item.id]} alt={item.title || "image"} loading="lazy" />
                : <div className="card-placeholder" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add `.grid-area` CSS to `src/globals.css`**

```css
/* ─── Layout ────────────────────────────────────────────────── */
.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: #0f0f0f;
}

.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-width: 0;
}

.grid-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
```

- [ ] **Step 3: Update `src/App.jsx`**

a) Add import:
```js
import Grid from "./components/Grid";
```

b) Remove the `ImageCard` function definition from `App.jsx` (it's now inside Grid.jsx inline).

c) Replace the `<main className="main">` block in the JSX with:
```jsx
<div className="main-area">
  <Grid
    items={filtered}
    imageUrls={imageUrls}
    search={search}
    onSearch={setSearch}
    onCardClick={setSelectedItem}
    onCardContextMenu={handleCardContextMenu}
    onAddClick={() => fileInputRef.current?.click()}
    isDragging={isDragging}
  />
</div>
```

- [ ] **Step 4: Verify**

Run: `npm run tauri dev`
Expected: grid renders as before, search works, + Add button works, drag-drop still works.

- [ ] **Step 5: Commit**

```bash
git add src/components/Grid.jsx src/App.jsx src/globals.css
git commit -m "refactor: extract Grid into its own component"
```

---

## Task 5: Create DetailPanel.jsx and wire it into App.jsx

**Files:**
- Create: `src/components/DetailPanel.jsx`
- Modify: `src/App.jsx`
- Modify: `src/globals.css`

- [ ] **Step 1: Create `src/components/DetailPanel.jsx`**

```jsx
import { useState, useEffect, useRef } from "react";

export default function DetailPanel({
  item,
  imageUrl,
  collections,
  onUpdate,
  onDelete,
  onClose,
  width,
  onResizeStart,
}) {
  const [title,    setTitle]    = useState(item.title);
  const [tagInput, setTagInput] = useState("");
  const [tags,     setTags]     = useState(item.tags);
  const [note,     setNote]     = useState(item.note);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const pickerRef = useRef(null);

  // Sync when a different item is selected
  useEffect(() => {
    setTitle(item.title);
    setTags(item.tags);
    setNote(item.note);
    setTagInput("");
    setShowCollectionPicker(false);
  }, [item.id]);

  // Close collection picker on outside click
  useEffect(() => {
    if (!showCollectionPicker) return;
    const handler = (e) => {
      if (!pickerRef.current?.contains(e.target)) setShowCollectionPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCollectionPicker]);

  // Escape to close panel
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const saveTitle = () => {
    if (title !== item.title) onUpdate(item.id, { title });
  };

  const saveNote = () => {
    if (note !== item.note) onUpdate(item.id, { note });
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    const next = [...tags, t];
    setTags(next);
    onUpdate(item.id, { tags: next });
    setTagInput("");
  };

  const removeTag = (t) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    onUpdate(item.id, { tags: next });
  };

  const toggleCollection = (colId) => {
    const next = item.collections.includes(colId)
      ? item.collections.filter((id) => id !== colId)
      : [...item.collections, colId];
    onUpdate(item.id, { collections: next });
  };

  const formattedDate = new Date(item.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const activeCollections = collections.filter((c) => item.collections.includes(c.id));
  const availableCollections = collections.filter((c) => !c.archived && !item.collections.includes(c.id));

  return (
    <div className="detail-panel" style={{ width }}>
      {/* Resize handle on left edge */}
      <div className="panel-resize-handle" onMouseDown={onResizeStart} />

      {/* Close */}
      <button className="panel-close" onClick={onClose} title="Close (Esc)">×</button>

      {/* Image */}
      <div className="panel-image-wrap">
        {imageUrl
          ? <img src={imageUrl} alt={item.title || "image"} />
          : <div className="panel-image-placeholder" />}
      </div>

      {/* Title */}
      <input
        className="panel-title"
        value={title}
        placeholder="Untitled"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
      />

      {/* Tags */}
      <div className="panel-tags-wrap">
        {tags.map((t) => (
          <span key={t} className="tag-pill">
            {t}
            <button className="tag-remove" onClick={() => removeTag(t)}>×</button>
          </span>
        ))}
        <input
          className="tag-input"
          placeholder="Add tag…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addTag(); }
          }}
          onBlur={addTag}
        />
      </div>

      {/* Collections */}
      <div className="panel-collections-wrap" ref={pickerRef}>
        {activeCollections.map((col) => (
          <span key={col.id} className="collection-pill">
            {col.icon} {col.name}
            <button className="tag-remove" onClick={() => toggleCollection(col.id)}>×</button>
          </span>
        ))}
        {availableCollections.length > 0 && (
          <div className="collection-add-wrap">
            <button
              className="collection-add-btn"
              onClick={() => setShowCollectionPicker((v) => !v)}
            >+</button>
            {showCollectionPicker && (
              <div className="collection-picker">
                {availableCollections.map((col) => (
                  <button
                    key={col.id}
                    className="collection-picker-item"
                    onClick={() => { toggleCollection(col.id); setShowCollectionPicker(false); }}
                  >
                    {col.icon} {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note */}
      <textarea
        className="panel-note"
        placeholder="Add a note…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
      />

      {/* Date */}
      <p className="panel-date">{formattedDate}</p>

      {/* Delete */}
      <button className="btn-danger panel-delete" onClick={() => { onDelete(item.id); onClose(); }}>
        Delete
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add DetailPanel CSS to `src/globals.css`**

```css
/* ─── Detail Panel ──────────────────────────────────────────── */
.detail-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 14px 14px 18px;
  background: #161616;
  border-left: 1px solid #222;
  overflow-y: auto;
  position: relative;
  min-width: 260px;
  max-width: 560px;
}

.panel-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}
.panel-resize-handle:hover { background: rgba(255,255,255,0.08); }

.panel-close {
  align-self: flex-end;
  background: none;
  border: none;
  cursor: pointer;
  color: #555;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0;
  margin-bottom: -4px;
}
.panel-close:hover { color: #aaa; }

.panel-image-wrap {
  width: 100%;
  max-height: 240px;
  overflow: hidden;
  border-radius: 6px;
  background: #1e1e1e;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel-image-wrap img {
  width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: 6px;
}
.panel-image-placeholder {
  width: 100%;
  height: 160px;
  background: #222;
  border-radius: 6px;
}

.panel-title {
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  color: #eee;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 2px 0;
  width: 100%;
  outline: none;
}
.panel-title:focus { border-bottom-color: #444; }

.panel-tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 2px 7px;
  font-size: 0.75rem;
  color: #ccc;
}
.tag-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  font-size: 0.75rem;
  padding: 0;
  line-height: 1;
}
.tag-remove:hover { color: #aaa; }

.tag-input {
  background: none;
  border: none;
  outline: none;
  color: #aaa;
  font-size: 0.75rem;
  width: 80px;
}
.tag-input::placeholder { color: #444; }

.panel-collections-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}

.collection-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(100,100,200,0.12);
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 0.75rem;
  color: #99a;
}

.collection-add-wrap { position: relative; }

.collection-add-btn {
  background: rgba(255,255,255,0.05);
  border: 1px dashed #333;
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 0.8rem;
  color: #555;
  cursor: pointer;
}
.collection-add-btn:hover { color: #aaa; border-color: #666; }

.collection-picker {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 4px;
  z-index: 100;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.collection-picker-item {
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  padding: 5px 8px;
  font-size: 0.8rem;
  color: #aaa;
  border-radius: 4px;
  white-space: nowrap;
}
.collection-picker-item:hover { background: rgba(255,255,255,0.06); color: #eee; }

.panel-note {
  background: rgba(255,255,255,0.03);
  border: 1px solid #222;
  border-radius: 5px;
  color: #aaa;
  font-size: 0.82rem;
  padding: 8px;
  resize: vertical;
  min-height: 72px;
  outline: none;
  font-family: inherit;
}
.panel-note:focus { border-color: #444; }

.panel-date {
  font-size: 0.72rem;
  color: #444;
  margin: 0;
}

.panel-delete {
  align-self: flex-start;
  margin-top: auto;
}
```

- [ ] **Step 3: Update `src/App.jsx`**

a) Add import:
```js
import DetailPanel from "./components/DetailPanel";
```

b) Add panel resize handler (after `handleSidebarResizeStart`):
```js
const handlePanelResizeStart = useCallback((e) => {
  e.preventDefault();
  const startX     = e.clientX;
  const startWidth = panelWidth;
  const onMove = (ev) => {
    // Panel is on the right, so dragging left makes it wider
    const w = Math.min(560, Math.max(260, startWidth - (ev.clientX - startX)));
    setPanelWidth(w);
    localStorage.setItem("tome_panel_width", w);
  };
  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup",   onUp);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup",   onUp);
}, [panelWidth]);
```

c) Inside the `<div className="main-area">` JSX, add the panel after `<Grid .../>`:
```jsx
{selectedItem && (
  <DetailPanel
    item={selectedItem}
    imageUrl={imageUrls[selectedItem.id]}
    collections={collections}
    onUpdate={handleUpdate}
    onDelete={handleDelete}
    onClose={() => setSelectedItem(null)}
    width={panelWidth}
    onResizeStart={handlePanelResizeStart}
  />
)}
```

d) Remove the old `DetailOverlay` component definition from `App.jsx` and remove its JSX usage.

- [ ] **Step 4: Verify**

Run: `npm run tauri dev`
Expected:
- Click a card → panel opens on the right, grid narrows, no backdrop
- Click a different card → panel content switches without closing
- Esc closes the panel
- × button closes the panel
- Title edits save on blur
- Tags can be added (type + Enter) and removed (click ×)
- Collections section shows current membership with removable pills and a + to add more
- Note saves on blur
- Delete button removes the item and closes the panel
- Drag handle on panel left edge resizes between 260–560px, persists on reload

- [ ] **Step 5: Commit**

```bash
git add src/components/DetailPanel.jsx src/App.jsx src/globals.css
git commit -m "feat: add Eagle-style DetailPanel with resize and auto-save"
```

---

## Task 6: Update AddOverlay to use collections

**Files:**
- Create: `src/components/AddOverlay.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `src/components/AddOverlay.jsx`**

This is mostly a copy of the existing `AddOverlay` from `App.jsx`, with `folders` → `collections` and the select updated:

```jsx
import { useState, useEffect } from "react";

export default function AddOverlay({ imageFile, collections, onSave, onCancel }) {
  const [title,       setTitle]       = useState("");
  const [tagInput,    setTagInput]    = useState("");
  const [note,        setNote]        = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [previewUrl,  setPreviewUrl]  = useState(null);
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleSave = async () => {
    if (!imageFile) return;
    setSaving(true);
    try {
      const bytes = new Uint8Array(await imageFile.arrayBuffer());
      const tags  = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      await onSave({
        imageBytes:   bytes,
        originalName: imageFile.name,
        title,
        tags,
        note,
        collectionId: collectionId || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="overlay" onKeyDown={handleKeyDown}>
      <div className="overlay-backdrop" onClick={onCancel} />
      <div className="add-panel">
        {previewUrl && (
          <div className="add-preview"><img src={previewUrl} alt="preview" /></div>
        )}
        <div className="add-fields">
          <input
            className="field-input"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <input
            className="field-input"
            placeholder="Tags — comma separated"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          {collections.length > 0 && (
            <select
              className="field-input field-select"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
            >
              <option value="">No collection</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          )}
          <textarea
            className="field-input field-textarea"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <div className="add-actions">
            <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/App.jsx`**

a) Add import:
```js
import AddOverlay from "./components/AddOverlay";
```

b) Remove the old `AddOverlay` function definition from `App.jsx`.

c) Update `handleSaveNew` to use `collectionId` instead of `folderId`:
```js
const handleSaveNew = async (data) => {
  const collectionIds = data.collectionId
    ? [data.collectionId]
    : activeView.type === "collection" ? [activeView.id] : [];
  const item = await addItem({ ...data, collections: collectionIds });
  setItems((prev) => [item, ...prev]);
  setPendingFile(null);
};
```

d) Update `<AddOverlay>` JSX to pass `collections` instead of `folders`:
```jsx
{pendingFile && (
  <AddOverlay
    imageFile={pendingFile}
    collections={collections.filter((c) => !c.archived)}
    onSave={handleSaveNew}
    onCancel={() => setPendingFile(null)}
  />
)}
```

- [ ] **Step 3: Verify**

Run: `npm run tauri dev`
Expected:
- Drag or paste an image → overlay appears with collection dropdown (if any collections exist)
- Saving creates the item, which appears in the grid immediately
- If a collection was selected, the item appears under that collection in the sidebar

- [ ] **Step 4: Commit**

```bash
git add src/components/AddOverlay.jsx src/App.jsx
git commit -m "feat: update AddOverlay to use collections"
```

---

## Task 7: Final App.jsx cleanup

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update `handleCardContextMenu` in `src/App.jsx`**

Replace the existing card context menu handler with one that uses `collections[]` instead of `folder_id`:

```js
const handleCardContextMenu = (e, item) => {
  openCtxMenu(e, [
    { icon: "↗", label: "Open details", action: () => setSelectedItem(item) },
    "---",
    {
      icon: "⤷", label: "Add to collection", action: () => {
        const nonArchived = collections.filter((c) => !c.archived);
        setCtxMenu({
          x: e.clientX, y: e.clientY,
          menuItems: nonArchived.map((c) => ({
            icon:  item.collections.includes(c.id) ? "✓" : " ",
            label: `${c.icon} ${c.name}`,
            action: () => {
              const next = item.collections.includes(c.id)
                ? item.collections.filter((id) => id !== c.id)
                : [...item.collections, c.id];
              handleUpdate(item.id, { collections: next });
            },
          })),
        });
      },
    },
    ...(activeView.type === "collection" ? [{
      icon: "✕", label: "Remove from collection", action: () =>
        handleUpdate(item.id, {
          collections: item.collections.filter((id) => id !== activeView.id),
        }),
    }] : []),
    "---",
    { icon: "🗑", label: "Delete", danger: true, action: () => handleDelete(item.id) },
  ]);
};
```

- [ ] **Step 2: Remove all dead code from `src/App.jsx`**

Delete these now-unused items that were left from the old implementation:
- Any remaining reference to `folder_id`, `activeFolder`, `activeTag` variables
- `handleRenameFolder`, `handleDeleteFolder`, `handleRenameTag`, `handleDeleteTag` handlers (replaced by collection equivalents)
- The old inline `Sidebar`, `ImageCard`, `AddOverlay`, `DetailOverlay` function definitions if any remain
- Unused imports (`loadFolders`, `addFolder`, `renameFolder`, `deleteFolder` from old store)

- [ ] **Step 3: Verify the full feature set works end-to-end**

Run: `npm run tauri dev` and check:
- [ ] Drag an image in → overlay → save → appears in grid
- [ ] Ctrl+V a screenshot → same flow
- [ ] Click a card → detail panel opens on the right, grid reflows (no dimming)
- [ ] Click another card → panel content switches
- [ ] Edit title in panel → blur → refreshed on next open
- [ ] Add a tag → Enter → pill appears
- [ ] Remove a tag → pill disappears
- [ ] Add item to a collection via panel + button
- [ ] Remove item from collection via panel pill ×
- [ ] Esc closes the panel
- [ ] Sidebar: create a collection → appears in tree
- [ ] Sidebar: create a sub-collection → appears indented under parent
- [ ] Sidebar: right-click → Archive → collection moves to Archived section
- [ ] Sidebar: right-click → Delete → confirmation dialog → collection removed, items stay in All
- [ ] Sidebar: Tags section collapsed by default, expands on click
- [ ] Sidebar: resize handle drags between 200–340px, persists on reload
- [ ] Panel resize handle drags between 260–560px, persists on reload
- [ ] Filtering: click collection → grid shows only matching items
- [ ] Filtering: click Unorganized → shows items with no collections
- [ ] Search filters across title, tags, note

- [ ] **Step 4: Final commit**

```bash
git add src/App.jsx
git commit -m "feat: phase 1 complete — collections, sidebar, Eagle-style detail panel"
```

---

## Self-review notes

- **Spec coverage:** All spec requirements covered — collections CRUD, archive, delete (with confirm copy), nested display, resizable panes (200–340 / 260–560), Eagle-style panel, tags collapsed by default, archived collapsed by default, auto-save on blur, pill-based tag + collection UI.
- **Type consistency:** `collections[]` array used throughout store, App, Sidebar, DetailPanel, AddOverlay — no `folder_id` leakage.
- **No placeholders:** All steps contain actual code.
- **One ambiguity resolved:** `deleteCollection` in store also removes sub-collections records (not just the parent), consistent with App.jsx state update in `handleDeleteCollection`.
