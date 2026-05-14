import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import * as Icons from "lucide-react";

function ColIcon({ icon, color, size = 14 }) {
  const Ic = Icons[icon];
  if (Ic) return <Ic size={size} color={color || "var(--muted)"} />;
  return <span style={{ fontSize: size }}>{icon || "📁"}</span>;
}

export default function CollectionPickerModal({
  mode,
  selectedIds,
  items,
  collections,
  imageUrls,
  onConfirm,
  onClose,
}) {
  const [pickedIds, setPickedIds] = useState(new Set());
  const [search, setSearch] = useState("");

  const selectedItems = useMemo(() => items.filter((i) => selectedIds.has(i.id)), [items, selectedIds]);
  const nonArchived = useMemo(() => collections.filter((c) => !c.archived), [collections]);

  const filtered = useMemo(() => {
    if (!search.trim()) return nonArchived;
    const q = search.toLowerCase();
    return nonArchived.filter((c) => c.name.toLowerCase().includes(q));
  }, [nonArchived, search]);

  const getThumbnailUrl = (item) => {
    if (item.type === "flow") {
      const first = item.screens?.[0];
      return first ? imageUrls[first.id] : null;
    }
    return imageUrls[item.id];
  };

  const handleRowClick = (colId) => {
    if (mode === "move") {
      setPickedIds(new Set([colId]));
    } else {
      setPickedIds((prev) => {
        const next = new Set(prev);
        next.has(colId) ? next.delete(colId) : next.add(colId);
        return next;
      });
    }
  };

  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-backdrop" />
      <motion.div
        className="ui-modal"
        style={{ width: 400 }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.7 }}
      >
        <div className="ui-modal-header">
          <span className="ui-modal-title">
            {mode === "move" ? "Move to…" : "Copy to…"}
          </span>
          <button className="ui-modal-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="ui-modal-sep" />
        <div className="ui-modal-body">
          {selectedItems.length > 0 && (
            <div className="cpm-thumbs">
              {selectedItems.map((item) => {
                const url = getThumbnailUrl(item);
                return (
                  <div key={item.id} className="cpm-thumb">
                    {url && <img src={url} alt="" />}
                  </div>
                );
              })}
            </div>
          )}

          <input
            className="cpm-search"
            type="text"
            placeholder="Search collections…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <div className="cpm-list">
            {filtered.length === 0 && (
              <div className="cpm-empty">No collections found</div>
            )}
            {filtered.map((col) => {
              const allIn =
                selectedItems.length > 0 &&
                selectedItems.every((i) => i.collections.includes(col.id));
              const isPicked = pickedIds.has(col.id);
              return (
                <button
                  key={col.id}
                  className={`cpm-row${isPicked ? " picked" : ""}${allIn ? " disabled" : ""}`}
                  disabled={allIn}
                  onClick={() => handleRowClick(col.id)}
                >
                  <ColIcon icon={col.icon} color={col.color} />
                  <span className="cpm-row-name">{col.name}</span>
                  {isPicked && <Check size={13} className="cpm-row-check" />}
                </button>
              );
            })}
          </div>

          <div className="cpm-footer">
            <button
              className="btn-primary"
              disabled={pickedIds.size === 0}
              onClick={() => onConfirm([...pickedIds])}
            >
              {mode === "move" ? "Move" : "Copy"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
