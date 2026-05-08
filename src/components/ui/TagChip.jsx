import { useState } from "react";
import { Hash, X } from "lucide-react";

export function TagChip({ label, onRemove, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(label);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim().toLowerCase();
    if (trimmed && trimmed !== label) onRename(trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
  };

  return (
    <span className="ui-tag-chip">
      <Hash size={12} strokeWidth={2} />
      {editing ? (
        <input
          className="ui-tag-chip-rename-input"
          value={draft}
          size={Math.max(4, draft.length + 1)}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="ui-tag-chip-label"
          onClick={onRename ? startEdit : undefined}
          style={onRename ? { cursor: "text" } : undefined}
        >
          {label}
        </span>
      )}
      {onRemove && (
        <button
          className="ui-tag-chip-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          tabIndex={-1}
          aria-label={`Remove tag ${label}`}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
