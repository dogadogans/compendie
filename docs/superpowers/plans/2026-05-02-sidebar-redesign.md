# Sidebar Redesign + Hide/Show Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the sidebar with a dark noise-textured visual style, icon-forward nav items, collapsible sections with hover-reveal actions, and a hide/show toggle that integrates into the top toolbar.

**Architecture:** Four targeted file edits — CSS first (so JSX can reference classes immediately), then Sidebar.jsx (full JSX redesign, all logic preserved), then App.jsx (state + wiring), then Grid.jsx (toolbar panel button). No new files, no new dependencies.

**Tech Stack:** React, Lucide-react (already installed), CSS custom properties, dnd-kit (existing)

---

## Task 1: Replace sidebar CSS in App.css

**Files:**
- Modify: `src/App.css` (three separate replacements)

This task replaces three stale CSS blocks with the new visual system. All new class names are defined here before the JSX uses them.

- [ ] **Step 1: Replace the first sidebar CSS block (lines 129–277)**

Find this exact block (starts after `.app { ... }`, ends before `/* ── Main area */`):

```css
/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.sidebar {
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  min-width: 200px;
  max-width: 340px;
}

.sidebar-logo {
  padding: 18px 16px 14px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-add-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  color: var(--text-muted);
  padding: 0 2px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}
.sidebar-add-btn:hover {
  color: var(--text);
  background: var(--hover);
}

/* ── Sidebar nav ─────────────────────────────────────────────────────────── */
.sidebar-nav {
  padding: 8px 8px 4px;
}

.nav-item {
  all: unset;
  cursor: pointer;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--muted);
  transition: background 0.1s, color 0.1s;
  box-sizing: border-box;
}
.nav-item:hover { background: var(--accent-bg); color: var(--text); }
.nav-item.active { background: var(--accent-bg); color: var(--text); font-weight: 500; }

/* ── Sidebar sections (Folders / Tags) ───────────────────────────────────── */
.sidebar-section {
  padding: 12px 8px 4px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}

.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

.section-add-btn {
  all: unset;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: var(--muted);
  padding: 0 2px;
  border-radius: 4px;
  transition: color 0.1s, background 0.1s;
}
.section-add-btn:hover { color: var(--text); background: var(--accent-bg); }

/* ── Folder items ────────────────────────────────────────────────────────── */
.folder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 4px;
}

.folder-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.folder-actions {
  display: none;
  gap: 2px;
  flex-shrink: 0;
}
.folder-item:hover .folder-actions { display: flex; }

.folder-action-btn {
  all: unset;
  cursor: pointer;
  font-size: 13px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--muted);
  transition: color 0.1s, background 0.1s;
}
.folder-action-btn:hover { background: var(--border); color: var(--text); }
.folder-action-btn.danger:hover { background: var(--danger-bg); color: var(--danger); }

.folder-new-row {
  padding: 2px 4px 4px;
}

.folder-name-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg);
  color: var(--text);
  outline: none;
```

Replace with:

