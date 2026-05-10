# Sidebar Redesign + Hide/Show — Design Spec
**Date:** 2026-05-02  
**Status:** Approved

---

## Overview

Redesign the sidebar to match the new visual direction (dark, noise-textured, icon-forward) and add a hide/show toggle that integrates cleanly into the top toolbar.

---

## Visual Redesign

### Background
- Color: `#1A1A1A` (matches `--surface` variable, no change needed there)
- Right border: `rgba(169, 169, 169, 0.25)` — slightly lighter than current
- Noise texture: `::before` pseudo-element, `position: absolute; inset: 0; pointer-events: none`, SVG `feTurbulence` fractalNoise at ~4% opacity, tiled at 200×200px. Sidebar already has `position: relative` and `overflow: hidden` so this is safe.

### Header Row
- App name "Compendie" — 14px, weight 600, color `#D6D6D6`
- Right side: two 28×28px icon buttons, always visible (not hover-gated)
  - `Plus` (16px) — calls `onAddClick` (opens add overlay)
  - `PanelLeftClose` (16px) — calls `onToggleSidebar`
- Padding: 12px all sides
- Replaces current `.sidebar-logo` / `.sidebar-add-btn`

### Nav Items (All, Unorganized)
- Height: 40px, `border-radius: 8px`
- Layout: `[icon 20px] [label flex-1] [count]`
- Icon color: `var(--muted)` / `#767676`
- Label color: `#F5F5F5`, 14px weight 400
- Count color: `#A5A5A5`, 14px weight 400, right-aligned
- Hover: `rgba(255,255,255,0.04)` background
- Active: `rgba(255,255,255,0.05)` background
- Icons: `Images` for All, `Inbox` for Unorganized (both from lucide-react)

### Section Headers (Folders, Tags, Archived)
- 12px, weight 600, color `#F5F5F5`
- 32px tall row, `border-radius: 8px`
- Hover: `rgba(255,255,255,0.03)` background, reveals action buttons
- **Folders**: chevron (collapse/expand) + Plus button (create collection modal), both hidden until row is hovered
- **Tags**: chevron (collapse/expand) + Plus button (calls `onAddClick` as placeholder — no standalone tag creation yet)
- **Archived**: chevron (collapse/expand) only, no Plus
- Chevrons use Lucide `ChevronDown` / `ChevronRight` (14px)
- Action buttons: 22×22px, `border-radius: 4px`, color `#A5A5A5`, hover reveals background `rgba(255,255,255,0.08)` + color `#F5F5F5`

### Collection Rows
- Same 40px height, 8px border-radius as nav items
- Layout: `[expand-btn 16px] [folder-icon 16px] [name flex-1] [count]`
- Expand chevron uses Lucide icons (replaces text arrows `▸` / `▾`)
- Count: always visible, `#A5A5A5`
- `getCollectionCount(colId)` = `items.filter(i => i.collections?.includes(colId)).length`
- Sub-items: `padding-left: 20px`, no expand button slot

### Tag Rows
- Same 40px height nav item layout
- Icon: `Hash` 20px
- Count always visible

### Removed
- `.sidebar-divider` elements between sections — replaced by section padding
- Text arrows (`▸` `▾`) on expand buttons — replaced by Lucide chevrons
- Old `.sidebar-logo`, `.sidebar-add-btn`, `.sidebar-section-header`, `.section-add-btn`, `.sidebar-collapse-header`, `.collapse-arrow` classes

---

## Sidebar Hide/Show

### State (App.jsx)
```
const [sidebarHidden, setSidebarHidden] = useState(
  () => localStorage.getItem("compendie_sidebar_hidden") === "true"
);
const handleToggleSidebar = useCallback(() => {
  setSidebarHidden(prev => {
    const next = !prev;
    localStorage.setItem("compendie_sidebar_hidden", next);
    return next;
  });
}, []);
```

### When Sidebar Is Visible
- `<Sidebar>` renders normally
- `PanelLeftClose` button in sidebar header fires `handleToggleSidebar`
- `sidebarHidden` and `onToggleSidebar` passed as new props to Sidebar

### When Sidebar Is Hidden
- `<Sidebar>` is not rendered (conditional render in App.jsx, not hidden via CSS)
- `sidebarHidden` and `onToggleSidebar` passed to `<Grid>`
- Grid's `toolbar-left` prepends a `PanelLeft` (16px) icon button before the folder icon
- Button styled same as other toolbar icon buttons (`.btn-icon`)
- Sidebar width is not applied when hidden (Grid/main area takes full width naturally)

### Resize Handle
- Unchanged — stays at right edge of sidebar, only present when sidebar is visible

---

## File Changes

| File | Change |
|------|--------|
| `src/components/Sidebar.jsx` | Add `onToggleSidebar` prop; add `foldersCollapsed` state; redesign header, nav, section headers, collection rows; swap text chevrons for Lucide |
| `src/components/Grid.jsx` | Add `sidebarHidden` + `onToggleSidebar` props; prepend panel icon to toolbar-left when hidden |
| `src/App.jsx` | Add `sidebarHidden` state + `handleToggleSidebar`; pass to Sidebar and Grid; add `PanelLeft` to lucide imports |
| `src/App.css` | Replace sidebar CSS block; add new classes: `.sidebar-header`, `.sidebar-app-name`, `.sidebar-header-actions`, `.sidebar-icon-btn`, `.nav-item-icon`, `.nav-item-label`, `.nav-item-count`, `.sidebar-section-header-row`, `.sidebar-section-label`, `.sidebar-section-actions`, `.sidebar-section-action-btn` |

---

## Out of Scope
- Standalone tag creation (Plus button on Tags section is a visual placeholder calling `onAddClick`)
- Sidebar animation/transition on hide (instant show/hide)
- Keyboard shortcut for sidebar toggle
