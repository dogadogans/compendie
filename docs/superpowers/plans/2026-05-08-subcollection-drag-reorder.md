# Subcollection Card Drag-to-Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow subcollection cards in the collection view header row to be dragged and reordered, with a ghost card following the cursor and the order persisted to `data.json`.

**Architecture:** Add a nested `DndContext` (dnd-kit supports nesting) that wraps only the `.subfolder-row`. A new `SortableSubfolderCard` wrapper uses `useSortable` and renders a `DragOverlay` ghost. On drag end, `onReorderSubCollections` is called, which flows up to App.jsx where a handler reorders the subcollections in-place within the full collections array and persists via the existing `reorderCollections` store function.

**Tech Stack:** `@dnd-kit/core`, `@dnd-kit/sortable` (already installed), React, existing `reorderCollections` store function.

---

## Files

- **Modify:** `src/components/Grid.jsx` — add `SortableSubfolderCard` component, subfolder `DndContext`/`SortableContext`, drag state, `DragOverlay`, `onReorderSubCollections` prop
- **Modify:** `src/App.jsx` — add `handleReorderSubCollections` handler, pass as prop to `<Grid>`

---

### Task 1: Add `useSortable` import and `SortableSubfolderCard` component to Grid.jsx

**Files:**
- Modify: `src/components/Grid.jsx:7` (imports line)

- [ ] **Step 1: Add `useSortable` to the dnd-kit/sortable import**

In `src/components/Grid.jsx`, change line 7 from:
```js
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
```
to:
```js
import { SortableContext, arrayMove, useSortable } from "@dnd-kit/sortable";
```

- [ ] **Step 2: Add `SortableSubfolderCard` component after the `SubColIcon` function (around line 17)**

Insert this new component after the closing brace of `SubColIcon`:
```jsx
function SortableSubfolderCard({ id, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab", touchAction: "none" }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify the app still compiles — open the dev server and check for errors**

Run: `npm run dev` and confirm no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Grid.jsx
git commit -m "feat: add SortableSubfolderCard wrapper component"
```

---

### Task 2: Add subfolder drag state and nested DndContext in Grid.jsx

**Files:**
- Modify: `src/components/Grid.jsx` — state, sensors already exist, wrap subfolder-row

- [ ] **Step 1: Add subfolder drag state near the existing state declarations (around line 250)**

After the existing `const [isZooming, setIsZooming] = useState(false);` line, add:
```js
const [activeSubId, setActiveSubId] = useState(null);
```

- [ ] **Step 2: Add `onReorderSubCollections` to the Grid props destructure (around line 225)**

In the `export default function Grid({` destructure, add `onReorderSubCollections,` after `onReorder,`:
```js
onReorder,
onReorderSubCollections,
```

- [ ] **Step 3: Replace the subfolder-row block (around lines 419–442) with a nested DndContext**

Find this block:
```jsx
{subCollections.length > 0 && (
  <div className="subfolder-row">
    {subCollections.map(col => {
      const count = allItems.filter(i => i.collections.includes(col.id)).length;
      return (
        <div key={col.id} className="subfolder-card" onClick={() => onSelectCollection(col.id)}>
          <div className="subfolder-card-top">
            <SubColIcon icon={col.icon} color={col.color} />
            <button
              className="subfolder-dots"
              onClick={(e) => { e.stopPropagation(); onCollectionContextMenu?.(e, col); }}
            >
              <DotsIcon />
            </button>
          </div>
          <div className="subfolder-card-bottom">
            <span className="subfolder-name">{col.name}</span>
            <span className="subfolder-count">{count} {count === 1 ? "Image" : "Images"}</span>
          </div>
        </div>
      );
    })}
  </div>
)}
```

