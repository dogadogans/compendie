import { useState, useEffect, useRef, useMemo } from "react";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import FlowCard from "./FlowCard";
import SortableCard from "./SortableCard";
import useMasonryLayout from "../hooks/useMasonryLayout";

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

export default function Grid({
  items,
  imageUrls,
  search,
  onSearch,
  activeView,
  onCardClick,
  onCardContextMenu,
  isDragging,
  onReorder,
}) {
  const [activeTab, setActiveTab] = useState("images");
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [zoom, setZoom] = useState(loadZoom);
  const [isZooming, setIsZooming] = useState(false);
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

  // Reset tab to "images" whenever the active collection changes
  useEffect(() => {
    setActiveTab("images");
  }, [activeView]);

  // Ctrl+wheel → zoom in/out (like Photoshop)
  useEffect(() => {
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
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
  const imageItems = inCollection ? items.filter(i => i.type === "image") : items;
  const flowItems  = inCollection ? items.filter(i => i.type === "flow")  : items;
  const visibleItems = inCollection
    ? (activeTab === "images" ? imageItems : flowItems)
    : items;

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
    <div className="grid-area">
      <header className="toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
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
        {inCollection && (
          <div className="collection-tabs">
            <button
              className={`tab-btn${activeTab === "images" ? " active" : ""}`}
              onClick={() => setActiveTab("images")}
            >Images</button>
            <button
              className={`tab-btn${activeTab === "flows" ? " active" : ""}`}
              onClick={() => setActiveTab("flows")}
            >Flows</button>
          </div>
        )}
      </header>

      {inCollection && activeTab === "flows" ? (
        flowItems.length === 0 ? (
          <div className="empty-state">No flows in this collection.</div>
        ) : (
          <div className="flows-tab-layout">
            {flowItems.map(flow => (
              <div key={flow.id} className="flow-row">
                <div className="flow-row-title">{flow.title || "Untitled"}</div>
                <div className="flow-row-screens">
                  {(flow.screens || []).map(screen => (
                    <div
                      key={screen.id}
                      className="flow-row-screen"
                      onClick={() => onCardClick(flow)}
                    >
                      {imageUrls[screen.id]
                        ? <img src={imageUrls[screen.id]} alt="" draggable={false} onLoad={recalculate} />
                        : <div className="card-placeholder" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : visibleItems.length === 0 ? (
        <div className={`empty-state${isDragging ? " drop-active" : ""}`}>
          {isDragging
            ? "Drop to save"
            : inCollection && activeTab === "images"
              ? "No images in this collection."
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
                        onClick={() => onCardClick(item)}
                        onContextMenu={onCardContextMenu}
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
                      onClick={() => onCardClick(item)}
                      onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(e, item); }}
                      title={item.title || undefined}
                    >
                      {imageUrls[item.id]
                        ? <img src={imageUrls[item.id]} alt={item.title || "image"} loading="lazy" draggable={false} onLoad={recalculate} />
                        : <div className="card-placeholder" />}
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
