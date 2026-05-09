import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export default function AlertDialog({ title, message, confirmLabel = "Delete", onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} width={320}>
      <p className="dcm-message text-sm">{message}</p>
      <div className="dcm-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
