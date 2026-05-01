import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { Hash } from "lucide-react";
import CreateCollectionModal from "./CreateCollectionModal";

// Renders a Lucide icon for a collection, falls back to emoji for old data.
function ColIcon({ icon, color, size = 14 }) {
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
  onSortChange,
  onReorderCollections,
  width,
  onResizeStart,
}) {
  const [expandedIds,     setExpandedIds]     = useState(new Set());
  const [tagsExpanded,    setTagsExpanded]    = useState(
    () => localStorage.getItem("compendie_tags_expanded") === "true"
  );
  const [archivedExpanded,setArchivedExpanded]= useState(
    () => localStorage.getItem("compendie_archived_expanded") === "true"
  );
  const [modalOpen,    setModalOpen]    = useState(false);

  const allTags     = [...new Set(items.flatMap((i) => i.tags))].sort();
  const topLevel = useMemo(() => {
    const cols = collections.filter((c) => !c.parent_id && !c.archived);
    if (!collectionSort || collectionSort.by === "manual") return cols;
    const dir = collectionSort.dir === "asc" ? 1 : -1;
    return [...cols].sort((a, b) => {
      if (collectionSort.by === "name")
        return dir * a.name.localeCompare(b.name);
      if (collectionSort.by === "date_created")
        return dir * (new Date(a.created_at) - new Date(b.created_at));
      if (collectionSort.by === "date_updated")
        return dir * (
          new Date(a.updated_at ?? a.created_at) -
          new Date(b.updated_at ?? b.created_at)
        );
      return 0;
    });
  }, [collections, collectionSort]);
  const archived    = collections.filter((c) => c.archived);
  const getChildren = (pid) => collections.filter((c) => c.parent_id === pid && !c.archived);
  const unorganized = items.filter((i) => i.collections.length === 0).length;

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

  const renderCollection = (col, isChild = false) => {
    const children   = isChild ? [] : getChildren(col.id);
    const hasKids    = children.length > 0;
    const isExpanded = expandedIds.has(col.id);
    const isActive   = activeView.type === "collection" && activeView.id === col.id;

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
              {hasKids ? (isExpanded ? "▾" : "▸") : ""}
            </button>
          )}
          {isChild && <span className="sub-indent">└</span>}

          <span className="collection-label" onClick={() => onSelectCollection(col.id)}>
            <span className="collection-icon">
              <ColIcon icon={col.icon} color={col.color} size={14} />
            </span>
            <span className="collection-name">{col.name}</span>
          </span>
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
        <div className="sidebar-logo">
          <span>Compendie</span>
          <button className="sidebar-add-btn" onClick={onAddClick}>+</button>
        </div>

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
            <button className="section-add-btn" onClick={() => setModalOpen(true)}>+</button>
          </div>
          {topLevel.map((col) => renderCollection(col))}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section">
              <button
                className="sidebar-collapse-header"
                onClick={() => {
                  const next = !tagsExpanded;
                  setTagsExpanded(next);
                  localStorage.setItem("compendie_tags_expanded", next);
                }}
              >
                <span className="collapse-arrow">{tagsExpanded ? "▾" : "▸"}</span>
                Tags
              </button>
              {tagsExpanded && allTags.map((tag) => {
                const count = items.filter((i) => i.tags.includes(tag)).length;
                return (
                  <button
                    key={tag}
                    className={`nav-item tag-nav-item${activeView.type === "tag" && activeView.tag === tag ? " active" : ""}`}
                    onClick={() => onSelectTag(tag)}
                  >
                    <Hash size={12} className="tag-nav-icon" />
                    <span className="tag-nav-name">{tag}</span>
                    <span className="sidebar-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Archived */}
        {archived.length > 0 && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section">
              <button
                className="sidebar-collapse-header"
                onClick={() => {
                  const next = !archivedExpanded;
                  setArchivedExpanded(next);
                  localStorage.setItem("compendie_archived_expanded", next);
                }}
              >
                <span className="collapse-arrow">{archivedExpanded ? "▾" : "▸"}</span>
                Archived
              </button>
              {archivedExpanded && archived.map((col) => (
                <div
                  key={col.id}
                  data-collection-id={col.id}
                  className={`nav-item collection-item muted${activeView.type === "collection" && activeView.id === col.id ? " active" : ""}`}
                  onClick={() => onSelectCollection(col.id)}
                  onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col); }}
                >
                  <span className="collection-icon">
                    <ColIcon icon={col.icon} color={col.color} size={14} />
                  </span>
                  <span className="collection-name">{col.name}</span>
                </div>
              ))}
            </div>
          </>
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
