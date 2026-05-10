# Multi-select Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Organize mode, a floating selection bar, and bulk actions (Move, Copy, New folder, Delete) to the Grid — plus expand the `...` menu with collection-level actions.

**Architecture:** `selectedIds` (Set) and `organizeMode` (bool) live in App.jsx and flow down to Grid and the new selection bar. Three new leaf components (ActionsDropdown, CollectionPicker, QuickFolderModal) are wired up through App.jsx handlers. The `...` menu is restructured so Sort by becomes a submenu and collection-specific actions (Organize, Edit, Archive, Delete) are added when `activeView.type === "collection"`.

**Tech Stack:** React, framer-motion (already in project), lucide-react, existing `Modal`/`Button`/`Input` UI primitives from `src/components/ui/`

---

## File Map

| File | Change |
|------|--------|
| `src/components/DeleteConfirmModal.jsx` | Add optional `title`, `message`, `confirmLabel` props |
| `src/components/ActionsDropdown.jsx` | **New** — anchored dropdown with Move/Copy/New folder/Delete |
| `src/components/CollectionPicker.jsx` | **New** — collection destination picker |
| `src/components/QuickFolderModal.jsx` | **New** — lightweight name-only folder creation modal |
| `src/App.jsx` | Add state, bulk handlers, selection bar JSX, expand `...` menu |
| `src/components/Grid.jsx` | Accept `organizeMode`/`selectedIds`/`onToggleSelect`, add selection ring, fix click |
| `src/App.css` | Selection bar, card ring, dropdown, picker styles |

---

### Task 1: Generalize DeleteConfirmModal

**Files:**
- Modify: `src/components/DeleteConfirmModal.jsx`

Current file uses hardcoded collection-delete wording. We need it to accept overrides for bulk-item deletion too.

- [ ] **Replace the full file contents**

```jsx
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
```

- [ ] **Start dev server and verify existing collection delete still works**

```bash
npm run tauri dev
```

Right-click a collection in the sidebar → Delete → confirm dialog still shows "Delete "Name"" with the collections-stay message. No change in behavior.

- [ ] **Commit**

```bash
git add src/components/DeleteConfirmModal.jsx
git commit -m "refactor: generalize DeleteConfirmModal to accept title/message overrides"
```

---

### Task 2: ActionsDropdown component

**Files:**
- Create: `src/components/ActionsDropdown.jsx`

Anchored dropdown that renders above the selection bar. Closes on outside click.

- [ ] **Create the file**

```jsx
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
```

- [ ] **Add CSS to `src/App.css`**

```css
/* ── Actions dropdown ─────────────────────────────────────────────────────── */
.actions-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: var(--surface-2);
  outline: 1px solid var(--border);
  outline-offset: -1px;
  border-radius: 12px;
  box-shadow: 0px 10px 10px -5px rgba(0,0,0,0.08), 0px 20px 25px -5px rgba(0,0,0,0.16);
  padding: 8px;
  min-width: 190px;
  z-index: 200;
  animation: ctx-in 0.1s cubic-bezier(0.23, 1, 0.32, 1);
}

.actions-dropdown-item {
  all: unset;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.08s;
}
.actions-dropdown-item:hover { background: rgba(67,67,67,0.20); }
.actions-dropdown-item.danger { color: var(--danger); }
.actions-dropdown-item.danger:hover { background: var(--danger-bg); }

.actions-dropdown-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 6px;
}
```

- [ ] **Commit**

```bash
git add src/components/ActionsDropdown.jsx src/App.css
git commit -m "feat: add ActionsDropdown component"
```

---

### Task 3: CollectionPicker component

**Files:**
- Create: `src/components/CollectionPicker.jsx`

Floating list of collections to pick a destination from. Greyed out if all selected items are already in that collection.

- [ ] **Create the file**

