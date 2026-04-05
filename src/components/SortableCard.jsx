import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function SortableCard({ id, style, disabled, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const combinedStyle = {
    ...style,                                         // absolute position from masonry hook
    transform: CSS.Transform.toString(transform),     // dnd-kit drag offset
    transition: isDragging ? undefined : transition,  // smooth return on cancel
    opacity: isDragging ? 0 : 1,                      // hole — DragOverlay shows the ghost
    zIndex: isDragging ? 1 : undefined,
    cursor: disabled ? undefined : "grab",
  };

  return (
    <div ref={setNodeRef} style={combinedStyle} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