```css
/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.sidebar {
  flex-shrink: 0;
  border-right: 1px solid rgba(169, 169, 169, 0.2);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  min-width: 200px;
  max-width: 340px;
}

.sidebar::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}

/* ── Sidebar header ───────────────────────────────────────────────────────── */
.sidebar-header {
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.sidebar-app-name {
  font-size: 14px;
  font-weight: 600;
  color: #D6D6D6;
  letter-spacing: -0.01em;
}

.sidebar-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.sidebar-icon-btn {
  all: unset;
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--muted);
  transition: background 0.1s, color 0.1s;
}
.sidebar-icon-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

/* ── Sidebar nav ─────────────────────────────────────────────────────────── */
.sidebar-nav {
  padding: 0 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  position: relative;
  z-index: 1;
}

.nav-item {
  all: unset;
  cursor: pointer;
  display: flex;
  align-items: center;
  width: 100%;
  gap: 6px;
  padding: 4px 6px;
  height: 40px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
  color: #F5F5F5;
  transition: background 0.1s;
  box-sizing: border-box;
}
.nav-item:hover { background: rgba(255, 255, 255, 0.04); }
.nav-item.active { background: rgba(255, 255, 255, 0.05); }

.nav-item-icon {
  flex-shrink: 0;
  color: var(--muted);
  display: flex;
  align-items: center;
}

.nav-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item-count {
  font-size: 14px;
  color: #A5A5A5;
  flex-shrink: 0;
}

/* ── Sidebar sections ────────────────────────────────────────────────────── */
.sidebar-section {
  padding: 4px 8px;
  position: relative;
  z-index: 1;
}

.sidebar-section + .sidebar-section {
  border-top: 1px solid rgba(67, 67, 67, 0.3);
  margin-top: 4px;
  padding-top: 8px;
}

.sidebar-section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 6px;
  border-radius: 8px;
  transition: background 0.1s;
  margin-bottom: 2px;
}
.sidebar-section-header-row:hover {
  background: rgba(255, 255, 255, 0.03);
}
.sidebar-section-header-row:hover .sidebar-section-actions {
  opacity: 1;
}

.sidebar-section-label {
  font-size: 12px;
  font-weight: 600;
  color: #F5F5F5;
  letter-spacing: 0.01em;
  flex: 1;
}

.sidebar-section-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.1s;
}

.sidebar-section-action-btn {
  all: unset;
  cursor: pointer;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #A5A5A5;
  transition: background 0.1s, color 0.1s;
}
.sidebar-section-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #F5F5F5;
}

/* placeholder — was folder-name-input */
.folder-name-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg);
  color: var(--text);
  outline: none;
```

- [ ] **Step 2: Replace the second sidebar CSS block (lines 812–945)**

Find:

```css
/* ── Sidebar (new collections system) ───────────────────────── */

.sidebar-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.collection-item {
  gap: 2px;
  cursor: default;
}

.expand-btn {
  all: unset;
  cursor: pointer;
  font-size: 0.65rem;
  width: 14px;
  flex-shrink: 0;
  line-height: 1;
  color: var(--muted);
  text-align: center;
}
.expand-btn.invisible { visibility: hidden; }
.expand-btn:hover { color: var(--text); }

.collection-label {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  overflow: hidden;
  cursor: pointer;
}
.collection-icon { flex-shrink: 0; }
.collection-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-item { padding-left: 4px; }
.sub-indent { color: var(--muted); font-size: 0.75rem; flex-shrink: 0; }
.sub-collections { padding-left: 10px; }

.collection-new-row { padding: 2px 4px; }

.collection-name-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 3px 6px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg);
  color: var(--text);
  outline: none;
}
.collection-name-input:focus { border-color: var(--focus-border); }

.sidebar-collapse-header {
  all: unset;
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  cursor: pointer;
  padding: 4px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
  border-radius: 4px;
  box-sizing: border-box;
}
.sidebar-collapse-header:hover { color: var(--text); background: var(--accent-bg); }
.collapse-arrow { font-size: 0.6rem; }
```

Replace with:

```css
/* ── Sidebar collection items ────────────────────────────────────────────── */

.collection-item {
  gap: 4px;
  cursor: default;
}

.expand-btn {
  all: unset;
  cursor: pointer;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #A5A5A5;
  transition: color 0.1s;
}
.expand-btn.invisible { visibility: hidden; }
.expand-btn:hover { color: var(--text); }

.collection-label {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
  cursor: pointer;
  min-width: 0;
}

.collection-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.collection-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: #F5F5F5;
}

.sub-item { padding-left: 20px; }
.sub-indent { width: 16px; flex-shrink: 0; }
.sub-collections { padding-left: 4px; }

.nav-item.muted { color: var(--muted); }
```

Then find (still in block 2, after the collapse-arrow rule):

