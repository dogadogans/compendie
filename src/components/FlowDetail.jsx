import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import { TagChip } from "./ui/TagChip";
import { CollectionChip } from "./ui/CollectionChip";
import ContextMenu from "./ContextMenu";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

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

  const [scrollOffset, setScrollOffset] = useState(0);
  const [metaHidden, setMetaHidden]   = useState(false);
  const [metaWidth,  setMetaWidth]    = useState(
    () => parseInt(localStorage.getItem("tome_flow_detail_meta_width") || "320")
  );
  const [zoom,       setZoom]         = useState(1);
  const [dotMenuPos, setDotMenuPos]   = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const areaRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const prevItemWidthRef = useRef(0);
  const zoomRef = useRef(zoom);

  const [title,       setTitle]       = useState(flow.title);
  const [tags,        setTags]        = useState(flow.tags  ?? []);
  const [note,        setNote]        = useState(flow.note  ?? "");
  const [colPickerPos, setColPickerPos] = useState(null);
  const [tagPickerPos, setTagPickerPos] = useState(null);

  const titleRef  = useRef(null);
  const noteRef   = useRef(null);
  const colBtnRef = useRef(null);
  const tagBtnRef = useRef(null);

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
  const openTagPicker = () => {
    const rect = tagBtnRef.current?.getBoundingClientRect();
    if (rect) setTagPickerPos({ x: rect.left, y: rect.bottom + 4 });
  };

  const activeCollections = (collections ?? []).filter((c) => flow.collections.includes(c.id));

  const allTagsMerged = [...new Set([...allTags, ...tags])];
  const tagMenuItems = allTagsMerged.map((t) => ({
    icon: LucideIcons.Hash,
    iconColor: "var(--green-300)",
    label: t,
    checked: tags.includes(t),
    action: () => { if (tags.includes(t)) removeTag(t); else addTag(t); },
    keepOpen: true,
  }));

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

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const itemWidth = containerWidth > 0 ? (containerWidth * zoom) / 2 : 0;
  const maxOffset = itemWidth > 0 ? (screens.length - 1) * itemWidth : 0;
  const selectedIdx = itemWidth > 0
    ? Math.max(0, Math.min(Math.round(scrollOffset / itemWidth), screens.length - 1))
    : 0;
  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx < screens.length - 1;

  const goTo = (idx) => {
    const clamped = Math.max(0, Math.min(idx, screens.length - 1));
    const offset = clamped * itemWidth;
    setScrollOffset(offset);
    scrollOffsetRef.current = offset;
  };

  // Reset when flow changes
  useEffect(() => {
    setScrollOffset(0);
    scrollOffsetRef.current = 0;
    prevItemWidthRef.current = 0;
    setTitle(flow.title);
    setTags(flow.tags  ?? []);
    setNote(flow.note  ?? "");
    setColPickerPos(null);
    setTagPickerPos(null);
    setDotMenuPos(null);
    setZoom(1);
    if (titleRef.current) titleRef.current.innerText = flow.title || "";
    requestAnimationFrame(() => autoResize(noteRef.current));
  }, [flow.id]);

  // Ctrl+wheel over the carousel → zoom screens
  useEffect(() => {
    const el = areaRef.current;
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

  // Keep scroll position on the same item when itemWidth changes (resize / sidebar toggle)
  useEffect(() => {
    if (itemWidth === 0) return;
    if (prevItemWidthRef.current > 0 && prevItemWidthRef.current !== itemWidth) {
      const idx = Math.round(scrollOffsetRef.current / prevItemWidthRef.current);
      const clamped = Math.max(0, Math.min(idx, screens.length - 1));
      const next = clamped * itemWidth;
      setScrollOffset(next);
      scrollOffsetRef.current = next;
    }
    prevItemWidthRef.current = itemWidth;
  }, [itemWidth, screens.length]);

  useEffect(() => {
    if (!areaRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(areaRef.current);
    return () => ro.disconnect();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (e.key === "ArrowLeft"  && hasPrevItem) onNavigate(allItems[allCurrentIndex - 1]);
      if (e.key === "ArrowRight" && hasNextItem) onNavigate(allItems[allCurrentIndex + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, hasPrevItem, hasNextItem, allCurrentIndex, allItems]);

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

  const handleCarouselMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startOffset = scrollOffsetRef.current;
    const currentMax = maxOffset;

    const onMove = (ev) => {
      const delta = startX - ev.clientX;
      const next = Math.max(0, Math.min(startOffset + delta, currentMax));
      setScrollOffset(next);
      scrollOffsetRef.current = next;
      setIsDragging(true);
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setIsDragging(false);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
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

          {/* Zoom slider */}
          <div className="detail-topbar-zoom">
            <input
              type="range"
              className="detail-zoom-slider"
              min={0}
              max={ZOOM_STEPS.length - 1}
              value={ZOOM_STEPS.indexOf(zoom) !== -1 ? ZOOM_STEPS.indexOf(zoom) : 2}
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

          {/* Carousel */}
          <div
            ref={areaRef}
            className="flow-carousel-area"
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            onMouseDown={handleCarouselMouseDown}
          >
            {screens.length > 1 && (
              <>
                <button
                  className="flow-carousel-nav flow-carousel-nav--left"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => goTo(selectedIdx - 1)}
                  disabled={!hasPrev}
                >
                  <LucideIcons.ChevronLeft size={16} />
                </button>
                <button
                  className="flow-carousel-nav flow-carousel-nav--right"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => goTo(selectedIdx + 1)}
                  disabled={!hasNext}
                >
                  <LucideIcons.ChevronRight size={16} />
                </button>
                <span className="flow-carousel-screen-counter">{selectedIdx + 1} / {screens.length}</span>
              </>
            )}
            {itemWidth > 0 && (
              <div
                className="flow-carousel-track"
                style={{ transform: `translateX(${-scrollOffset}px)` }}
              >
                {screens.map((screen, idx) => (
                  <div
                    key={screen.id}
                    className="flow-carousel-item"
                    style={{ width: itemWidth }}
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
                <div className="detail-pills-row">
                  {tags.map((t) => (
                    <TagChip key={t} label={t} onRemove={() => removeTag(t)} onRename={(newName) => renameTag(t, newName)} />
                  ))}
                  <button ref={tagBtnRef} className="detail-add-btn" onClick={openTagPicker}><LucideIcons.Plus size={16} /></button>
                </div>

                <div className="detail-meta-footer">
                  <p className="panel-date">{formattedDate}</p>
                </div>

              </div>
            </>
          )}
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
