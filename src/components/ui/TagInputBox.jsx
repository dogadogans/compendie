import { useState, useRef, useEffect } from "react";
import { TagChip } from "./TagChip";

export function TagInputBox({ label, tags = [], allTags = [], onAdd, onRemove, placeholder = "add tag..." }) {
  const [value,     setValue]     = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  const trimmed = value.trim().toLowerCase();
  const suggestions = trimmed
    ? allTags.filter((t) => !tags.includes(t) && t.includes(trimmed))
    : [];
  const showCreate = trimmed.length > 0 && !tags.includes(trimmed) && !allTags.includes(trimmed);
  const open = suggestions.length > 0 || showCreate;
  // total navigable rows: suggestions + optional create row
  const totalRows = suggestions.length + (showCreate ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setValue("");
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const commit = (tag) => {
    const t = (tag ?? value).trim().toLowerCase();
    if (t && !tags.includes(t)) onAdd(t);
    setValue("");
    setActiveIdx(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        commit(suggestions[activeIdx]);
      } else {
        // activeIdx === suggestions.length is the "create" row, or -1 means free-type
        commit();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, totalRows - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setValue("");
      setActiveIdx(-1);
    }
  };

  return (
    <div className="ui-field" ref={wrapRef} style={{ position: "relative" }}>
      {label && <label className="ui-field-label">{label}</label>}
      <div className="ui-tag-box" onClick={() => inputRef.current?.focus()}>
        {tags.map((t) => (
          <TagChip key={t} label={t} onRemove={() => onRemove(t)} />
        ))}
        <input
          ref={inputRef}
          className="ui-tag-bare-input"
          placeholder={tags.length === 0 ? placeholder : ""}
          value={value}
          onChange={(e) => { setValue(e.target.value); setActiveIdx(-1); }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {open && (
        <div className="ui-coll-dropdown">
          {suggestions.map((t, i) => (
            <button
              key={t}
              className={`ui-coll-dropdown-item${i === activeIdx ? " active" : ""}`}
              onMouseDown={() => commit(t)}
            >
              {t}
            </button>
          ))}
          {showCreate && (
            <button
              className={`ui-coll-dropdown-item ui-coll-dropdown-create${activeIdx === suggestions.length ? " active" : ""}`}
              onMouseDown={() => commit()}
            >
              + Create&nbsp;<strong>"{trimmed}"</strong>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
