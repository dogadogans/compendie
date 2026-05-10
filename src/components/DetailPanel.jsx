import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import { TagChip } from "./ui/TagChip";
import { CollectionChip } from "./ui/CollectionChip";
import ContextMenu from "./ContextMenu";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

export default function DetailPanel({
  item,
  allItems,
  imageUrls,
  collections,
  allTags = [],
  onUpdate,
  onDelete,
  onClose,
  onNavigate,
  onCreateCollection,
  onAddNewCollection,
}) {
  const [title, setTitle]             = useState(item.title);
  const [tags,  setTags]              = useState(item.tags);
  const [note,  setNote]              = useState(item.note);
  const [zoom,  setZoom]              = useState(1);
  const [metaHidden,  setMetaHidden]  = useState(false);
  const [metaWidth,   setMetaWidth]   = useState(
    () => parseInt(localStorage.getItem("tome_detail_meta_width") || "320")
  );
  const [panX,  setPanX]  = useState(0);
  const [panY,  setPanY]  = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [colPickerPos, setColPickerPos] = useState(null);
  const [tagPickerPos, setTagPickerPos] = useState(null);
  const [dotMenuPos,   setDotMenuPos]   = useState(null);

  const zoomRef    = useRef(zoom);
  const imgAreaRef = useRef(null);
  const colBtnRef  = useRef(null);
  const tagBtnRef  = useRef(null);
  const dotBtnRef  = useRef(null);
  const titleRef   = useRef(null);
  const noteRef    = useRef(null);

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const currentIndex = allItems.findIndex((i) => i.id === item.id);
  const hasPrev      = currentIndex > 0;
  const hasNext      = currentIndex < allItems.length - 1;
  const imageUrl     = imageUrls[item.id];

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    setTitle(item.title);
    setTags(item.tags);
    setNote(item.note);
    setColPickerPos(null);
    setTagPickerPos(null);
    setDotMenuPos(null);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    if (titleRef.current) titleRef.current.innerText = item.title || "";
    requestAnimationFrame(() => autoResize(noteRef.current));
  }, [item.id]);

  // Reset pan when returning to 1:1
  useEffect(() => {
    if (zoom === 1) { setPanX(0); setPanY(0); }
  }, [zoom]);

  // Ctrl+wheel over the image area → zoom image
  useEffect(() => {
    const el = imgAreaRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const z = zoomRef.current;
      if (e.deltaY < 0) {
        const next = ZOOM_STEPS.find(s => s > z);
        if (next !== undefined) setZoom(next);
      } else {
        const prev = [...ZOOM_STEPS].reverse().find(s => s < z);
        if (prev !== undefined) setZoom(prev);
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Keyboard: Escape to close, arrows to navigate
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (e.key === "ArrowLeft"  && hasPrev) onNavigate(allItems[currentIndex - 1]);
      if (e.key === "ArrowRight" && hasNext) onNavigate(allItems[currentIndex + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, hasPrev, hasNext, currentIndex, allItems]);

  const handleImgAreaMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    const startX = e.clientX - panX;
    const startY = e.clientY - panY;
    setIsPanning(true);
    const onMove = (ev) => {
      setPanX(ev.clientX - startX);
      setPanY(ev.clientY - startY);
    };
    const onUp = () => {
      setIsPanning(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const saveTitle = () => {
    const t = (titleRef.current?.innerText ?? "").replace(/\n/g, " ").trim();
    if (t !== item.title) onUpdate(item.id, { title: t });
  };
  const saveNote  = () => { if (note  !== item.note)  onUpdate(item.id, { note });  };

  // Tag helpers
  const addTag = (t) => {
    const cleaned = t.trim().toLowerCase();
    if (!cleaned || tags.includes(cleaned)) return;
    const next = [...tags, cleaned];
    setTags(next);
    onUpdate(item.id, { tags: next });
  };
  const removeTag = (t) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    onUpdate(item.id, { tags: next });
  };
  const renameTag = (oldTag, newTag) => {
    const cleaned = newTag.trim().toLowerCase();
    if (!cleaned || cleaned === oldTag || tags.includes(cleaned)) return;
    const next = tags.map((t) => (t === oldTag ? cleaned : t));
    setTags(next);
    onUpdate(item.id, { tags: next });
  };

  // Collection helper
  const toggleCollection = (colId) => {
    const next = item.collections.includes(colId)
      ? item.collections.filter((id) => id !== colId)
      : [...item.collections, colId];
    onUpdate(item.id, { collections: next });
  };

  // ContextMenu items for tags
  const allTagsMerged = [...new Set([...allTags, ...tags])];
  const tagMenuItems = allTagsMerged.map((t) => ({
    icon: LucideIcons.Hash,
    iconColor: "var(--green-300)",
    label: t,
    checked: tags.includes(t),
    action: () => { if (tags.includes(t)) removeTag(t); else addTag(t); },
    keepOpen: true,
  }));

  // ContextMenu items for collections
  const colMenuItems = collections
    .filter((c) => !c.archived)
    .map((c) => ({
      icon: LucideIcons[c.icon] ?? LucideIcons.Folder,
      iconColor: c.color || undefined,
      label: c.name,
      checked: item.collections.includes(c.id),
      action: () => toggleCollection(c.id),
    }));

  // Dot menu items
  const dotMenuItems = [
    {
      icon: LucideIcons.Trash2,
      label: "Delete",
      danger: true,
      action: () => { onDelete(item.id); onClose(); },
    },
  ];

  const openColPicker = () => {
    const rect = colBtnRef.current?.getBoundingClientRect();
    if (rect) setColPickerPos({ x: rect.left, y: rect.bottom + 4 });
  };
  const openTagPicker = () => {
    const rect = tagBtnRef.current?.getBoundingClientRect();
    if (rect) setTagPickerPos({ x: rect.left, y: rect.bottom + 4 });
  };
  const openDotMenu = () => {
    const rect = dotBtnRef.current?.getBoundingClientRect();
    if (rect) setDotMenuPos({ x: rect.right - 160, y: rect.bottom + 4 });
  };

  const handleMetaResizeStart = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = metaWidth;
    const onMove = (ev) => {
      const next = Math.min(520, Math.max(240, startWidth + (startX - ev.clientX)));
      setMetaWidth(next);
      localStorage.setItem("tome_detail_meta_width", next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const activeCollections = collections.filter((c) => item.collections.includes(c.id));

  const fileExt = item.image_path
    ? "." + item.image_path.split(".").pop().toLowerCase()
    : null;

  const formattedDate = new Date(item.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const zoomStepIndex = ZOOM_STEPS.indexOf(zoom) !== -1 ? ZOOM_STEPS.indexOf(zoom) : 2;

  return (
    <>
        {/* ── Top bar ── */}
        <div className="detail-topbar">
          <div className="detail-topbar-nav">
            <button
              className="btn-icon"
              onClick={() => hasPrev && onNavigate(allItems[currentIndex - 1])}
              disabled={!hasPrev}
              title="Previous (←)"
            >
              <LucideIcons.ChevronLeft size={15} />
            </button>
            <button
              className="btn-icon"
              onClick={() => hasNext && onNavigate(allItems[currentIndex + 1])}
              disabled={!hasNext}
              title="Next (→)"
            >
              <LucideIcons.ChevronRight size={15} />
            </button>
            {allItems.length > 1 && (
              <span className="detail-topbar-counter">{currentIndex + 1} / {allItems.length}</span>
            )}
          </div>

          {/* Zoom slider */}
          <div className="detail-topbar-zoom">
            <input
              type="range"
              className="detail-zoom-slider"
              min={0}
              max={ZOOM_STEPS.length - 1}
              value={zoomStepIndex}
              onChange={(e) => setZoom(ZOOM_STEPS[parseInt(e.target.value)])}
              title={`Zoom: ${Math.round(zoom * 100)}%`}
            />
          </div>

          <div className="detail-topbar-actions">
            <button
              className="btn-icon"
              onClick={() => setMetaHidden((v) => !v)}
              title={metaHidden ? "Show panel" : "Hide panel"}
            >
              <LucideIcons.PanelRight size={15} />
            </button>
            <button
              ref={dotBtnRef}
              className="btn-icon"
              onClick={openDotMenu}
              title="More options"
            >
              <LucideIcons.MoreHorizontal size={15} />
            </button>
            <button className="btn-icon" onClick={onClose} title="Close (Esc)">
              <LucideIcons.X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="detail-body">

          {/* Image side */}
          <div
            ref={imgAreaRef}
            className="detail-img-area"
            style={{ cursor: isPanning ? "grabbing" : zoom > 1 ? "grab" : "default" }}
            onMouseDown={handleImgAreaMouseDown}
          >
            {imageUrl
              ? <img
                  src={imageUrl}
                  alt={title || "image"}
                  className="detail-img"
                  style={{
                    transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
              : <div className="detail-img-placeholder" />
            }
          </div>

          {/* Metadata side */}
          {!metaHidden && (
            <>
            <div className="detail-meta-resize-handle" onMouseDown={handleMetaResizeStart} />
            <div className="detail-meta-side" style={{ width: metaWidth, flex: "none" }}>

              <div className="detail-meta-title-row" onClick={() => titleRef.current?.focus()}>
                <div
                  ref={titleRef}
                  className="detail-meta-title"
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Untitled"
                  onInput={(e) => {
                    const text = e.currentTarget.innerText.replace(/\n/g, " ");
                    if (text.length > 120) {
                      e.currentTarget.innerText = text.slice(0, 120);
                      const range = document.createRange();
                      range.selectNodeContents(e.currentTarget);
                      range.collapse(false);
                      const sel = window.getSelection();
                      sel.removeAllRanges();
                      sel.addRange(range);
                    }
                    setTitle(e.currentTarget.innerText);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  onBlur={saveTitle}
                />
                {fileExt && <span className="detail-meta-ext">{fileExt}</span>}
              </div>

              <textarea
                ref={noteRef}
                className="detail-meta-note"
                placeholder="no notes"
                value={note}
                maxLength={1000}
                style={{ fontSize: note.length < 600 ? 14 : Math.max(11, 14 - ((note.length - 600) / 400) * 3) + "px" }}
                onChange={(e) => { setNote(e.target.value); autoResize(e.target); }}
                onBlur={saveNote}
              />

              <div className="detail-meta-divider" />

              {/* Collections */}
              <span className="detail-meta-label">Collections</span>
              <div className="detail-pills-row">
                {activeCollections.map((col) => (
                  <CollectionChip
                    key={col.id}
                    name={col.name}
                    color={col.color}
                    icon={col.icon}
                    onRemove={() => toggleCollection(col.id)}
                  />
                ))}
                <button ref={colBtnRef} className="detail-add-btn" onClick={openColPicker}><LucideIcons.Plus size={16} /></button>
              </div>

              {/* Tags */}
              <span className="detail-meta-label" style={{ marginTop: "14px" }}>Tags</span>
              <div className="detail-pills-row">
                {tags.map((t) => (
                  <TagChip key={t} label={t} onRemove={() => removeTag(t)} onRename={(newName) => renameTag(t, newName)} />
                ))}
                <button ref={tagBtnRef} className="detail-add-btn" onClick={openTagPicker}><LucideIcons.Plus size={16} /></button>
              </div>

              {/* Footer */}
              <div className="detail-meta-footer">
                <p className="panel-date">{formattedDate}</p>
              </div>

            </div>
            </>
          )}
        </div>

      {/* Collection picker portal */}
      {colPickerPos && createPortal(
        <div onClick={(e) => e.stopPropagation()}>
          <ContextMenu
            x={colPickerPos.x}
            y={colPickerPos.y}
            items={colMenuItems}
            searchable
            onAddNew={(name) => {
              setColPickerPos(null);
              onAddNewCollection?.(name);
            }}
            onClose={() => setColPickerPos(null)}
          />
        </div>,
        document.body
      )}

      {/* Tag picker portal */}
      {tagPickerPos && createPortal(
        <div onClick={(e) => e.stopPropagation()}>
          <ContextMenu
            x={tagPickerPos.x}
            y={tagPickerPos.y}
            items={tagMenuItems}
            searchable
            onAddNew={(name) => {
              addTag(name);
              setTagPickerPos(null);
            }}
            onClose={() => setTagPickerPos(null)}
          />
        </div>,
        document.body
      )}

      {/* Dot menu portal */}
      {dotMenuPos && createPortal(
        <div onClick={(e) => e.stopPropagation()}>
          <ContextMenu
            x={dotMenuPos.x}
            y={dotMenuPos.y}
            items={dotMenuItems}
            onClose={() => setDotMenuPos(null)}
          />
        </div>,
        document.body
      )}
    </>
  );
}
