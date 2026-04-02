import { useState, useEffect, useRef } from "react";
import FlowCard from "./FlowCard";

export default function Grid({
  items,
  imageUrls,
  search,
  onSearch,
  activeView,
  onCardClick,
  onCardContextMenu,
  onAddClick,
  onAddFlowClick,
  isDragging,
  // (selectedIds, onSelectionChange, onSelectionDragStart added in Task 2)
}) {
  const [activeTab, setActiveTab] = useState("images");

  // Reset tab to "images" whenever the active collection changes
  useEffect(() => {
    setActiveTab("images");
  }, [activeView]);

  const inCollection = activeView?.type === "collection";
  const imageItems = inCollection ? items.filter(i => i.type === "image") : items;
  const flowItems  = inCollection ? items.filter(i => i.type === "flow")  : items;
  const visibleItems = inCollection
    ? (activeTab === "images" ? imageItems : flowItems)
    : items;

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
        <button className="btn-add" onClick={onAddClick}>+ Image</button>
        <button className="btn-add" onClick={onAddFlowClick}>+ Flow</button>
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
                  onClick={() => onCardClick(item)}
                  onContextMenu={onCardContextMenu}
                />
              );
            }
            return (
              <div
                key={item.id}
                className="card"
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
