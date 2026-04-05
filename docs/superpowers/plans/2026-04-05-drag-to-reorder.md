# Drag-to-Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pinterest-style drag-to-reorder to the masonry grid — live card shifting during drag, order persisted to `data.json`.

**Architecture:** Switch the grid from CSS `columns` to an absolutely-positioned JS-calculated masonry layout (`useMasonryLayout` hook). Wrap each card in dnd-kit's `useSortable`. On drag end, splice the global `items` array and call `reorderItems()` to persist. One global order shared by all views.

**Tech Stack:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, React hooks, Tauri FS

---

## File Map

| File | Change |
|---|---|
| `src/hooks/useMasonryLayout.js` | **Create** — measures card heights, returns absolute `{x,y}` positions |
| `src/components/SortableCard.jsx` | **Create** — dnd-kit `useSortable` wrapper for each card |
| `src/components/Grid.jsx` | **Modify** — add DndContext + SortableContext, switch to JS masonry |
| `src/store.js` | **Modify** — add `reorderItems(newOrderedIds)` |
| `src/App.jsx` | **Modify** — add `handleReorder`, pass `onReorder` to Grid |
| `src/App.css` | **Modify** — remove CSS columns, add absolute positioning + drag transitions |

---

### Task 1: Install dnd-kit packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd "c:/Users/Oem/Desktop/my projects/tome"
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected output: packages added, no errors.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit packages for drag-to-reorder"
```

---

### Task 2: Add `reorderItems` to store.js

**Files:**
- Modify: `src/store.js`

- [ ] **Step 1: Add the function after `deleteItem` (after line 90)**

Open `src/store.js`. After the closing `}` of `deleteItem`, add:

```js
// Takes a full array of item IDs in their new desired order.
// Reorders data.items to match, then saves.
export async function reorderItems(newOrderedIds) {
  const data = await loadData();
  const itemMap = new Map(data.items.map((i) => [i.id, i]));
  data.items = newOrderedIds
    .filter((id) => itemMap.has(id))
    .map((id) => itemMap.get(id));
  await saveData(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/store.js
git commit -m "feat: add reorderItems to store"
```

---

### Task 3: Wire up `handleReorder` in App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import arrayMove and reorderItems**

At the top of `src/App.jsx`, add `arrayMove` import:

```js
import { arrayMove } from "@dnd-kit/sortable";
```

In the existing `./store` import block, add `reorderItems`:

```js
import {
  loadItems, addItem, updateItem, deleteItem, getImageUrl,
  loadCollections, addCollection, updateCollection, deleteCollection, archiveCollection,
  addFlow, updateFlow, reorderItems,
} from "./store";
```

- [ ] **Step 2: Add `handleReorder` after `handleDelete` (after line ~218)**

```js
const handleReorder = useCallback((activeId, overId) => {
  setItems((prev) => {
    const oldIndex = prev.findIndex((i) => i.id === activeId);
    const newIndex = prev.findIndex((i) => i.id === overId);
    if (oldIndex === -1 || newIndex === -1) return prev;
    const reordered = arrayMove(prev, oldIndex, newIndex);
    reorderItems(reordered.map((i) => i.id)).catch(console.error);
    return reordered;
  });
}, []);
```

- [ ] **Step 3: Pass `onReorder` to Grid**

Find `<Grid` in App.jsx's return (around line 431). Add `onReorder={handleReorder}` to its props:

```jsx
<Grid
  items={filtered}
  imageUrls={imageUrls}
  search={search}
  onSearch={setSearch}
  activeView={activeView}
  selectedIds={selectedIds}
  onSelectionChange={setSelectedIds}
  onSelectionDragStart={handleSelectionDragStart}
  onCardClick={handleCardClick}
  onCardContextMenu={handleCardContextMenu}
  isDragging={isDragging}
  onReorder={handleReorder}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire handleReorder in App"
```

---

### Task 4: Create `useMasonryLayout` hook

**Files:**
- Create: `src/hooks/useMasonryLayout.js`

This hook replaces CSS `columns`. After each render it queries the DOM for card heights, then runs a shortest-column-first algorithm to assign `{x, y, width}` to each item. A `ResizeObserver` re-runs the calculation when the container is resized.

`useLayoutEffect` (not `useEffect`) is used for the items-change trigger so positions are applied before the browser paints — preventing a visible flash.

- [ ] **Step 1: Create the hooks directory**

```bash
mkdir -p "c:/Users/Oem/Desktop/my projects/tome/src/hooks"
```

- [ ] **Step 2: Write the hook**

Create `src/hooks/useMasonryLayout.js`:

```js
import { useState, useLayoutEffect, useEffect, useRef, useCallback } from "react";

const GAP = 12;          // matches the old column-gap
const MIN_COL_WIDTH = 180; // matches the old `columns: 4 180px`

export default function useMasonryLayout(items) {
  const containerRef = useRef(null);
  const itemsRef     = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const [layout, setLayout] = useState({
    positions: {},
    containerHeight: 0,
    columnWidth: MIN_COL_WIDTH,
  });

  const recalculate = useCallback((currentItems) => {
    const container = containerRef.current;
    if (!container) return;

    // clientWidth includes padding (20px each side), so subtract 40 for usable width
    const usable = container.clientWidth - 40;
    if (usable <= 0) return;

    const colCount   = Math.max(1, Math.floor((usable + GAP) / (MIN_COL_WIDTH + GAP)));
    const colWidth   = (usable - GAP * (colCount - 1)) / colCount;
    const colHeights = Array(colCount).fill(0);
    const positions  = {};

    currentItems.forEach((item) => {
      const card = container.querySelector(`[data-item-id="${item.id}"]`);
      if (!card) return;
      const col = colHeights.indexOf(Math.min(...colHeights));
      positions[item.id] = {
        x: col * (colWidth + GAP),
        y: colHeights[col],
        width: colWidth,
      };
      colHeights[col] += card.offsetHeight + GAP;
    });

    setLayout({
      positions,
      containerHeight: colHeights.length > 0 ? Math.max(...colHeights) : 0,
      columnWidth: colWidth,
    });
  }, []);

  // Re-run after every items change (synchronous, before browser paint)
  useLayoutEffect(() => {
    recalculate(items);
  }, [items, recalculate]);

  // Re-run on container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalculate(itemsRef.current));
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalculate]);

  return { ...layout, containerRef };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMasonryLayout.js
git commit -m "feat: add useMasonryLayout hook"
```

---

### Task 5: Create `SortableCard` component

**Files:**
- Create: `src/components/SortableCard.jsx`

`SortableCard` is a thin wrapper around dnd-kit's `useSortable`. It:
- Applies the drag transform (so dnd-kit can move the card visually as you drag)
- Sets `opacity: 0` when this item is the actively-dragged one — this creates the "hole" effect. The ghost is rendered separately by `DragOverlay` in Grid.
- Accepts `disabled` — set `true` for rubber-band selected items so their mousedown falls through to the existing collection-drag gesture.

- [ ] **Step 1: Write the component**

Create `src/components/SortableCard.jsx`:

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SortableCard.jsx
git commit -m "feat: add SortableCard dnd-kit wrapper"
```

---

### Task 6: Rewrite Grid.jsx masonry section

**Files:**
- Modify: `src/components/Grid.jsx`

The rubber-band selection logic and the Flows tab are **not changed**. Only the masonry `.grid` block is replaced.

- [ ] **Step 1: Replace the import block at the top of Grid.jsx**

Replace the entire existing import section with:

```js
import { useState, useEffect, useRef } from "react";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import FlowCard from "./FlowCard";
import SortableCard from "./SortableCard";
import useMasonryLayout from "../hooks/useMasonryLayout";
```

- [ ] **Step 2: Add `onReorder` to the props destructure**

Change the function signature to add `onReorder`:

```js
export default function Grid({
  items,
  imageUrls,
  search,
  onSearch,
  activeView,
  selectedIds,
  onSelectionChange,
  onSelectionDragStart,
  onCardClick,
  onCardContextMenu,
  isDragging,
  onReorder,
}) {
```

- [ ] **Step 3: Add dnd-kit state and sensors after the existing `activeTab` useState**

After the line `const [activeTab, setActiveTab] = useState("images");`, add:

```js
const [activeId, setActiveId] = useState(null);

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  })
);

function handleDragStart({ active }) {
  // If dragging an unselected card while selection exists, clear selection first
  if (selectedIdsRef.current.size > 0 && !selectedIdsRef.current.has(active.id)) {
    onSelectionChange(new Set());
  }
  setActiveId(active.id);
}

function handleDragEnd({ active, over }) {
  setActiveId(null);
  if (!over || active.id === over.id) return;
  onReorder(active.id, over.id);
}
```

- [ ] **Step 4: Add masonry hook and activeItem after the `visibleItems` calculation**

Find the line `const visibleItems = inCollection` (around line 121). After the entire `visibleItems` declaration block, add:

```js
const { positions, containerHeight, columnWidth, containerRef: masonryRef } =
  useMasonryLayout(visibleItems);

const activeItem = activeId ? items.find((i) => i.id === activeId) : null;
```

- [ ] **Step 5: Replace the masonry grid JSX**

Find the existing masonry grid block in the return — it is the `<div className={`grid${isDragging ...`}>` block inside the final conditional (the one that renders when there are visible items and the active tab is not the Flows tab). Replace this entire block with:

```jsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={visibleItems.map((i) => i.id)}
    strategy={rectSortingStrategy}
  >
    <div
      ref={(el) => {
        gridRef.current    = el;
        masonryRef.current = el;
      }}
      className={`grid${isDragging ? " drop-active" : ""}`}
      style={{ height: containerHeight || undefined }}
    >
      {isDragging && <div className="grid-drop-overlay"><span>Drop to save</span></div>}
      {visibleItems.map((item) => {
        const pos = positions[item.id];
        const cardStyle = pos
          ? { position: "absolute", left: pos.x, top: pos.y, width: pos.width }
          : { position: "absolute", left: 0, top: 0, width: columnWidth, visibility: "hidden" };

        if (item.type === "flow") {
          const firstScreenUrl = item.screens?.[0]
            ? imageUrls[item.screens[0].id]
            : undefined;
          return (
            <SortableCard
              key={item.id}
              id={item.id}
              style={cardStyle}
              disabled={selectedIds?.has(item.id)}
            >
              <FlowCard
                item={item}
                imageUrl={firstScreenUrl}
                selected={selectedIds?.has(item.id)}
                onClick={() => onCardClick(item)}
                onContextMenu={onCardContextMenu}
              />
            </SortableCard>
          );
        }

        return (
          <SortableCard
            key={item.id}
            id={item.id}
            style={cardStyle}
            disabled={selectedIds?.has(item.id)}
          >
            <div
              data-item-id={item.id}
              className={`card${selectedIds?.has(item.id) ? " selected" : ""}`}
              onClick={() => onCardClick(item)}
              onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(e, item); }}
              title={item.title || undefined}
            >
              {imageUrls[item.id]
                ? <img src={imageUrls[item.id]} alt={item.title || "image"} loading="lazy" />
                : <div className="card-placeholder" />}
            </div>
          </SortableCard>
        );
      })}
    </div>
  </SortableContext>

  <DragOverlay>
    {activeItem && (
      <div style={{
        opacity: 0.6,
        transform: "scale(1.03)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        borderRadius: 8,
        overflow: "hidden",
        width: columnWidth,
        cursor: "grabbing",
      }}>
        {activeItem.type === "flow" ? (
          <FlowCard
            item={activeItem}
            imageUrl={activeItem.screens?.[0] ? imageUrls[activeItem.screens[0].id] : undefined}
            selected={false}
            onClick={() => {}}
            onContextMenu={() => {}}
          />
        ) : (
          <div className="card">
            {imageUrls[activeItem.id]
              ? <img
                  src={imageUrls[activeItem.id]}
                  alt={activeItem.title || "image"}
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              : <div className="card-placeholder" />}
          </div>
        )}
      </div>
    )}
  </DragOverlay>
</DndContext>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Grid.jsx
git commit -m "feat: switch Grid to JS masonry + dnd-kit drag-to-reorder"
```

---

### Task 7: Update CSS

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Replace the `.grid` rule (around line 324)**

Find:
```css
.grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  columns: 4 180px;   /* masonry via CSS columns */
  column-gap: 12px;
}
```

Replace with:
```css
.grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  position: relative;  /* required for absolutely-positioned cards */
  min-height: 100px;
}
```

- [ ] **Step 2: Remove the duplicate `position: relative` rule (around line 369)**

Find and delete this line (the property is now in the main `.grid` rule above):
```css
.grid { position: relative; }
```

- [ ] **Step 3: Update `.card` — remove columns-specific properties, add transform transition**

Find the `.card` block:
```css
.card {
  break-inside: avoid;
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s, opacity 0.15s;
}
```

Replace with:
```css
.card {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s, opacity 0.15s, transform 200ms ease;
}
```

- [ ] **Step 4: Update `.flow-card` — remove columns-specific properties, add transform transition**

Find the `.flow-card` block:
```css
.flow-card {
  break-inside: avoid;
  margin-bottom: 12px;
  position: relative;
  cursor: pointer;
}
```

Replace with:
```css
.flow-card {
  position: relative;
  cursor: pointer;
  transition: transform 200ms ease;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/App.css
git commit -m "feat: update CSS for JS masonry — remove columns, add drag transitions"
```

---

### Task 8: Smoke test

- [ ] **Step 1: Start the app**

```bash
cd "c:/Users/Oem/Desktop/my projects/tome"
npm run tauri dev
```

- [ ] **Step 2: Verify the grid looks correct**

Confirm: cards render in masonry columns, proportions match the old layout, no overlapping, no blank gaps.

- [ ] **Step 3: Test drag-to-reorder**

1. Press and hold a card for ~150ms — a semi-transparent ghost lifts off at 60% opacity, slight scale-up
2. Drag over other cards — they should shift to make room in real time
3. Drop — card lands in its new spot
4. Quit and reopen — confirm the order persisted in `~/compendie/data.json`

- [ ] **Step 4: Test gesture coexistence**

1. Rubber-band select 2+ cards (drag on empty background)
2. Drag from a **selected** card toward the sidebar → should still assign to collection (not reorder)
3. With no selection, drag an unselected card → should reorder
4. Short-click a card (< 150ms hold) → should open detail panel, not drag

- [ ] **Step 5: Test collection view reorder**

1. Open a collection, reorder items inside it
2. Go to All view — verify those items appear in their new global positions

- [ ] **Step 6: Commit any fixes, then final commit**

```bash
git add -p
git commit -m "feat: drag-to-reorder complete — Pinterest-style masonry reorder with dnd-kit"
```
