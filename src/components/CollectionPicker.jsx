import { useRef, useEffect } from "react";
import * as Icons from "lucide-react";

function ColIcon({ icon, color, size = 14 }) {
  const Ic = Icons[icon];
  if (Ic) return <Ic size={size} color={color || "var(--muted)"} />;
  return <span style={{ fontSize: size }}>{icon || "📁"}</span>;
}

export default function CollectionPicker({ mode, collections, selectedIds, items, onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const nonArchived   = collections.filter((c) => !c.archived);

  return (
    <div className="collection-picker" ref={ref}>
      <div className="collection-picker-header">
        {mode === "move" ? "Move to…" : "Copy to…"}
      </div>
      {nonArchived.length === 0 && (
        <div className="collection-picker-empty">No collections yet</div>
      )}
      {nonArchived.map((col) => {
        const allIn = selectedItems.length > 0 && selectedItems.every((i) => i.collections.includes(col.id));
        return (
          <button
            key={col.id}
            className={`collection-picker-item${allIn ? " disabled" : ""}`}
            disabled={allIn}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => !allIn && onPick(col.id)}
          >
            <ColIcon icon={col.icon} color={col.color} />
            <span>{col.name}</span>
          </button>
        );
      })}
    </div>
  );
}
