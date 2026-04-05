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
  onAddClick,
  width,
  onResizeStart,
}) {
  const [expandedIds,      setExpandedIds]      = useState(new Set());
  const [tagsExpanded,     setTagsExpanded]     = useState(
    () => localStorage.getItem("compendie_tags_expanded") === "true"
  );
  const [archivedExpanded, setArchivedExpanded] = useState(
    () => localStorage.getItem("compendie_archived_expanded") === "true"
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
    const children     = isChild ? [] : getChildren(col.id);
    const hasKids      = children.length > 0;
    const isExpanded   = expandedIds.has(col.id);
    const isActive     = activeView.type === "collection" && activeView.id === col.id;
    return (
      <div key={col.id}>
        <div
          data-collection-id={col.id}
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
                localStorage.setItem("compendie_tags_expanded", next);
              }}
            >
              <span className="collapse-arrow">{tagsExpanded ? "▾" : "▸"}</span>
              Tags
            </button>
            {tagsExpanded && (
              <div className="tag-chips">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    className={`tag-chip${activeView.type === "tag" && activeView.tag === tag ? " active" : ""}`}
                    onClick={() => onSelectTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
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
