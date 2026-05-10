import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import { TagChip, CollectionChip } from "./ui";
import ContextMenu from "./ContextMenu";

const THUMB_COLORS = ["#e8e4dc", "#d4e8e0", "#dce4e8", "#e8dce4", "#e8e8dc"];
function thumbBg(i) { return THUMB_COLORS[i % THUMB_COLORS.length]; }

function getItemTranslate(i, src, dst, itemHeight) {
  if (dst === null || dst === src || i === src) return 0;
  if (dst < src) { if (i >= dst && i < src) return itemHeight; }
  else           { if (i > src && i <= dst)  return -itemHeight; }
  return 0;
}

function makeMeta(file, defaultCollectionId) {
  return {
    title:         file ? file.name.replace(/\.[^/.]+$/, "") : "",
    tags:          [],
    tagInput:      "",
    collectionIds: defaultCollectionId ? [defaultCollectionId] : [],
    note:          "",
  };
}

export default function AddOverlay({
  imageFiles,
  collections,
  allTags = [],
  defaultCollectionId = null,
  onSave,
  onSaveFlow,
  onCancel,
  onRemoveFile,
  onReorderFiles,
  onAddFiles,
  onCreateCollection,
}) {
  const [mode,             setMode]             = useState("image");
  const [selectedIdx,      setSelectedIdx]      = useState(0);
  const [imageMetas,       setImageMetas]       = useState(() => imageFiles.map((f) => makeMeta(f, defaultCollectionId)));
  const [flowTitle,          setFlowTitle]          = useState("");
  const [flowTagInput,       setFlowTagInput]       = useState("");
  const [flowTags,           setFlowTags]           = useState([]);
  const [flowCollectionIds,  setFlowCollectionIds]  = useState(() => defaultCollectionId ? [defaultCollectionId] : []);
  const [flowScreenIdx,    setFlowScreenIdx]    = useState(null); // which screen note is open
  const [previewUrls,      setPreviewUrls]      = useState([]);
  const [saving,        setSaving]        = useState(false);
  const [dragActive,    setDragActive]    = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  // Pointer-based lift drag — direct DOM updates for ghost position (no re-render on move)
  const [tagPickerPos, setTagPickerPos] = useState(null);
  const [colPickerPos, setColPickerPos] = useState(null);
  const tagBtnRef = useRef(null);
  const colBtnRef = useRef(null);
  const drag     = useRef({ active: false, srcIdx: null, overIdx: null, offsetX: 0, offsetY: 0, files: [], itemHeight: 0 });
  const ghostRef = useRef(null);
  const listRef  = useRef(null);
  const fileInputRef = useRef(null);

  // Sync imageMetas when files grow
  useEffect(() => {
    setImageMetas((prev) => {
      if (prev.length === imageFiles.length) return prev;
      return imageFiles.map((f, i) => prev[i] ?? makeMeta(f, defaultCollectionId));
    });
    setSelectedIdx((prev) => Math.min(prev, Math.max(0, imageFiles.length - 1)));
  }, [imageFiles]);

  useEffect(() => { setTagPickerPos(null); setColPickerPos(null); }, [selectedIdx, mode]);

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
          collections: flowCollectionIds,
        });
      } else {
        const dataList = await Promise.all(
          imageFiles.map(async (f, i) => ({
            imageBytes:    new Uint8Array(await f.arrayBuffer()),
            originalName:  f.name,
            title:         imageMetas[i]?.title         ?? "",
            tags:          imageMetas[i]?.tags          ?? [],
            note:          imageMetas[i]?.note          ?? "",
            collectionIds: imageMetas[i]?.collectionIds ?? [],
          }))
        );
        await onSave(dataList);
      }
    } catch (e) {
      console.error("Save failed:", e);
      alert("Save failed: " + (e?.message ?? e));
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
          <h2 className="apv2-title">{headerTitle}</h2>
          {hasFiles ? (
            <div className="apv2-tabs">
              <button
                className={`apv2-tab${mode === "image" ? " active" : ""}`}
                onClick={() => setMode("image")}
              >Image</button>
              <button
                className={`apv2-tab${mode === "flow" ? " active" : ""}`}
                onClick={() => setMode("flow")}
              >Flow</button>
            </div>
          ) : <div />}
          <button className="apv2-close-btn" onClick={onCancel} title="Close">×</button>
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
                  <span className="apv2-single-name">{meta.title || imageFiles[0].name}</span>
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
                      <span className="apv2-list-name">{imageMetas[i]?.title || f.name}</span>
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
                          <div className="apv2-flow-arrow">⌄</div>
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
                      : "1 Image"}
                  </p>

                  <div className="apv2-title-group">
                    <input
                      className="apv2-title-input"
                      placeholder="Untitled"
                      value={meta.title}
                      onChange={(e) => updateMeta(selectedIdx, "title", e.target.value)}
                      autoFocus
                    />
                    <textarea
                      className="apv2-note-input"
                      placeholder="add note"
                      value={meta.note}
                      onChange={(e) => updateMeta(selectedIdx, "note", e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div>
                    <span className="detail-meta-label">Tags</span>
                    <div className="detail-pills-row" style={{ marginTop: 8 }}>
                      {meta.tags.map((t) => (
                        <TagChip key={t} label={t} onRemove={() => removeImageTag(selectedIdx, t)} />
                      ))}
                      <button
                        ref={tagBtnRef}
                        className="detail-add-btn"
                        onClick={() => {
                          const rect = tagBtnRef.current?.getBoundingClientRect();
                          if (rect) setTagPickerPos({ x: rect.left, y: rect.bottom + 4 });
                        }}
                      >
                        <LucideIcons.Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="detail-meta-label">Collection</span>
                    <div className="detail-pills-row" style={{ marginTop: 8 }}>
                      {(meta.collectionIds ?? []).map((id) => {
                        const col = collections.find((c) => c.id === id);
                        if (!col) return null;
                        return (
                          <CollectionChip
                            key={id}
                            name={col.name}
                            color={col.color}
                            icon={col.icon}
                            onRemove={() => updateMeta(selectedIdx, "collectionIds", (meta.collectionIds ?? []).filter((x) => x !== id))}
                          />
                        );
                      })}
                      <button
                        ref={colBtnRef}
                        className="detail-add-btn"
                        onClick={() => {
                          const rect = colBtnRef.current?.getBoundingClientRect();
                          if (rect) setColPickerPos({ x: rect.left, y: rect.bottom + 4 });
                        }}
                      >
                        <LucideIcons.Plus size={16} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="apv2-section-label">
                    {imageFiles.length} Image Flow
                  </p>

                  <div className="apv2-title-group">
                    <input
                      className="apv2-title-input"
                      placeholder="Flow name"
                      value={flowTitle}
                      onChange={(e) => setFlowTitle(e.target.value)}
                      autoFocus
                    />
                    <textarea
                      className="apv2-note-input"
                      placeholder="add note"
                      rows={2}
                    />
                  </div>

                  <div>
                    <span className="detail-meta-label">Tags</span>
                    <div className="detail-pills-row" style={{ marginTop: 8 }}>
                      {flowTags.map((t) => (
                        <TagChip key={t} label={t} onRemove={() => setFlowTags((prev) => prev.filter((x) => x !== t))} />
                      ))}
                      <button
                        ref={tagBtnRef}
                        className="detail-add-btn"
                        onClick={() => {
                          const rect = tagBtnRef.current?.getBoundingClientRect();
                          if (rect) setTagPickerPos({ x: rect.left, y: rect.bottom + 4 });
                        }}
                      >
                        <LucideIcons.Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="detail-meta-label">Collection</span>
                    <div className="detail-pills-row" style={{ marginTop: 8 }}>
                      {flowCollectionIds.map((id) => {
                        const col = collections.find((c) => c.id === id);
                        if (!col) return null;
                        return (
                          <CollectionChip
                            key={id}
                            name={col.name}
                            color={col.color}
                            icon={col.icon}
                            onRemove={() => setFlowCollectionIds((prev) => prev.filter((x) => x !== id))}
                          />
                        );
                      })}
                      <button
                        ref={colBtnRef}
                        className="detail-add-btn"
                        onClick={() => {
                          const rect = colBtnRef.current?.getBoundingClientRect();
                          if (rect) setColPickerPos({ x: rect.left, y: rect.bottom + 4 });
                        }}
                      >
                        <LucideIcons.Plus size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="apv2-footer">
          <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          {hasFiles && (
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saveLabel}
            </button>
          )}
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

      {/* Tag picker portal */}
      {tagPickerPos && createPortal(
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ContextMenu
            x={tagPickerPos.x}
            y={tagPickerPos.y}
            searchable
            items={allTags.map((t) => {
              const selectedTags = mode === "flow" ? flowTags : (meta.tags ?? []);
              return {
                icon: LucideIcons.Hash,
                iconColor: "var(--accent)",
                label: t,
                checked: selectedTags.includes(t),
                action: () => {
                  if (mode === "flow") {
                    setFlowTags((prev) =>
                      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                    );
                  } else {
                    const cur = imageMetas[selectedIdx]?.tags ?? [];
                    updateMeta(selectedIdx, "tags",
                      cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]
                    );
                  }
                },
              };
            })}
            onAddNew={(name) => {
              setTagPickerPos(null);
              const t = name.trim().toLowerCase();
              if (!t) return;
              if (mode === "flow") {
                setFlowTags((prev) => prev.includes(t) ? prev : [...prev, t]);
              } else {
                const cur = imageMetas[selectedIdx]?.tags ?? [];
                if (!cur.includes(t)) updateMeta(selectedIdx, "tags", [...cur, t]);
              }
            }}
            onClose={() => setTagPickerPos(null)}
          />
        </div>,
        document.body
      )}

      {/* Collection picker portal */}
      {colPickerPos && createPortal(
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ContextMenu
            x={colPickerPos.x}
            y={colPickerPos.y}
            searchable
            items={collections
              .filter((c) => !c.archived)
              .map((c) => {
                const selectedIds = mode === "flow" ? flowCollectionIds : (meta.collectionIds ?? []);
                return {
                  icon: LucideIcons[c.icon] ?? LucideIcons.Folder,
                  iconColor: c.color || undefined,
                  label: c.name,
                  checked: selectedIds.includes(c.id),
                  action: () => {
                    if (mode === "flow") {
                      setFlowCollectionIds((prev) =>
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                      );
                    } else {
                      updateMeta(selectedIdx, "collectionIds",
                        selectedIds.includes(c.id)
                          ? selectedIds.filter((x) => x !== c.id)
                          : [...selectedIds, c.id]
                      );
                    }
                  },
                };
              })}
            onAddNew={async (name) => {
              setColPickerPos(null);
              const col = await onCreateCollection({ name, icon: "Folder" });
              if (col?.id) {
                if (mode === "flow") {
                  setFlowCollectionIds((prev) => [...prev, col.id]);
                } else {
                  updateMeta(selectedIdx, "collectionIds", [...(meta.collectionIds ?? []), col.id]);
                }
              }
            }}
            onClose={() => setColPickerPos(null)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
