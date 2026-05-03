import { X } from "lucide-react";
import { motion } from "framer-motion";

export function Modal({ title, onClose, children, width = 320 }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-backdrop" />
      <motion.div
        className="ui-modal"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.7 }}
      >
        <div className="ui-modal-header">
          <span className="ui-modal-title">{title}</span>
          <button className="ui-modal-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="ui-modal-sep" />
        <div className="ui-modal-body">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
