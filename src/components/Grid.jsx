import FlowCard from "./FlowCard";

export default function Grid({
  items,
  imageUrls,
  search,
  onSearch,
  onCardClick,
  onCardContextMenu,
  onAddClick,
  onAddFlowClick,
  isDragging,
}) {
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
        <button className="btn-add" onClick={onAddClick}>+ Image</button>
        <button className="btn-add" onClick={onAddFlowClick}>+ Flow</button>
      </header>

      {items.length === 0 ? (
        <div className={`empty-state${isDragging ? " drop-active" : ""}`}>
          {isDragging
            ? "Drop to save"
            : "Drag an image in or paste with Ctrl+V to get started."}
        </div>
      ) : (
        <div className={`grid${isDragging ? " drop-active" : ""}`}>
          {isDragging && <div className="grid-drop-overlay"><span>Drop to save</span></div>}
          {items.map((item) => {
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
