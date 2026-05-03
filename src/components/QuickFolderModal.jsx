import { useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

export default function QuickFolderModal({ parentCollectionName, itemCount, onSave, onClose }) {
  const [name, setName] = useState("");

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
  };

  return (
    <Modal title="New folder" onClose={onClose} width={320}>
      <p className="text-sm" style={{ color: "var(--muted)", marginBottom: 12 }}>
        Inside <strong style={{ color: "var(--text)" }}>{parentCollectionName}</strong>
        {" · "}{itemCount} {itemCount === 1 ? "item" : "items"} will be added
      </p>
      <Input
        placeholder="Folder name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        autoFocus
      />
      <div className="dcm-actions" style={{ marginTop: 12 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!name.trim()} onClick={handleCreate}>Create</Button>
      </div>
    </Modal>
  );
}
