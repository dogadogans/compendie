# Collection Menu: Edit, Sort, Drag Reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Edit (modal), Sort by submenu (Manual/Name/Date Created/Date Updated), and drag-to-reorder to the sidebar collection context menu.

**Architecture:** All changes are in four existing files — `store.js`, `CreateCollectionModal.jsx`, `App.jsx`, and `Sidebar.jsx`. No new files or dependencies needed; dnd-kit is already installed. Sort state lives in `localStorage`. Drag reorder is only active in Manual sort mode.

**Tech Stack:** React, dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`), localStorage

---

## File Map

| File | What changes |
|---|---|
| `src/store.js` | Add `updated_at` to `updateCollection`; add `reorderCollections()` |
| `src/components/CreateCollectionModal.jsx` | Add `title` + `initialData` props to support edit mode |
| `src/App.jsx` | Remove rename handler; add edit + sort state + handlers; update context menu; update Sidebar props |
| `src/components/Sidebar.jsx` | Remove inline rename; accept sort + reorder props; sorted rendering; dnd-kit drag |

---

## Task 1: store.js — `updated_at` + `reorderCollections`

**Files:**
- Modify: `src/store.js`

- [ ] **Step 1: Add `updated_at` to `updateCollection`**

In `src/store.js`, find `updateCollection` (currently at line ~198). Replace the function body so every update stamps `updated_at`:

```js
export async function updateCollection(id, changes) {
  const data = await loadData();
  const idx  = data.collections.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Collection not found");
  data.collections[idx] = {
    ...data.collections[idx],
    ...changes,
    updated_at: new Date().toISOString(),
  };
  await saveData(data);
  return data.collections[idx];
}
```

- [ ] **Step 2: Add `reorderCollections` export**

Add this function directly after `updateCollection` in `src/store.js`:

```js
export async function reorderCollections(newOrderedIds) {
  const data = await loadData();
  const colMap = new Map(data.collections.map((c) => [c.id, c]));
  const reordered = newOrderedIds
    .filter((id) => colMap.has(id))
    .map((id) => colMap.get(id));
  if (reordered.length !== data.collections.length) {
    console.warn("reorderCollections: ID count mismatch, aborting save");
    return;
  }
  data.collections = reordered;
  await saveData(data);
}
```

- [ ] **Step 3: Verify manually**

Run `npm run tauri dev` (or the existing dev server). Right-click a collection → Archive. Open `~/compendie/data.json` in a text editor and verify the collection now has an `updated_at` field.

- [ ] **Step 4: Commit**

```bash
git add src/store.js
git commit -m "feat: add updated_at to updateCollection, add reorderCollections"
```

---

## Task 2: CreateCollectionModal — edit mode props

**Files:**
- Modify: `src/components/CreateCollectionModal.jsx`

- [ ] **Step 1: Add `title` and `initialData` props**

In `src/components/CreateCollectionModal.jsx`, replace the function signature and the three `useState` calls at the top of the component:

Current signature (line 26):
```js
export default function CreateCollectionModal({ onSave, onClose, initialName = "" }) {
```

Replace with:
```js
export default function CreateCollectionModal({ onSave, onClose, title = "New Collection", initialData = null }) {
```

Then replace the three initial `useState` calls (lines 27–33):

Current:
```js
const [name,            setName]            = useState(initialName);
const [iconName,        setIconName]        = useState("Folder");
const [color,           setColor]           = useState("#f0b429");
```

Replace with:
```js
const [name,            setName]            = useState(initialData?.name    ?? "");
const [iconName,        setIconName]        = useState(initialData?.icon    ?? "Folder");
const [color,           setColor]           = useState(initialData?.color   ?? "#f0b429");
```

- [ ] **Step 2: Use `title` prop in the header**

Find the header `<span>` (line 70):
```jsx
<span className="ccm-title">New Collection</span>
```

Replace with:
```jsx
<span className="ccm-title">{title}</span>
```

- [ ] **Step 3: Verify it still works for create**

Start the dev server. Click the `+` button in the Collections section header. The modal should open with "New Collection" header and empty fields, exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/CreateCollectionModal.jsx
git commit -m "feat: add title and initialData props to CreateCollectionModal for edit mode"
```

---

## Task 3: App.jsx — edit collection state + handler + modal render

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `reorderCollections` to the store import**

Find the import block at the top of `src/App.jsx` (lines 6–9):

```js
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadCollections, addCollection, updateCollection, deleteCollection, archiveCollection,
  addFlow, updateFlow, reorderItems,
} from "./store";
```

Replace with:

```js
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadCollections, addCollection, updateCollection, deleteCollection, archiveCollection,
  addFlow, updateFlow, reorderItems, reorderCollections,
} from "./store";
```

- [ ] **Step 2: Add `editingCollection` state**

In `App()`, after the `ctxMenu` state declaration (around line 33), add:

```js
const [editingCollection, setEditingCollection] = useState(null);
```

- [ ] **Step 3: Replace `handleRenameCollection` with `handleUpdateCollection`**

Find and delete `handleRenameCollection` (around line 224):

```js
const handleRenameCollection = async (id, name) => {
  const updated = await updateCollection(id, { name });
  setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
};
```

Add `handleUpdateCollection` in its place:

```js
const handleUpdateCollection = async (id, { name, icon, color }) => {
  const updated = await updateCollection(id, { name, icon, color });
  setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
};
```

- [ ] **Step 4: Render the edit modal**

In the `return (...)` block, find where the `AddOverlay` is rendered (around line 422). Directly before it, add:

```jsx
{editingCollection && (
  <CreateCollectionModal
    title="Edit Collection"
    initialData={editingCollection}
    onSave={async ({ name, icon, color }) => {
      await handleUpdateCollection(editingCollection.id, { name, icon, color });
      setEditingCollection(null);
    }}
    onClose={() => setEditingCollection(null)}
  />
)}
```

- [ ] **Step 5: Remove `onRenameCollection` from Sidebar props**

In the `<Sidebar>` JSX (around line 363), remove this line:

```jsx
onRenameCollection={handleRenameCollection}
```

- [ ] **Step 6: Verify**

Start dev server. Right-click a collection. The menu still shows (even though Edit isn't wired yet — that's Task 4). Check for console errors. No rename handler errors expected.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add editingCollection state and handleUpdateCollection, remove rename handler"
```

---

## Task 4: App.jsx — Sort by state + context menu + reorder handler

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add `buildSortMenuItems` helper above the `App` component**

At the top of `src/App.jsx`, before the `export default function App()` line, add:

```js
function buildSortMenuItems(sort, onSortChange) {
  const mk = (by, label) => {
    const isActive = sort.by === by;
    return {
      icon: isActive ? "✓" : " ",
      label,
      hint: isActive ? (sort.dir === "asc" ? "↑" : "↓") : "",
      action: () =>
        onSortChange(
          isActive
            ? { by, dir: sort.dir === "asc" ? "desc" : "asc" }
            : { by, dir: "asc" }
        ),
    };
  };
  return [
    {
      icon: sort.by === "manual" ? "✓" : " ",
      label: "Manual",
      action: () => onSortChange({ by: "manual", dir: "asc" }),
    },
    "---",
    mk("name", "Name"),
    mk("date_created", "Date Created"),
    mk("date_updated", "Date Updated"),
  ];
}
```

- [ ] **Step 2: Add `collectionSort` state and `handleSortChange`**

Inside `App()`, after the `editingCollection` state line, add:

```js
const [collectionSort, setCollectionSort] = useState(() => {
  try {
    return (
      JSON.parse(localStorage.getItem("compendie_collection_sort")) ||
      { by: "manual", dir: "asc" }
    );
  } catch {
    return { by: "manual", dir: "asc" };
  }
});

const handleSortChange = (newSort) => {
  setCollectionSort(newSort);
  localStorage.setItem("compendie_collection_sort", JSON.stringify(newSort));
};
```

- [ ] **Step 3: Add `handleReorderCollections`**

After `handleSortChange`, add:

```js
const handleReorderCollections = useCallback((newTopLevelIds) => {
  setCollections((prev) => {
    const topSet = new Set(newTopLevelIds);
    const rest = prev.filter((c) => !topSet.has(c.id));
    const reordered = newTopLevelIds
      .map((id) => prev.find((c) => c.id === id))
      .filter(Boolean);
    const next = [...reordered, ...rest];
    reorderCollections(next.map((c) => c.id)).catch(console.error);
    return next;
  });
}, []);
```

- [ ] **Step 4: Replace `handleCollectionContextMenu`**

Find the existing `handleCollectionContextMenu` (around line 278) and replace it entirely:

```js
const handleCollectionContextMenu = (e, collection) => {
  openCtxMenu(e, [
    { icon: "✎", label: "Edit…", action: () => setEditingCollection(collection) },
    { icon: "📦", label: "Archive", action: () => handleArchiveCollection(collection.id) },
    { icon: "↕", label: "Sort by", hint: "▸",
      action: () => openCtxMenu(e, buildSortMenuItems(collectionSort, handleSortChange)),
    },
    "---",
    { icon: "🗑", label: "Delete", danger: true, action: () => handleDeleteCollection(collection.id) },
  ]);
};
```

- [ ] **Step 5: Pass new props to Sidebar**

In the `<Sidebar>` JSX, add these three props (and remove the now-gone `onRenameCollection` if not already removed in Task 3):

```jsx
collectionSort={collectionSort}
onSortChange={handleSortChange}
onReorderCollections={handleReorderCollections}
```

- [ ] **Step 6: Verify**

Start dev server. Right-click a collection:
- "Edit…" should open the modal pre-filled with the collection's name, icon, and color, with "Edit Collection" header. Save should update it.
- "Sort by" should close the main menu and open a new menu with Manual / Name / Date Created / Date Updated. Clicking "Name" should show a ✓ and ↑ next to it. Clicking "Name" again should toggle to ↓.
- Archive and Delete should still work.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Sort by submenu, Edit action, and collection reorder handler to context menu"
```

---

## Task 5: Sidebar.jsx — remove inline rename, sorted rendering

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Update prop signature — remove rename, add sort props**

Replace the `export default function Sidebar({ ... })` signature. Remove `onRenameCollection`, add `collectionSort`, `onSortChange`, `onReorderCollections`:

```js
export default function Sidebar({
  collections,
  items,
  activeView,
  onSelectAll,
  onSelectUnorganized,
  onSelectCollection,
  onSelectTag,
  onAddCollection,
  onContextMenu,
  onAddClick,
  collectionSort,
  onSortChange,
  onReorderCollections,
  width,
  onResizeStart,
}) {
```

- [ ] **Step 2: Remove inline rename state and handlers**

Delete these lines from the top of the `Sidebar` function body (around lines 36–38 and 50–56):

```js
const [renamingId,   setRenamingId]   = useState(null);
const [renameValue,  setRenameValue]  = useState("");
```

```js
const submitRename = async (id) => {
  const name = renameValue.trim();
  if (name) await onRenameCollection(id, name);
  setRenamingId(null);
};

const startRename = (col) => { setRenamingId(col.id); setRenameValue(col.name); };
```

- [ ] **Step 3: Replace `topLevel` with sorted `useMemo`**

Add `useMemo` to the existing React import if not present. Then replace the `topLevel` constant (currently line ~40):

```js
const topLevel    = collections.filter((c) => !c.parent_id && !c.archived);
```

Replace with:

```js
const topLevel = useMemo(() => {
  const cols = collections.filter((c) => !c.parent_id && !c.archived);
  if (!collectionSort || collectionSort.by === "manual") return cols;
  const dir = collectionSort.dir === "asc" ? 1 : -1;
  return [...cols].sort((a, b) => {
    if (collectionSort.by === "name")
      return dir * a.name.localeCompare(b.name);
    if (collectionSort.by === "date_created")
      return dir * (new Date(a.created_at) - new Date(b.created_at));
    if (collectionSort.by === "date_updated")
      return dir * (
        new Date(a.updated_at ?? a.created_at) -
        new Date(b.updated_at ?? b.created_at)
      );
    return 0;
  });
}, [collections, collectionSort]);
```

Add `useMemo` to the import at the top of the file (it's imported from `"react"` — add it if missing):

```js
import { useState, useMemo } from "react";
```

- [ ] **Step 4: Simplify `renderCollection` — remove inline rename JSX**

Inside `renderCollection`, remove the conditional rename input block and simplify the label to always render:

Find this block inside `renderCollection` (around lines 89–109):

```jsx
{renamingId === col.id ? (
  <input
    className="collection-name-input"
    value={renameValue}
    onChange={(e) => setRenameValue(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter")  submitRename(col.id);
      if (e.key === "Escape") setRenamingId(null);
    }}
    onBlur={() => submitRename(col.id)}
    autoFocus
    onClick={(e) => e.stopPropagation()}
  />
) : (
  <span className="collection-label" onClick={() => onSelectCollection(col.id)}>
    <span className="collection-icon">
      <ColIcon icon={col.icon} color={col.color} size={14} />
    </span>
    <span className="collection-name">{col.name}</span>
  </span>
)}
```

Replace with:

```jsx
<span className="collection-label" onClick={() => onSelectCollection(col.id)}>
  <span className="collection-icon">
    <ColIcon icon={col.icon} color={col.color} size={14} />
  </span>
  <span className="collection-name">{col.name}</span>
</span>
```

- [ ] **Step 5: Remove `startRename` from the `onContextMenu` call in `renderCollection`**

Find (line ~76):

```jsx
onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col, () => startRename(col)); }}
```

Replace with:

```jsx
onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col); }}
```

Do the same for the archived collection row (around line ~212):

```jsx
onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col, () => startRename(col)); }}
```

Replace with:

```jsx
onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col); }}
```

- [ ] **Step 6: Verify**

Start dev server. Collections list should now sort when you pick Name/Date Created/Date Updated from the Sort by submenu. Reverting to Manual should restore the original order.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: sorted collection rendering, remove inline rename from sidebar"
```

---

## Task 6: Sidebar.jsx — drag-to-reorder (Manual mode)

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Add dnd-kit imports to Sidebar.jsx**

At the top of `src/components/Sidebar.jsx`, add:

```js
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

- [ ] **Step 2: Add `SortableCollectionRow` component**

Add this small component just above the `ColIcon` function (before the `export default function Sidebar`):

```jsx
function SortableCollectionRow({ col, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...(disabled ? {} : { ...attributes, ...listeners })}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Add sensors and drag handler inside `Sidebar`**

Inside the `Sidebar` function body, after the state declarations, add:

```js
const isManual = !collectionSort || collectionSort.by === "manual";

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
);

const handleDragEnd = ({ active, over }) => {
  if (!over || active.id === over.id) return;
  const oldIndex = topLevel.findIndex((c) => c.id === active.id);
  const newIndex  = topLevel.findIndex((c) => c.id === over.id);
  onReorderCollections(arrayMove(topLevel, oldIndex, newIndex).map((c) => c.id));
};
```

- [ ] **Step 4: Wrap the top-level collection list in DndContext + SortableContext**

In the render, find where `topLevel.map(...)` is called inside the Collections section (around line ~153):

```jsx
{topLevel.map((col) => renderCollection(col))}
```

Replace with:

```jsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={topLevel.map((c) => c.id)}
    strategy={verticalListSortingStrategy}
  >
    {topLevel.map((col) => (
      <SortableCollectionRow key={col.id} col={col} disabled={!isManual}>
        {renderCollection(col)}
      </SortableCollectionRow>
    ))}
  </SortableContext>
</DndContext>
```

- [ ] **Step 5: Verify drag reorder**

Start dev server. Ensure sort is set to Manual (default). Drag a collection row up or down in the sidebar — it should reorder. Switch sort to "Name" and verify collections re-sort alphabetically and dragging is no longer possible.

Open `~/compendie/data.json` after a drag reorder and verify the `collections` array order changed.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: drag-to-reorder collections in sidebar (Manual mode only)"
```

---

## Self-Review Checklist

After all tasks complete, verify:

- [ ] Right-click context menu shows: Edit…, Archive, Sort by ▸, (divider), Delete
- [ ] Edit… opens the modal pre-filled — name, icon, color all match the collection
- [ ] Saving the edit updates the collection name/icon/color in the sidebar
- [ ] Sort by → Manual shows a ✓ on Manual when active
- [ ] Sort by → Name sorts A-Z with ↑ indicator; clicking again sorts Z-A with ↓
- [ ] Sort by → Date Created and Date Updated sort correctly
- [ ] In Manual mode, drag reorder works and persists after page reload
- [ ] In non-Manual mode, drag is disabled (rows don't move on drag)
- [ ] Sub-collections are unaffected by both sort and drag
- [ ] Archived collections section is unaffected
- [ ] No console errors anywhere
