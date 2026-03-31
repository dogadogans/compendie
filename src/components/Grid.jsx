export default function Grid({
  items,
  imageUrls,
  search,
  onSearch,
  onCardClick,
  onCardContextMenu,
  onAddClick,
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
        <button className="btn-add" onClick={onAddClick}>+ Add</button>
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
          {items.map((item) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
