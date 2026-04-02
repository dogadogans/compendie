import { useState, useEffect } from "react";

function makeImageMeta() { return { title: "", tagInput: "", collectionId: "" }; }

export default function AddOverlay({ imageFiles, collections, onSave, onSaveFlow, onCancel }) {
  const [mode,            setMode]            = useState("image");
  const [imageMetas,      setImageMetas]      = useState(() => imageFiles.map(makeImageMeta));
  const [flowTitle,       setFlowTitle]       = useState("");
  const [flowTagInput,    setFlowTagInput]    = useState("");
  const [flowNote,        setFlowNote]        = useState("");
  const [flowCollections, setFlowCollections] = useState([]);
  const [previewUrls,     setPreviewUrls]     = useState([]);
  const [saving,          setSaving]          = useState(false);

  // Keep imageMetas in sync when imageFiles grows (new paste/drop while panel open)
  useEffect(() => {
    setImageMetas((prev) => {
      if (prev.length === imageFiles.length) return prev;
      return imageFiles.map((_, i) => prev[i] ?? makeImageMeta());
    });
  }, [imageFiles]);

  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageFiles]);

  const updateMeta = (i, field, value) =>
    setImageMetas((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  const parseTags = (str) =>
    str.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

  const toggleFlowCollection = (id) =>
    setFlowCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === "flow") {
        await onSaveFlow({
          title:       flowTitle,
          screens:     imageFiles.map((f) => ({ file: f })),
          tags:        parseTags(flowTagInput),
          note:        flowNote,
          collections: flowCollections,
        });
      } else {
        const dataList = await Promise.all(
          imageFiles.map(async (f, i) => ({
            imageBytes:   new Uint8Array(await f.arrayBuffer()),
            originalName: f.name,
            title:        imageMetas[i]?.title       ?? "",
            tags:         parseTags(imageMetas[i]?.tagInput ?? ""),
            note:         "",
            collectionId: imageMetas[i]?.collectionId || null,
          }))
        );
        await onSave(dataList);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { onCancel(); return; }
    if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      handleSave();
    }
  };

  const saveLabel = saving
    ? "Saving…"
    : mode === "flow"
      ? "Save Flow"
      : imageFiles.length > 1 ? `Save ${imageFiles.length} Images` : "Save";

  return (
    <div className="overlay" onKeyDown={handleKeyDown}>
      <div className="overlay-backdrop" onClick={onCancel} />
      <div className="add-panel">

        <div className="add-header">
          <div className="add-tabs">
            <button
              className={`add-tab-btn${mode === "image" ? " active" : ""}`}
              onClick={() => setMode("image")}
            >Image</button>
            <button
              className={`add-tab-btn${mode === "flow" ? " active" : ""}`}
              onClick={() => setMode("flow")}
            >Flow</button>
          </div>
          <button className="add-close" onClick={onCancel}>×</button>
        </div>

        <div className="add-body">
          {mode === "image" ? (
            <div className="add-image-row">
              {previewUrls.map((url, i) => (
                <div key={i} className="add-image-card">
                  <div className="add-card-preview">
                    <img src={url} alt="" />
                  </div>
                  <div className="add-card-fields">
                    <input
                      className="add-card-input"
                      placeholder="Title"
                      value={imageMetas[i]?.title ?? ""}
                      onChange={(e) => updateMeta(i, "title", e.target.value)}
                      autoFocus={i === 0}
                    />
                    <input
                      className="add-card-input"
                      placeholder="Tags, comma separated"
                      value={imageMetas[i]?.tagInput ?? ""}
                      onChange={(e) => updateMeta(i, "tagInput", e.target.value)}
                    />
                    {collections.length > 0 && (
                      <select
                        className="add-card-input add-card-select"
                        value={imageMetas[i]?.collectionId ?? ""}
                        onChange={(e) => updateMeta(i, "collectionId", e.target.value)}
                      >
                        <option value="">No collection</option>
                        {collections.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="add-flow-body">
              <div className="add-flow-strip">
                {previewUrls.map((url, i) => (
                  <div key={i} className="add-flow-thumb">
                    <img src={url} alt="" />
                  </div>
                ))}
              </div>
              <input
                className="add-title-large"
                placeholder="Flow name"
                value={flowTitle}
                onChange={(e) => setFlowTitle(e.target.value)}
                autoFocus
              />
              <input
                className="field-input"
                placeholder="Tags, comma separated"
                value={flowTagInput}
                onChange={(e) => setFlowTagInput(e.target.value)}
              />
              <textarea
                className="field-input field-textarea"
                placeholder="Add a note…"
                value={flowNote}
                onChange={(e) => setFlowNote(e.target.value)}
                rows={3}
              />
              {collections.length > 0 && (
                <div className="add-collection-pills">
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`collection-pill${flowCollections.includes(c.id) ? " active" : ""}`}
                      onClick={() => toggleFlowCollection(c.id)}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="add-footer">
          <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saveLabel}
          </button>
        </div>

      </div>
    </div>
  );
}
