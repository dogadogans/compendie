import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

// Props:
//   mode: "create" | "edit"
//   flow: existing flow object (edit mode only)
//   items: all items (for Tome picker — only type:"image")
//   imageUrls: { [id]: objectURL }
//   collections: non-archived collections
//   onSave(payload): called in create mode
//   onUpdate(id, payload): called in edit mode
//   onCancel(): close without saving
export default function FlowBuilder({
  mode, flow, items, imageUrls, collections, onSave, onUpdate, onCancel,
}) {
  const [title,      setTitle]      = useState(mode === "edit" ? flow.title : "");
  const [screens,    setScreens]    = useState(() =>
    mode === "edit"
      ? flow.screens.map((s) => ({ ...s, file: null, previewUrl: imageUrls[s.id] || null }))
      : []
  );
  const [tagInput,     setTagInput]     = useState(mode === "edit" ? flow.tags.join(", ") : "");
  const [note,         setNote]         = useState(mode === "edit" ? flow.note : "");
  const [collectionId, setCollectionId] = useState(
    mode === "edit" ? (flow.collections[0] || "") : ""
  );
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [dragIdx,     setDragIdx]     = useState(null);

  // Track object URLs we create so we can revoke on unmount
  const ownedUrls = useRef([]);
  useEffect(() => () => ownedUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Ctrl+V paste anywhere in the overlay
  useEffect(() => {
    const onPaste = (e) => {
      const file = e.clipboardData?.files?.[0];
      if (file?.type.startsWith("image/")) addScreenFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const addScreenFile = (file) => {
    const previewUrl = URL.createObjectURL(file);
    ownedUrls.current.push(previewUrl);
    setScreens((prev) => [
      ...prev,
      { id: uuidv4(), file, previewUrl, image_path: null, note: "" },
    ]);
  };

  const addScreenFromItem = (item) => {
    // Toggle: if already in tray, remove it
    const exists = screens.some((s) => s.image_path === item.image_path && !s.file);
    if (exists) {
      setScreens((prev) => prev.filter((s) => !(s.image_path === item.image_path && !s.file)));
      return;
    }
    setScreens((prev) => [
      ...prev,
      { id: uuidv4(), file: null, previewUrl: imageUrls[item.id] || null,
        image_path: item.image_path, note: "" },
    ]);
  };

  const removeScreen = (idx) =>
    setScreens((prev) => prev.filter((_, i) => i !== idx));

  // Drag-to-reorder
  const handleDragEnterScreen = (idx) => {
    if (dragIdx === null || dragIdx === idx) return;
    setScreens((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };

  const handleSave = async () => {
    if (!title.trim() && screens.length === 0) return;
    setSaving(true);
    try {
      const tags = tagInput.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
      const payload = {
        title,
        screens: screens.map((s) => ({
          id:         s.id,
          file:       s.file || null,
          image_path: s.image_path || null,
          note:       s.note || "",
        })),
        tags,
        note,
        collections: collectionId ? [collectionId] : [],
      };
      if (mode === "edit") await onUpdate(flow.id, payload);
      else                  await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  const fileInputRef = useRef(null);
  const imageItems   = items.filter((i) => i.type === "image");
  const inTrayPaths  = new Set(screens.filter((s) => !s.file).map((s) => s.image_path));

  return (
    <div className="flow-builder-overlay" onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}>
      <div className="flow-builder-backdrop" onClick={onCancel} />
      <div className="flow-builder-panel">

        {/* Header */}
        <div className="flow-builder-header">
          <input
            className="flow-builder-title-input"
            placeholder="Flow name…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <button className="panel-close" onClick={onCancel}>×</button>
        </div>

        {/* Body: screen tray + optional picker */}
        <div className="flow-builder-body">

          {/* Screen tray */}
          <div className="flow-builder-tray">
            <div className="flow-builder-screens">
              {screens.length === 0 && (
                <div className="flow-tray-empty">Add screens below to get started</div>
              )}
              {screens.map((screen, idx) => (
                <div
                  key={screen.id}
                  className={`flow-tray-thumb${dragIdx === idx ? " dragging" : ""}`}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragEnter={() => handleDragEnterScreen(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={() => setDragIdx(null)}
                >
                  {screen.previewUrl
                    ? <img src={screen.previewUrl} alt={`Screen ${idx + 1}`} />
                    : <div className="flow-tray-thumb-placeholder" />}
                  <button
                    className="flow-tray-remove"
                    onClick={() => removeScreen(idx)}
                  >×</button>
                  <div className="flow-tray-num">{idx + 1}</div>
                </div>
              ))}
            </div>

            <div className="flow-tray-add-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) addScreenFile(f);
                  e.target.value = "";
                }}
              />
              <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>
                From files
              </button>
              <button className="btn-ghost" onClick={() => setPickerOpen((v) => !v)}>
                {pickerOpen ? "Close picker" : "Pick from Tome"}
              </button>
            </div>
          </div>

          {/* Tome picker panel */}
          {pickerOpen && (
            <div className="flow-picker-panel">
              <div className="flow-picker-header">Pick from Tome</div>
              <div className="flow-picker-grid">
                {imageItems.length === 0 && (
                  <div className="flow-picker-empty">No images in Tome yet</div>
                )}
                {imageItems.map((item) => {
                  const selected = inTrayPaths.has(item.image_path);
                  return (
                    <div
                      key={item.id}
                      className={`flow-picker-thumb${selected ? " selected" : ""}`}
                      onClick={() => addScreenFromItem(item)}
                    >
                      {imageUrls[item.id]
                        ? <img src={imageUrls[item.id]} alt={item.title || ""} />
                        : <div className="flow-picker-thumb-placeholder" />}
                      {selected && <div className="flow-picker-check">✓</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flow-builder-footer">
          <input
            className="field-input"
            placeholder="Tags — comma separated"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
          />
          <textarea
            className="field-input field-textarea"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
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
          <div className="add-actions">
            <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || screens.length === 0}
            >
              {saving ? "Saving…" : mode === "edit" ? "Update flow" : "Save flow"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
