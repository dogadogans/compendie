import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import * as Icons from "lucide-react";
import CreateCollectionModal from "./CreateCollectionModal";
import ContextMenu from "./ContextMenu";
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

function SortableTagRow({ tag, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tag });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
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
  sidebarTags,
  onAddTag,
  onReorderTags,
  onRenameTag,
  onDeleteTag,
  onNestCollection,
  onAddCollection,
  onContextMenu,
  onAddClick,
  collectionSort,
  onSortChange,
  onReorderCollections,
  width,
  isHidden,
  onResizeStart,
  onToggleSidebar,
  theme,
  onToggleTheme,
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
  const [tagMenu, setTagMenu] = useState(null); // { tag, x, y }
  const [renamingTag, setRenamingTag] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [tagSort, setTagSort] = useState({ by: "manual", dir: "asc" });
  const [newTagOpen, setNewTagOpen] = useState(false);
  const [newTagDraft, setNewTagDraft] = useState("");
  const nestTimerRef = useRef(null);
  const [nestTargetId, setNestTargetId] = useState(null);

  const displayTags = (() => {
    const tags = sidebarTags || [];
    if (tagSort.by === "manual") return tags;
    const withCount = tags.map((tag) => ({
      tag,
      count: items.filter((i) => i.tags.includes(tag)).length,
    }));
    const dir = tagSort.dir === "asc" ? 1 : -1;
    return withCount
      .sort((a, b) => {
        if (tagSort.by === "count") return dir * (a.count - b.count);
        return dir * a.tag.localeCompare(b.tag);
      })
      .map((x) => x.tag);
  })();

  const handleTagContextMenu = (e, tag) => {
    e.preventDefault();
    e.stopPropagation();
    setTagMenu({ tag, x: e.clientX, y: e.clientY });
  };

  const commitRename = (oldTag) => {
    const cleaned = renameDraft.trim().toLowerCase();
    if (cleaned && cleaned !== oldTag) onRenameTag(oldTag, cleaned);
    setRenamingTag(null);
  };

  const commitNewTag = () => {
    const cleaned = newTagDraft.trim().toLowerCase();
    if (cleaned) onAddTag(cleaned);
    setNewTagDraft("");
    setNewTagOpen(false);
  };

  const handleTagDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ordered = sidebarTags || [];
    const oldIdx = ordered.indexOf(active.id);
    const newIdx = ordered.indexOf(over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onReorderTags(arrayMove(ordered, oldIdx, newIdx));
    setTagSort({ by: "manual", dir: "asc" });
  };

  const handleCollectionDragOver = ({ over, active }) => {
    clearTimeout(nestTimerRef.current);
    if (!over || over.id === active?.id) { setNestTargetId(null); return; }
    nestTimerRef.current = setTimeout(() => setNestTargetId(over.id), 700);
  };

  const handleCollectionDragEnd = ({ active, over }) => {
    clearTimeout(nestTimerRef.current);
    if (nestTargetId && nestTargetId !== active.id) {
      onNestCollection(active.id, nestTargetId);
      setNestTargetId(null);
      return;
    }
    setNestTargetId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = topLevel.findIndex((c) => c.id === active.id);
    const newIndex = topLevel.findIndex((c) => c.id === over.id);
    if (!isManual) onSortChange?.({ by: "manual", dir: "asc" });
    onReorderCollections(arrayMove(topLevel, oldIndex, newIndex).map((c) => c.id));
  };

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

  const toggleArchived = () => {
    const next = !archivedExpanded;
    setArchivedExpanded(next);
    localStorage.setItem("compendie_archived_expanded", next);
  };

  const renderCollection = (col, isChild = false) => {
    const children = isChild ? [] : getChildren(col.id);
    const hasKids = children.length > 0;
    const isExpanded = expandedIds.has(col.id);
    const isActive = activeView.type === "collection" && activeView.id === col.id;
    const count = getCollectionCount(col.id);

    return (
      <div key={col.id} className="collection-row-wrap">
        <div
          data-collection-id={col.id}
          className={`nav-item collection-item${isActive ? " active" : ""}${isChild ? " sub-item" : ""}${nestTargetId === col.id ? " nest-target" : ""}`}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col); }}
        >
          {isChild ? (
            <span className="sub-indent" />
          ) : (
            <span
              className={`col-icon-wrap${hasKids ? " expandable" : ""}`}
              onClick={(e) => { e.stopPropagation(); if (hasKids) toggleExpand(col.id); }}
            >
              <span className="col-icon-default">
                <ColIcon icon={col.icon} color={col.color} size={16} />
              </span>
              {hasKids && (
                <span className="col-icon-chevron">
                  {isExpanded ? <Icons.ChevronDown size={14} /> : <Icons.ChevronRight size={14} />}
                </span>
              )}
            </span>
          )}

          <span className="collection-label" onClick={() => onSelectCollection(col.id)}>
            {isChild && (
              <span className="collection-icon">
                <ColIcon icon={col.icon} color={col.color} size={16} />
              </span>
            )}
            <span className="collection-name">{col.name}</span>
          </span>
          <button
            className="collection-item-dots"
            onClick={(e) => { e.stopPropagation(); onContextMenu(e, col); }}
          >
            <Icons.MoreHorizontal size={14} />
          </button>
          {count > 0 && <span className="nav-item-count collection-count">{count}</span>}
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
      <aside
        className="sidebar"
        style={isHidden ? { width: 0, minWidth: 0, overflow: 'hidden' } : { width }}
      >

        {/* Header: app name + add */}
        <div className="sidebar-header">
          <span className="sidebar-app-name">Compendie</span>
          <div className="sidebar-header-actions">
            <button className="sidebar-icon-btn" onClick={onToggleTheme} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}
            </button>
            <button className="sidebar-icon-btn" onClick={onAddClick} title="Add">
              <Icons.Plus size={16} />
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
          <div className="sidebar-section-header-row" onClick={toggleFolders}>
            <span className="sidebar-section-label">Folders</span>
            <div className="sidebar-section-actions">
              <button
                className="sidebar-section-action-btn"
                onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
                title="New folder"
              >
                <Icons.Plus size={14} />
              </button>
              <button
                className="sidebar-section-action-btn"
                onClick={(e) => { e.stopPropagation(); toggleFolders(); }}
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleCollectionDragOver} onDragEnd={handleCollectionDragEnd}>
              <SortableContext items={topLevel.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {topLevel.map((col) => (
                  <SortableCollectionRow key={col.id} col={col}>
                    {renderCollection(col)}
                  </SortableCollectionRow>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Tags section */}
        {(displayTags.length > 0 || newTagOpen) && (
          <div className="sidebar-section">
            <div className="sidebar-section-header-row" onClick={toggleTags}>
              <span className="sidebar-section-label">Tags</span>
              <div className="sidebar-section-actions">
                <button
                  className="sidebar-section-action-btn"
                  onClick={(e) => { e.stopPropagation(); setNewTagOpen(true); setNewTagDraft(""); if (!tagsExpanded) toggleTags(); }}
                  title="New tag"
                >
                  <Icons.Plus size={14} />
                </button>
                <button
                  className="sidebar-section-action-btn"
                  onClick={(e) => { e.stopPropagation(); toggleTags(); }}
                  title={tagsExpanded ? "Collapse tags" : "Expand tags"}
                >
                  {tagsExpanded ? <Icons.ChevronDown size={14} /> : <Icons.ChevronRight size={14} />}
                </button>
              </div>
            </div>

            {tagsExpanded && (
              <>
                {/* New tag input — appears at very top */}
                {newTagOpen && (
                  <div className="nav-item">
                    <span className="nav-item-icon"><Icons.Hash size={20} /></span>
                    <input
                      className="sidebar-tag-rename-input"
                      placeholder="tag name..."
                      value={newTagDraft}
                      autoFocus
                      onChange={(e) => setNewTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") { e.preventDefault(); commitNewTag(); }
                        else if (e.key === "Escape") { e.preventDefault(); setNewTagOpen(false); setNewTagDraft(""); }
                      }}
                      onBlur={() => { if (!newTagDraft.trim()) setNewTagOpen(false); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* Draggable tag list */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTagDragEnd}>
                  <SortableContext items={displayTags} strategy={verticalListSortingStrategy}>
                    {displayTags.map((tag) => {
                      const count = items.filter((i) => i.tags.includes(tag)).length;
                      const isActive = activeView.type === "tag" && activeView.tag === tag;
                      const isRenaming = renamingTag === tag;
                      return (
                        <SortableTagRow key={tag} tag={tag}>
                          <div
                            className={`nav-item${isActive ? " active" : ""}`}
                            onClick={() => !isRenaming && onSelectTag(tag)}
                            onContextMenu={(e) => handleTagContextMenu(e, tag)}
                          >
                            <span className="nav-item-icon"><Icons.Hash size={20} /></span>
                            {isRenaming ? (
                              <input
                                className="sidebar-tag-rename-input"
                                value={renameDraft}
                                autoFocus
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === "Enter") { e.preventDefault(); commitRename(tag); }
                                  else if (e.key === "Escape") { e.preventDefault(); setRenamingTag(null); }
                                }}
                                onBlur={() => commitRename(tag)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className="nav-item-label">{tag}</span>
                            )}
                            <span className="nav-item-count">{count}</span>
                          </div>
                        </SortableTagRow>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </>
            )}
          </div>
        )}

        {/* Archived section (only when archived collections exist) */}
        {archived.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-section-header-row" onClick={toggleArchived}>
              <span className="sidebar-section-label">Archived</span>
              <div className="sidebar-section-actions">
                <button
                  className="sidebar-section-action-btn"
                  onClick={(e) => { e.stopPropagation(); toggleArchived(); }}
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

      </aside>

      {modalOpen && (
        <CreateCollectionModal
          onSave={handleModalSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {tagMenu && createPortal(
        <ContextMenu
          x={tagMenu.x}
          y={tagMenu.y}
          items={[
            {
              icon: Icons.Pencil,
              label: "Rename",
              action: () => { setRenamingTag(tagMenu.tag); setRenameDraft(tagMenu.tag); setTagMenu(null); },
            },
            {
              icon: Icons.Trash2,
              label: "Delete",
              danger: true,
              action: () => { onDeleteTag(tagMenu.tag); setTagMenu(null); },
            },
            "---",
            { icon: Icons.ArrowDownAZ,  label: "Name A→Z",  checked: tagSort.by === "name"  && tagSort.dir === "asc",  action: () => { setTagSort({ by: "name",  dir: "asc"  }); setTagMenu(null); } },
            { icon: Icons.ArrowUpAZ,    label: "Name Z→A",  checked: tagSort.by === "name"  && tagSort.dir === "desc", action: () => { setTagSort({ by: "name",  dir: "desc" }); setTagMenu(null); } },
            { icon: Icons.ArrowDown01,  label: "Count ↑",   checked: tagSort.by === "count" && tagSort.dir === "asc",  action: () => { setTagSort({ by: "count", dir: "asc"  }); setTagMenu(null); } },
            { icon: Icons.ArrowDown10,  label: "Count ↓",   checked: tagSort.by === "count" && tagSort.dir === "desc", action: () => { setTagSort({ by: "count", dir: "desc" }); setTagMenu(null); } },
            { icon: Icons.GripVertical, label: "Manual",    checked: tagSort.by === "manual",                          action: () => { setTagSort({ by: "manual", dir: "asc" }); setTagMenu(null); } },
          ]}
          onClose={() => setTagMenu(null)}
        />,
        document.body
      )}
    </>
  );
}
