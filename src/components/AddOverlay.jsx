import { useState, useEffect } from "react";

export default function AddOverlay({ imageFiles, collections, onSave, onSaveFlow, onCancel }) {
  const [mode,         setMode]         = useState("image"); // "image" | "flow"
  const [title,        setTitle]        = useState("");
  const [tagInput,     setTagInput]     = useState("");
  const [note,         setNote]         = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [previewUrls,  setPreviewUrls]  = useState([]);
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageFiles]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tags = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (mode === "flow") {
        const screens = await Promise.all(
          imageFiles.map(async (f) => ({ file: f }))
        );
        await onSaveFlow({ title, screens, tags, note, collectionId: collectionId || null });
      } else {
        const dataList = await Promise.all(
          imageFiles.map(async (f) => ({
            imageBytes:   new Uint8Array(await f.arrayBuffer()),
            originalName: f.name,
            title,
            tags,
            note,
            collectionId: collectionId || null,
          }))
        );
        await onSave(dataList);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") onCancel();
  };

  const multi = imageFiles.length > 1;

  return (
    <div className="overlay" onKeyDown={handleKeyDown}>
      <div className="overlay-backdrop" onClick={onCancel} />
      <div className="add-panel">
        {/* Thumbnail strip */}
        <div className={`add-previews${multi ? " multi" : ""}`}>
          {previewUrls.map((url, i) => (
            <div key={i} className="add-preview-thumb">
              <img src={url} alt="" />
            </div>
          ))}
        </div>

        <div className="add-fields">
          {/* Image / Flow toggle — only show when more than one image */}
          {multi && (
            <div className="add-mode-toggle">
              <button
                className={`mode-btn${mode === "image" ? " active" : ""}`}
                onClick={() => setMode("image")}
              >
                Images
              </button>
              <button
                className={`mode-btn${mode === "flow" ? " active" : ""}`}
                onClick={() => setMode("flow")}
              >
                Flow
              </button>
            </div>
          )}

          <input
            className="field-input"
            placeholder={mode === "flow" ? "Flow name (optional)" : "Title (optional)"}
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
              {saving ? "Saving…" : mode === "flow" ? "Save as Flow" : multi ? `Save ${imageFiles.length} Images` : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
