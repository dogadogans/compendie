import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { ChevronsUpDown, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

const ALL_ICON_NAMES = Object.keys(Icons)
  .filter((k) => /^[A-Z]/.test(k) && !k.endsWith("Icon") && k !== "LucideProvider")
  .sort();

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

const INITIAL_SHOW = 200;

export default function CreateCollectionModal({ onSave, onClose, title = "New Collection", initialData = null }) {
  const [name,            setName]            = useState(initialData?.name  ?? "");
  const [iconName,        setIconName]        = useState(initialData?.icon  ?? "Folder");
  const [color,           setColor]           = useState(initialData?.color ?? "#f0b429");
  const [iconPickerOpen,  setIconPickerOpen]  = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [iconSearch,      setIconSearch]      = useState("");
  const [saving,          setSaving]          = useState(false);

  const filtered = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    if (!q) return ALL_ICON_NAMES.slice(0, INITIAL_SHOW);
    return ALL_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [iconSearch]);

  const IconComp = Icons[iconName] || Icons.Folder;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave({ name: trimmed, icon: iconName, color });
    } catch (e) {
      console.error("Save failed:", e);
      alert("Save failed: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} width={360}>
      <div className="ccm-body">

        {/* Name */}
        <div className="ccm-field">
          <label className="ccm-label">Collection Name</label>
          <input
            className="ccm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  handleSave();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
          />
        </div>

        {/* Icon + Color grouped box */}
        <div className="ccm-group">

          {/* Icon row */}
          <div
            className="ccm-row"
            onClick={() => {
              setIconPickerOpen((o) => !o);
              setColorPickerOpen(false);
            }}
          >
            <span className="ccm-row-label">Collection Icon</span>
            <div className="ccm-row-right">
              <IconComp size={16} color={color} />
              <ChevronsUpDown size={13} className="ccm-chevron" />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {iconPickerOpen && (
              <motion.div
                className="ccm-icon-picker"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="ccm-icon-picker-inner">
                  <div className="ccm-icon-search-wrap">
                    <Search size={12} className="ccm-icon-search-icon" />
                    <input
                      className="ccm-icon-search"
                      placeholder={`Search ${ALL_ICON_NAMES.length} icons…`}
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  </div>
                  <div className="ccm-icon-grid">
                    {filtered.map((n) => {
                      const Ic = Icons[n];
                      if (!Ic) return null;
                      const isActive = iconName === n;
                      return (
                        <button
                          key={n}
                          className={`ccm-icon-btn${isActive ? " active" : ""}`}
                          title={n}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIconName(n);
                            setIconPickerOpen(false);
                            setIconSearch("");
                          }}
                        >
                          <Ic size={15} color={isActive ? color : undefined} />
                        </button>
                      );
                    })}
                    {iconSearch === "" && ALL_ICON_NAMES.length > INITIAL_SHOW && (
                      <div className="ccm-icon-more">
                        +{ALL_ICON_NAMES.length - INITIAL_SHOW} more — search to find them
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="ccm-row-divider" />

          {/* Color row */}
          <div
            className="ccm-row"
            onClick={() => {
              setColorPickerOpen((o) => !o);
              setIconPickerOpen(false);
            }}
          >
            <span className="ccm-row-label">Collection Color</span>
            <div className="ccm-row-right">
              <motion.span
                className="ccm-color-dot"
                style={{ background: color }}
                layout
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
              />
              <ChevronsUpDown size={13} className="ccm-chevron" />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {colorPickerOpen && (
              <motion.div
                className="ccm-color-picker"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="ccm-swatches">
                  {COLORS.map((c) => (
                    <motion.button
                      key={c}
                      className="ccm-swatch"
                      style={{ background: c }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setColor(c);
                        setColorPickerOpen(false);
                      }}
                      whileHover={{ scale: 1.18 }}
                      whileTap={{ scale: 0.88 }}
                      animate={{
                        scale: color === c ? 1.1 : 1,
                        boxShadow:
                          color === c
                            ? `0 0 0 2px #1e1e1e, 0 0 0 4px ${c}`
                            : "0 0 0 0px transparent, 0 0 0 0px transparent",
                      }}
                      transition={{ type: "spring", stiffness: 480, damping: 22, mass: 0.55 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save */}
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!name.trim() || saving}
          style={{ width: "100%" }}
        >
          {saving ? "Saving…" : "Save"}
        </Button>

      </div>
    </Modal>
  );
}
