import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadCollections, addCollection, updateCollection, deleteCollection, archiveCollection,
  addFlow, updateFlow,
} from "./store";
import AddOverlay from "./components/AddOverlay";
import ContextMenu from "./components/ContextMenu";
import Sidebar from "./components/Sidebar";
import Grid from "./components/Grid";
import DetailPanel from "./components/DetailPanel";
import FlowBuilder from "./components/FlowBuilder";
import FlowDetail from "./components/FlowDetail";
import "./App.css";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif"];
const MIME = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", bmp:"image/bmp", avif:"image/avif" };

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [items,        setItems]        = useState([]);
  const [collections,  setCollections]  = useState([]);
  const [imageUrls,    setImageUrls]    = useState({});
  const [search,       setSearch]       = useState("");
  const [activeView,   setActiveView]   = useState({ type: "all" });
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingFiles,    setPendingFiles]    = useState([]);
  const [addOverlayOpen,  setAddOverlayOpen]  = useState(false);
  const [isDragging,      setIsDragging]      = useState(false);
  const [ctxMenu,      setCtxMenu]      = useState(null);
  const [selectedIds,        setSelectedIds]        = useState(new Set());
  const selectedIdsRef = useRef(new Set());
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  // null | { mode: "create" } | { mode: "edit", flow: object }
  const [flowBuilder, setFlowBuilder] = useState(null);
  // null | flow-item object
  const [flowDetail, setFlowDetail] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(
    () => parseInt(localStorage.getItem("compendie_sidebar_width") || "240")
  );
  const ghostRef    = useRef(null);  // direct DOM ref — updated without React re-renders
  const dragColRef  = useRef(null);  // current hovered collection id during drag
  const itemsRef    = useRef(items); // always-current items for use in stable callbacks
  useEffect(() => { itemsRef.current = items; }, [items]);
  const dragCounter     = useRef(0);
  const recentDropPaths = useRef(new Set()); // dedup Tauri double-emit per path
  const recentDropTimer = useRef(null);
  const fileInputRef = useRef(null);
  const loadedIds = useRef(new Set());

  useEffect(() => {
    loadItems().then(setItems).catch(console.error);
    loadCollections().then(setCollections).catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const tasks = [];
      for (const item of items) {
        if (item.type === "flow") {
          for (const screen of (item.screens || [])) {
            if (!loadedIds.current.has(screen.id))
              tasks.push({ id: screen.id, path: screen.image_path });
          }
        } else {
          if (!loadedIds.current.has(item.id))
            tasks.push({ id: item.id, path: item.image_path });
        }
      }
      const newUrls = {};
      await Promise.all(tasks.map(async ({ id, path }) => {
        try {
          const url = await getImageUrl(path);
          if (!cancelled) { newUrls[id] = url; loadedIds.current.add(id); }
        } catch (e) { console.warn("Failed to load image", id, e); }
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
      if (file?.type.startsWith("image/")) {
        setPendingFiles((prev) => [...prev, file]);
        setAddOverlayOpen(true);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlistenHover, unlistenDrop, unlistenLeave;
    (async () => {
      unlistenHover = await listen("tauri://drag-over", () => { dragCounter.current += 1; setIsDragging(true); });
      unlistenLeave = await listen("tauri://drag-leave", () => { dragCounter.current = 0; setIsDragging(false); });
      unlistenDrop = await listen("tauri://drag-drop", async (event) => {
        dragCounter.current = 0; setIsDragging(false);
        const paths = event.payload?.paths ?? [];
        const allImagePaths = paths.filter((p) => IMAGE_EXTENSIONS.includes(p.split(".").pop().toLowerCase()));
        // Deduplicate: skip paths already seen in this drag session (Tauri double-emits on Windows)
        const newPaths = allImagePaths.filter((p) => !recentDropPaths.current.has(p));
        if (!newPaths.length) return;
        newPaths.forEach((p) => recentDropPaths.current.add(p));
        clearTimeout(recentDropTimer.current);
        recentDropTimer.current = setTimeout(() => recentDropPaths.current.clear(), 500);
        try {
          const newFiles = await Promise.all(
            newPaths.map(async (imagePath) => {
              const bytes = await readFile(imagePath);
              const ext = imagePath.split(".").pop().toLowerCase();
              const filename = imagePath.replace(/\\/g, "/").split("/").pop();
              const blob = new Blob([bytes], { type: MIME[ext] || "image/png" });
              return new File([blob], filename, { type: blob.type });
            })
          );
          setPendingFiles((prev) => [...prev, ...newFiles]);
          setAddOverlayOpen(true);
        } catch (e) { console.error("Failed to read dragged file:", e); }
      });
      // If cleanup already ran before promises resolved, unregister immediately
      if (cancelled) { unlistenHover?.(); unlistenLeave?.(); unlistenDrop?.(); }
    })();
    return () => { cancelled = true; unlistenHover?.(); unlistenDrop?.(); unlistenLeave?.(); };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      // Don't clear selection if the user is typing in an input or textarea
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      setSelectedIds(new Set());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleDragEnter = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); }, []);

  // Save all pending files as separate images
  const handleSaveNew = async (dataList) => {
    const saved = await Promise.all(
      dataList.map((data) => {
        const collectionIds = data.collectionId
          ? [data.collectionId]
          : activeView.type === "collection" ? [activeView.id] : [];
        return addItem({ ...data, collections: collectionIds });
      })
    );
    setItems((prev) => [...saved.reverse(), ...prev]);
    setPendingFiles([]);
    setAddOverlayOpen(false);
  };

  // Save all pending files as a single flow
  const handleSaveNewFlow = async (data) => {
    const collectionIds = data.collections?.length
      ? data.collections
      : activeView.type === "collection" ? [activeView.id] : [];
    const item = await addFlow({ ...data, collections: collectionIds });
    setItems((prev) => [item, ...prev]);
    setPendingFiles([]);
    setAddOverlayOpen(false);
  };

  const handleUpdate = useCallback(async (id, changes) => {
    const updated = await updateItem(id, changes);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setSelectedItem((prev) => (prev?.id === id ? updated : prev));
  }, []);

  const handleSaveFlow = async (data) => {
    const collectionIds = data.collections.length
      ? data.collections
      : activeView.type === "collection" ? [activeView.id] : [];
    const item = await addFlow({ ...data, collections: collectionIds });
    setItems((prev) => [item, ...prev]);
    setFlowBuilder(null);
  };

  const handleUpdateFlow = async (id, data) => {
    const updated = await updateFlow(id, data);
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    setFlowDetail((prev) => (prev?.id === id ? updated : prev));
    setFlowBuilder(null);
  };

  const handleUpdateScreenNote = async (flowId, screenId, note) => {
    const flow = items.find((i) => i.id === flowId);
    if (!flow) return;
    const updatedScreens = flow.screens.map((s) =>
      s.id === screenId ? { ...s, note } : s
    );
    const updated = await updateFlow(flowId, { screens: updatedScreens });
    setItems((prev) => prev.map((i) => (i.id === flowId ? updated : i)));
    setFlowDetail(updated);
  };

  const handleDelete = async (id) => {
    await deleteItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedItem((prev) => (prev?.id === id ? null : prev));
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
      localStorage.setItem("compendie_sidebar_width", w);
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

  const handleCardClick = (item) => {
    if (item.type === "flow") setFlowDetail(item);
    else setSelectedItem(item);
  };

  const handleCardContextMenu = (e, item) => {
    openCtxMenu(e, [
      {
        icon: "↗", label: "Open details",
        action: () => item.type === "flow" ? setFlowDetail(item) : setSelectedItem(item),
      },
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

  const handleSelectionDragStart = useCallback(() => {
    // Show ghost — DOM-only, no React state
    if (ghostRef.current) {
      ghostRef.current.textContent = `+${selectedIdsRef.current.size}`;
      ghostRef.current.style.display = "block";
    }

    let prevColEl = null; // sidebar element currently highlighted

    const onMove = (e) => {
      // Move ghost — no setState, no re-render
      if (ghostRef.current) {
        ghostRef.current.style.left = `${e.clientX + 12}px`;
        ghostRef.current.style.top  = `${e.clientY + 12}px`;
      }

      // Highlight sidebar target — direct DOM class toggle, no setState
      const el    = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = el?.closest("[data-collection-id]") ?? null;
      if (colEl !== prevColEl) {
        prevColEl?.classList.remove("drag-target");
        colEl?.classList.add("drag-target");
        prevColEl = colEl;
      }
      dragColRef.current = colEl?.dataset?.collectionId ?? null;
    };

    const onUp = () => {
      if (ghostRef.current) ghostRef.current.style.display = "none";
      prevColEl?.classList.remove("drag-target");
      prevColEl = null;

      const colId = dragColRef.current;
      if (colId) {
        selectedIdsRef.current.forEach((id) => {
          const item = itemsRef.current.find((i) => i.id === id);
          if (!item) return;
          if (!item.collections.includes(colId)) {
            handleUpdate(id, { collections: [...item.collections, colId] });
          }
        });
      }
      setSelectedIds(new Set());
      dragColRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [handleUpdate]); // zero React state reads in hot path

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
        onAddClick={() => setAddOverlayOpen(true)}
        width={sidebarWidth}
        onResizeStart={handleSidebarResizeStart}
      />

      <div className="main-area">
        <Grid
          items={filtered}
          imageUrls={imageUrls}
          search={search}
          onSearch={setSearch}
          activeView={activeView}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onSelectionDragStart={handleSelectionDragStart}
          onCardClick={handleCardClick}
          onCardContextMenu={handleCardContextMenu}
          isDragging={isDragging}
        />
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) setPendingFiles((prev) => [...prev, ...files]);
            e.target.value = "";
          }} />
        {selectedItem && pendingFiles.length === 0 && (
          <DetailPanel
            item={selectedItem}
            allItems={filtered}
            imageUrls={imageUrls}
            collections={collections}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onClose={() => setSelectedItem(null)}
            onNavigate={setSelectedItem}
          />
        )}
      </div>

      <div ref={ghostRef} className="drag-ghost" style={{ display: "none" }} />

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.menuItems}
          onClose={() => setCtxMenu(null)} />
      )}

      {(addOverlayOpen || pendingFiles.length > 0) && (
        <AddOverlay
          imageFiles={pendingFiles}
          collections={collections.filter((c) => !c.archived)}
          onSave={handleSaveNew}
          onSaveFlow={handleSaveNewFlow}
          onCancel={() => { setPendingFiles([]); setAddOverlayOpen(false); }}
          onRemoveFile={(i) => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
          onReorderFiles={setPendingFiles}
          onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
        />
      )}

      {flowBuilder && (
        <FlowBuilder
          mode={flowBuilder.mode}
          flow={flowBuilder.flow}
          items={items}
          imageUrls={imageUrls}
          collections={collections.filter((c) => !c.archived)}
          onSave={handleSaveFlow}
          onUpdate={handleUpdateFlow}
          onCancel={() => setFlowBuilder(null)}
        />
      )}

      {flowDetail && !flowBuilder && (
        <FlowDetail
          flow={flowDetail}
          imageUrls={imageUrls}
          onClose={() => setFlowDetail(null)}
          onEdit={() => setFlowBuilder({ mode: "edit", flow: flowDetail })}
          onUpdateScreenNote={handleUpdateScreenNote}
        />
      )}

    </div>
  );
}
