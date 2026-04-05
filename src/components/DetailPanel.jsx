import { useState, useEffect, useRef } from "react";

export default function DetailPanel({
  item,
  allItems,
  imageUrls,
  collections,
  onUpdate,
  onDelete,
  onClose,
  onNavigate,
}) {
  const [title,    setTitle]    = useState(item.title);
  const [tagInput, setTagInput] = useState("");
  const [tags,     setTags]     = useState(item.tags);
  const [note,     setNote]     = useState(item.note);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const pickerRef = useRef(null);

  // Images only — flows are handled by FlowDetail
  const imageItems = allItems.filter((i) => i.type !== "flow");
  const currentIndex = imageItems.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < imageItems.length - 1;

  const imageUrl = imageUrls[item.id];

  // Sync when a different item is selected
  useEffect(() => {
    setTitle(item.title);
    setTags(item.tags);
    setNote(item.note);
    setTagInput("");
    setShowCollectionPicker(false);
  }, [item.id]);

  // Close collection picker on outside click
  useEffect(() => {
    if (!showCollectionPicker) return;
    const handler = (e) => {
      if (!pickerRef.current?.contains(e.target)) setShowCollectionPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCollectionPicker]);

  // Keyboard: Escape to close, arrows to navigate
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft"  && hasPrev) onNavigate(imageItems[currentIndex - 1]);
      if (e.key === "ArrowRight" && hasNext) onNavigate(imageItems[currentIndex + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, hasPrev, hasNext, currentIndex, imageItems]);

  const saveTitle = () => {
    if (title !== item.title) onUpdate(item.id, { title });
  };

  const saveNote = () => {
    if (note !== item.note) onUpdate(item.id, { note });
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    const next = [...tags, t];
    setTags(next);
    onUpdate(item.id, { tags: next });
    setTagInput("");
  };

  const removeTag = (t) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    onUpdate(item.id, { tags: next });
  };

  const toggleCollection = (colId) => {
    const next = item.collections.includes(colId)
      ? item.collections.filter((id) => id !== colId)
      : [...item.collections, colId];
    onUpdate(item.id, { collections: next });
  };

  const formattedDate = new Date(item.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const activeCollections    = collections.filter((c) => item.collections.includes(c.id));
  const availableCollections = collections.filter((c) => !c.archived && !item.collections.includes(c.id));

  return (
    <div className="detail-fullscreen">

      {/* ── Image side ── */}
      <div className="detail-img-side">
        {imageUrl
          ? <img src={imageUrl} alt={item.title || "image"} className="detail-img" />
          : <div className="detail-img-placeholder" />}

        {/* Nav arrows */}
        {hasPrev && (
          <button
            className="detail-nav-arrow detail-nav-prev"
            onClick={() => onNavigate(imageItems[currentIndex - 1])}
            title="Previous (←)"
          >‹</button>
        )}
        {hasNext && (
          <button
            className="detail-nav-arrow detail-nav-next"
            onClick={() => onNavigate(imageItems[currentIndex + 1])}
            title="Next (→)"
          >›</button>
        )}

        {/* Close */}
        <button className="detail-close" onClick={onClose} title="Close (Esc)">×</button>

        {/* Counter */}
        {imageItems.length > 1 && (
          <span className="detail-counter">{currentIndex + 1} of {imageItems.length}</span>
        )}
      </div>

      {/* ── Metadata side ── */}
      <div className="detail-meta-side">

        {/* Title */}
        <input
          className="panel-title detail-meta-title"
          value={title}
          placeholder="Untitled"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
        />

        <div className="detail-meta-divider" />

        {/* Tags */}
        <span className="detail-meta-label">Tags</span>
        <div className="panel-tags-wrap">
          {tags.map((t) => (
            <span key={t} className="tag-pill">
              {t}
              <button className="tag-remove" onClick={() => removeTag(t)}>×</button>
            </span>
          ))}
          <input
            className="tag-input"
            placeholder="Add tag…"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
            }}
            onBlur={addTag}
          />
        </div>

        {/* Collections */}
        <span className="detail-meta-label" style={{ marginTop: "16px" }}>Collections</span>
        <div className="panel-collections-wrap" ref={pickerRef}>
          {activeCollections.map((col) => (
            <span key={col.id} className="collection-pill">
              {col.icon} {col.name}
              <button className="tag-remove" onClick={() => toggleCollection(col.id)}>×</button>
            </span>
          ))}
          {availableCollections.length > 0 && (
            <div className="collection-add-wrap">
              <button
                className="collection-add-btn"
                onClick={() => setShowCollectionPicker((v) => !v)}
              >+</button>
              {showCollectionPicker && (
                <div className="collection-picker">
                  {availableCollections.map((col) => (
                    <button
                      key={col.id}
                      className="collection-picker-item"
                      onClick={() => { toggleCollection(col.id); setShowCollectionPicker(false); }}
                    >
                      {col.icon} {col.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Note */}
        <span className="detail-meta-label" style={{ marginTop: "16px" }}>Note</span>
        <textarea
          className="panel-note"
          placeholder="Add a note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
        />

        {/* Footer */}
        <div className="detail-meta-footer">
          <p className="panel-date">{formattedDate}</p>
          <button
            className="btn-danger panel-delete"
            onClick={() => { onDelete(item.id); onClose(); }}
          >Delete</button>
        </div>

      </div>
    </div>
  );
}