```jsx
import { useRef, useEffect } from "react";
import * as Icons from "lucide-react";

function ColIcon({ icon, color, size = 14 }) {
  const Ic = Icons[icon];
  if (Ic) return <Ic size={size} color={color || "var(--muted)"} />;
  return <span style={{ fontSize: size }}>{icon || "📁"}</span>;
}

export default function CollectionPicker({ mode, collections, selectedIds, items, onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handle = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const nonArchived   = collections.filter((c) => !c.archived);

  return (
    <div className="collection-picker" ref={ref}>
      <div className="collection-picker-header">
        {mode === "move" ? "Move to…" : "Copy to…"}
      </div>
      {nonArchived.length === 0 && (
        <div className="collection-picker-empty">No collections yet</div>
      )}
      {nonArchived.map((col) => {
        const allIn = selectedItems.length > 0 && selectedItems.every((i) => i.collections.includes(col.id));
        return (
          <button
            key={col.id}
            className={`collection-picker-item${allIn ? " disabled" : ""}`}
            disabled={allIn}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => !allIn && onPick(col.id)}
          >
            <ColIcon icon={col.icon} color={col.color} />
            <span>{col.name}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Add CSS to `src/App.css`**

```css
/* ── Collection picker ────────────────────────────────────────────────────── */
.collection-picker {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: var(--surface-2);
  outline: 1px solid var(--border);
  outline-offset: -1px;
  border-radius: 12px;
  box-shadow: 0px 10px 10px -5px rgba(0,0,0,0.08), 0px 20px 25px -5px rgba(0,0,0,0.16);
  padding: 8px;
  min-width: 200px;
  max-height: 280px;
  overflow-y: auto;
  z-index: 200;
  animation: ctx-in 0.1s cubic-bezier(0.23, 1, 0.32, 1);
}

.collection-picker-header {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 4px 8px 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.collection-picker-empty {
  font-size: 13px;
  color: var(--muted);
  padding: 8px;
  text-align: center;
}

.collection-picker-item {
  all: unset;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.08s;
}
.collection-picker-item:hover:not(.disabled) { background: rgba(67,67,67,0.20); }
.collection-picker-item.disabled {
  color: var(--muted);
  cursor: not-allowed;
  opacity: 0.45;
}
```

- [ ] **Commit**

```bash
git add src/components/CollectionPicker.jsx src/App.css
git commit -m "feat: add CollectionPicker component"
```

---

### Task 4: QuickFolderModal component

**Files:**
- Create: `src/components/QuickFolderModal.jsx`

Lightweight modal — just a name field. Uses existing `Modal` + `Button` primitives.

- [ ] **Create the file**

```jsx
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
```

- [ ] **Commit**

```bash
git add src/components/QuickFolderModal.jsx
git commit -m "feat: add QuickFolderModal component"
```

---

### Task 5: Selection state and handlers in App.jsx

**Files:**
- Modify: `src/App.jsx`

Add `selectedIds`, `organizeMode`, bulk action handlers, and an effect to reset selection on navigation.

- [ ] **Add imports at the top of App.jsx** (after the existing imports)

```js
import ActionsDropdown  from "./components/ActionsDropdown";
import CollectionPicker from "./components/CollectionPicker";
import QuickFolderModal from "./components/QuickFolderModal";
import { AnimatePresence, motion } from "framer-motion";
```

- [ ] **Add state after the existing `deleteConfirm` state line (~line 60)**

```js
const [selectedIds,    setSelectedIds]    = useState(new Set());
const [organizeMode,   setOrganizeMode]   = useState(false);
const [actionMenuOpen, setActionMenuOpen] = useState(false);
const [pickerMode,     setPickerMode]     = useState(null); // "move" | "copy" | null
const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
const [quickFolderOpen,   setQuickFolderOpen]   = useState(false);
```

- [ ] **Add reset effect after the existing `useEffect` for `loadItems` (~line 99)**

```js
useEffect(() => {
  setSelectedIds(new Set());
  setOrganizeMode(false);
  setActionMenuOpen(false);
  setPickerMode(null);
}, [activeView]);
```

- [ ] **Add `handleToggleSelect` and `handleClearSelection` after `handleReorder` (~line 278)**

```js
const handleToggleSelect = useCallback((id) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}, []);

