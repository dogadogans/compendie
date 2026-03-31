import { useState, useEffect, useRef } from "react";

export default function ContextMenu({ x, y, items: menuItems, onClose }) {
  const ref = useRef(null);
  const [inlineInput, setInlineInput] = useState(null); // { index, value, onConfirm }

  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (!ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    const vw = window.innerWidth, vh = window.innerHeight;
    setPos({
      x: x + w > vw ? Math.max(0, vw - w - 8) : x,
      y: y + h > vh ? Math.max(0, vh - h - 8) : y,
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const confirmInline = () => {
    if (!inlineInput) return;
    const val = inlineInput.value.trim();
    if (val) inlineInput.onConfirm(val);
    onClose();
  };

  return (
    <div ref={ref} className="ctx-menu" style={{ left: pos.x, top: pos.y }}>
      {menuItems.map((item, i) => {
        if (item === "---") return <div key={i} className="ctx-divider" />;

        // Inline input mode for this item
        if (inlineInput?.index === i) {
          return (
            <div key={i} className="ctx-inline-input-row">
              <input
                className="ctx-inline-input"
                value={inlineInput.value}
                onChange={(e) => setInlineInput((s) => ({ ...s, value: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); confirmInline(); }
                  if (e.key === "Escape") onClose();
                }}
                autoFocus
              />
              <button className="ctx-inline-confirm" onClick={confirmInline}>↵</button>
            </div>
          );
        }

        return (
          <button key={i} className={`ctx-item${item.danger ? " danger" : ""}`}
            onClick={() => {
              if (item.inputDefault !== undefined) {
                // Switch this row to inline input mode instead of closing
                setInlineInput({ index: i, value: item.inputDefault, onConfirm: item.action });
              } else {
                onClose();
                item.action();
              }
            }}>
            {item.icon && <span className="ctx-icon">{item.icon}</span>}
            <span className="ctx-label">{item.label}</span>
            {item.hint && <span className="ctx-hint">{item.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
