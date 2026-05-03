import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

export default function DeleteConfirmModal({
  collectionName,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}) {
  const resolvedTitle   = title   ?? `Delete "${collectionName}"`;
  const resolvedMessage = message ?? "Your images won't be deleted — they'll stay in All and any other collections they belong to.";
  return (
    <Modal title={resolvedTitle} onClose={onClose} width={320}>
      <p className="dcm-message text-sm">{resolvedMessage}</p>
      <div className="dcm-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