const handleClearSelection = useCallback(() => {
  setSelectedIds(new Set());
  setOrganizeMode(false);
  setActionMenuOpen(false);
  setPickerMode(null);
}, []);
```

- [ ] **Add bulk action handlers after `handleClearSelection`**

```js
const handleBulkMove = useCallback(async (targetId) => {
  const ids = [...selectedIds];
  await Promise.all(ids.map((id) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    const next = item.collections
      .filter((c) => c !== activeView.id)
      .concat(item.collections.includes(targetId) ? [] : [targetId]);
    return handleUpdate(id, { collections: next });
  }));
  handleClearSelection();
}, [selectedIds, activeView, handleUpdate, handleClearSelection]);

const handleBulkCopy = useCallback(async (targetId) => {
  const ids = [...selectedIds];
  await Promise.all(ids.map((id) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item || item.collections.includes(targetId)) return;
    return handleUpdate(id, { collections: [...item.collections, targetId] });
  }));
  handleClearSelection();
}, [selectedIds, handleUpdate, handleClearSelection]);

const handleBulkDelete = useCallback(async () => {
  const ids = [...selectedIds];
  for (const id of ids) await handleDelete(id);
  handleClearSelection();
}, [selectedIds, handleDelete, handleClearSelection]);

const handleQuickNewFolder = useCallback(async (name) => {
  const col = await handleAddCollection({ name, icon: "Folder", color: "#888888", parentId: activeView.id });
  const ids = [...selectedIds];
  await Promise.all(ids.map((id) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    return handleUpdate(id, { collections: [...item.collections, col.id] });
  }));
  setQuickFolderOpen(false);
  handleClearSelection();
}, [selectedIds, activeView, handleAddCollection, handleUpdate, handleClearSelection]);
```

- [ ] **Commit**

```bash
git add src/App.jsx
git commit -m "feat: add selection state and bulk action handlers to App"
```

---

### Task 6: Grid card selection UI

**Files:**
- Modify: `src/components/Grid.jsx`

Accept `organizeMode`, `selectedIds`, `onToggleSelect`. Add selection ring to image cards and flow cards. Change click behavior in organizeMode.

- [ ] **Add new props to the Grid function signature** (currently `function Grid({ items, allItems, ... })`)

Add `organizeMode = false, selectedIds = new Set(), onToggleSelect,` to the destructured props list.

- [ ] **Change image card click** (around line 535 where `onClick={() => onCardClick(item)}` is inside the image card div)

```jsx
onClick={() => organizeMode ? onToggleSelect?.(item.id) : onCardClick(item)}
```

- [ ] **Add selection ring overlay inside the image card div** (after the `img`/placeholder, still inside the `data-item-id` div)

```jsx
{organizeMode && (
  <div className={`card-select-ring${selectedIds.has(item.id) ? " selected" : ""}`} />
)}
```

- [ ] **Change FlowCard click** (around line 517, inside the SortableCard for flow items)

Replace:
```jsx
<FlowCard
  item={item}
  imageUrl={firstScreenUrl}
  onClick={() => onCardClick(item)}
  onContextMenu={onCardContextMenu}
/>
```
With:
```jsx
<FlowCard
  item={item}
  imageUrl={firstScreenUrl}
  onClick={() => organizeMode ? onToggleSelect?.(item.id) : onCardClick(item)}
  onContextMenu={onCardContextMenu}
  selected={organizeMode && selectedIds.has(item.id)}
  showSelectRing={organizeMode}
/>
```

- [ ] **Add CSS to `src/App.css`**

```css
/* ── Card selection ring ──────────────────────────────────────────────────── */
.card-select-ring {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  background: rgba(0, 0, 0, 0.25);
  pointer-events: none;
  z-index: 2;
  transition: border-color 0.12s, background 0.12s;
}
.card-select-ring.selected {
  border-color: var(--blue-500);
  background: var(--blue-500);
}
.card-select-ring.selected::after {
  content: "";
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 10.5l3.5 3.5 6.5-7' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/16px no-repeat;
}

