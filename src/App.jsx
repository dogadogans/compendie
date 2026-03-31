import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadFolders, addFolder, renameFolder, deleteFolder,
} from "./store";
import ContextMenu from "./components/ContextMenu";
import "./App.css";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif"];
const MIME = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", bmp:"image/bmp", avif:"image/avif" };

// ─── Image card ───────────────────────────────────────────────────────────────
function ImageCard({ item, imageUrl, onClick, onContextMenu }) {
  return (
    <div className="card" onClick={() => onClick(item)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
      title={item.title || undefined}>
      {imageUrl
        ? <img src={imageUrl} alt={item.title || "image"} loading="lazy" />
        : <div className="card-placeholder" />}
    </div>
  );
}

// ─── Add overlay ──────────────────────────────────────────────────────────────
function AddOverlay({ imageFile, folders, onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [note, setNote] = useState("");
  const [folderId, setFolderId] = useState("");
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
      await onSave({ imageBytes: bytes, originalName: imageFile.name, title, tags, note, folderId: folderId || null });
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
          {folders.length > 0 && (
            <select className="field-input field-select" value={folderId}
              onChange={(e) => setFolderId(e.target.value)}>
              <option value="">No folder</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
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
function DetailOverlay({ item, imageUrl, folders, onClose, onUpdate, onDelete }) {
  const [title, setTitle] = useState(item.title);
  const [tagInput, setTagInput] = useState(item.tags.join(", "));
  const [note, setNote] = useState(item.note);
  const [folderId, setFolderId] = useState(item.folder_id || "");
  const [dirty, setDirty] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const mark = (setter) => (e) => { setter(e.target.value); setDirty(true); };

  const handleSave = async () => {
    const tags = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    await onUpdate(item.id, { title, tags, note, folder_id: folderId || null });
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
          <select className="field-input field-select" value={folderId} onChange={mark(setFolderId)}>
            <option value="">No folder</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ folders, allTags, activeFolder, activeTag, onSelectFolder, onSelectTag,
  onAddFolder, onRenameFolder, onDeleteFolder, onRenameTag, onDeleteTag,
  onFolderContextMenu, onTagContextMenu }) {
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const newFolderInputRef = useRef(null);

  useEffect(() => {
    if (addingFolder) newFolderInputRef.current?.focus();
  }, [addingFolder]);

  const submitNewFolder = async () => {
    const name = newFolderName.trim();
    if (name) await onAddFolder(name);
    setNewFolderName("");
    setAddingFolder(false);
  };

  const submitRename = async (id) => {
    const name = renameValue.trim();
    if (name) await onRenameFolder(id, name);
    setRenamingId(null);
  };

  // Expose inline rename trigger to context menu
  const startRename = (folder) => {
    setRenamingId(folder.id);
    setRenameValue(folder.name);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Tome</div>

      <nav className="sidebar-nav">
        <button className={`nav-item${!activeFolder && !activeTag ? " active" : ""}`}
          onClick={() => { onSelectFolder(null); onSelectTag(null); }}>
          All
        </button>
      </nav>

      {/* Folders */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Folders</span>
          <button className="section-add-btn" title="New folder"
            onClick={() => setAddingFolder(true)}>+</button>
        </div>

        {addingFolder && (
          <div className="folder-new-row">
            <input ref={newFolderInputRef} className="folder-name-input" placeholder="Folder name"
              value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewFolder();
                if (e.key === "Escape") { setAddingFolder(false); setNewFolderName(""); }
              }}
              onBlur={submitNewFolder} />
          </div>
        )}

        {folders.map((folder) => (
          <div key={folder.id}
            className={`nav-item folder-item${activeFolder === folder.id ? " active" : ""}`}
            onContextMenu={(e) => { e.preventDefault(); onFolderContextMenu(e, folder, () => startRename(folder)); }}>
            {renamingId === folder.id ? (
              <input className="folder-name-input" value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename(folder.id);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                onBlur={() => submitRename(folder.id)} autoFocus />
            ) : (
              <>
                <span className="folder-name"
                  onClick={() => onSelectFolder(activeFolder === folder.id ? null : folder.id)}>
                  {folder.name}
                </span>
                <div className="folder-actions">
                  <button className="folder-action-btn" title="Rename"
                    onClick={(e) => { e.stopPropagation(); startRename(folder); }}>✎</button>
                  <button className="folder-action-btn danger" title="Delete"
                    onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}>×</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header"><span>Tags</span></div>
          {allTags.map((tag) => (
            <button key={tag}
              className={`nav-item${activeTag === tag ? " active" : ""}`}
              onClick={() => onSelectTag(activeTag === tag ? null : tag)}
              onContextMenu={(e) => { e.preventDefault(); onTagContextMenu(e, tag); }}>
              {tag}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, menuItems }
  const dragCounter = useRef(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadItems().then(setItems).catch(console.error);
    loadFolders().then(setFolders).catch(console.error);
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
  const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); }, []);

  const handleSaveNew = async (data) => {
    const item = await addItem({ ...data, folderId: data.folderId || activeFolder || null });
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

  const handleAddFolder = async (name) => {
    const folder = await addFolder(name);
    setFolders((prev) => [...prev, folder]);
  };

  const handleRenameFolder = async (id, name) => {
    const updated = await renameFolder(id, name);
    setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
  };

  const handleDeleteFolder = async (id) => {
    await deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setItems((prev) => prev.map((i) => i.folder_id === id ? { ...i, folder_id: null } : i));
    if (activeFolder === id) setActiveFolder(null);
  };

  // Rename a tag across all items
  const handleRenameTag = async (oldTag, newTag) => {
    const affected = items.filter((i) => i.tags.includes(oldTag));
    await Promise.all(affected.map((i) =>
      updateItem(i.id, { tags: i.tags.map((t) => t === oldTag ? newTag : t) })
    ));
    setItems((prev) => prev.map((i) =>
      i.tags.includes(oldTag) ? { ...i, tags: i.tags.map((t) => t === oldTag ? newTag : t) } : i
    ));
    if (activeTag === oldTag) setActiveTag(newTag);
  };

  // Delete a tag from all items
  const handleDeleteTag = async (tag) => {
    const affected = items.filter((i) => i.tags.includes(tag));
    await Promise.all(affected.map((i) =>
      updateItem(i.id, { tags: i.tags.filter((t) => t !== tag) })
    ));
    setItems((prev) => prev.map((i) =>
      i.tags.includes(tag) ? { ...i, tags: i.tags.filter((t) => t !== tag) } : i
    ));
    if (activeTag === tag) setActiveTag(null);
  };

  // ── Context menu builders ──────────────────────────────────────────────────

  const openCtxMenu = (e, menuItems) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, menuItems });
  };

  const handleCardContextMenu = (e, item) => {
    openCtxMenu(e, [
      { icon: "↗", label: "Open details", action: () => setSelectedItem(item) },
      "---",
      {
        icon: "⤷", label: "Move to folder", action: () => {
          // Show a second context menu with folder choices
          setCtxMenu({
            x: e.clientX, y: e.clientY,
            menuItems: [
              { icon: "", label: "No folder", action: () => handleUpdate(item.id, { folder_id: null }) },
              ...folders.map((f) => ({
                icon: item.folder_id === f.id ? "✓" : " ",
                label: f.name,
                action: () => handleUpdate(item.id, { folder_id: f.id }),
              })),
            ],
          });
        },
      },
      "---",
      { icon: "🗑", label: "Delete", danger: true, action: () => handleDelete(item.id) },
    ]);
  };

  const handleFolderContextMenu = (e, folder, startRename) => {
    openCtxMenu(e, [
      { icon: "✎", label: "Rename", action: startRename },
      "---",
      { icon: "🗑", label: "Delete", danger: true, action: () => handleDeleteFolder(folder.id) },
    ]);
  };

  const handleTagContextMenu = (e, tag) => {
    openCtxMenu(e, [
      {
        icon: "✎", label: "Rename tag",
        inputDefault: tag,
        action: (newName) => {
          if (newName !== tag) handleRenameTag(tag, newName.toLowerCase());
        },
      },
      "---",
      { icon: "🗑", label: "Delete tag", danger: true, action: () => handleDeleteTag(tag) },
    ]);
  };

  const allTags = [...new Set(items.flatMap((i) => i.tags))].sort();

  const filtered = items.filter((item) => {
    if (activeFolder && item.folder_id !== activeFolder) return false;
    if (activeTag && !item.tags.includes(activeTag)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.tags.some((t) => t.includes(q)) ||
      item.note.toLowerCase().includes(q)
    );
  });

  return (
    <div className="app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}>

      <Sidebar
        folders={folders} allTags={allTags}
        activeFolder={activeFolder} activeTag={activeTag}
        onSelectFolder={(id) => { setActiveFolder(id); setActiveTag(null); }}
        onSelectTag={(tag) => { setActiveTag(tag); setActiveFolder(null); }}
        onAddFolder={handleAddFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onRenameTag={handleRenameTag}
        onDeleteTag={handleDeleteTag}
        onFolderContextMenu={handleFolderContextMenu}
        onTagContextMenu={handleTagContextMenu}
      />

      <main className="main">
        <header className="toolbar">
          <input className="search-input" type="search" placeholder="Search…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-add" onClick={() => fileInputRef.current?.click()}>+ Add</button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPendingFile(file);
              e.target.value = "";
            }} />
        </header>

        {filtered.length === 0 ? (
          <div className={`empty-state${isDragging ? " drop-active" : ""}`}>
            {isDragging ? "Drop to save"
              : items.length === 0 ? "Drag an image in or paste with Ctrl+V to get started."
              : "No items match your filter."}
          </div>
        ) : (
          <div className={`grid${isDragging ? " drop-active" : ""}`}>
            {isDragging && <div className="grid-drop-overlay"><span>Drop to save</span></div>}
            {filtered.map((item) => (
              <ImageCard key={item.id} item={item} imageUrl={imageUrls[item.id]}
                onClick={setSelectedItem} onContextMenu={handleCardContextMenu} />
            ))}
          </div>
        )}
      </main>

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.menuItems}
          onClose={() => setCtxMenu(null)} />
      )}

      {pendingFile && (
        <AddOverlay imageFile={pendingFile} folders={folders}
          onSave={handleSaveNew} onCancel={() => setPendingFile(null)} />
      )}

      {selectedItem && !pendingFile && (
        <DetailOverlay item={selectedItem} imageUrl={imageUrls[selectedItem.id]}
          folders={folders} onClose={() => setSelectedItem(null)}
          onUpdate={handleUpdate} onDelete={handleDelete} />
      )}
    </div>
  );
}
