import { useState, useEffect, useRef } from "react";
import FlowCard from "./FlowCard";

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
}) {
  const [activeTab, setActiveTab] = useState("images");

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
        <div className={`grid${isDragging ? " drop-active" : ""}`}>
          {isDragging && <div className="grid-drop-overlay"><span>Drop to save</span></div>}
          {visibleItems.map((item) => {
            if (item.type === "flow") {
              const firstScreenUrl = item.screens?.[0]
                ? imageUrls[item.screens[0].id]
                : undefined;
              return (
                <FlowCard
                  key={item.id}
                  item={item}
                  imageUrl={firstScreenUrl}
                  selected={selectedIds?.has(item.id)}
                  onClick={() => onCardClick(item)}
                  onContextMenu={onCardContextMenu}
                />
              );
            }
            return (
              <div
                key={item.id}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