/* card must be position:relative for the ring to anchor — add if not already set */
.card { position: relative; }
```

- [ ] **Pass new props from App.jsx to Grid** (in the `<Grid ... />` JSX around line 541)

Add:
```jsx
organizeMode={organizeMode}
selectedIds={selectedIds}
onToggleSelect={handleToggleSelect}
```

- [ ] **Start dev server and visually verify**

```bash
npm run tauri dev
```

Open any collection → click `...` → you can't select yet (handler not wired) but the Grid receives props without errors. No console errors.

- [ ] **Commit**

```bash
git add src/components/Grid.jsx src/App.css src/App.jsx
git commit -m "feat: grid selection ring and organizeMode click behavior"
```

---

### Task 7: Selection bar in App.jsx

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`

Floating bar at the bottom of `.main-area`. Animates in/out. Opens ActionsDropdown or CollectionPicker above itself.

- [ ] **Add selection bar JSX inside `.main-area`**, after the `<DetailPanel>` block and before the closing `</div>` of `.main-area`

```jsx
<AnimatePresence>
  {selectedIds.size > 0 && (
    <motion.div
      className="selection-bar"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
    >
      <span className="selection-bar-count">{selectedIds.size} Selected</span>
      <button className="selection-bar-clear" onClick={handleClearSelection}>×</button>
      <div className="selection-bar-actions-wrap">
        <button
          className="selection-bar-btn"
          onClick={() => {
            setPickerMode(null);
            setActionMenuOpen((v) => !v);
          }}
        >
          ⌘ Actions
        </button>
        {actionMenuOpen && (
          <ActionsDropdown
            inCollection={activeView.type === "collection"}
            onMoveTo={() => { setActionMenuOpen(false); setPickerMode("move"); }}
            onCopyTo={() => { setActionMenuOpen(false); setPickerMode("copy"); }}
            onNewFolder={() => { setActionMenuOpen(false); setQuickFolderOpen(true); }}
            onDelete={() => { setActionMenuOpen(false); setBulkDeleteConfirm(true); }}
            onClose={() => setActionMenuOpen(false)}
          />
        )}
        {pickerMode && (
          <CollectionPicker
            mode={pickerMode}
            collections={collections}
            selectedIds={selectedIds}
            items={items}
            onPick={pickerMode === "move" ? handleBulkMove : handleBulkCopy}
            onClose={() => setPickerMode(null)}
          />
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Add CSS to `src/App.css`**

```css
/* ── Selection bar ────────────────────────────────────────────────────────── */
.selection-bar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-2);
  outline: 1px solid var(--border);
  outline-offset: -1px;
  border-radius: 12px;
  padding: 6px 8px;
  box-shadow: 0px 8px 16px -4px rgba(0,0,0,0.12), 0px 16px 32px -8px rgba(0,0,0,0.20);
  z-index: 100;
  white-space: nowrap;
}

.selection-bar-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  padding: 0 6px;
}

.selection-bar-clear {
  all: unset;
  font-size: 16px;
  line-height: 1;
  color: var(--muted);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background 0.08s;
}
.selection-bar-clear:hover { background: rgba(67,67,67,0.20); }

.selection-bar-actions-wrap {
  position: relative;
}

