export default function FlowCard({ item, imageUrl, onClick, onContextMenu, selected }) {
  const count = item.screens?.length ?? 0;
  return (
    <div
      data-item-id={item.id}
      className={`flow-card${selected ? " selected" : ""}`}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
      title={item.title || undefined}
    >
      <div className="flow-card-shadow flow-card-shadow-2" />
      <div className="flow-card-shadow flow-card-shadow-1" />
      <div className="flow-card-face">
        {imageUrl
          ? <img src={imageUrl} alt={item.title || "flow"} loading="lazy" />
          : <div className="card-placeholder" />}
        <div className="flow-card-badge">{count} screen{count !== 1 ? "s" : ""}</div>
      </div>
    </div>
  );
}
