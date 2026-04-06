import { useSortable } from "@dnd-kit/sortable";

export default function SortableCard({ id, style, isGridDragging, isZooming, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id });

  // Animate cards sliding to new masonry positions during drag reorder.
  // No dnd-kit transform — masonry owns absolute positions, DragOverlay owns the ghost.
  // Transforms on non-dragging cards caused overlap, so we rely on left/top transitions.
  const transition = !isDragging && isGridDragging
    ? "left 180ms ease, top 180ms ease"
    : !isDragging && isZooming
      ? "left 180ms ease, top 180ms ease, width 180ms ease"
      : undefined;

  const combinedStyle = {
    ...style,
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 1 : undefined,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={combinedStyle} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
