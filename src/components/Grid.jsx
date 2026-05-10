import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable } from "@dnd-kit/sortable";
import * as Icons from "lucide-react";
import FlowCard from "./FlowCard";
import SortableCard from "./SortableCard";
import useMasonryLayout from "../hooks/useMasonryLayout";

function SubColIcon({ icon, color, size = 18 }) {
  const Ic = Icons[icon];
  if (Ic) return <Ic size={size} color={color || "var(--muted)"} />;
  return <span style={{ fontSize: size }}>{icon || "📁"}</span>;
}

function SortableSubfolderCard({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX ?? 1}) scaleY(${transform.scaleY ?? 1})` : undefined,
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        touchAction: "none",
      }}
    >
      {children}
    </div>
  );
}

const ZOOM_MIN = 150;
const ZOOM_MAX = 500;
const ZOOM_STEP = 20;
const ZOOM_DEFAULT = 220;

function clampZoom(v) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
}

function loadZoom() {
  const saved = parseInt(localStorage.getItem("tome-zoom"), 10);
  return isNaN(saved) ? ZOOM_DEFAULT : clampZoom(saved);
}


function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="4" cy="8" r="1.25" fill="currentColor"/>
      <circle cx="8" cy="8" r="1.25" fill="currentColor"/>
      <circle cx="12" cy="8" r="1.25" fill="currentColor"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  );
}

function PanelLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 2.33398V13.6673" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 8C2 5.17157 2 3.75736 2.87868 2.87868C3.75736 2 5.17157 2 8 2C10.8284 2 12.2426 2 13.1213 2.87868C14 3.75736 14 5.17157 14 8C14 10.8284 14 12.2426 13.1213 13.1213C12.2426 14 10.8284 14 8 14C5.17157 14 3.75736 14 2.87868 13.1213C2 12.2426 2 10.8284 2 8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function SearchBox({ search, onSearch, collections = [], allItems = [], allTags = [], onSelectCollection, onSelectTag }) {
  const [open,      setOpen]      = useState(false);
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0, width: 0 });
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  const q = search.trim().toLowerCase();

  const matchedCollections = useMemo(() => {
    if (!q) return [];
    return collections.filter(c => !c.archived && c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [q, collections]);

  const matchedTags = useMemo(() => {
    if (!q) return [];
    return allTags
      .filter(t => t.includes(q))
      .map(t => ({ tag: t, count: allItems.filter(i => i.tags.includes(t)).length }))
      .slice(0, 8);
  }, [q, allTags, allItems]);

  const hasResults   = matchedCollections.length > 0 || matchedTags.length > 0;
  const showDropdown = open && q.length > 0 && hasResults;
  const totalItems   = matchedCollections.length + matchedTags.length;

  const calcPos = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    calcPos();
    window.addEventListener("resize", calcPos);
    return () => window.removeEventListener("resize", calcPos);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset keyboard selection whenever the query changes
  useEffect(() => { setActiveIdx(-1); }, [q]);

  const selectByIdx = (idx) => {
    if (idx < 0 || idx >= totalItems) return;
    if (idx < matchedCollections.length) {
      onSelectCollection(matchedCollections[idx].id);
    } else {
      onSelectTag(matchedTags[idx - matchedCollections.length].tag);
    }
    onSearch("");
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      if (!search) inputRef.current?.blur();
      return;
    }
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      selectByIdx(activeIdx);
    }
  };

  return (
    <div className="search-wrapper" ref={wrapRef}>
      <span className="search-icon-left"><SearchIcon /></span>
      <input
        ref={inputRef}
        className={`search-input${search ? " search-input--has-clear" : ""}`}
        type="text"
        placeholder="Search…"
        value={search}
        onChange={(e) => { onSearch(e.target.value); setOpen(true); calcPos(); }}
        onFocus={() => { setOpen(true); calcPos(); }}
        onKeyDown={handleKeyDown}
      />
      {search && (
        <button
          className="search-clear-btn"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); onSearch(""); setOpen(false); inputRef.current?.focus(); }}
        >
          <ClearIcon />
        </button>
      )}
      {showDropdown && createPortal(
        <div className="search-dropdown" style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}>
          {matchedCollections.length > 0 && (
            <div className="search-dd-group">
              <div className="search-dd-section-header">Collections</div>
              {matchedCollections.map((col, i) => (
                <button
                  key={col.id}
                  className={`search-dd-item${activeIdx === i ? " active" : ""}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => { e.preventDefault(); onSelectCollection(col.id); onSearch(""); setOpen(false); }}
                >
                  <span className="search-dd-dot" style={{ background: col.color || "var(--muted)" }} />
                  <span className="search-dd-label">{col.name}</span>
                </button>
              ))}
            </div>
          )}
          {matchedTags.length > 0 && (
            <div className="search-dd-group">
              <div className="search-dd-section-header">Tags</div>
              {matchedTags.map(({ tag, count }, i) => {
                const globalIdx = matchedCollections.length + i;
                return (
                  <button
                    key={tag}
                    className={`search-dd-item${activeIdx === globalIdx ? " active" : ""}`}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    onMouseDown={(e) => { e.preventDefault(); onSelectTag(tag); onSearch(""); setOpen(false); }}
                  >
                    <span className="search-dd-hash">#</span>
                    <span className="search-dd-label">{tag}</span>
                    <span className="search-dd-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

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
  onCollectionContextMenu,
  onSelectCollection,
  onSelectTag = () => {},
  isDragging,
  onReorder,
  onReorderSubCollections,
  onAddClick,
  onOptionsMenu,
  sidebarHidden,
  onToggleSidebar,
  allTags = [],
  organizeMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  detailOpen = false,
}) {
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [zoom, setZoom] = useState(loadZoom);
  const [isZooming, setIsZooming] = useState(false);
  const [activeSubId, setActiveSubId] = useState(null);
  const zoomTimerRef = useRef(null);

  function changeZoom(newZoom) {
    const v = clampZoom(newZoom);
    setZoom(v);
    localStorage.setItem("tome-zoom", v);
    setIsZooming(true);
    clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setIsZooming(false), 300);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart({ active }) {
    setActiveId(active.id);
  }

  function handleDragOver({ over }) {
    setOverId(over?.id ?? null);
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null);
    setOverId(null);
    if (!over || active.id === over.id) return;
    onReorder(active.id, over.id);
  }

  const gridAreaRef = useRef(null);

  // Reset scroll position whenever the active view changes
  useEffect(() => {
    if (gridAreaRef.current) gridAreaRef.current.scrollTop = 0;
  }, [activeView]);

  const detailOpenRef = useRef(false);
  useEffect(() => { detailOpenRef.current = detailOpen; }, [detailOpen]);

  // Ctrl+wheel → zoom in/out (like Photoshop)
  useEffect(() => {
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      if (detailOpenRef.current) return;
      e.preventDefault();
      // deltaY > 0 = scroll down = zoom out (smaller images)
      setZoom((prev) => {
        const next = clampZoom(prev - Math.sign(e.deltaY) * ZOOM_STEP);
        localStorage.setItem("tome-zoom", next);
        return next;
      });
      setIsZooming(true);
      clearTimeout(zoomTimerRef.current);
      zoomTimerRef.current = setTimeout(() => setIsZooming(false), 300);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const inCollection = activeView?.type === "collection";

  const viewLabel = useMemo(() => {
    if (activeView?.type === "all") return "All Images";
    if (activeView?.type === "unorganized") return "Unorganized";
    if (activeView?.type === "tag") return `#${activeView.tag}`;
    if (activeView?.type === "collection") {
      const col = collections.find(c => c.id === activeView.id);
      return col?.name || "Collection";
    }
    return "All Images";
  }, [activeView, collections]);

  const viewCount = useMemo(() => {
    if (activeView?.type === "all") return allItems.length;
    if (activeView?.type === "unorganized") return allItems.filter(i => i.collections.length === 0).length;
    if (activeView?.type === "collection") return allItems.filter(i => i.collections.includes(activeView.id)).length;
    if (activeView?.type === "tag") return allItems.filter(i => i.tags.includes(activeView.tag)).length;
    return allItems.length;
  }, [activeView, allItems]);

  const subCollections = useMemo(
    () => inCollection ? collections.filter(c => c.parent_id === activeView.id && !c.archived) : [],
    [inCollection, collections, activeView]
  );

  const visibleItems = items;

  // Live reorder preview: as you drag over a card, the array shifts so masonry
  // re-lays cards into their new positions with a smooth CSS transition.
  const liveItems = useMemo(() => {
    if (!activeId || !overId || activeId === overId) return visibleItems;
    const oldIndex = visibleItems.findIndex(i => i.id === activeId);
    const newIndex = visibleItems.findIndex(i => i.id === overId);
    if (oldIndex === -1 || newIndex === -1) return visibleItems;
    return arrayMove(visibleItems, oldIndex, newIndex);
  }, [activeId, overId, visibleItems]);

  const { positions, containerHeight, columnWidth, containerRef: masonryRef, recalculate } =
    useMasonryLayout(liveItems, zoom);


  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <div className="grid-area" ref={gridAreaRef}>
      <header className="toolbar">
        {/* Left: optional sidebar toggle + view icon + name + count + add button */}
        <div className="toolbar-left">
          <button className="btn-sidebar-toggle" onClick={onToggleSidebar} title={sidebarHidden ? "Show sidebar" : "Hide sidebar"}>
            <PanelLeftIcon />
          </button>
<span className="toolbar-view-name">{viewLabel}</span>
          <span className="toolbar-view-count">{viewCount}</span>
        </div>

        {/* Center: search */}
        <div className="toolbar-center">
          <SearchBox
            search={search}
            onSearch={onSearch}
            collections={collections}
            allItems={allItems}
            allTags={allTags}
            onSelectCollection={onSelectCollection}
            onSelectTag={onSelectTag}
          />
        </div>

        {/* Right: zoom slider + add + options */}
        <div className="toolbar-right">
          <div className="zoom-container">
            <input
              className="zoom-slider"
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(e) => changeZoom(parseInt(e.target.value, 10))}
              title="Zoom (or Ctrl+scroll)"
            />
          </div>
          <button className="btn-icon" onClick={onAddClick} title="Add image">
            <PlusIcon />
          </button>
          <button className="btn-icon" onClick={onOptionsMenu} title="Options">
            <DotsIcon />
          </button>
        </div>
      </header>

      {/* Below toolbar: sub-collections and tabs */}
      {subCollections.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveSubId(active.id)}
          onDragEnd={({ active, over }) => {
            setActiveSubId(null);
            if (!over || active.id === over.id) return;
            const oldIdx = subCollections.findIndex(c => c.id === active.id);
            const newIdx = subCollections.findIndex(c => c.id === over.id);
            const reordered = arrayMove(subCollections, oldIdx, newIdx);
            onReorderSubCollections?.(reordered.map(c => c.id));
          }}
          onDragCancel={() => setActiveSubId(null)}
        >
          <SortableContext items={subCollections.map(c => c.id)}>
            <div className="subfolder-row">
              {subCollections.map(col => {
                const count = allItems.filter(i => i.collections.includes(col.id)).length;
                return (
                  <SortableSubfolderCard key={col.id} id={col.id}>
                    <div className="subfolder-card" onClick={() => onSelectCollection(col.id)}>
                      <div className="subfolder-card-top">
                        <SubColIcon icon={col.icon} color={col.color} />
                        <button
                          className="subfolder-dots"
                          onClick={(e) => { e.stopPropagation(); onCollectionContextMenu?.(e, col); }}
                        >
                          <DotsIcon />
                        </button>
                      </div>
                      <div className="subfolder-card-bottom">
                        <span className="subfolder-name">{col.name}</span>
                        <span className="subfolder-count">{count} {count === 1 ? "Image" : "Images"}</span>
                      </div>
                    </div>
                  </SortableSubfolderCard>
                );
              })}
            </div>
          </SortableContext>

          {createPortal(
            <DragOverlay dropAnimation={null}>
              {activeSubId && subCollections.find(c => c.id === activeSubId) && (() => {
                const col = subCollections.find(c => c.id === activeSubId);
                const count = allItems.filter(i => i.collections.includes(col.id)).length;
                return (
                  <div className="subfolder-card" style={{ pointerEvents: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
                    <div className="subfolder-card-top">
                      <SubColIcon icon={col.icon} color={col.color} />
                    </div>
                    <div className="subfolder-card-bottom">
                      <span className="subfolder-name">{col.name}</span>
                      <span className="subfolder-count">{count} {count === 1 ? "Image" : "Images"}</span>
                    </div>
                  </div>
                );
              })()}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      )}
      {visibleItems.length === 0 ? (
        <div className={`empty-state${isDragging ? " drop-active" : ""}`}>
          {isDragging
            ? "Drop to save"
            : inCollection
              ? "Nothing in this collection yet."
              : "Drag an image in or paste with Ctrl+V to get started."}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={liveItems.map((i) => i.id)}>
            <div
              ref={(el) => { masonryRef.current = el; }}
              className={`grid${isDragging ? " drop-active" : ""}`}
              style={{ height: containerHeight || undefined }}
            >
              {isDragging && <div className="grid-drop-overlay"><span>Drop to save</span></div>}
              {liveItems.map((item) => {
                const pos = positions[item.id];
                const cardStyle = pos
                  ? { position: "absolute", left: pos.x, top: pos.y, width: pos.width }
                  : { position: "absolute", left: 0, top: 0, width: columnWidth, visibility: "hidden" };

                if (item.type === "flow") {
                  const firstScreenUrl = item.screens?.[0]
                    ? imageUrls[item.screens[0].id]
                    : undefined;
                  return (
                    <SortableCard
                      key={item.id}
                      id={item.id}
                      style={cardStyle}
                      isGridDragging={!!activeId}
                      isZooming={isZooming}
                    >
                      <FlowCard
                        item={item}
                        imageUrl={firstScreenUrl}
                        onClick={() => organizeMode ? onToggleSelect?.(item.id) : onCardClick(item)}
                        onContextMenu={onCardContextMenu}
                        selected={organizeMode && selectedIds.has(item.id)}
                        showSelectRing={organizeMode}
                      />
                    </SortableCard>
                  );
                }

                return (
                  <SortableCard
                    key={item.id}
                    id={item.id}
                    style={cardStyle}
                    isGridDragging={!!activeId}
                  >
                    <div
                      data-item-id={item.id}
                      className="card"
                      onClick={() => organizeMode ? onToggleSelect?.(item.id) : onCardClick(item)}
                      onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(e, item); }}
                      title={item.title || undefined}
                    >
                      {imageUrls[item.id]
                        ? <img src={imageUrls[item.id]} alt={item.title || "image"} loading="lazy" draggable={false} onLoad={recalculate} />
                        : <div className="card-placeholder" />}
                      {organizeMode && (
                        <div className={`card-select-ring${selectedIds.has(item.id) ? " selected" : ""}`} />
                      )}
                    </div>
                  </SortableCard>
                );
              })}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem && (
              <div style={{
                opacity: 0.6,
                transform: "scale(1.03)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                borderRadius: 8,
                overflow: "hidden",
                width: columnWidth,
                cursor: "grabbing",
              }}>
                {activeItem.type === "flow" ? (
                  <FlowCard
                    item={activeItem}
                    imageUrl={activeItem.screens?.[0] ? imageUrls[activeItem.screens[0].id] : undefined}
                    selected={false}
                    onClick={() => {}}
                    onContextMenu={() => {}}
                  />
                ) : (
                  <div className="card">
                    {imageUrls[activeItem.id]
                      ? <img
                          src={imageUrls[activeItem.id]}
                          alt={activeItem.title || "image"}
                          style={{ display: "block", width: "100%", height: "auto" }}
                          draggable={false}
                        />
                      : <div className="card-placeholder" />}
                  </div>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