```css
.sidebar-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--muted);
  background: var(--accent-bg);
  border-radius: 8px;
  padding: 1px 5px;
}

.nav-item.muted { color: var(--muted); }

.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}
.sidebar-resize-handle:hover { background: var(--border); }
```

Replace with:

```css
.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}
.sidebar-resize-handle:hover { background: rgba(255,255,255,0.05); }
```

- [ ] **Step 3: Replace the tag-nav CSS block**

Find:

```css
/* ── Tag nav items (sidebar) ─────────────────────────────────────────────── */
.tag-nav-item {
  gap: 6px;
}

.tag-nav-icon {
  flex-shrink: 0;
  color: var(--muted);
}

.tag-nav-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Replace with:

```css
/* ── Tag nav items (sidebar) — layout inherited from .nav-item ───────────── */
```

- [ ] **Step 4: Verify CSS compiles — start the dev server**

```bash
npm run tauri dev
```

App should launch without console errors. The sidebar will look broken until Task 2 updates the JSX — that's expected. Confirm no CSS parse errors in the browser devtools console.

- [ ] **Step 5: Commit**

```bash
git add src/App.css
git commit -m "style: replace sidebar CSS with new visual system"
```

---

## Task 2: Redesign Sidebar.jsx

**Files:**
- Modify: `src/components/Sidebar.jsx` (full JSX rewrite, all logic preserved)

Replace the entire file with the following. All existing logic (DnD, modal, sorting, context menu, expand/collapse) is preserved; only the JSX structure and new state are changed.

- [ ] **Step 1: Replace the full file content**

```jsx
import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import CreateCollectionModal from "./CreateCollectionModal";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableCollectionRow({ col, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...(disabled ? {} : { ...attributes, ...listeners })}
    >
      {children}
    </div>
  );
}

function ColIcon({ icon, color, size = 16 }) {
  const Ic = Icons[icon];
  if (Ic) return <Ic size={size} color={color || "var(--muted)"} />;
  return <span style={{ fontSize: size }}>{icon}</span>;
}

