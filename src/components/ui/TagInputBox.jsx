import { useState, useRef, useEffect } from "react";
import { Hash, Plus } from "lucide-react";
import { TagChip } from "./TagChip";

export function TagInputBox({ label, tags = [], allTags = [], onAdd, onRemove, onRename, placeholder = "add tag...", compact = false }) {
  const [value,     setValue]     = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [inputOpen, setInputOpen] = useState(false);
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  const trimmed = value.trim().toLowerCase();
  const suggestions = trimmed
    ? allTags.filter((t) => !tags.includes(t) && t.includes(trimmed))
    : [];
  const showCreate = trimmed.length > 0 && !tags.includes(trimmed) && !allTags.includes(trimmed);
  const dropdownOpen = suggestions.length > 0 || showCreate;
  const totalRows = suggestions.length + (showCreate ? 1 : 0);
  const effectiveActiveIdx = (activeIdx === -1 && showCreate && suggestions.length === 0)
    ? suggestions.length
    : activeIdx;

  useEffect(() => {
    if (!dropdownOpen && !(compact && inputOpen)) return;
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setValue("");
        setActiveIdx(-1);
        if (compact) setInputOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen, inputOpen, compact]);

  useEffect(() => {
    if (compact && inputOpen) inputRef.current?.focus();
  }, [compact, inputOpen]);

  const commit = (tag) => {
    const t = (tag ?? value).trim().toLowerCase();
    if (t && !tags.includes(t)) onAdd(t);
    setValue("");
    setActiveIdx(-1);
    if (compact) setInputOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        commit(suggestions[activeIdx]);
      } else {
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
      if (compact) setInputOpen(false);
    }
  };

  const dropdown = dropdownOpen && (
    <div className="ui-coll-dropdown">
      {suggestions.map((t, i) => (
        <button
          key={t}
          className={`ui-coll-dropdown-item${i === effectiveActiveIdx ? " active" : ""}`}
          onMouseDown={() => commit(t)}
        >
          <Hash size={10} style={{ opacity: 0.4, flexShrink: 0 }} />
          {t}
        </button>
      ))}
      {showCreate && (
        <button
          className={`ui-coll-dropdown-item ui-coll-dropdown-create${effectiveActiveIdx === suggestions.length ? " active" : ""}`}
          onMouseDown={() => commit()}
        >
          <Plus size={12} strokeWidth={2.5} />
          Create&nbsp;<strong>"{trimmed}"</strong>
        </button>
      )}
    </div>
  );

  if (compact) {
    return (
      <div ref={wrapRef} style={{ position: "relative" }}>
        {label && <span className="detail-meta-label">{label}</span>}
        <div className="detail-pills-row" style={label ? { marginTop: 8 } : {}}>
          {tags.map((t) => (
            <TagChip key={t} label={t} onRemove={() => onRemove(t)} onRename={onRename ? (newName) => onRename(t, newName) : undefined} />
          ))}
          {inputOpen ? (
            <div style={{ position: "relative" }}>
              <input
                ref={inputRef}
                className="apv2-tag-inline-input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => { setValue(e.target.value); setActiveIdx(-1); }}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (!value.trim()) setInputOpen(false); }}
              />
              {dropdown}
            </div>
          ) : (
            <button className="detail-add-btn" onClick={() => setInputOpen(true)}>
              <Plus size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

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
      {dropdown}
    </div>
  );
}
