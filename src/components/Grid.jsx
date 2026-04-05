import { useState, useEffect, useRef } from "react";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import FlowCard from "./FlowCard";
import SortableCard from "./SortableCard";
import useMasonryLayout from "../hooks/useMasonryLayout";

export default function Grid({
  items,
  imageUrls,
  search,
  onSearch,
  activeView,
  selectedIds,
  onSelectionChange,
  onSelectionDragStart,
  onCardClick,
  onCardContextMenu,
  isDragging,
  onReorder,
}) {
  const [activeTab, setActiveTab] = useState("images");
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  function handleDragStart({ active }) {
    // If dragging an unselected card while selection exists, clear selection first
    if (selectedIdsRef.current.size > 0 && !selectedIdsRef.current.has(active.id)) {
      onSelectionChange(new Set());
    }
    setActiveId(active.id);
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    onReorder(active.id, over.id);
  }

  // Reset tab to "images" whenever the active collection changes
  useEffect(() => {
    setActiveTab("images");
  }, [activeView]);

  const gridRef    = useRef(null);  // attached to the grid-area div
  const rbOverlay  = useRef(null);  // the rubber band rectangle div
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let rbStartX = 0, rbStartY = 0, rbActive = false;

    const onMouseMove = (e) => {
      const dx = e.clientX - rbStartX;
      const dy = e.clientY - rbStartY;
      if (!rbActive && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      rbActive = true;

      const left = Math.min(e.clientX, rbStartX);
      const top  = Math.min(e.clientY, rbStartY);
      const w    = Math.abs(dx);
      const h    = Math.abs(dy);

      if (rbOverlay.current) {
        rbOverlay.current.style.display = "block";
        rbOverlay.current.style.left    = `${left}px`;
        rbOverlay.current.style.top     = `${top}px`;
        rbOverlay.current.style.width   = `${w}px`;
        rbOverlay.current.style.height  = `${h}px`;
      }

      const rbRect = { left, top, right: left + w, bottom: top + h };
      const cards  = grid.querySelectorAll("[data-item-id]");
      const hits   = new Set();
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        if (r.left < rbRect.right && r.right > rbRect.left &&
            r.top  < rbRect.bottom && r.bottom > rbRect.top) {
          hits.add(card.dataset.itemId);
        }
      });
      onSelectionChange(hits);
    };

    const onMouseUp = () => {
      if (rbOverlay.current) rbOverlay.current.style.display = "none";
      if (rbActive) {
        // Suppress the click that fires after mouseup on a card.
        // We check rbActive *before* resetting it. The capture-phase listener
        // runs before React's synthetic event system, so stopPropagation here
        // prevents the card's onClick from ever firing. Self-removes after one use.
        const suppressClick = (ev) => {
          ev.stopPropagation();
          window.removeEventListener("click", suppressClick, true);
        };
        window.addEventListener("click", suppressClick, true);
      }
      rbActive = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;

      // If mousedown on a selected card → start drag (Task 3)
      const cardEl = e.target.closest("[data-item-id]");
      if (cardEl && selectedIdsRef.current.has(cardEl.dataset.itemId)) {
        e.preventDefault(); // prevent browser native image drag stealing mouse events
        onSelectionDragStart();
        return;
      }

      // If mousedown on any card → normal click, just clear selection
      if (cardEl) {
        onSelectionChange(new Set());
        return;
      }

      // Background mousedown → start rubber band
      rbStartX  = e.clientX;
      rbStartY  = e.clientY;
      rbActive  = false;
      onSelectionChange(new Set());

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
    };

    grid.addEventListener("mousedown", onMouseDown);
    return () => {
      grid.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, [onSelectionChange, onSelectionDragStart]);

  const inCollection = activeView?.type === "collection";
  const imageItems = inCollection ? items.filter(i => i.type === "image") : items;
  const flowItems  = inCollection ? items.filter(i => i.type === "flow")  : items;
  const visibleItems = inCollection
    ? (activeTab === "images" ? imageItems : flowItems)
    : items;

  const { positions, containerHeight, columnWidth, containerRef: masonryRef } =
    useMasonryLayout(visibleItems);

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <div className="grid-area" ref={gridRef}>
      <div ref={rbOverlay} className="rubber-band" style={{ display: "none" }} />
      <header className="toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
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
                        ? <img src={imageUrls[screen.id]} alt="" />
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
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleItems.map((i) => i.id)}>
            <div
              ref={(el) => { masonryRef.current = el; }}
              className={`grid${isDragging ? " drop-active" : ""}`}
              style={{ height: containerHeight || undefined }}
            >
              {isDragging && <div className="grid-drop-overlay"><span>Drop to save</span></div>}
              {visibleItems.map((item) => {
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
                      disabled={selectedIds?.has(item.id)}
                    >
                      <FlowCard
                        item={item}
                        imageUrl={firstScreenUrl}
                        selected={selectedIds?.has(item.id)}
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
                    disabled={selectedIds?.has(item.id)}
                  >
                    <div
                      data-item-id={item.id}
                      className={`card${selectedIds?.has(item.id) ? " selected" : ""}`}
                      onClick={() => onCardClick(item)}
                      onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(e, item); }}
                      title={item.title || undefined}
                    >
                      {imageUrls[item.id]
                        ? <img src={imageUrls[item.id]} alt={item.title || "image"} loading="lazy" />
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
