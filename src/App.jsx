import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ExternalLink, FolderPlus, FolderMinus, Trash2 } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";
import { arrayMove } from "@dnd-kit/sortable";
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadCollections, addCollection, updateCollection, deleteCollection, archiveCollection,
  addFlow, updateFlow, reorderItems, reorderCollections,
} from "./store";
import AddOverlay from "./components/AddOverlay";
import ContextMenu from "./components/ContextMenu";
import Sidebar from "./components/Sidebar";
import Grid from "./components/Grid";
import DetailPanel from "./components/DetailPanel";
import FlowBuilder from "./components/FlowBuilder";
import FlowDetail from "./components/FlowDetail";
import CreateCollectionModal from "./components/CreateCollectionModal";
import DeleteConfirmModal from "./components/DeleteConfirmModal";
import ActionsDropdown  from "./components/ActionsDropdown";
import CollectionPicker from "./components/CollectionPicker";
import QuickFolderModal from "./components/QuickFolderModal";
import { AnimatePresence, motion } from "framer-motion";
import "./App.css";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif"];
const MIME = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", bmp:"image/bmp", avif:"image/avif" };

// ─── Sort menu builder ────────────────────────────────────────────────────────
function buildSortMenuItems(sort, onSortChange) {
  const opt = (by, dir, label) => ({
    label,
    checked: sort.by === by && sort.dir === dir,
    action: () => onSortChange({ by, dir }),
  });
  return [
    { label: "Manual", checked: sort.by === "manual", action: () => onSortChange({ by: "manual", dir: "asc" }) },
    "---",
    opt("name", "asc",  "Name: A → Z"),
    opt("name", "desc", "Name: Z → A"),
    "---",
    opt("date_created", "asc",  "Date Created: First"),
    opt("date_created", "desc", "Date Created: Last"),
    "---",
    opt("date_updated", "asc",  "Date Updated: First"),
    opt("date_updated", "desc", "Date Updated: Last"),
  ];
}

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
  const [editingCollection, setEditingCollection] = useState(null);
  const [newFolderParentId, setNewFolderParentId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
  const [selectedIds,       setSelectedIds]       = useState(new Set());
  const [organizeMode,      setOrganizeMode]       = useState(false);
  const [actionMenuOpen,    setActionMenuOpen]     = useState(false);
  const [pickerMode,        setPickerMode]         = useState(null); // "move" | "copy" | null
  const [bulkDeleteConfirm, setBulkDeleteConfirm]  = useState(false);
  const [quickFolderOpen,   setQuickFolderOpen]    = useState(false);
  const [collectionSort, setCollectionSort] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("compendie_collection_sort")) ||
        { by: "manual", dir: "asc" }
      );
    } catch {
      return { by: "manual", dir: "asc" };
    }
  });
  const [gridSort, setGridSort] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("compendie_grid_sort")) || { by: "manual", dir: "asc" };
    } catch {
      return { by: "manual", dir: "asc" };
    }
  });
  // null | { mode: "create" } | { mode: "edit", flow: object }
  const [flowBuilder, setFlowBuilder] = useState(null);
  // null | flow-item object
  const [flowDetail, setFlowDetail] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(
    () => parseInt(localStorage.getItem("compendie_sidebar_width") || "240")
  );
  const [sidebarHidden, setSidebarHidden] = useState(
    () => localStorage.getItem("compendie_sidebar_hidden") === "true"
  );
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

  // Reset selection state whenever the active view changes
  useEffect(() => {
    setSelectedIds(new Set());
    setOrganizeMode(false);
    setActionMenuOpen(false);
    setPickerMode(null);
  }, [activeView]);

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
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        setAddOverlayOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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


  const handleDragEnter = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); }, []);

  // Save all pending files as separate images
  const handleSaveNew = async (dataList) => {
    const saved = await Promise.all(
      dataList.map((data) => {
        const collectionIds = data.collectionIds?.length
          ? data.collectionIds
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

  const handleReorder = useCallback((activeId, overId) => {
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === activeId);
      const newIndex = prev.findIndex((i) => i.id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      reorderItems(reordered.map((i) => i.id)).catch(console.error);
      return reordered;
    });
    setGridSort((prev) => {
      if (prev.by === "manual") return prev;
      const next = { by: "manual", dir: "asc" };
      localStorage.setItem("compendie_grid_sort", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setOrganizeMode(false);
    setActionMenuOpen(false);
    setPickerMode(null);
  }, []);

  // Move selected items into targetId, removing them from the current collection
  const handleBulkMove = useCallback(async (targetId) => {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      const next = item.collections
        .filter((c) => c !== activeView.id)
        .concat(item.collections.includes(targetId) ? [] : [targetId]);
      return handleUpdate(id, { collections: next });
    }));
    handleClearSelection();
  }, [selectedIds, activeView, handleUpdate, handleClearSelection]);

  // Copy selected items into targetId without removing from current collection
  const handleBulkCopy = useCallback(async (targetId) => {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item || item.collections.includes(targetId)) return;
      return handleUpdate(id, { collections: [...item.collections, targetId] });
    }));
    handleClearSelection();
  }, [selectedIds, handleUpdate, handleClearSelection]);

  // Delete all selected items one by one
  const handleBulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    for (const id of ids) await handleDelete(id);
    handleClearSelection();
  }, [selectedIds, handleDelete, handleClearSelection]);

  // Create a new folder and move all selected items into it
  const handleQuickNewFolder = useCallback(async (name) => {
    const col = await handleAddCollection({ name, icon: "Folder", color: "#888888", parentId: activeView.id });
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      return handleUpdate(id, { collections: [...item.collections, col.id] });
    }));
    setQuickFolderOpen(false);
    handleClearSelection();
  }, [selectedIds, activeView, handleAddCollection, handleUpdate, handleClearSelection]);

  // ── Collection handlers ──────────────────────────────────────────────────────

  const handleAddCollection = async ({ name, icon, color, parentId }) => {
    const col = await addCollection({ name, icon, color, parentId });
    setCollections((prev) => [...prev, col]);
    return col;
  };

  const handleUpdateCollection = async (id, { name, icon, color }) => {
    const updated = await updateCollection(id, { name, icon, color });
    setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const handleArchiveCollection = async (id) => {
    const updated = await archiveCollection(id);
    setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
    if (activeView.type === "collection" && activeView.id === id)
      setActiveView({ type: "all" });
  };

  const handleDeleteCollection = (id) => {
    const col = collections.find((c) => c.id === id);
    setDeleteConfirm({ id, name: col?.name ?? "" });
  };

  const confirmDeleteCollection = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
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

  const handleSortChange = (newSort) => {
    setCollectionSort(newSort);
    localStorage.setItem("compendie_collection_sort", JSON.stringify(newSort));
  };

  const handleReorderCollections = useCallback((newTopLevelIds) => {
    setCollections((prev) => {
      const topSet = new Set(newTopLevelIds);
      const rest = prev.filter((c) => !topSet.has(c.id));
      const reordered = newTopLevelIds
        .map((id) => prev.find((c) => c.id === id))
        .filter(Boolean);
      const next = [...reordered, ...rest];
      reorderCollections(next.map((c) => c.id)).catch(console.error);
      return next;
    });
  }, []);

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

  const handleToggleSidebar = useCallback(() => {
    setSidebarHidden((prev) => {
      const next = !prev;
      localStorage.setItem("compendie_sidebar_hidden", next);
      return next;
    });
  }, []);

  // ── Context menus ────────────────────────────────────────────────────────────

  const openCtxMenu = (e, menuItems) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, menuItems });
  };

  const handleCollectionContextMenu = (e, collection) => {
    openCtxMenu(e, [
      ...(!collection.parent_id ? [{
        label: "New folder",
        action: () => setNewFolderParentId(collection.id),
      }] : []),
      { label: "Edit…", action: () => setEditingCollection(collection) },
      { label: "Archive", action: () => handleArchiveCollection(collection.id) },
      { label: "Sort by", submenu: true,
        action: () => openCtxMenu(e, buildSortMenuItems(collectionSort, handleSortChange)),
      },
      "---",
      { label: "Delete", danger: true, action: () => handleDeleteCollection(collection.id) },
    ]);
  };

  const handleCardClick = (item) => {
    if (item.type === "flow") setFlowDetail(item);
    else setSelectedItem(item);
  };

  const handleCardContextMenu = (e, item) => {
    openCtxMenu(e, [
      {
        icon: ExternalLink, label: "Open details",
        action: () => item.type === "flow" ? setFlowDetail(item) : setSelectedItem(item),
      },
      "---",
      {
        icon: FolderPlus, label: "Add to collection", action: () => {
          const nonArchived = collections.filter((c) => !c.archived);
          setCtxMenu({
            x: e.clientX, y: e.clientY,
            menuItems: nonArchived.map((c) => ({
              checked: item.collections.includes(c.id),
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
        icon: FolderMinus, label: "Remove from collection", action: () =>
          handleUpdate(item.id, {
            collections: item.collections.filter((id) => id !== activeView.id),
          }),
      }] : []),
      "---",
      { icon: Trash2, label: "Delete", danger: true, action: () => handleDelete(item.id) },
    ]);
  };


  // ── Filtering ────────────────────────────────────────────────────────────────

  const getDescendantIds = useCallback((id) => {
    const ids = new Set([id]);
    collections.forEach((c) => { if (c.parent_id === id) ids.add(c.id); });
    return ids;
  }, [collections]);

  const allTags = useMemo(
    () => [...new Set(items.flatMap((i) => i.tags))].sort(),
    [items]
  );

  const filtered = useMemo(() => items.filter((item) => {
    if (activeView.type === "unorganized" && item.collections.length > 0) return false;
    if (activeView.type === "collection") {
      if (!item.collections.includes(activeView.id)) return false;
    }
    if (activeView.type === "tag" && !item.tags.includes(activeView.tag)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.tags.some((t) => t.includes(q))  ||
      item.note.toLowerCase().includes(q)
    );
  }), [items, activeView, search]);

  const sortedFiltered = useMemo(() => {
    if (gridSort.by === "manual") return filtered;
    return [...filtered].sort((a, b) => {
      let aVal, bVal;
      if (gridSort.by === "name") {
        aVal = (a.title || "").toLowerCase();
        bVal = (b.title || "").toLowerCase();
      } else if (gridSort.by === "date_created") {
        aVal = a.created_at || "";
        bVal = b.created_at || "";
      } else if (gridSort.by === "date_updated") {
        aVal = a.updated_at || a.created_at || "";
        bVal = b.updated_at || b.created_at || "";
      }
      if (aVal < bVal) return gridSort.dir === "asc" ? -1 : 1;
      if (aVal > bVal) return gridSort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, gridSort]);

  const handleGridSortChange = (newSort) => {
    setGridSort(newSort);
    localStorage.setItem("compendie_grid_sort", JSON.stringify(newSort));
  };

  const handleGridOptionsMenu = (e) => {
    const opt = (by, dir, label) => ({
      label,
      checked: gridSort.by === by && gridSort.dir === dir,
      action: () => handleGridSortChange({ by, dir }),
    });
    openCtxMenu(e, [
      { label: "Manual", checked: gridSort.by === "manual", action: () => handleGridSortChange({ by: "manual", dir: "asc" }) },
      "---",
      opt("name", "asc",  "Name: A → Z"),
      opt("name", "desc", "Name: Z → A"),
      "---",
      opt("date_created", "asc",  "Date Created: First"),
      opt("date_created", "desc", "Date Created: Last"),
      "---",
      opt("date_updated", "asc",  "Date Updated: First"),
      opt("date_updated", "desc", "Date Updated: Last"),
      ...(activeView.type === "collection" ? [
        "---",
        { icon: Trash2, label: "Delete Collection", danger: true, action: () => handleDeleteCollection(activeView.id) },
      ] : []),
    ]);
  };

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
          onContextMenu={handleCollectionContextMenu}
          collectionSort={collectionSort}
          onSortChange={handleSortChange}
          onReorderCollections={handleReorderCollections}
          onAddClick={() => setAddOverlayOpen(true)}
          width={sidebarWidth}
          isHidden={sidebarHidden}
          onToggleSidebar={handleToggleSidebar}
        />

      {!sidebarHidden && (
        <div
          className="sidebar-resize-handle"
          style={{ left: sidebarWidth + 8 }}
          onMouseDown={handleSidebarResizeStart}
        />
      )}

      <div className="main-area">
        <Grid
          items={sortedFiltered}
          allItems={items}
          collections={collections}
          imageUrls={imageUrls}
          search={search}
          onSearch={setSearch}
          activeView={activeView}
          onCardClick={handleCardClick}
          onCardContextMenu={handleCardContextMenu}
          onCollectionContextMenu={handleCollectionContextMenu}
          onSelectCollection={(id) => setActiveView({ type: "collection", id })}
          isDragging={isDragging}
          onReorder={handleReorder}
          onAddClick={() => setAddOverlayOpen(true)}
          onOptionsMenu={handleGridOptionsMenu}
          sidebarHidden={sidebarHidden}
          onToggleSidebar={handleToggleSidebar}
          allTags={allTags}
          onSelectTag={(tag) => setActiveView({ type: "tag", tag })}
          organizeMode={organizeMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
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
            allTags={allTags}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onClose={() => setSelectedItem(null)}
            onNavigate={setSelectedItem}
          />
        )}
      </div>


      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.menuItems}
          onClose={() => setCtxMenu(null)} />
      )}

      {editingCollection && (
        <CreateCollectionModal
          title="Edit Collection"
          initialData={editingCollection}
          onSave={async ({ name, icon, color }) => {
            await handleUpdateCollection(editingCollection.id, { name, icon, color });
            setEditingCollection(null);
          }}
          onClose={() => setEditingCollection(null)}
        />
      )}

      {newFolderParentId && (
        <CreateCollectionModal
          title="New Folder"
          onSave={async ({ name, icon, color }) => {
            await handleAddCollection({ name, icon, color, parentId: newFolderParentId });
            setNewFolderParentId(null);
          }}
          onClose={() => setNewFolderParentId(null)}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          collectionName={deleteConfirm.name}
          onConfirm={confirmDeleteCollection}
          onClose={() => setDeleteConfirm(null)}
        />
      )}

      {(addOverlayOpen || pendingFiles.length > 0) && (
        <AddOverlay
          imageFiles={pendingFiles}
          collections={collections.filter((c) => !c.archived)}
          allTags={allTags}
          onSave={handleSaveNew}
          onSaveFlow={handleSaveNewFlow}
          onCancel={() => { setPendingFiles([]); setAddOverlayOpen(false); }}
          onRemoveFile={(i) => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
          onReorderFiles={setPendingFiles}
          onAddFiles={(files) => setPendingFiles((prev) => [...prev, ...files])}
          onCreateCollection={(data) => handleAddCollection({ ...data, parentId: null })}
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
