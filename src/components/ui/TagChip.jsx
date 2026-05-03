import { Hash, X } from "lucide-react";

export function TagChip({ label, onRemove }) {
  return (
    <span className="ui-tag-chip">
      <Hash size={12} strokeWidth={2} />
      <span className="ui-tag-chip-label">{label}</span>
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
