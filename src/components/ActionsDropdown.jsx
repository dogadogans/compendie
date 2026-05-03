import { useRef, useEffect } from "react";
import { ArrowRight, Copy, FolderPlus, Trash2 } from "lucide-react";

export default function ActionsDropdown({ inCollection, onMoveTo, onCopyTo, onNewFolder, onDelete, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div className="actions-dropdown" ref={ref}>
      <button className="actions-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={onMoveTo}>
        <ArrowRight size={14} /> Move to…
      </button>
      <button className="actions-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={onCopyTo}>
        <Copy size={14} /> Copy to…
      </button>
      {inCollection && (
        <button className="actions-dropdown-item" onMouseDown={(e) => e.stopPropagation()} onClick={onNewFolder}>
          <FolderPlus size={14} /> New folder here
        </button>
      )}
      <div className="actions-dropdown-sep" />
      <button className="actions-dropdown-item danger" onMouseDown={(e) => e.stopPropagation()} onClick={onDelete}>
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
}
