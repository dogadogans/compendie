import { useState, useEffect, useRef } from "react";

const THUMB_COLORS = ["#e8e4dc", "#d4e8e0", "#dce4e8", "#e8dce4", "#e8e8dc"];
function thumbBg(i) { return THUMB_COLORS[i % THUMB_COLORS.length]; }

function getItemTranslate(i, src, dst, itemHeight) {
  if (dst === null || dst === src || i === src) return 0;
  if (dst < src) { if (i >= dst && i < src) return itemHeight; }
  else           { if (i > src && i <= dst)  return -itemHeight; }
  return 0;
}

function makeMeta(file) {
  return {
    title:      file ? file.name.replace(/\.[^/.]+$/, "") : "",
    tags:       [],
    tagInput:   "",
    collectionId: "",
    note:       "",
  };
}

export default function AddOverlay({
  imageFiles,
  collections,
  onSave,
  onSaveFlow,
  onCancel,
  onRemoveFile,
  onReorderFiles,
  onAddFiles,
}) {
  const [mode,             setMode]             = useState("image");
  const [selectedIdx,      setSelectedIdx]      = useState(0);
  const [imageMetas,       setImageMetas]       = useState(() => imageFiles.map(makeMeta));
  const [flowTitle,        setFlowTitle]        = useState("");
  const [flowTagInput,     setFlowTagInput]     = useState("");
  const [flowTags,         setFlowTags]         = useState([]);
  const [flowCollectionId, setFlowCollectionId] = useState("");
  const [flowScreenIdx,    setFlowScreenIdx]    = useState(null); // which screen note is open
  const [previewUrls,      setPreviewUrls]      = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [dragActive,  setDragActive]  = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  // Pointer-based lift drag — direct DOM updates for ghost position (no re-render on move)
  const drag     = useRef({ active: false, srcIdx: null, overIdx: null, offsetX: 0, offsetY: 0, files: [], itemHeight: 0 });
  const ghostRef = useRef(null);
  const listRef  = useRef(null);
  const fileInputRef = useRef(null);

  // Sync imageMetas when files grow
  useEffect(() => {
    setImageMetas((prev) => {
      if (prev.length === imageFiles.length) return prev;
      return imageFiles.map((f, i) => prev[i] ?? makeMeta(f));
    });
    setSelectedIdx((prev) => Math.min(prev, Math.max(0, imageFiles.length - 1)));
  }, [imageFiles]);

  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageFiles]);

  const updateMeta = (i, field, val) =>
    setImageMetas((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  // Image tag helpers
  const addImageTag = (i) => {
    const t = (imageMetas[i]?.tagInput ?? "").trim().toLowerCase();
    if (!t) return;
    if (!imageMetas[i]?.tags.includes(t))
      updateMeta(i, "tags", [...(imageMetas[i]?.tags ?? []), t]);
    updateMeta(i, "tagInput", "");
  };
  const removeImageTag = (i, tag) =>
    updateMeta(i, "tags", imageMetas[i].tags.filter((t) => t !== tag));

  // Flow tag helpers
  const addFlowTag = () => {
    const t = flowTagInput.trim().toLowerCase();
    if (!t || flowTags.includes(t)) { setFlowTagInput(""); return; }
    setFlowTags((prev) => [...prev, t]);
    setFlowTagInput("");
  };

  // Pinterest-style lift drag
  const handleHandlePointerDown = (e, i) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const itemEl = e.currentTarget.closest(".apv2-list-item");
    const flowEl = e.currentTarget.closest(".apv2-flow-item");
    const itemRect = itemEl.getBoundingClientRect();
    const flowRect = (flowEl ?? itemEl).getBoundingClientRect();
    // Measure natural midpoints NOW before any translateY is applied
    const flowItemEls = listRef.current?.querySelectorAll(".apv2-flow-item") ?? [];
    const naturalMids = Array.from(flowItemEls).map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    drag.current = {
      active: true, srcIdx: i, overIdx: i,
      offsetX: e.clientX - itemRect.left,
      offsetY: e.clientY - itemRect.top,
      files: [...imageFiles],
      itemHeight: flowRect.height,
      naturalMids,
      // initial position for first render (ghostRef is null until React paints)
      initLeft: itemRect.left,
      initTop:  itemRect.top,
      initWidth: itemRect.width,
    };
    document.body.classList.add("dragging");
    setDragActive(true);
    setDragOverIdx(i);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current.active) return;
      // Move ghost directly — no React re-render
      if (ghostRef.current) {
        ghostRef.current.style.left = `${e.clientX - drag.current.offsetX}px`;
        ghostRef.current.style.top  = `${e.clientY - drag.current.offsetY}px`;
      }
      // Use natural (pre-transform) midpoints so shifted items don't confuse hit detection
      const mids = drag.current.naturalMids;
      if (mids.length) {
        let newOver = mids.length - 1;
        for (let i = 0; i < mids.length; i++) {
          if (e.clientY < mids[i]) { newOver = i; break; }
        }
        if (newOver !== drag.current.overIdx) {
          drag.current.overIdx = newOver;
          setDragOverIdx(newOver);
        }
      }
    };
    const onUp = () => {
      if (!drag.current.active) return;
      const { srcIdx, overIdx, files } = drag.current;
      drag.current.active = false;
      document.body.classList.remove("dragging");
      setDragActive(false);
      setDragOverIdx(null);
      if (srcIdx !== overIdx) {
        const reordered = [...files];
        const [moved] = reordered.splice(srcIdx, 1);
        reordered.splice(overIdx, 0, moved);
        onReorderFiles(reordered);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onReorderFiles]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === "flow") {
        await onSaveFlow({
          title:       flowTitle,
          screens:     imageFiles.map((f) => ({ file: f })),
          tags:        flowTags,
          note:        "",
          collections: flowCollectionId ? [flowCollectionId] : [],
        });
      } else {
        const dataList = await Promise.all(
          imageFiles.map(async (f, i) => ({
            imageBytes:   new Uint8Array(await f.arrayBuffer()),
            originalName: f.name,
            title:        imageMetas[i]?.title       ?? "",
            tags:         imageMetas[i]?.tags        ?? [],
            note:         imageMetas[i]?.note        ?? "",
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
      if (imageFiles.length > 0) handleSave();
    }
  };

  const hasFiles = imageFiles.length > 0;
  const meta     = imageMetas[selectedIdx] ?? makeMeta(imageFiles[selectedIdx]);

  const headerTitle = !hasFiles
    ? "Add images"
    : mode === "flow"
      ? "New flow"
      : imageFiles.length === 1
        ? "Add image"
        : `Add ${imageFiles.length} images`;

  const saveLabel = saving
    ? "Saving…"
    : mode === "flow"
      ? "Save flow"
      : imageFiles.length === 1
        ? "Save image"
        : `Save ${imageFiles.length} images`;

  return (
    <div className="overlay" onKeyDown={handleKeyDown}>
      <div className="overlay-backdrop" onClick={onCancel} />
      <div className="apv2-panel">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="apv2-header">
          <div className="apv2-header-left">
            <h2 className="apv2-title">{headerTitle}</h2>
            {hasFiles && (
              <div className="apv2-tabs">
                <button
                  className={`apv2-tab${mode === "image" ? " active" : ""}`}
                  onClick={() => setMode("image")}
                >Images</button>
                <button
                  className={`apv2-tab${mode === "flow" ? " active" : ""}`}
                  onClick={() => setMode("flow")}
                >Flow</button>
              </div>
            )}
          </div>
          {hasFiles && (
            <span className="apv2-count">
              {imageFiles.length} {imageFiles.length === 1 ? "image" : "images"}
            </span>
          )}
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        {!hasFiles ? (
          <div className="apv2-dropzone" onClick={() => fileInputRef.current?.click()}>
            <div className="apv2-drop-plus">+</div>
            <p className="apv2-drop-primary">Drop images here</p>
            <p className="apv2-drop-secondary">or click to browse your files</p>
            <p className="apv2-drop-secondary">Ctrl+V also works</p>
          </div>
        ) : (
          <div className="apv2-body">

            {/* Left panel */}
            <div className="apv2-left">
              {imageFiles.length === 1 ? (
                <div className="apv2-single">
                  <div className="apv2-single-thumb" style={{ background: thumbBg(0) }}>
                    {previewUrls[0] && <img src={previewUrls[0]} alt="" />}
                    <button
                      className="apv2-remove-btn"
                      onClick={(e) => { e.stopPropagation(); onRemoveFile(0); }}
                      title="Remove"
                    >×</button>
                  </div>
                  <span className="apv2-single-name">{imageFiles[0].name}</span>
                </div>
              ) : mode === "image" ? (
                <div className="apv2-list">
                  {imageFiles.map((f, i) => (
                    <div
                      key={i}
                      className={`apv2-list-item${selectedIdx === i ? " active" : ""}`}
                      onClick={() => setSelectedIdx(i)}
                    >
                      <div className="apv2-list-thumb" style={{ background: thumbBg(i) }}>
                        {previewUrls[i] && <img src={previewUrls[i]} alt="" />}
                      </div>
                      <span className="apv2-list-name">{f.name}</span>
                      <button
                        className="apv2-list-remove"
                        onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                        title="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="apv2-list" ref={listRef} style={{ touchAction: "none" }}>
                  {imageFiles.map((f, i) => {
                    const ty = getItemTranslate(i, drag.current.srcIdx, dragOverIdx, drag.current.itemHeight);
                    return (
                      <div
                        key={i}
                        className="apv2-flow-item"
                        style={dragActive ? {
                          transform:  `translateY(${ty}px)`,
                          transition: "transform 0.15s ease",
                          opacity:    i === drag.current.srcIdx ? 0 : 1,
                        } : {}}
                      >
                        <div
                          className={`apv2-list-item${flowScreenIdx === i ? " active" : ""}`}
                          onClick={() => setFlowScreenIdx(flowScreenIdx === i ? null : i)}
                        >
                          <span
                            className="apv2-drag-handle"
                            onPointerDown={(e) => handleHandlePointerDown(e, i)}
                            onClick={(e) => e.stopPropagation()}
                            title="Drag to reorder"
                            style={{ touchAction: "none", cursor: dragActive ? "grabbing" : "grab" }}
                          >⠿</span>
                          <span className="apv2-list-num">{i + 1}</span>
                          <div className="apv2-list-thumb" style={{ background: thumbBg(i) }}>
                            {previewUrls[i] && <img src={previewUrls[i]} alt="" draggable={false} />}
                          </div>
                          <span className="apv2-list-name">{f.name}</span>
                          <button
                            className="apv2-list-remove"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                            title="Remove"
                          >×</button>
                        </div>
                        {i < imageFiles.length - 1 && (
                          <div className="apv2-flow-arrow">↓</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="apv2-add-more"
                onClick={() => fileInputRef.current?.click()}
              >
                + Add more images
              </button>
            </div>

            {/* Right panel */}
            <div className="apv2-right">
              {mode === "image" ? (
                <>
                  <p className="apv2-section-label">
                    {imageFiles.length > 1
                      ? `Image ${selectedIdx + 1} of ${imageFiles.length}`
                      : "Image details"}
                  </p>

                  <div className="apv2-field">
                    <label className="apv2-label">Title</label>
                    <input
                      className="apv2-input"
                      value={meta.title}
                      onChange={(e) => updateMeta(selectedIdx, "title", e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="apv2-field">
                    <label className="apv2-label">Tags</label>
                    <div className="apv2-tag-box">
                      {meta.tags.map((t) => (
                        <span key={t} className="apv2-tag-pill">
                          {t}
                          <button className="apv2-tag-remove" onClick={() => removeImageTag(selectedIdx, t)}>×</button>
                        </span>
                      ))}
                      <input
                        className="apv2-tag-input"
                        placeholder="add tag..."
                        value={meta.tagInput}
                        onChange={(e) => updateMeta(selectedIdx, "tagInput", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); addImageTag(selectedIdx); }
                        }}
                      />
                    </div>
                  </div>

                  <div className="apv2-field">
                    <label className="apv2-label">Collection</label>
                    <select
                      className="apv2-input apv2-select"
                      value={meta.collectionId}
                      onChange={(e) => updateMeta(selectedIdx, "collectionId", e.target.value)}
                    >
                      <option value="">None</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="apv2-field">
                    <label className="apv2-label">Note</label>
                    <textarea
                      className="apv2-input apv2-textarea"
                      placeholder="Optional note..."
                      value={meta.note}
                      onChange={(e) => updateMeta(selectedIdx, "note", e.target.value)}
                      rows={4}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="apv2-field">
                    <label className="apv2-label">Flow title</label>
                    <input
                      className="apv2-input"
                      placeholder="e.g. Spotify onboarding"
                      value={flowTitle}
                      onChange={(e) => setFlowTitle(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="apv2-field">
                    <label className="apv2-label">Collection</label>
                    <select
                      className="apv2-input apv2-select"
                      value={flowCollectionId}
                      onChange={(e) => setFlowCollectionId(e.target.value)}
                    >
                      <option value="">None</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="apv2-field">
                    <label className="apv2-label">Tags</label>
                    <div className="apv2-tag-box">
                      {flowTags.map((t) => (
                        <span key={t} className="apv2-tag-pill">
                          {t}
                          <button
                            className="apv2-tag-remove"
                            onClick={() => setFlowTags((prev) => prev.filter((x) => x !== t))}
                          >×</button>
                        </span>
                      ))}
                      <input
                        className="apv2-tag-input"
                        placeholder="add tag..."
                        value={flowTagInput}
                        onChange={(e) => setFlowTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); addFlowTag(); }
                        }}
                      />
                    </div>
                  </div>

                  {flowScreenIdx !== null ? (
                    <div className="apv2-field">
                      <label className="apv2-label">Note for screen {flowScreenIdx + 1}</label>
                      <textarea
                        className="apv2-input apv2-textarea"
                        placeholder="Optional note..."
                        rows={3}
                      />
                    </div>
                  ) : (
                    <p className="apv2-hint-text">
                      Click a screen on the left to add an optional note to it.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="apv2-footer">
          <span className="apv2-footer-hint">
            {!hasFiles
              ? "Drag images here or click to browse"
              : mode === "flow"
                ? "Drag handles to reorder screens"
                : imageFiles.length > 1
                  ? "Click an image to edit details"
                  : ""}
          </span>
          <div className="apv2-footer-actions">
            <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
            {hasFiles && (
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saveLabel}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Floating ghost — shown while dragging a flow screen */}
      {dragActive && (
        <div
          ref={ghostRef}
          className="apv2-drag-ghost"
          style={{ left: drag.current.initLeft, top: drag.current.initTop, width: drag.current.initWidth }}
        >
          <div className="apv2-list-item">
            <span className="apv2-drag-handle" style={{ opacity: 1, cursor: "grabbing" }}>⠿</span>
            <span className="apv2-list-num">{drag.current.srcIdx + 1}</span>
            <div className="apv2-list-thumb" style={{ background: thumbBg(drag.current.srcIdx) }}>
              {previewUrls[drag.current.srcIdx] && (
                <img src={previewUrls[drag.current.srcIdx]} alt="" draggable={false} style={{ pointerEvents: "none" }} />
              )}
            </div>
            <span className="apv2-list-name">{imageFiles[drag.current.srcIdx]?.name}</span>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onAddFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