.selection-bar-btn {
  all: unset;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  background: var(--surface-1, rgba(67,67,67,0.15));
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.08s;
}
.selection-bar-btn:hover { background: rgba(67,67,67,0.28); }
```

- [ ] **Ensure `.main-area` has `position: relative`** in `src/App.css` (check — if not, add it)

Search for `.main-area` in `src/App.css`. If it doesn't have `position: relative`, add it.

- [ ] **Start dev server and visually verify selection bar**

```bash
npm run tauri dev
```

There's no way to enter select mode yet (that's Task 9), but you can test by temporarily adding `setOrganizeMode(true)` to the `useEffect(() => {...}, [])` load effect, then clicking cards to see: selection bar appears/disappears, `×` clears selection, ActionsDropdown opens above the bar, CollectionPicker opens when Move/Copy are clicked.

Remove the temporary line after verifying.

- [ ] **Commit**

```bash
git add src/App.jsx src/App.css
git commit -m "feat: floating selection bar with Actions dropdown and CollectionPicker"
```

---

### Task 8: Bulk delete confirmation and QuickFolderModal in App.jsx

**Files:**
- Modify: `src/App.jsx`

Wire up the `bulkDeleteConfirm` state to a `DeleteConfirmModal`, and `quickFolderOpen` to `QuickFolderModal`. Both already imported in Task 5.

- [ ] **Add bulk delete modal** inside App.jsx's return, after the existing `{deleteConfirm && <DeleteConfirmModal ... />}` block

```jsx
{bulkDeleteConfirm && (
  <DeleteConfirmModal
    title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? "item" : "items"}?`}
    message="This cannot be undone. Deleted items are removed from Tome permanently."
    confirmLabel={`Delete ${selectedIds.size === 1 ? "item" : `${selectedIds.size} items`}`}
    onConfirm={async () => { setBulkDeleteConfirm(false); await handleBulkDelete(); }}
    onClose={() => setBulkDeleteConfirm(false)}
  />
)}
```

- [ ] **Add QuickFolderModal**, after the bulk delete modal

```jsx
{quickFolderOpen && activeView.type === "collection" && (
  <QuickFolderModal
    parentCollectionName={collections.find((c) => c.id === activeView.id)?.name ?? ""}
    itemCount={selectedIds.size}
    onSave={handleQuickNewFolder}
    onClose={() => setQuickFolderOpen(false)}
  />
)}
```

- [ ] **Start dev server and verify full bulk delete flow**

```bash
npm run tauri dev
```

Temporarily force `organizeMode=true` in state initializer, click 2 items, click ⌘ Actions → Delete → confirm dialog shows "Delete 2 items?" → clicking Delete removes both items and selection bar disappears.

- [ ] **Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire bulk delete confirmation and QuickFolderModal"
```

---

### Task 9: Expand the `...` menu

**Files:**
- Modify: `src/App.jsx`

Replace the flat sort-only `handleGridOptionsMenu` with a richer menu that shows collection actions when inside a collection view.

- [ ] **Replace `handleGridOptionsMenu` entirely** (currently lines ~482–504)

```js
const handleGridOptionsMenu = (e) => {
  const inCollection = activeView.type === "collection";
  const collection   = inCollection ? collections.find((c) => c.id === activeView.id) : null;

  const sortItems = [
    { label: "Manual", checked: gridSort.by === "manual", action: () => handleGridSortChange({ by: "manual", dir: "asc" }) },
    "---",
    { label: "Name: A → Z",          checked: gridSort.by === "name"         && gridSort.dir === "asc",  action: () => handleGridSortChange({ by: "name",         dir: "asc"  }) },
    { label: "Name: Z → A",          checked: gridSort.by === "name"         && gridSort.dir === "desc", action: () => handleGridSortChange({ by: "name",         dir: "desc" }) },
    "---",
    { label: "Date Created: First",   checked: gridSort.by === "date_created" && gridSort.dir === "asc",  action: () => handleGridSortChange({ by: "date_created", dir: "asc"  }) },
    { label: "Date Created: Last",    checked: gridSort.by === "date_created" && gridSort.dir === "desc", action: () => handleGridSortChange({ by: "date_created", dir: "desc" }) },
    "---",
    { label: "Date Updated: First",   checked: gridSort.by === "date_updated" && gridSort.dir === "asc",  action: () => handleGridSortChange({ by: "date_updated", dir: "asc"  }) },
    { label: "Date Updated: Last",    checked: gridSort.by === "date_updated" && gridSort.dir === "desc", action: () => handleGridSortChange({ by: "date_updated", dir: "desc" }) },
  ];

  openCtxMenu(e, [
    { label: "Sort by", submenu: true, action: () => openCtxMenu(e, sortItems) },
    ...(inCollection ? [
      "---",
      { label: "Organize images/flows", action: () => { setOrganizeMode(true); setCtxMenu(null); } },
      { label: "Edit…",                 action: () => { setEditingCollection(collection); setCtxMenu(null); } },
      "---",
      { label: "Archive collection",    action: () => handleArchiveCollection(activeView.id) },
      { label: "Delete collection", danger: true, action: () => handleDeleteCollection(activeView.id) },
    ] : []),
  ]);
};
```

- [ ] **Start dev server and test all `...` menu paths**

```bash
npm run tauri dev
```

Check each path:

1. **All view → `...`** — only "Sort by" appears. Click it → sort submenu appears. Choose "Name: A → Z" → grid re-sorts.
2. **Collection view → `...`** — Sort by + Organize/Edit/Archive/Delete appear.
3. **Organize images/flows** → `organizeMode` becomes true → selection bar not yet visible (no items selected), but clicking a card now selects it (blue ring appears) instead of opening detail panel. Selection bar appears after first click.
4. **Edit…** → collection edit modal opens pre-filled.
5. **Archive collection** → collection moves to Archived in sidebar.
6. **Delete collection** → existing delete confirm dialog.

- [ ] **Commit**

```bash
git add src/App.jsx
git commit -m "feat: expand ... menu with Organize, Edit, Archive and Sort-by submenu"
```

---

### Task 10: CSS polish pass

**Files:**
- Modify: `src/App.css`

Final check — ensure `.main-area` is `position: relative` and all new components feel consistent with the existing design.

- [ ] **Check `.main-area` in `src/App.css`**

Search for `.main-area`. Confirm it has `position: relative`. If not:

```css
.main-area { position: relative; }
```

- [ ] **Verify card position is relative** — search for `.card {` in `src/App.css`. Confirm `position: relative` is present. The selection ring uses `position: absolute` so the card must be the containing block.

- [ ] **Visually review the full flow end-to-end**

```bash
npm run tauri dev
```

Walk through the complete user journey:
1. Open a collection with several images
2. Click `...` → "Organize images/flows"
3. Click 3 images — each gets blue ring, selection bar shows "3 Selected"
4. Click `⌘ Actions` → dropdown appears above bar
5. Click "Move to…" → collection picker appears → pick a destination → items move, selection clears
6. Repeat, this time choose "Copy to…" — items stay in current + added to destination
7. Select 2 images → Actions → "New folder here" → type a name → Create → new sub-folder appears in sidebar, items added
8. Select 2 images → Actions → Delete → confirm → items gone
9. Click `×` in bar → selection clears, rings disappear, bar slides out
10. Navigate away from the collection → come back — organizeMode is reset (no rings, no bar)

- [ ] **Commit**

```bash
git add src/App.css
git commit -m "fix: ensure main-area and card positioning for selection ring"
```

---

## Self-Review

**Spec coverage:**
- ✅ `...` menu: Sort by (submenu), Organize images/flows, Edit…, Archive, Delete — Task 9
- ✅ Selection mode entry via `...` → organizeMode — Task 9
- ✅ Card click in organizeMode selects instead of opens — Task 6
- ✅ Selection ring (empty/filled) — Task 6
- ✅ Selection bar with count, ×, ⌘ Actions — Task 7
- ✅ ActionsDropdown: Move to…, Copy to…, New folder here, Delete — Task 2
- ✅ CollectionPicker for move/copy — Task 3
- ✅ Move logic (remove from current, add to target) — Task 5
- ✅ Copy logic (add to target, keep in current) — Task 5
- ✅ QuickFolderModal (name only, creates sub-collection, adds items) — Task 4 + 8
- ✅ Bulk delete with generalized confirm modal — Task 1 + 8
- ✅ Selection resets on navigation — Task 5
- ✅ Flow cards get same selection behavior as image cards — Task 6
- ✅ "New folder here" hidden outside collection view — Task 2 (inCollection prop)
