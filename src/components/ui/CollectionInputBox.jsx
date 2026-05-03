import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, ArrowLeft, Folder, Star, Heart, Bookmark, Tag, Box, Film, ImageIcon, Layers, Archive, Globe } from "lucide-react";
import { CollectionChip } from "./CollectionChip";

const COLORS = [
  "#f0b429",
  "#9AFF54",
  "#60a5fa",
  "#a78bfa",
  "#f87171",
  "#fb923c",
  "#f472b6",
  "#2dd4bf",
  "#94a3b8",
  "#e5e7eb",
];

const PRESET_ICONS = [
  { name: "Folder",   Comp: Folder   },
  { name: "Star",     Comp: Star     },
  { name: "Heart",    Comp: Heart    },
  { name: "Bookmark", Comp: Bookmark },
  { name: "Tag",      Comp: Tag      },
  { name: "Box",      Comp: Box      },
  { name: "Film",     Comp: Film     },
  { name: "Image",    Comp: ImageIcon},
  { name: "Layers",   Comp: Layers   },
  { name: "Archive",  Comp: Archive  },
  { name: "Globe",    Comp: Globe    },
];

export function CollectionInputBox({ label, selectedIds = [], collections = [], onAdd, onRemove, onCreate }) {
  const [query,       setQuery]       = useState("");
  const [open,        setOpen]        = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [createStep,  setCreateStep]  = useState(null);
  const [createName,  setCreateName]  = useState("");
  const [createIcon,  setCreateIcon]  = useState("Folder");
  const [creating,    setCreating]    = useState(false);
  const [dropPos,     setDropPos]     = useState({ top: 0, left: 0, width: 0 });

  const wrapRef = useRef(null);
  const dropRef = useRef(null);

  const available = collections.filter(
    (c) => !selectedIds.includes(c.id) &&
           c.name.toLowerCase().includes(query.toLowerCase())
  );
  const showCreate = query.trim().length > 0 && !collections.some(
    (c) => c.name.toLowerCase() === query.trim().toLowerCase()
  );

  const calcPos = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    calcPos();
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        !wrapRef.current?.contains(e.target) &&
        !dropRef.current?.contains(e.target)
      ) {
        setOpen(false);
        setCreateStep(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openDropdown = () => { calcPos(); setOpen(true); };

  const handleSelect = (col) => {
    onAdd(col.id);
    setQuery("");
    setOpen(false);
    setActiveIdx(-1);
  };

  // Step 1: open icon picker (called from "Create" button or Enter when nothing is selected)
  const openCreate = (e) => {
    e?.preventDefault();
    setCreateName(query.trim());
    setCreateIcon("Folder");
    setCreateStep("icon");
    setActiveIdx(-1);
  };

  // Fast path: Enter key creates immediately with defaults (Folder + first color)
  const createWithDefaults = async () => {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const id = await onCreate?.({ name, icon: "Folder", color: COLORS[0] });
      if (id) onAdd(id);
      setQuery("");
      setOpen(false);
      setCreateStep(null);
    } catch (err) {
      console.error("Failed to create collection:", err);
      alert("Failed to create collection: " + (err?.message ?? err));
    } finally {
      setCreating(false);
    }
  };

  // Step 2: icon chosen → go to color picker (onClick, no e.preventDefault needed)
  const pickIcon = (name) => {
    setCreateIcon(name);
    setCreateStep("color");
  };

  // Step 3: color chosen → create and add chip (onClick, no e.preventDefault needed)
  const pickColorAndCreate = async (color) => {
    if (creating) return;
    setCreating(true);
    try {
      const id = await onCreate?.({ name: createName, icon: createIcon, color });
      if (id) onAdd(id);
      setQuery("");
      setOpen(false);
      setCreateStep(null);
    } catch (err) {
      console.error("Failed to create collection:", err);
      alert("Failed to create collection: " + (err?.message ?? err));
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (createStep) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (createStep === "color") setCreateStep("icon");
        else setCreateStep(null);
      }
      e.stopPropagation();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openDropdown();
      setActiveIdx((i) => Math.min(i + 1, available.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (activeIdx >= 0 && activeIdx < available.length) {
        handleSelect(available[activeIdx]);
      } else if (showCreate) {
        createWithDefaults(); // Enter = instant create with defaults
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  const dropStyle = { position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width };

  const dropdown = open ? (
    <div
      ref={dropRef}
      className={`ui-coll-dropdown${createStep ? " ui-coll-create-panel" : ""}`}
      style={dropStyle}
    >
      {!createStep && (
        <>
          {available.length === 0 && query === "" && (
            <p className="ui-coll-dropdown-empty">Type to search or create</p>
          )}
          {available.map((col, i) => (
            <button
              key={col.id}
              className={`ui-coll-dropdown-item${i === activeIdx ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(col); }}
            >
              <span className="ui-coll-dropdown-dot" style={{ background: col.color }} />
              {col.name}
            </button>
          ))}
          {available.length === 0 && query !== "" && !showCreate && (
            <p className="ui-coll-dropdown-empty">No match for "{query}"</p>
          )}
          {(showCreate || query === "") && (
            <button
              className="ui-coll-dropdown-item ui-coll-dropdown-create"
              onMouseDown={openCreate}
            >
              <Plus size={12} strokeWidth={2.5} />
              {query.trim()
                ? <>Create&nbsp;<strong>"{query.trim()}"</strong></>
                : "Create new collection"}
            </button>
          )}
        </>
      )}

      {createStep === "icon" && (
        <>
          <div className="ui-coll-create-header">
            <button className="ui-coll-create-back" type="button"
              onClick={() => setCreateStep(null)}>
              <ArrowLeft size={13} />
            </button>
            <span className="ui-coll-create-title">Pick an icon for "{createName}"</span>
          </div>
          <div className="ui-coll-create-body">
            <div className="ui-coll-create-icons">
              {PRESET_ICONS.map(({ name, Comp }) => (
                <button
                  key={name}
                  type="button"
                  className={`ui-coll-icon-btn${createIcon === name ? " active" : ""}`}
                  title={name}
                  onClick={() => pickIcon(name)}
                >
                  <Comp size={15} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {createStep === "color" && (
        <>
          <div className="ui-coll-create-header">
            <button className="ui-coll-create-back" type="button"
              onClick={() => setCreateStep("icon")}>
              <ArrowLeft size={13} />
            </button>
            <span className="ui-coll-create-title">
              Pick a color
              {createName && <span className="ui-coll-create-subtitle"> for "{createName}"</span>}
            </span>
          </div>
          <div className="ui-coll-create-body">
            <div className="ui-coll-create-swatches-grid">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="ui-coll-swatch-large"
                  style={{ background: c }}
                  disabled={creating}
                  onClick={() => pickColorAndCreate(c)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="ui-field" ref={wrapRef}>
      {label && <label className="ui-field-label">{label}</label>}
      <div className="ui-tag-box" onClick={() => !createStep && openDropdown()}>
        {selectedIds.map((id) => {
          const col = collections.find((c) => c.id === id);
          if (!col) return null;
          return (
            <CollectionChip
              key={id}
              name={col.name}
              color={col.color}
              icon={col.icon}
              onRemove={(e) => { e.stopPropagation(); onRemove(id); }}
            />
          );
        })}
        <input
          className="ui-tag-bare-input"
          placeholder={selectedIds.length === 0 ? "add collection..." : ""}
          value={createStep ? "" : query}
          readOnly={!!createStep}
          onChange={(e) => { setQuery(e.target.value); openDropdown(); setActiveIdx(-1); }}
          onFocus={openDropdown}
          onKeyDown={handleKeyDown}
        />
      </div>
      {createPortal(dropdown, document.body)}
    </div>
  );
}
