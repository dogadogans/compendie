import { useState, useEffect } from "react";

// ScreenDetailPanel — inline, right side of FlowDetail
function ScreenDetailPanel({ screen, screenIndex, total, imageUrl, onNoteChange }) {
  const [note, setNote] = useState(screen.note || "");

  useEffect(() => { setNote(screen.note || ""); }, [screen.id]);

  return (
    <div className="flow-detail-panel">
      <div className="flow-detail-panel-pos">Screen {screenIndex + 1} of {total}</div>
      {imageUrl && (
        <div className="flow-detail-panel-img">
          <img src={imageUrl} alt={`Screen ${screenIndex + 1}`} />
        </div>
      )}
      <textarea
        className="panel-note"
        placeholder="Add a note for this screen…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => onNoteChange(screen.id, note)}
        style={{ flexShrink: 0 }}
      />
    </div>
  );
}

// Props:
//   flow: the flow item
//   imageUrls: { [screenId]: objectURL }
//   onClose(): close the detail view
//   onEdit(): open FlowBuilder in edit mode for this flow
//   onUpdateScreenNote(flowId, screenId, note): save a screen note change
export default function FlowDetail({ flow, imageUrls, onClose, onEdit, onUpdateScreenNote }) {
  const [selectedIdx, setSelectedIdx] = useState(null);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (selectedIdx === null) return;
      if (e.key === "ArrowRight")
        setSelectedIdx((i) => Math.min(i + 1, flow.screens.length - 1));
      if (e.key === "ArrowLeft")
        setSelectedIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, selectedIdx, flow.screens.length]);

  const selectedScreen = selectedIdx !== null ? flow.screens[selectedIdx] : null;

  return (
    <div className="flow-detail">

      {/* Top bar */}
      <div className="flow-detail-topbar">
        <div>
          <div className="flow-detail-title">{flow.title || "Untitled flow"}</div>
          <div className="flow-detail-meta">{flow.screens.length} screens · Esc to close</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn-ghost" style={{ color: "rgba(255,255,255,0.6)" }} onClick={onEdit}>
            Edit
          </button>
          <button className="panel-close" style={{ color: "rgba(255,255,255,0.5)" }} onClick={onClose}>
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flow-detail-body">

        {/* Horizontal scroll */}
        <div className="flow-detail-scroll">
          {flow.screens.map((screen, idx) => (
            <div
              key={screen.id}
              className={`flow-screen-card${selectedIdx === idx ? " selected" : ""}`}
              onClick={() => setSelectedIdx(idx)}
            >
              {imageUrls[screen.id]
                ? <img src={imageUrls[screen.id]} alt={`Screen ${idx + 1}`} />
                : <div className="flow-screen-placeholder" />}
            </div>
          ))}
        </div>

        {/* Screen detail panel */}
        {selectedScreen && (
          <ScreenDetailPanel
            screen={selectedScreen}
            screenIndex={selectedIdx}
            total={flow.screens.length}
            imageUrl={imageUrls[selectedScreen.id]}
            onNoteChange={(screenId, note) => onUpdateScreenNote(flow.id, screenId, note)}
          />
        )}

      </div>
    </div>
  );
}
