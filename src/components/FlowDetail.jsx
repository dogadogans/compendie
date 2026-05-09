import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import { TagInputBox } from "./ui/TagInputBox";
import { CollectionChip } from "./ui/CollectionChip";
import ContextMenu from "./ContextMenu";

const CARD_GAP = 16;

export default function FlowDetail({
  flow,
  allItems,
  imageUrls,
  collections,
  allTags = [],
  onUpdate,
  onDelete,
  onClose,
  onNavigate,
  onAddNewCollection,
}) {
  const screens = flow.screens ?? [];

  const allCurrentIndex = allItems.findIndex((i) => i.id === flow.id);
  const hasPrevItem = allCurrentIndex > 0;
  const hasNextItem = allCurrentIndex < allItems.length - 1;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [metaHidden, setMetaHidden]   = useState(false);
  const [metaWidth,  setMetaWidth]    = useState(
    () => parseInt(localStorage.getItem("tome_flow_detail_meta_width") || "320")
  );
  const [dotMenuPos, setDotMenuPos]   = useState(null);

  const areaRef         = useRef(null);
  const selectedIdxRef  = useRef(selectedIdx);
  const [containerWidth, setContainerWidth] = useState(0);
  const [cardWidth,      setCardWidth]      = useState(0);
  const [dragDelta,  setDragDelta]  = useState(0);
  const [isSnapping, setIsSnapping] = useState(true);

  const [title,       setTitle]       = useState(flow.title);
  const [tags,        setTags]        = useState(flow.tags  ?? []);
  const [note,        setNote]        = useState(flow.note  ?? "");
  const [colPickerPos, setColPickerPos] = useState(null);

  const titleRef  = useRef(null);
  const noteRef   = useRef(null);
  const colBtnRef = useRef(null);

  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  const saveTitle = () => {
    const t = (titleRef.current?.innerText ?? "").replace(/\n/g, " ").trim();
    if (t !== flow.title) onUpdate(flow.id, { title: t });
  };
  const saveNote = () => { if (note !== flow.note) onUpdate(flow.id, { note }); };

  const addTag = (t) => {
    const cleaned = t.trim().toLowerCase();
    if (!cleaned || tags.includes(cleaned)) return;
    const next = [...tags, cleaned];
    setTags(next);
    onUpdate(flow.id, { tags: next });
  };
  const removeTag = (t) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    onUpdate(flow.id, { tags: next });
  };
  const renameTag = (oldTag, newTag) => {
    const cleaned = newTag.trim().toLowerCase();
    if (!cleaned || cleaned === oldTag || tags.includes(cleaned)) return;
    const next = tags.map((tg) => (tg === oldTag ? cleaned : tg));
    setTags(next);
    onUpdate(flow.id, { tags: next });
  };

  const toggleCollection = (colId) => {
    const next = flow.collections.includes(colId)
      ? flow.collections.filter((id) => id !== colId)
      : [...flow.collections, colId];
    onUpdate(flow.id, { collections: next });
  };

  const openColPicker = () => {
    const rect = colBtnRef.current?.getBoundingClientRect();
    if (rect) setColPickerPos({ x: rect.left, y: rect.bottom + 4 });
  };

  const activeCollections = (collections ?? []).filter((c) => flow.collections.includes(c.id));

  const colMenuItems = (collections ?? [])
    .filter((c) => !c.archived)
    .map((c) => ({
      icon: LucideIcons[c.icon] ?? LucideIcons.Folder,
      iconColor: c.color || undefined,
      label: c.name,
      checked: flow.collections.includes(c.id),
      action: () => toggleCollection(c.id),
    }));

  const dotBtnRef = useRef(null);

  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx < screens.length - 1;

  const goTo = useCallback((idx) => {
    setSelectedIdx(Math.max(0, Math.min(idx, screens.length - 1)));
  }, [screens.length]);

  // Reset to first screen when flow changes
  useEffect(() => {
    setSelectedIdx(0);
    setTitle(flow.title);
    setTags(flow.tags  ?? []);
    setNote(flow.note  ?? "");
    setColPickerPos(null);
    setDotMenuPos(null);
    if (titleRef.current) titleRef.current.innerText = flow.title || "";
    requestAnimationFrame(() => autoResize(noteRef.current));
  }, [flow.id]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (e.key === "ArrowLeft"  && hasPrev) goTo(selectedIdx - 1);
      if (e.key === "ArrowRight" && hasNext) goTo(selectedIdx + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, hasPrev, hasNext, selectedIdx, goTo]);

  useEffect(() => { selectedIdxRef.current = selectedIdx; }, [selectedIdx]);

  useEffect(() => {
    if (!areaRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setContainerWidth(w);
      setCardWidth(Math.min(w * 0.46, 320));
    });
    ro.observe(areaRef.current);
    return () => ro.disconnect();
  }, []);

  const handleCarouselMouseDown = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    let delta = 0;

    const onMove = (ev) => {
      delta = ev.clientX - startX;
      setDragDelta(delta);
      setIsSnapping(false);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      const idx = selectedIdxRef.current;
      const len = screens.length;
      if (delta < -60 && idx < len - 1) goTo(idx + 1);
      else if (delta > 60 && idx > 0)   goTo(idx - 1);
      setDragDelta(0);
      setIsSnapping(true);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }, [screens.length, goTo]);

  const openDotMenu = () => {
    const rect = dotBtnRef.current?.getBoundingClientRect();
    if (rect) setDotMenuPos({ x: rect.right - 160, y: rect.bottom + 4 });
  };

  const handleMetaResizeStart = (e) => {
    e.preventDefault();
    const startX    = e.clientX;
    const startWidth = metaWidth;
    const onMove = (ev) => {
      const next = Math.min(520, Math.max(240, startWidth + (startX - ev.clientX)));
      setMetaWidth(next);
      localStorage.setItem("tome_flow_detail_meta_width", next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",  onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  const formattedDate = new Date(flow.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const dotMenuItems = [
    {
      icon: LucideIcons.Trash2,
      label: "Delete",
      danger: true,
      action: () => onDelete(flow.id),
    },
  ];

  return (
    <>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Topbar ── */}
        <div className="detail-topbar">
          <div className="detail-topbar-nav">
            <button
              className="btn-icon"
              onClick={() => hasPrevItem && onNavigate(allItems[allCurrentIndex - 1])}
              disabled={!hasPrevItem}
              title="Previous (←)"
            >
              <LucideIcons.ChevronLeft size={15} />
            </button>
            <button
              className="btn-icon"
              onClick={() => hasNextItem && onNavigate(allItems[allCurrentIndex + 1])}
              disabled={!hasNextItem}
              title="Next (→)"
            >
              <LucideIcons.ChevronRight size={15} />
            </button>
            {allItems.length > 1 && (
              <span className="detail-topbar-counter">
                {allCurrentIndex + 1} / {allItems.length}
              </span>
            )}
          </div>

          <div style={{ flex: 1 }} />

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

          {/* Carousel */}
          <div
            ref={areaRef}
            className="flow-carousel-area"
            style={{ cursor: "grab" }}
            onMouseDown={handleCarouselMouseDown}
          >
            {screens.length > 1 && (
              <>
                <button
                  className="flow-carousel-nav flow-carousel-nav--left"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); goTo(selectedIdx - 1); }}
                  disabled={!hasPrev}
                >
                  <LucideIcons.ChevronLeft size={16} />
                </button>
                <button
                  className="flow-carousel-nav flow-carousel-nav--right"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); goTo(selectedIdx + 1); }}
                  disabled={!hasNext}
                >
                  <LucideIcons.ChevronRight size={16} />
                </button>
                <span className="flow-carousel-screen-counter">{selectedIdx + 1} / {screens.length}</span>
              </>
            )}
            {containerWidth > 0 && (
              <div
                className="flow-carousel-track"
                style={{
                  transform:  `translateX(${Math.round(containerWidth / 2 - cardWidth / 2 - selectedIdx * (cardWidth + CARD_GAP)) + dragDelta}px)`,
                  transition: isSnapping ? "transform 200ms ease-out" : "none",
                  gap: CARD_GAP,
                }}
              >
                {screens.map((screen, idx) => (
                  <div
                    key={screen.id}
                    className={`flow-carousel-card${idx !== selectedIdx ? " flow-carousel-card--adjacent" : ""}`}
                    style={{ width: cardWidth }}
                  >
                    {imageUrls[screen.id]
                      ? <img src={imageUrls[screen.id]} alt={`Screen ${idx + 1}`} />
                      : <div className="flow-carousel-placeholder" />
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metadata panel */}
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
                    data-placeholder="Untitled flow"
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
                  <button ref={colBtnRef} className="detail-add-btn" onClick={openColPicker}>
                    <LucideIcons.Plus size={16} />
                  </button>
                </div>

                <span className="detail-meta-label" style={{ marginTop: "14px" }}>Tags</span>
                <TagInputBox
                  compact
                  tags={tags}
                  allTags={allTags}
                  onAdd={addTag}
                  onRemove={removeTag}
                  onRename={renameTag}
                />

                <div className="detail-meta-footer">
                  <p className="panel-date">{formattedDate}</p>
                </div>

              </div>
            </>
          )}
        </div>
      </div>

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
    </>
  );
}
