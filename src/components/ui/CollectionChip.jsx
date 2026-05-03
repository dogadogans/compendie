import { X, Folder, Star, Heart, Bookmark, Tag, Box, Film, ImageIcon, Layers, Archive, Globe } from "lucide-react";

const ICON_MAP = {
  Folder:   Folder,
  Star:     Star,
  Heart:    Heart,
  Bookmark: Bookmark,
  Tag:      Tag,
  Box:      Box,
  Film:     Film,
  Image:    ImageIcon,
  Layers:   Layers,
  Archive:  Archive,
  Globe:    Globe,
};

export function CollectionChip({ name, color = "#ffffff", icon = "Folder", onRemove }) {
  const IconComp = ICON_MAP[icon] ?? Folder;

  return (
    <span className="ui-coll-chip">
      <IconComp size={12} strokeWidth={2} style={{ color, flexShrink: 0 }} />
      <span className="ui-coll-chip-label">{name}</span>
      {onRemove && (
        <button
          className="ui-coll-chip-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          tabIndex={-1}
          aria-label={`Remove collection ${name}`}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
