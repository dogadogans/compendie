import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ExternalLink, FolderPlus, FolderMinus, Trash2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";
import { arrayMove } from "@dnd-kit/sortable";
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadCollections, addCollection, updateCollection, deleteCollection, archiveCollection,
  addFlow, updateFlow, reorderItems, reorderCollections,
  loadGlobalTags, addGlobalTag, reorderGlobalTags, bulkRenameTag, bulkDeleteTag,
} from "./store";
import AddOverlay from "./components/AddOverlay";
import ContextMenu from "./components/ContextMenu";
import Sidebar from "./components/Sidebar";
import Grid from "./components/Grid";
import DetailPanel from "./components/DetailPanel";
import FlowBuilder from "./components/FlowBuilder";
import FlowDetail from "./components/FlowDetail";
import CreateCollectionModal from "./components/CreateCollectionModal";
import AlertDialog from "./components/AlertDialog";
import ActionsDropdown  from "./components/ActionsDropdown";
import CollectionPicker from "./components/CollectionPicker";
import QuickFolderModal from "./components/QuickFolderModal";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "./components/Toast";
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
  const [globalTags,   setGlobalTags]   = useState([]);
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
  const [alertDialog, setAlertDialog] = useState(null); // { title, message, confirmLabel, onConfirm }
  const [selectedIds,       setSelectedIds]       = useState(new Set());
  const [organizeMode,      setOrganizeMode]       = useState(false);
  const [actionMenuOpen,    setActionMenuOpen]     = useState(false);
  const [pickerMode,        setPickerMode]         = useState(null); // "move" | "copy" | null
  const [quickFolderOpen,   setQuickFolderOpen]    = useState(false);
  const [collectionPickerModal, setCollectionPickerModal] = useState(null); // { prefillName, itemId }
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
  const [theme, setTheme] = useState(
    () => localStorage.getItem("compendie_theme") || "dark"
  );
  const itemsRef    = useRef(items); // always-current items for use in stable callbacks
  useEffect(() => { itemsRef.current = items; }, [items]);
  const dragCounter     = useRef(0);
  const recentDropPaths = useRef(new Set()); // dedup Tauri double-emit per path
  const recentDropTimer = useRef(null);
  const fileInputRef = useRef(null);
  const loadedIds = useRef(new Set());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("compendie_theme", theme);
  }, [theme]);

  useEffect(() => {
    loadItems().then(setItems).catch(console.error);
    loadCollections().then(setCollections).catch(console.error);
    loadGlobalTags().then(setGlobalTags).catch(console.error);
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
    if (changes.tags) {
      setGlobalTags((prev) => {
        const newOnes = changes.tags.filter((t) => !prev.includes(t));
        return newOnes.length ? [...newOnes, ...prev] : prev;
      });
    }
  }, []);

  const handleRenameTag = async (oldTag, newTag) => {
    const { items: updatedItems, globalTags: updatedGlobalTags } = await bulkRenameTag(oldTag, newTag);
    setItems(updatedItems);
    setGlobalTags(updatedGlobalTags);
    if (activeView.type === "tag" && activeView.tag === oldTag)
      setActiveView({ type: "tag", tag: newTag });
  };

  const handleDeleteTag = (tag) => {
    setAlertDialog({
      title: `Delete "#${tag}"`,
      message: "This will remove the tag from all images and flows.",
      confirmLabel: "Delete tag",
      onConfirm: async () => {
        setAlertDialog(null);
        const { items: updatedItems, globalTags: updatedGlobalTags } = await bulkDeleteTag(tag);
        setItems(updatedItems);
        setGlobalTags(updatedGlobalTags);
        if (activeView.type === "tag" && activeView.tag === tag)
          setActiveView({ type: "all" });
      },
    });
  };

  const handleAddTag = async (tag) => {
    const updated = await addGlobalTag(tag);
    setGlobalTags(updated);
  };

  const handleReorderTags = async (newOrder) => {
    const updated = await reorderGlobalTags(newOrder);
    setGlobalTags(updated);
  };

  const handleNestCollection = async (collectionId, parentId) => {
    if (collectionId === parentId) return;
    await updateCollection(collectionId, { parent_id: parentId });
    const updated = await loadCollections();
    setCollections(updated);
  };

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

  const handleAddCollection = async ({ name, icon, color, parentId }) => {
    const col = await addCollection({ name, icon, color, parentId });
    setCollections((prev) => [...prev, col]);
    return col;
  };

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

  const handleUnarchiveCollection = async (id) => {
    const updated = await updateCollection(id, { archived: false });
    setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const handleDeleteCollection = (id) => {
    const col = collections.find((c) => c.id === id);
    setAlertDialog({
      title: `Delete "${col?.name ?? ""}"`,
      message: "Your images won't be deleted — they'll stay in All and any other collections they belong to.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setAlertDialog(null);
        await deleteCollection(id);
        const removedIds = new Set([id, ...collections.filter((c) => c.parent_id === id).map((c) => c.id)]);
        setCollections((prev) => prev.filter((c) => !removedIds.has(c.id)));
        setItems((prev) => prev.map((i) => ({
          ...i,
          collections: i.collections.filter((cid) => !removedIds.has(cid)),
        })));
        if (activeView.type === "collection" && activeView.id === id)
          setActiveView({ type: "all" });
      },
    });
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

  const handleReorderSubCollections = useCallback((newSubIds) => {
    setCollections((prev) => {
      const byId = new Map(prev.map(c => [c.id, c]));
      const subSet = new Set(newSubIds);
      // Verify all IDs exist before mutating
      if (newSubIds.some(id => !byId.has(id))) return prev;
      const newSubs = newSubIds.map(id => byId.get(id));
      let subIdx = 0;
      const result = prev.map(c => subSet.has(c.id) ? newSubs[subIdx++] : c);
      reorderCollections(result.map(c => c.id)).catch(console.error);
      return result;
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
      ...(!collection.parent_id && !collection.archived ? [{
        label: "New folder",
        action: () => setNewFolderParentId(collection.id),
      }] : []),
      { label: "Edit…", action: () => setEditingCollection(collection) },
      ...(collection.archived
        ? [{ label: "Remove from Archive", action: () => handleUnarchiveCollection(collection.id) }]
        : [
            { label: "Archive", action: () => handleArchiveCollection(collection.id) },
            { label: "Sort by", submenu: true,
              action: () => openCtxMenu(e, buildSortMenuItems(collectionSort, handleSortChange)),
            },
          ]
      ),
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
            searchable: true,
            onAddNew: (name) => {
              setCollectionPickerModal({ prefillName: name, itemId: item.id });
            },
            menuItems: nonArchived.map((c) => ({
              checked: item.collections.includes(c.id),
              icon: LucideIcons[c.icon] ?? LucideIcons.Folder,
              iconColor: c.color || undefined,
              label: c.name,
              action: () => {
                const adding = !item.collections.includes(c.id);
                const next = adding
                  ? [...item.collections, c.id]
                  : item.collections.filter((id) => id !== c.id);
                handleUpdate(item.id, { collections: next });
                const label = item.title || item.image_path?.split("/").pop() || "Item";
                if (adding) toast(`${label} added to ${c.name}`);
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
      { icon: Trash2, label: "Delete", danger: true, action: () => {
        const isFlow = item.type === "flow";
        setAlertDialog({
          title: isFlow ? "Delete this flow?" : "Delete this image?",
          message: isFlow
            ? "This will permanently remove the flow and all its screens from Tome."
            : "This will permanently remove the image from Tome.",
          confirmLabel: "Delete",
          onConfirm: () => { setAlertDialog(null); handleDelete(item.id); },
        });
      }},
    ]);
  };


  // ── Filtering ────────────────────────────────────────────────────────────────

  const getDescendantIds = useCallback((id) => {
    const ids = new Set([id]);
    collections.forEach((c) => { if (c.parent_id === id) ids.add(c.id); });
    return ids;
  }, [collections]);

  const allTags = useMemo(() => {
    const fromItems = items.flatMap((i) => i.tags);
    const extra = fromItems.filter((t) => !globalTags.includes(t));
    return [...globalTags, ...new Set(extra)];
  }, [globalTags, items]);

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
    const inCollection = activeView.type === "collection";
    const collection   = inCollection ? collections.find((c) => c.id === activeView.id) : null;

    const sortItems = buildSortMenuItems(gridSort, handleGridSortChange);

    openCtxMenu(e, [
      { label: "Sort by", submenu: true, action: () => openCtxMenu(e, sortItems) },
      ...(inCollection ? [
        "---",
        { label: "Organize images/flows", action: () => { setOrganizeMode(true); setCtxMenu(null); } },
        { label: "Edit…",                 action: () => { setEditingCollection(collection); setCtxMenu(null); } },
        "---",
        { label: "Archive collection",    action: () => handleArchiveCollection(activeView.id) },
        { label: "Delete collection", danger: true, action: () => handleDeleteCollection(activeView.id) },
      ] : []),
    ]);
  };

  // Stable callbacks for selection bar — must be outside JSX to satisfy Rules of Hooks
  const handleClosePickerMode = useCallback(() => setPickerMode(null), []);
  const handleCloseActionMenu = useCallback(() => setActionMenuOpen(false), []);

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
          sidebarTags={allTags}
          onAddTag={handleAddTag}
          onReorderTags={handleReorderTags}
          onRenameTag={handleRenameTag}
          onDeleteTag={handleDeleteTag}
          onNestCollection={handleNestCollection}
          onAddCollection={handleAddCollection}
          onContextMenu={handleCollectionContextMenu}
          collectionSort={collectionSort}
          onSortChange={handleSortChange}
          onReorderCollections={handleReorderCollections}
          onAddClick={() => setAddOverlayOpen(true)}
          width={sidebarWidth}
          isHidden={sidebarHidden}
          onToggleSidebar={handleToggleSidebar}
          theme={theme}
          onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}
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
          onReorderSubCollections={handleReorderSubCollections}
          onAddClick={() => setAddOverlayOpen(true)}
          onOptionsMenu={handleGridOptionsMenu}
          sidebarHidden={sidebarHidden}
          onToggleSidebar={handleToggleSidebar}
          detailOpen={!!selectedItem}
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
            onDelete={(id) => {
              const it = itemsRef.current.find((i) => i.id === id);
              setAlertDialog({
                title: it?.type === "flow" ? "Delete this flow?" : "Delete this image?",
                message: it?.type === "flow"
                  ? "This will permanently remove the flow and all its screens from Tome."
                  : "This will permanently remove the image from Tome.",
                confirmLabel: "Delete",
                onConfirm: () => { setAlertDialog(null); handleDelete(id); },
              });
            }}
            onClose={() => setSelectedItem(null)}
            onNavigate={setSelectedItem}
            onCreateCollection={(data) => handleAddCollection({ ...data, parentId: null })}
            onAddNewCollection={(name) => setCollectionPickerModal({ prefillName: name, itemId: selectedItem.id })}
          />
        )}

        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              className="selection-bar"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
            >
              <span className="selection-bar-count">{selectedIds.size} Selected</span>
              <button className="selection-bar-clear" onClick={handleClearSelection}>×</button>
              <div className="selection-bar-actions-wrap">
                <button
                  className="selection-bar-btn"
                  onClick={() => {
                    setPickerMode(null);
                    setActionMenuOpen((v) => !v);
                  }}
                >
                  ⌘ Actions
                </button>
                {actionMenuOpen && (
                  <ActionsDropdown
                    inCollection={activeView.type === "collection"}
                    onMoveTo={() => { setActionMenuOpen(false); setPickerMode("move"); }}
                    onCopyTo={() => { setActionMenuOpen(false); setPickerMode("copy"); }}
                    onNewFolder={() => { setActionMenuOpen(false); setQuickFolderOpen(true); }}
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
                )}
                {pickerMode && (
                  <CollectionPicker
                    mode={pickerMode}
                    collections={collections}
                    selectedIds={selectedIds}
                    items={items}
                    onPick={pickerMode === "move" ? handleBulkMove : handleBulkCopy}
                    onClose={handleClosePickerMode}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.menuItems}
          searchable={ctxMenu.searchable}
          onAddNew={ctxMenu.onAddNew}
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

      {collectionPickerModal && (
        <CreateCollectionModal
          initialData={{ name: collectionPickerModal.prefillName, icon: "Folder", color: "#f0b429" }}
          onSave={async ({ name, icon, color }) => {
            const col = await handleAddCollection({ name, icon, color, parentId: null });
            const target = items.find((i) => i.id === collectionPickerModal.itemId);
            if (target) {
              await handleUpdate(collectionPickerModal.itemId, {
                collections: [...target.collections, col.id],
              });
              const label = target.title || target.image_path?.split("/").pop() || "Item";
              toast(`${label} added to ${col.name}`);
            }
            setCollectionPickerModal(null);
          }}
          onClose={() => setCollectionPickerModal(null)}
        />
      )}

      <Toaster />

      {alertDialog && (
        <AlertDialog
          title={alertDialog.title}
          message={alertDialog.message}
          confirmLabel={alertDialog.confirmLabel}
          onConfirm={alertDialog.onConfirm}
          onClose={() => setAlertDialog(null)}
        />
      )}

      {quickFolderOpen && activeView.type === "collection" && (
        <QuickFolderModal
          parentCollectionName={collections.find((c) => c.id === activeView.id)?.name ?? ""}
          itemCount={selectedIds.size}
          onSave={handleQuickNewFolder}
          onClose={() => setQuickFolderOpen(false)}
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
          collections={collections}
          allTags={allTags}
          onUpdate={handleUpdate}
          onDelete={(id) => {
            setAlertDialog({
              title: "Delete this flow?",
              message: "This will permanently remove the flow and all its screens from Tome.",
              confirmLabel: "Delete",
              onConfirm: () => { setAlertDialog(null); handleDelete(id); },
            });
          }}
          onClose={() => setFlowDetail(null)}
          onAddNewCollection={(name) => setCollectionPickerModal({ prefillName: name, itemId: flowDetail.id })}
        />
      )}

    </div>
  );
}
