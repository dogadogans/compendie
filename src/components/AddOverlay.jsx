import { useState, useEffect } from "react";

export default function AddOverlay({ imageFile, collections, onSave, onCancel }) {
  const [title,        setTitle]        = useState("");
  const [tagInput,     setTagInput]     = useState("");
  const [note,         setNote]         = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [previewUrl,   setPreviewUrl]   = useState(null);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleSave = async () => {
    if (!imageFile) return;
    setSaving(true);
    try {
      const bytes = new Uint8Array(await imageFile.arrayBuffer());
      const tags  = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      await onSave({
        imageBytes:   bytes,
        originalName: imageFile.name,
        title,
        tags,
        note,
        collectionId: collectionId || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="overlay" onKeyDown={handleKeyDown}>
      <div className="overlay-backdrop" onClick={onCancel} />
      <div className="add-panel">
        {previewUrl && (
          <div className="add-preview"><img src={previewUrl} alt="preview" /></div>
        )}
        <div className="add-fields">
          <input
            className="field-input"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <input
            className="field-input"
            placeholder="Tags — comma separated"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          {collections.length > 0 && (
            <select
              className="field-input field-select"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
            >
              <option value="">No collection</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          )}
          <textarea
            className="field-input field-textarea"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
          <div className="add-actions">
            <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
