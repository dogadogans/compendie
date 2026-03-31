import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadCollections, addCollection, updateCollection, deleteCollection, archiveCollection,
} from "./store";
import ContextMenu from "./components/ContextMenu";
import Sidebar from "./components/Sidebar";
import Grid from "./components/Grid";
import "./App.css";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif"];
const MIME = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", bmp:"image/bmp", avif:"image/avif" };

// ─── Add overlay ──────────────────────────────────────────────────────────────
function AddOverlay({ imageFile, onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [note, setNote] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);

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
      const tags = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      await onSave({ imageBytes: bytes, originalName: imageFile.name, title, tags, note });
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
        {previewUrl && <div className="add-preview"><img src={previewUrl} alt="preview" /></div>}
        <div className="add-fields">
          <input className="field-input" placeholder="Title (optional)" value={title}
            onChange={(e) => setTitle(e.target.value)} autoFocus />
          <input className="field-input" placeholder="Tags — comma separated" value={tagInput}
            onChange={(e) => setTagInput(e.target.value)} />
          <textarea className="field-input field-textarea" placeholder="Note (optional)"
            value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
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

// ─── Detail overlay ───────────────────────────────────────────────────────────
function DetailOverlay({ item, imageUrl, onClose, onUpdate, onDelete }) {
  const [title, setTitle] = useState(item.title);
  const [tagInput, setTagInput] = useState(item.tags.join(", "));
  const [note, setNote] = useState(item.note);
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const mark = (setter) => (e) => { setter(e.target.value); setDirty(true); };

  const handleSave = async () => {
    const tags = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    await onUpdate(item.id, { title, tags, note });
    setDirty(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(item.id); onClose(); }
    finally { setDeleting(false); }
  };

  const formattedDate = new Date(item.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="overlay" onKeyDown={(e) => e.key === "Escape" && onClose()} tabIndex={-1}>
      <div className="overlay-backdrop" onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-image-wrap">
          {imageUrl
            ? <img src={imageUrl} alt={item.title || "image"} />
            : <div className="card-placeholder" style={{ height: 300 }} />}
        </div>
        <div className="detail-fields">
          <input className="field-input field-title" placeholder="Untitled"
            value={title} onChange={mark(setTitle)} />
          <input className="field-input" placeholder="Tags — comma separated"
            value={tagInput} onChange={mark(setTagInput)} />
          <textarea className="field-input field-textarea" placeholder="No note"
            value={note} onChange={mark(setNote)} rows={4} />
          <p className="detail-date">{formattedDate}</p>
          <div className="detail-actions">
            <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
            {dirty && <button className="btn-primary" onClick={handleSave}>Save</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
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
  const dragCounter = useRef(0);
  const fileInputRef = useRef(null);

  // Suppress unused warning — panelWidth is stored for future detail panel use
  void panelWidth; void setPanelWidth;

  useEffect(() => {
    loadItems().then(setItems).catch(console.error);
    loadCollections().then(setCollections).catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const newUrls = {};
      await Promise.all(items.map(async (item) => {
        if (imageUrls[item.id]) return;
        try {
          const url = await getImageUrl(item.image_path);
          if (!cancelled) newUrls[item.id] = url;
        } catch (e) { console.warn("Failed to load image for", item.id, e); }
      }));
      if (!cancelled && Object.keys(newUrls).length > 0)
        setImageUrls((prev) => ({ ...prev, ...newUrls }));
    };
    load();
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    const onPaste = (e) => {
      const file = e.clipboardData?.files?.[0];
      if (file?.type.startsWith("image/")) setPendingFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    let unlistenHover, unlistenDrop, unlistenLeave;
    (async () => {
      unlistenHover = await listen("tauri://drag-over", () => { dragCounter.current += 1; setIsDragging(true); });
      unlistenLeave = await listen("tauri://drag-leave", () => { dragCounter.current = 0; setIsDragging(false); });
      unlistenDrop = await listen("tauri://drag-drop", async (event) => {
        dragCounter.current = 0; setIsDragging(false);
        const paths = event.payload?.paths ?? [];
        const imagePath = paths.find((p) => IMAGE_EXTENSIONS.includes(p.split(".").pop().toLowerCase()));
        if (!imagePath) return;
        try {
          const bytes = await readFile(imagePath);
          const ext = imagePath.split(".").pop().toLowerCase();
          const filename = imagePath.replace(/\\/g, "/").split("/").pop();
          const blob = new Blob([bytes], { type: MIME[ext] || "image/png" });
          setPendingFile(new File([blob], filename, { type: blob.type }));
        } catch (e) { console.error("Failed to read dragged file:", e); }
      });
    })();
    return () => { unlistenHover?.(); unlistenDrop?.(); unlistenLeave?.(); };
  }, []);

  const handleDragEnter = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); }, []);

  const handleSaveNew = async (data) => {
    const item = await addItem({ ...data, collections: [] });
    setItems((prev) => [item, ...prev]);
    setPendingFile(null);
  };

  const handleUpdate = async (id, changes) => {
    const updated = await updateItem(id, changes);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setSelectedItem((prev) => (prev?.id === id ? updated : prev));
  };

  const handleDelete = async (id) => {
    await deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (imageUrls[id]) {
      URL.revokeObjectURL(imageUrls[id]);
      setImageUrls((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  // ── Collection handlers ──────────────────────────────────────────────────────

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

  // ── Sidebar resize ───────────────────────────────────────────────────────────

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

  // ── Context menus ────────────────────────────────────────────────────────────

  const openCtxMenu = (e, menuItems) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, menuItems });
  };

  const handleCollectionContextMenu = (e, collection, startRename) => {
    openCtxMenu(e, [
      { icon: "✎", label: "Rename",  action: startRename },
      { icon: "📦", label: "Archive", action: () => handleArchiveCollection(collection.id) },
      "---",
      { icon: "🗑", label: "Delete", danger: true, action: () => handleDeleteCollection(collection.id) },
    ]);
  };

  const handleCardContextMenu = (e, item) => {
    openCtxMenu(e, [
      { icon: "↗", label: "Open details", action: () => setSelectedItem(item) },
      "---",
      { icon: "🗑", label: "Delete", danger: true, action: () => handleDelete(item.id) },
    ]);
  };

  // ── Filtering ────────────────────────────────────────────────────────────────

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

  return (
    <div className="app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}>

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
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPendingFile(file);
            e.target.value = "";
          }} />
      </div>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.menuItems}
          onClose={() => setCtxMenu(null)} />
      )}

      {pendingFile && (
        <AddOverlay imageFile={pendingFile}
          onSave={handleSaveNew} onCancel={() => setPendingFile(null)} />
      )}

      {selectedItem && !pendingFile && (
        <DetailOverlay item={selectedItem} imageUrl={imageUrls[selectedItem.id]}
          onClose={() => setSelectedItem(null)}
          onUpdate={handleUpdate} onDelete={handleDelete} />
      )}
    </div>
  );
}