Replace it with:
```jsx
{subCollections.length > 0 && (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragStart={({ active }) => setActiveSubId(active.id)}
    onDragEnd={({ active, over }) => {
      setActiveSubId(null);
      if (!over || active.id === over.id) return;
      const oldIdx = subCollections.findIndex(c => c.id === active.id);
      const newIdx = subCollections.findIndex(c => c.id === over.id);
      const reordered = arrayMove(subCollections, oldIdx, newIdx);
      onReorderSubCollections?.(reordered.map(c => c.id));
    }}
    onDragCancel={() => setActiveSubId(null)}
  >
    <SortableContext items={subCollections.map(c => c.id)}>
      <div className="subfolder-row">
        {subCollections.map(col => {
          const count = allItems.filter(i => i.collections.includes(col.id)).length;
          return (
            <SortableSubfolderCard key={col.id} id={col.id}>
              <div className="subfolder-card" onClick={() => onSelectCollection(col.id)}>
                <div className="subfolder-card-top">
                  <SubColIcon icon={col.icon} color={col.color} />
                  <button
                    className="subfolder-dots"
                    onClick={(e) => { e.stopPropagation(); onCollectionContextMenu?.(e, col); }}
                  >
                    <DotsIcon />
                  </button>
                </div>
                <div className="subfolder-card-bottom">
                  <span className="subfolder-name">{col.name}</span>
                  <span className="subfolder-count">{count} {count === 1 ? "Image" : "Images"}</span>
                </div>
              </div>
            </SortableSubfolderCard>
          );
        })}
      </div>
    </SortableContext>

    {createPortal(
      <DragOverlay>
        {activeSubId ? (() => {
          const col = subCollections.find(c => c.id === activeSubId);
          if (!col) return null;
          const count = allItems.filter(i => i.collections.includes(col.id)).length;
          return (
            <div className="subfolder-card" style={{ opacity: 1, pointerEvents: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
              <div className="subfolder-card-top">
                <SubColIcon icon={col.icon} color={col.color} />
              </div>
              <div className="subfolder-card-bottom">
                <span className="subfolder-name">{col.name}</span>
                <span className="subfolder-count">{count} {count === 1 ? "Image" : "Images"}</span>
              </div>
            </div>
          );
        })() : null}
      </DragOverlay>,
      document.body
    )}
  </DndContext>
)}
```

- [ ] **Step 4: Verify the app compiles and drag gesture works visually — subcollection cards should be draggable, ghost should appear**

Run: `npm run dev`, open a collection with subcollections, drag a card. Confirm: ghost follows cursor, original card is semi-transparent, cards reorder on drop.

- [ ] **Step 5: Commit**

```bash
git add src/components/Grid.jsx
git commit -m "feat: add drag-to-reorder for subcollection cards with ghost overlay"
```

---

### Task 3: Wire App.jsx handler to persist the new order

**Files:**
- Modify: `src/App.jsx` — add `handleReorderSubCollections`, pass to `<Grid>`

- [ ] **Step 1: Add `handleReorderSubCollections` handler in App.jsx after `handleReorderCollections` (around line 430)**

```js
const handleReorderSubCollections = useCallback((newSubIds) => {
  setCollections((prev) => {
    const subSet = new Set(newSubIds);
    const result = [];
    let subIdx = 0;
    for (const c of prev) {
      if (subSet.has(c.id)) {
        result.push(prev.find(x => x.id === newSubIds[subIdx++]));
      } else {
        result.push(c);
      }
    }
    reorderCollections(result.map(c => c.id)).catch(console.error);
    return result;
  });
}, []);
```

- [ ] **Step 2: Pass the handler to `<Grid>` in App.jsx**

Find the `<Grid>` JSX block. After the existing `onReorder={...}` prop, add:
```jsx
onReorderSubCollections={handleReorderSubCollections}
```

- [ ] **Step 3: Verify persistence — drag to reorder subcollections, then reload the app. The new order should be preserved.**

Run: `npm run dev`, drag subcollection cards into a new order, reload (`Ctrl+R`). Confirm the order is the same after reload.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: persist subcollection drag-reorder order to data.json"
```