export default function Sidebar({
  collections,
  items,
  activeView,
  onSelectAll,
  onSelectUnorganized,
  onSelectCollection,
  onSelectTag,
  onAddCollection,
  onContextMenu,
  onAddClick,
  collectionSort,
  onReorderCollections,
  width,
  onResizeStart,
  onToggleSidebar,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [foldersCollapsed, setFoldersCollapsed] = useState(
    () => localStorage.getItem("compendie_folders_collapsed") === "true"
  );
  const [tagsExpanded, setTagsExpanded] = useState(
    () => localStorage.getItem("compendie_tags_expanded") === "true"
  );
  const [archivedExpanded, setArchivedExpanded] = useState(
    () => localStorage.getItem("compendie_archived_expanded") === "true"
  );
  const [modalOpen, setModalOpen] = useState(false);

  const allTags = [...new Set(items.flatMap((i) => i.tags))].sort();

  const topLevel = useMemo(() => {
    const cols = collections.filter((c) => !c.parent_id && !c.archived);
    if (!collectionSort || collectionSort.by === "manual") return cols;
    const dir = collectionSort.dir === "asc" ? 1 : -1;
    return [...cols].sort((a, b) => {
      if (collectionSort.by === "name") return dir * a.name.localeCompare(b.name);
      if (collectionSort.by === "date_created") return dir * (new Date(a.created_at) - new Date(b.created_at));
      if (collectionSort.by === "date_updated")
        return dir * (new Date(a.updated_at ?? a.created_at) - new Date(b.updated_at ?? b.created_at));
      return 0;
    });
  }, [collections, collectionSort]);

  const archived = collections.filter((c) => c.archived);
  const getChildren = (pid) => collections.filter((c) => c.parent_id === pid && !c.archived);
  const unorganized = items.filter((i) => i.collections.length === 0).length;
  const getCollectionCount = (colId) => items.filter((i) => i.collections?.includes(colId)).length;
  const isManual = !collectionSort || collectionSort.by === "manual";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = topLevel.findIndex((c) => c.id === active.id);
    const newIndex = topLevel.findIndex((c) => c.id === over.id);
    onReorderCollections(arrayMove(topLevel, oldIndex, newIndex).map((c) => c.id));
  };

  const handleModalSave = async ({ name, icon, color }) => {
    await onAddCollection({ name, icon, color, parentId: null });
    setModalOpen(false);
  };

  const toggleExpand = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleFolders = () => {
    const next = !foldersCollapsed;
    setFoldersCollapsed(next);
    localStorage.setItem("compendie_folders_collapsed", next);
  };

  const toggleTags = () => {
    const next = !tagsExpanded;
    setTagsExpanded(next);
    localStorage.setItem("compendie_tags_expanded", next);
  };

  const renderCollection = (col, isChild = false) => {
    const children = isChild ? [] : getChildren(col.id);
    const hasKids = children.length > 0;
    const isExpanded = expandedIds.has(col.id);
    const isActive = activeView.type === "collection" && activeView.id === col.id;
    const count = getCollectionCount(col.id);

    return (
      <div key={col.id}>
        <div
          data-collection-id={col.id}
          className={`nav-item collection-item${isActive ? " active" : ""}${isChild ? " sub-item" : ""}`}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col); }}
        >
          {!isChild && (
            <button
              className={`expand-btn${hasKids ? "" : " invisible"}`}
              onClick={(e) => { e.stopPropagation(); if (hasKids) toggleExpand(col.id); }}
              tabIndex={-1}
            >
              {hasKids && (isExpanded
                ? <Icons.ChevronDown size={14} />
                : <Icons.ChevronRight size={14} />
              )}
            </button>
          )}
          {isChild && <span className="sub-indent" />}

          <span className="collection-label" onClick={() => onSelectCollection(col.id)}>
            <span className="collection-icon">
              <ColIcon icon={col.icon} color={col.color} size={16} />
            </span>
            <span className="collection-name">{col.name}</span>
          </span>
          {count > 0 && <span className="nav-item-count">{count}</span>}
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
    <>
      <aside className="sidebar" style={{ width }}>

        {/* Header: app name + add + hide */}
        <div className="sidebar-header">
          <span className="sidebar-app-name">Compendie</span>
          <div className="sidebar-header-actions">
            <button className="sidebar-icon-btn" onClick={onAddClick} title="Add">
              <Icons.Plus size={16} />
            </button>
            <button className="sidebar-icon-btn" onClick={onToggleSidebar} title="Hide sidebar">
              <Icons.PanelLeftClose size={16} />
            </button>
          </div>
        </div>

        {/* Top nav: All + Unorganized */}
        <nav className="sidebar-nav">
          <button
            className={`nav-item${activeView.type === "all" ? " active" : ""}`}
            onClick={onSelectAll}
          >
            <span className="nav-item-icon"><Icons.Images size={20} /></span>
            <span className="nav-item-label">All</span>
            <span className="nav-item-count">{items.length}</span>
          </button>
          <button
            className={`nav-item${activeView.type === "unorganized" ? " active" : ""}`}
            onClick={onSelectUnorganized}
          >
            <span className="nav-item-icon"><Icons.Inbox size={20} /></span>
            <span className="nav-item-label">Unorganized</span>
            {unorganized > 0 && <span className="nav-item-count">{unorganized}</span>}
          </button>
        </nav>

        {/* Folders section */}
        <div className="sidebar-section">
          <div className="sidebar-section-header-row">
            <span className="sidebar-section-label">Folders</span>
            <div className="sidebar-section-actions">
              <button
                className="sidebar-section-action-btn"
                onClick={() => setModalOpen(true)}
                title="New folder"
              >
                <Icons.Plus size={14} />
              </button>
              <button
                className="sidebar-section-action-btn"
                onClick={toggleFolders}
                title={foldersCollapsed ? "Expand folders" : "Collapse folders"}
              >
                {foldersCollapsed
                  ? <Icons.ChevronRight size={14} />
                  : <Icons.ChevronDown size={14} />
                }
              </button>
            </div>
          </div>

          {!foldersCollapsed && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={topLevel.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {topLevel.map((col) => (
                  <SortableCollectionRow key={col.id} col={col} disabled={!isManual}>
                    {renderCollection(col)}
                  </SortableCollectionRow>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Tags section (only when tags exist) */}
        {allTags.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-header-row">
              <span className="sidebar-section-label">Tags</span>
              <div className="sidebar-section-actions">
                <button
                  className="sidebar-section-action-btn"
                  onClick={onAddClick}
                  title="Add image"
                >
                  <Icons.Plus size={14} />
                </button>
                <button
                  className="sidebar-section-action-btn"
                  onClick={toggleTags}
                  title={tagsExpanded ? "Collapse tags" : "Expand tags"}
                >
                  {tagsExpanded
                    ? <Icons.ChevronDown size={14} />
                    : <Icons.ChevronRight size={14} />
                  }
                </button>
              </div>
            </div>
            {tagsExpanded && allTags.map((tag) => {
              const count = items.filter((i) => i.tags.includes(tag)).length;
              return (
                <button
                  key={tag}
                  className={`nav-item${activeView.type === "tag" && activeView.tag === tag ? " active" : ""}`}
                  onClick={() => onSelectTag(tag)}
                >
                  <span className="nav-item-icon"><Icons.Hash size={20} /></span>
                  <span className="nav-item-label">{tag}</span>
                  <span className="nav-item-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Archived section (only when archived collections exist) */}
        {archived.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-header-row">
              <span className="sidebar-section-label">Archived</span>
              <div className="sidebar-section-actions">
                <button
                  className="sidebar-section-action-btn"
                  onClick={() => {
                    const next = !archivedExpanded;
                    setArchivedExpanded(next);
                    localStorage.setItem("compendie_archived_expanded", next);
                  }}
                  title={archivedExpanded ? "Collapse archived" : "Expand archived"}
                >
                  {archivedExpanded
                    ? <Icons.ChevronDown size={14} />
                    : <Icons.ChevronRight size={14} />
                  }
                </button>
              </div>
            </div>
            {archivedExpanded && archived.map((col) => (
              <div
                key={col.id}
                data-collection-id={col.id}
                className={`nav-item collection-item muted${activeView.type === "collection" && activeView.id === col.id ? " active" : ""}`}
                onClick={() => onSelectCollection(col.id)}
                onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col); }}
              >
                <span className="collection-icon">
                  <ColIcon icon={col.icon} color={col.color} size={16} />
                </span>
                <span className="nav-item-label">{col.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
      </aside>

      {modalOpen && (
        <CreateCollectionModal
          onSave={handleModalSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Visual check**

With the dev server running, verify:
- Header shows "Compendie" + two icon buttons (Plus, PanelLeftClose)
- "All" row has a photo-stack icon + item count on right
- "Unorganized" row has an inbox icon + count (if > 0)
- "Folders" section header shows on hover: Plus button + Chevron
- Clicking the chevron collapses/expands folder list
- Clicking Plus in Folders header opens the create-collection modal
- Collection rows show item count on right
- Expand arrows on parent collections are now Lucide chevrons (not `▸` text)
- Tags section (if tags exist) shows chevron + Plus on hover, expands on click
- Noise texture is faintly visible on the sidebar background

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: redesign sidebar — icons, counts, collapsible sections, new header"
```

---

## Task 3: Wire sidebar hide/show in App.jsx

**Files:**
- Modify: `src/App.jsx`

Four targeted edits: import, state, callback, render.

- [ ] **Step 1: Add PanelLeft to the lucide import**

Find:

```js
import { ExternalLink, FolderPlus, FolderMinus, Trash2 } from "lucide-react";
```

Replace with:

```js
import { ExternalLink, FolderPlus, FolderMinus, Trash2, PanelLeft } from "lucide-react";
```

- [ ] **Step 2: Add sidebarHidden state**

Find (after the `sidebarWidth` useState, around line 80):

```js
  const [sidebarWidth, setSidebarWidth] = useState(
    () => parseInt(localStorage.getItem("compendie_sidebar_width") || "240")
  );
```

Replace with:

```js
  const [sidebarWidth, setSidebarWidth] = useState(
    () => parseInt(localStorage.getItem("compendie_sidebar_width") || "240")
  );
  const [sidebarHidden, setSidebarHidden] = useState(
    () => localStorage.getItem("compendie_sidebar_hidden") === "true"
  );
```

- [ ] **Step 3: Add handleToggleSidebar callback**

Find (after `handleSidebarResizeStart`, around line 335):

```js
  }, [sidebarWidth]);

  // ── Context menus ────────────────────────────────────────────────────────────
```

Replace with:

```js
  }, [sidebarWidth]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarHidden((prev) => {
      const next = !prev;
      localStorage.setItem("compendie_sidebar_hidden", next);
      return next;
    });
  }, []);

  // ── Context menus ────────────────────────────────────────────────────────────
```

- [ ] **Step 4: Wrap Sidebar in conditional render and pass new props**

Find:

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
        onContextMenu={handleCollectionContextMenu}
        collectionSort={collectionSort}
        onSortChange={handleSortChange}
        onReorderCollections={handleReorderCollections}
        onAddClick={() => setAddOverlayOpen(true)}
        width={sidebarWidth}
        onResizeStart={handleSidebarResizeStart}
      />
```

Replace with:

```jsx
      {!sidebarHidden && (
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
          onResizeStart={handleSidebarResizeStart}
          onToggleSidebar={handleToggleSidebar}
        />
      )}
```

- [ ] **Step 5: Pass sidebarHidden + onToggleSidebar to Grid**

Find:

```jsx
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
          onSelectCollection={(id) => setActiveView({ type: "collection", id })}
          isDragging={isDragging}
          onReorder={handleReorder}
          onAddClick={() => setAddOverlayOpen(true)}
          onOptionsMenu={handleGridOptionsMenu}
        />
```

Replace with:

```jsx
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
          onSelectCollection={(id) => setActiveView({ type: "collection", id })}
          isDragging={isDragging}
          onReorder={handleReorder}
          onAddClick={() => setAddOverlayOpen(true)}
          onOptionsMenu={handleGridOptionsMenu}
          sidebarHidden={sidebarHidden}
          onToggleSidebar={handleToggleSidebar}
        />
```

- [ ] **Step 6: Visual check**

Click the `PanelLeftClose` button (top-right of sidebar header). The sidebar should disappear completely and the content area should expand to fill the full width. Refreshing the page should keep the sidebar hidden (localStorage persisted). App should not throw any console errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add sidebar hide/show state and wiring"
```

---

## Task 4: Add show-sidebar button to Grid.jsx toolbar

**Files:**
- Modify: `src/components/Grid.jsx`

When the sidebar is hidden, a `PanelLeft` icon button is prepended to the toolbar-left, before the folder icon and view name.

- [ ] **Step 1: Add a PanelLeftIcon SVG helper**

Find (after the `SearchIcon` function, around line 59):

```jsx
export default function Grid({
```

Insert before that line:

```jsx
function PanelLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2.33398V13.6673" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 8C2 5.17157 2 3.75736 2.87868 2.87868C3.75736 2 5.17157 2 8 2C10.8284 2 12.2426 2 13.1213 2.87868C14 3.75736 14 5.17157 14 8C14 10.8284 14 12.2426 13.1213 13.1213C12.2426 14 10.8284 14 8 14C5.17157 14 3.75736 14 2.87868 13.1213C2 12.2426 2 10.8284 2 8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

```

- [ ] **Step 2: Add sidebarHidden and onToggleSidebar to Grid props**

Find:

```jsx
export default function Grid({
  items,
  allItems = [],
  collections = [],
  imageUrls,
  search,
  onSearch,
  activeView,
  onCardClick,
  onCardContextMenu,
  onSelectCollection,
  isDragging,
  onReorder,
  onAddClick,
  onOptionsMenu,
}) {
```

Replace with:

```jsx
export default function Grid({
  items,
  allItems = [],
  collections = [],
  imageUrls,
  search,
  onSearch,
  activeView,
  onCardClick,
  onCardContextMenu,
  onSelectCollection,
  isDragging,
  onReorder,
  onAddClick,
  onOptionsMenu,
  sidebarHidden,
  onToggleSidebar,
}) {
```

- [ ] **Step 3: Prepend panel button to toolbar-left**

Find:

```jsx
        {/* Left: view icon + name + count + add button */}
        <div className="toolbar-left">
          <span className="toolbar-view-icon"><FolderIcon /></span>
          <span className="toolbar-view-name">{viewLabel}</span>
          <span className="toolbar-view-count">{viewCount}</span>
          <button className="btn-icon" onClick={onAddClick} title="Add image">
            <PlusIcon />
          </button>
        </div>
```

Replace with:

```jsx
        {/* Left: optional sidebar toggle + view icon + name + count + add button */}
        <div className="toolbar-left">
          {sidebarHidden && (
            <button className="btn-icon" onClick={onToggleSidebar} title="Show sidebar">
              <PanelLeftIcon />
            </button>
          )}
          <span className="toolbar-view-icon"><FolderIcon /></span>
          <span className="toolbar-view-name">{viewLabel}</span>
          <span className="toolbar-view-count">{viewCount}</span>
          <button className="btn-icon" onClick={onAddClick} title="Add image">
            <PlusIcon />
          </button>
        </div>
```

- [ ] **Step 4: Visual check**

With sidebar hidden (from Task 3): confirm the PanelLeft icon button appears at the far left of the toolbar. Clicking it shows the sidebar again. With sidebar visible: confirm the button is gone from the toolbar. Toggle a few times to make sure the state persists correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/Grid.jsx
git commit -m "feat: show panel toggle in toolbar when sidebar is hidden"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Noise texture → Task 1 `.sidebar::before`
  - Dark `#1A1A1A` background → already `var(--surface)`, unchanged
  - Right border lightened → Task 1 `rgba(169, 169, 169, 0.2)`
  - Header: app name + Plus + PanelLeftClose → Task 2
  - Nav items with icons + counts → Task 2
  - "Folders" section: collapse + add on hover → Task 2 + Task 1 CSS
  - "Tags" section: collapse + add on hover → Task 2 + Task 1 CSS
  - "Archived" section: collapse only → Task 2
  - Collection rows with counts → Task 2 `getCollectionCount`
  - Expand arrows → Lucide chevrons → Task 2
  - `sidebarHidden` state + localStorage → Task 3
  - `PanelLeftClose` closes sidebar → Task 2 (button) + Task 3 (handler)
  - `PanelLeft` in toolbar opens sidebar → Task 4
  - Sidebar width freed when hidden → Task 3 (conditional render, not CSS hide)

- [x] **No placeholders** — all steps contain exact code
- [x] **Type consistency** — `onToggleSidebar` prop name is consistent across Task 2 (Sidebar accepts it), Task 3 (App passes it), Task 4 (Grid accepts + calls it)
- [x] **`getCollectionCount`** defined in Task 2 Sidebar, used in `renderCollection` in same file
- [x] **`foldersCollapsed` localStorage key** `"compendie_folders_collapsed"` — set and read in Task 2
