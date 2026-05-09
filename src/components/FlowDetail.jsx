import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import { TagInputBox } from "./ui/TagInputBox";
import { CollectionChip } from "./ui/CollectionChip";
import ContextMenu from "./ContextMenu";

export default function FlowDetail({
  flow,
  imageUrls,
  collections,
  allTags = [],
  onUpdate,
  onDelete,
  onClose,
  onAddNewCollection,
}) {
  const screens = flow.screens ?? [];

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [metaHidden, setMetaHidden]   = useState(false);
  const [metaWidth,  setMetaWidth]    = useState(
    () => parseInt(localStorage.getItem("tome_flow_detail_meta_width") || "320")
  );
  const [dotMenuPos, setDotMenuPos]   = useState(null);

  const dotBtnRef = useRef(null);

  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx < screens.length - 1;

  const goTo = useCallback((idx) => {
    setSelectedIdx(Math.max(0, Math.min(idx, screens.length - 1)));
  }, [screens.length]);

  // Reset to first screen when flow changes
  useEffect(() => {
    setSelectedIdx(0);
    setDotMenuPos(null);
  }, [flow.id]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft"  && hasPrev) goTo(selectedIdx - 1);
      if (e.key === "ArrowRight" && hasNext) goTo(selectedIdx + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, hasPrev, hasNext, selectedIdx, goTo]);

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
      action: () => { onDelete(flow.id); onClose(); },
    },
  ];

  return (
    <div className="detail-backdrop" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Topbar ── */}
        <div className="detail-topbar">
          <div className="detail-topbar-nav">
            <button
              className="btn-icon"
              onClick={() => hasPrev && goTo(selectedIdx - 1)}
              disabled={!hasPrev}
              title="Previous screen (←)"
            >
              <LucideIcons.ChevronLeft size={15} />
            </button>
            <button
              className="btn-icon"
              onClick={() => hasNext && goTo(selectedIdx + 1)}
              disabled={!hasNext}
              title="Next screen (→)"
            >
              <LucideIcons.ChevronRight size={15} />
            </button>
            {screens.length > 1 && (
              <span className="detail-topbar-counter">
                {selectedIdx + 1} / {screens.length}
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

          {/* Carousel area — static placeholder, wired up in Task 3 */}
          <div className="flow-carousel-area">
            {screens[selectedIdx] && imageUrls[screens[selectedIdx].id]
              ? <img
                  src={imageUrls[screens[selectedIdx].id]}
                  alt={`Screen ${selectedIdx + 1}`}
                  style={{
                    maxHeight: "calc(100% - 32px)",
                    maxWidth: "calc(100% - 160px)",
                    objectFit: "contain",
                    borderRadius: 6,
                  }}
                />
              : <div className="flow-carousel-placeholder" />
            }
          </div>

          {/* Metadata panel — placeholder, filled in Task 4 */}
          {!metaHidden && (
            <>
              <div className="detail-meta-resize-handle" onMouseDown={handleMetaResizeStart} />
              <div className="detail-meta-side" style={{ width: metaWidth, flex: "none" }}>
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
    </div>
  );
}
