import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronRight, Check, Search, Plus } from "lucide-react";

export default function ContextMenu({ x, y, items: menuItems, onClose, searchable, onAddNew }) {
  const ref = useRef(null);
  const searchRef = useRef(null);
  const [inlineInput, setInlineInput] = useState(null);
  const [query, setQuery] = useState("");
  const [navCursor, setNavCursor] = useState(-1);

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

  useEffect(() => {
    if (searchable && searchRef.current) searchRef.current.focus();
  }, [searchable]);

  const visibleItems = useMemo(() => {
    if (!searchable || !query.trim()) return menuItems;
    return menuItems.filter((item) =>
      item !== "---" && item.label?.toLowerCase().includes(query.toLowerCase())
    );
  }, [menuItems, searchable, query]);

  const noResults = searchable && query.trim() && visibleItems.length === 0;

  // Reset cursor on query change; auto-highlight Add row when it's the only option
  useEffect(() => {
    setNavCursor(noResults && onAddNew ? 0 : -1);
  }, [query]);

  // Indices of navigable items (non-dividers) within visibleItems, plus add-new slot
  const navigable = useMemo(() => {
    const arr = visibleItems.reduce((acc, item, i) => {
      if (item !== "---") acc.push(i);
      return acc;
    }, []);
    if (noResults && onAddNew) arr.push("add-new");
    return arr;
  }, [visibleItems, noResults, onAddNew]);

  const confirmInline = () => {
    if (!inlineInput) return;
    const val = inlineInput.value.trim();
    if (val) inlineInput.onConfirm(val);
    onClose();
  };

  const activateItem = (item) => {
    if (!item || item === "---") return;
    if (item.inputDefault !== undefined) {
      const idx = menuItems.indexOf(item);
      setInlineInput({ index: idx, value: item.inputDefault, onConfirm: item.action });
    } else {
      if (!item.keepOpen) onClose();
      item.action?.();
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (navigable.length > 0) setNavCursor(0);
    } else if (e.key === "Enter" && noResults && onAddNew) {
      e.preventDefault();
      onClose();
      onAddNew(query.trim());
    }
    // Escape handled by global listener
  };

  const handleMenuKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setNavCursor((prev) => Math.min(prev + 1, navigable.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (navCursor <= 0 && searchable) {
        setNavCursor(-1);
        searchRef.current?.focus();
      } else {
        setNavCursor((prev) => Math.max(prev - 1, 0));
      }
    } else if (e.key === "Enter" && navCursor >= 0) {
      e.preventDefault();
      const slot = navigable[navCursor];
      if (slot === "add-new") {
        onClose();
        onAddNew?.(query.trim());
      } else {
        activateItem(visibleItems[slot]);
      }
    }
  };

  return (
    <div ref={ref} className="ctx-menu" style={{ left: pos.x, top: pos.y }} onKeyDown={handleMenuKeyDown} tabIndex={-1}>
      {searchable && (
        <div className="ctx-search-row">
          <Search size={13} className="ctx-search-icon" />
          <input
            ref={searchRef}
            className="ctx-search-input"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      )}

      <div className="ctx-items">
      {noResults && onAddNew ? (
        <button
          className={`ctx-item${navCursor === 0 ? " ctx-item--active" : ""}`}
          onClick={() => { onClose(); onAddNew(query.trim()); }}
        >
          <Plus size={16} className="ctx-icon" />
          <span className="ctx-label">Add "{query.trim()}"</span>
        </button>
      ) : (
        visibleItems.map((item, i) => {
          if (item === "---") return <div key={i} className="ctx-divider" />;

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

          const Icon = item.icon;
          const isActive = navigable[navCursor] === i;
          return (
            <button
              key={i}
              className={`ctx-item${item.danger ? " danger" : ""}${isActive ? " ctx-item--active" : ""}`}
              onClick={() => activateItem(item)}
            >
              {Icon && (
                <Icon
                  size={16}
                  className="ctx-icon"
                  color={item.iconColor || undefined}
                />
              )}
              <span className="ctx-label">{item.label}</span>
              {item.submenu && <ChevronRight size={16} className="ctx-right-icon" />}
              {item.checked && <Check size={16} className="ctx-right-icon" />}
            </button>
          );
        })
      )}
      </div>
    </div>
  );
}
