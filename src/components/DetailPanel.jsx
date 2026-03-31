import { useState, useEffect, useRef } from "react";

export default function DetailPanel({
  item,
  imageUrl,
  collections,
  onUpdate,
  onDelete,
  onClose,
  width,
  onResizeStart,
}) {
  const [title,    setTitle]    = useState(item.title);
  const [tagInput, setTagInput] = useState("");
  const [tags,     setTags]     = useState(item.tags);
  const [note,     setNote]     = useState(item.note);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const pickerRef = useRef(null);

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

  // Escape to close panel
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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
    <div className="detail-panel-eagle" style={{ width }}>
      {/* Resize handle on left edge */}
      <div className="panel-resize-handle" onMouseDown={onResizeStart} />

      {/* Close */}
      <button className="panel-close" onClick={onClose} title="Close (Esc)">×</button>

      {/* Image */}
      <div className="panel-image-wrap">
        {imageUrl
          ? <img src={imageUrl} alt={item.title || "image"} />
          : <div className="panel-image-placeholder" />}
      </div>

      {/* Title */}
      <input
        className="panel-title"
        value={title}
        placeholder="Untitled"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
      />

      {/* Tags */}
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
      <textarea
        className="panel-note"
        placeholder="Add a note…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
      />

      {/* Date */}
      <p className="panel-date">{formattedDate}</p>

      {/* Delete */}
      <button className="btn-danger panel-delete" onClick={() => { onDelete(item.id); onClose(); }}>
        Delete
      </button>
    </div>
  );
}
