# Phase 3: Multi-select, Drag-to-Collection, and Collection Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rubber band multi-select, drag-to-sidebar collection assignment, and Images/Flows tabs in collection view.

**Architecture:** `selectedIds` state lives in `App.jsx` and flows down to `Grid` and `Sidebar`. The rubber band gesture and drag-start detection live in `Grid.jsx` using a `useEffect`-based mouse listener. App.jsx owns the drag ghost and drop coordination via `document.elementFromPoint`. Collection tabs are local state in `Grid.jsx`, reset on every `activeView` change.

**Tech Stack:** React 18, Vite, Tauri 2. No test runner — verification is done by running `npm run dev` in the `src-tauri` parent or via `cargo tauri dev` and testing in the app window.

---

## File Map

| File | What changes |
|------|-------------|
| `src/App.jsx` | Add `selectedIds`, `ghostPos`, `dragOverCollectionId` state; add `selectedIdsRef`; add `handleSelectionDragStart`; render ghost div; pass new props to Grid and Sidebar; add Escape key listener |
| `src/components/Grid.jsx` | Accept `activeView`, `selectedIds`, `onSelectionChange`, `onSelectionDragStart` props; add `activeTab` local state; add rubber band `useEffect`; add `selectedIdsRef`; add `rbOverlay` ref + div; add `data-item-id` to cards; pass `selected` prop to FlowCard; render tabs + flows tab layout |
| `src/components/FlowCard.jsx` | Accept `selected` prop; apply `.selected` class to root |
| `src/components/Sidebar.jsx` | Accept `dragOverCollectionId` prop; add `data-collection-id` attrs to collection rows; apply `.drag-target` class when matched |
| `src/App.css` | Add `.rubber-band`, `.drag-ghost`, `.card.selected`, `.flow-card.selected`, `.drag-target`, `.collection-tabs`, `.flows-tab-layout` styles |

---

## Task 1: Collection Tabs

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Grid.jsx`
- Modify: `src/App.css`

### Step 1 — Pass `activeView` prop to Grid in App.jsx

In `src/App.jsx`, find the `<Grid` JSX block (around line 348) and add `activeView={activeView}`:

```jsx
<Grid
  items={filtered}
  imageUrls={imageUrls}
  search={search}
  onSearch={setSearch}
  activeView={activeView}
  onCardClick={handleCardClick}
  onCardContextMenu={handleCardContextMenu}
  onAddClick={() => fileInputRef.current?.click()}
  onAddFlowClick={() => setFlowBuilder({ mode: "create" })}
  isDragging={isDragging}
/>
```

### Step 2 — Add tab state and reset effect in Grid.jsx

At the top of `Grid`, add:

```jsx
import { useState, useEffect, useRef } from "react";

export default function Grid({
  items,
  imageUrls,
  search,
  onSearch,
  activeView,
  onCardClick,
  onCardContextMenu,
  onAddClick,
  onAddFlowClick,
  isDragging,
  // (selectedIds, onSelectionChange, onSelectionDragStart added in Task 2)
}) {
  const [activeTab, setActiveTab] = useState("images");

  useEffect(() => {
    setActiveTab("images");
  }, [activeView]);
```

### Step 3 — Derive tab-filtered items and render tabs in toolbar

Replace the existing `return (` block in Grid.jsx with this. Keep the empty state and grid rendering below intact — only the toolbar and item list computation changes:

```jsx
  const inCollection = activeView?.type === "collection";
  const imageItems = inCollection ? items.filter(i => i.type === "image") : items;
  const flowItems  = inCollection ? items.filter(i => i.type === "flow")  : items;
  const visibleItems = inCollection
    ? (activeTab === "images" ? imageItems : flowItems)
    : items;

  return (
    <div className="grid-area">
      <header className="toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {inCollection && (
          <div className="collection-tabs">
            <button
              className={`tab-btn${activeTab === "images" ? " active" : ""}`}
              onClick={() => setActiveTab("images")}
            >Images</button>
            <button
              className={`tab-btn${activeTab === "flows" ? " active" : ""}`}
              onClick={() => setActiveTab("flows")}
            >Flows</button>
          </div>
        )}
        <button className="btn-add" onClick={onAddClick}>+ Image</button>
        <button className="btn-add" onClick={onAddFlowClick}>+ Flow</button>
      </header>
```

### Step 4 — Render flows tab layout

Below the toolbar, replace the existing empty-state/grid block with:

```jsx
      {inCollection && activeTab === "flows" ? (
        flowItems.length === 0 ? (
          <div className="empty-state">No flows in this collection.</div>
        ) : (
          <div className="flows-tab-layout">
            {flowItems.map(flow => (
              <div key={flow.id} className="flow-row">
                <div className="flow-row-title">{flow.title || "Untitled"}</div>
                <div className="flow-row-screens">
                  {(flow.screens || []).map(screen => (
                    <div
                      key={screen.id}
                      className="flow-row-screen"
                      onClick={() => onCardClick(flow)}
                    >
                      {imageUrls[screen.id]
                        ? <img src={imageUrls[screen.id]} alt="" />
                        : <div className="card-placeholder" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : visibleItems.length === 0 ? (
        <div className={`empty-state${isDragging ? " drop-active" : ""}`}>
          {isDragging
            ? "Drop to save"
            : inCollection && activeTab === "images"
              ? "No images in this collection."
              : "Drag an image in or paste with Ctrl+V to get started."}
        </div>
      ) : (
        <div className={`grid${isDragging ? " drop-active" : ""}`}>
          {isDragging && <div className="grid-drop-overlay"><span>Drop to save</span></div>}
          {visibleItems.map((item) => {
            if (item.type === "flow") {
              const firstScreenUrl = item.screens?.[0]
                ? imageUrls[item.screens[0].id]
                : undefined;
              return (
                <FlowCard
                  key={item.id}
                  item={item}
                  imageUrl={firstScreenUrl}
                  onClick={() => onCardClick(item)}
                  onContextMenu={onCardContextMenu}
                />
              );
            }
            return (
              <div
                key={item.id}
                className="card"
                onClick={() => onCardClick(item)}
                onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(e, item); }}
                title={item.title || undefined}
              >
                {imageUrls[item.id]
                  ? <img src={imageUrls[item.id]} alt={item.title || "image"} loading="lazy" />
                  : <div className="card-placeholder" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### Step 5 — Add tab + flows layout styles to App.css

Append to `src/App.css`:

```css
/* ── Collection tabs ─────────────────────────────────────────────────────── */
.collection-tabs {
  display: flex;
  gap: 2px;
  margin-right: auto;
}
.tab-btn {
  all: unset;
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 5px;
  cursor: pointer;
  color: var(--muted);
  transition: color 0.1s, background 0.1s;
}
.tab-btn:hover  { color: var(--text); background: var(--accent-bg); }
.tab-btn.active { color: var(--text); font-weight: 500; border-bottom: 2px solid var(--accent); border-radius: 0; }

/* ── Flows tab layout ────────────────────────────────────────────────────── */
.flows-tab-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px;
  overflow-y: auto;
}
.flow-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.flow-row-title {
  min-width: 120px;
  max-width: 120px;
  font-size: 13px;
  font-weight: 500;
  padding-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.flow-row-screens {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  flex: 1;
  padding-bottom: 4px;
}
.flow-row-screen {
  flex-shrink: 0;
  width: 160px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  background: var(--grey-100);
}
.flow-row-screen:hover { opacity: 0.85; }
.flow-row-screen img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Step 6 — Run dev and verify

Run `npm run tauri dev` (or however you start the dev build).

Expected:
- Click a collection in the sidebar → two tabs "Images" and "Flows" appear in the toolbar
- Images tab shows masonry grid filtered to images only
- Flows tab shows vertical list with horizontal scroll per flow
- Clicking a flow screen opens FlowDetail as before
- Switching to "All" view → tabs disappear
- Tab resets to Images when you click a different collection

### Step 7 — Commit

```bash
git add src/App.jsx src/components/Grid.jsx src/App.css
git commit -m "feat: add Images/Flows tabs in collection view"
```

---

## Task 2: Rubber Band Selection

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Grid.jsx`
- Modify: `src/components/FlowCard.jsx`
- Modify: `src/App.css`

### Step 1 — Add selectedIds state and ref in App.jsx

In `src/App.jsx`, add these near the other `useState` declarations (around line 23):

```jsx
const [selectedIds,        setSelectedIds]        = useState(new Set());
const selectedIdsRef = useRef(new Set());
useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
```

Add an Escape key listener alongside the existing paste listener (in the same or adjacent `useEffect`):

```jsx
useEffect(() => {
  const onKeyDown = (e) => {
    if (e.key === "Escape") setSelectedIds(new Set());
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}, []);
```

### Step 2 — Pass selectedIds and callbacks to Grid in App.jsx

Update the `<Grid` JSX to add three new props:

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
  onAddClick={() => fileInputRef.current?.click()}
  onAddFlowClick={() => setFlowBuilder({ mode: "create" })}
  isDragging={isDragging}
/>
```

`handleSelectionDragStart` is defined in Task 3. For now add a stub after the other handlers in App.jsx:

```jsx
const handleSelectionDragStart = useCallback(() => {
  // wired in Task 3
}, []);
```

### Step 3 — Add rubber band refs and useEffect in Grid.jsx

Accept the new props in Grid's function signature:

```jsx
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
  onAddClick,
  onAddFlowClick,
  isDragging,
}) {
```

Add refs inside the component (below the `activeTab` state):

```jsx
  const gridRef    = useRef(null);  // attached to the grid-area div
  const rbOverlay  = useRef(null);  // the rubber band rectangle div
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
```

Add the rubber band `useEffect`:

```jsx
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    let rbStartX = 0, rbStartY = 0, rbActive = false;

    const onMouseMove = (e) => {
      const dx = e.clientX - rbStartX;
      const dy = e.clientY - rbStartY;
      if (!rbActive && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      rbActive = true;

      const left = Math.min(e.clientX, rbStartX);
      const top  = Math.min(e.clientY, rbStartY);
      const w    = Math.abs(dx);
      const h    = Math.abs(dy);

      if (rbOverlay.current) {
        rbOverlay.current.style.display = "block";
        rbOverlay.current.style.left    = `${left}px`;
        rbOverlay.current.style.top     = `${top}px`;
        rbOverlay.current.style.width   = `${w}px`;
        rbOverlay.current.style.height  = `${h}px`;
      }

      const rbRect = { left, top, right: left + w, bottom: top + h };
      const cards  = grid.querySelectorAll("[data-item-id]");
      const hits   = new Set();
      cards.forEach((card) => {
        const r = card.getBoundingClientRect();
        if (r.left < rbRect.right && r.right > rbRect.left &&
            r.top  < rbRect.bottom && r.bottom > rbRect.top) {
          hits.add(card.dataset.itemId);
        }
      });
      onSelectionChange(hits);
    };

    const onMouseUp = () => {
      if (rbOverlay.current) rbOverlay.current.style.display = "none";
      rbActive = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;

      // If mousedown on a selected card → start drag (Task 3)
      const cardEl = e.target.closest("[data-item-id]");
      if (cardEl && selectedIdsRef.current.has(cardEl.dataset.itemId)) {
        onSelectionDragStart();
        return;
      }

      // If mousedown on any card → normal click, just clear selection
      if (cardEl) {
        onSelectionChange(new Set());
        return;
      }

      // Background mousedown → start rubber band
      rbStartX  = e.clientX;
      rbStartY  = e.clientY;
      rbActive  = false;
      onSelectionChange(new Set());

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup",   onMouseUp);
    };

    grid.addEventListener("mousedown", onMouseDown);
    return () => {
      grid.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, [onSelectionChange, onSelectionDragStart]);
```

### Step 4 — Add rubber band overlay div and attach gridRef

In the Grid JSX, attach `ref={gridRef}` to the outer `<div className="grid-area">` and add the overlay div inside it:

```jsx
  return (
    <div className="grid-area" ref={gridRef}>
      <div ref={rbOverlay} className="rubber-band" style={{ display: "none" }} />
      {/* ...rest of JSX unchanged... */}
```

### Step 5 — Add data-item-id to image cards and pass selected to FlowCard

In the image card JSX inside Grid, add `data-item-id`:

```jsx
            return (
              <div
                key={item.id}
                data-item-id={item.id}
                className={`card${selectedIds?.has(item.id) ? " selected" : ""}`}
                onClick={() => onCardClick(item)}
                onContextMenu={(e) => { e.preventDefault(); onCardContextMenu(e, item); }}
                title={item.title || undefined}
              >
```

In the FlowCard call, add `data-item-id` and `selected`:

```jsx
              return (
                <FlowCard
                  key={item.id}
                  item={item}
                  imageUrl={firstScreenUrl}
                  selected={selectedIds?.has(item.id)}
                  onClick={() => onCardClick(item)}
                  onContextMenu={onCardContextMenu}
                />
              );
```

### Step 6 — Update FlowCard.jsx to accept and apply selected

```jsx
export default function FlowCard({ item, imageUrl, onClick, onContextMenu, selected }) {
  const count = item.screens?.length ?? 0;
  return (
    <div
      data-item-id={item.id}
      className={`flow-card${selected ? " selected" : ""}`}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
      title={item.title || undefined}
    >
```

### Step 7 — Add rubber band + selected styles to App.css

Append to `src/App.css`:

```css
/* ── Rubber band selection ───────────────────────────────────────────────── */
.rubber-band {
  position: fixed;
  pointer-events: none;
  z-index: 500;
  border: 1.5px solid var(--accent);
  background: rgba(0, 0, 0, 0.04);
  border-radius: 3px;
}

.card.selected,
.flow-card.selected .flow-card-face {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

### Step 8 — Run dev and verify

Run `npm run tauri dev`.

Expected:
- Click and drag on the grid background → blue-grey rubber band rectangle appears
- Cards inside the rectangle get a dark outline as you drag over them
- Release → selection stays highlighted
- Click background (no drag) → selection clears
- Press Escape → selection clears
- Right-clicking a card still works normally
- Clicking a single card (no drag) → detail panel opens, selection clears

### Step 9 — Commit

```bash
git add src/App.jsx src/components/Grid.jsx src/components/FlowCard.jsx src/App.css
git commit -m "feat: rubber band multi-select on grid"
```

---

## Task 3: Drag Selection to Sidebar

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/App.css`

### Step 1 — Add drag state to App.jsx

Add these state and ref declarations near the others:

```jsx
const [ghostPos,             setGhostPos]             = useState(null); // { x, y } | null
const [dragOverCollectionId, setDragOverCollectionId] = useState(null);
const dragColRef  = useRef(null);  // mirrors dragOverCollectionId for use in mouseup closure
const itemsRef    = useRef(items); // always-current items for use in stable callbacks
useEffect(() => { itemsRef.current = items; }, [items]);
```

### Step 2 — Replace the handleSelectionDragStart stub in App.jsx

Replace the stub with the real implementation:

```jsx
const handleSelectionDragStart = useCallback(() => {
  const onMove = (e) => {
    setGhostPos({ x: e.clientX, y: e.clientY });

    const el    = document.elementFromPoint(e.clientX, e.clientY);
    const colEl = el?.closest("[data-collection-id]");
    const colId = colEl?.dataset?.collectionId ?? null;
    dragColRef.current = colId;
    setDragOverCollectionId(colId);
  };

  const onUp = () => {
    const colId = dragColRef.current;
    if (colId) {
      // Assign all selected items to this collection (no duplicates)
      // Use itemsRef so this callback stays stable ([] deps)
      selectedIdsRef.current.forEach((id) => {
        const item = itemsRef.current.find((i) => i.id === id);
        if (!item) return;
        if (!item.collections.includes(colId)) {
          handleUpdate(id, { collections: [...item.collections, colId] });
        }
      });
    }
    setSelectedIds(new Set());
    setDragOverCollectionId(null);
    dragColRef.current = null;
    setGhostPos(null);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup",   onUp);
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup",   onUp);
}, [handleUpdate]); // stable: items read via itemsRef, selectedIds via selectedIdsRef
```

Note: `selectedIdsRef` and `setSelectedIds` are already defined from Task 2.

### Step 3 — Render the drag ghost in App.jsx

Inside the App return JSX, add the ghost div (anywhere at the top level, e.g. after `{ctxMenu && ...}`):

```jsx
      {ghostPos && (
        <div
          className="drag-ghost"
          style={{ left: ghostPos.x + 12, top: ghostPos.y + 12 }}
        >
          +{selectedIds.size}
        </div>
      )}
```

### Step 4 — Pass dragOverCollectionId to Sidebar in App.jsx

Update the `<Sidebar` JSX to include the new prop:

```jsx
      <Sidebar
        collections={collections}
        items={items}
        activeView={activeView}
        dragOverCollectionId={dragOverCollectionId}
        onSelectAll={() => setActiveView({ type: "all" })}
        onSelectUnorganized={() => setActiveView({ type: "unorganized" })}
        onSelectCollection={(id) => setActiveView({ type: "collection", id })}
        onSelectTag={(tag) => setActiveView({ type: "tag", tag })}
        onAddCollection={handleAddCollection}
        onRenameCollection={handleRenameCollection}
        onContextMenu={handleCollectionContextMenu}
        width={sidebarWidth}
        onResizeStart={handleSidebarResizeStart}
      />
```

### Step 5 — Update Sidebar.jsx to accept dragOverCollectionId and apply attrs

Add `dragOverCollectionId` to the Sidebar props:

```jsx
export default function Sidebar({
  collections,
  items,
  activeView,
  dragOverCollectionId,
  onSelectAll,
  // ...rest unchanged
}) {
```

In `renderCollection`, add `data-collection-id` to the collection row div and apply `.drag-target` when matched:

```jsx
  const renderCollection = (col, isChild = false) => {
    const children   = isChild ? [] : getChildren(col.id);
    const hasKids    = children.length > 0;
    const isExpanded = expandedIds.has(col.id);
    const isActive   = activeView.type === "collection" && activeView.id === col.id;
    const isDragTarget = dragOverCollectionId === col.id;

    return (
      <div key={col.id}>
        <div
          data-collection-id={col.id}
          className={`nav-item collection-item${isActive ? " active" : ""}${isChild ? " sub-item" : ""}${isDragTarget ? " drag-target" : ""}`}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col, () => startRename(col)); }}
        >
```

Also add `data-collection-id` to the archived collection rows (the `onClick` div in the archived section):

```jsx
            <div
              key={col.id}
              data-collection-id={col.id}
              className={`nav-item collection-item muted${activeView.type === "collection" && activeView.id === col.id ? " active" : ""}${dragOverCollectionId === col.id ? " drag-target" : ""}`}
              onClick={() => onSelectCollection(col.id)}
              onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, col, () => startRename(col)); }}
            >
```

### Step 6 — Add ghost and drag-target styles to App.css

Append to `src/App.css`:

```css
/* ── Drag-to-sidebar ghost ───────────────────────────────────────────────── */
.drag-ghost {
  position: fixed;
  z-index: 900;
  pointer-events: none;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

/* ── Sidebar drop target ─────────────────────────────────────────────────── */
.nav-item.drag-target {
  background: var(--accent-bg);
  outline: 1.5px solid var(--accent);
  outline-offset: -1px;
  border-radius: 6px;
}
```

### Step 7 — Run dev and verify

Run `npm run tauri dev`.

Expected:
- Rubber band select 2+ cards
- Mousedown on any selected card → dark "+N" pill ghost follows cursor
- Hover over a collection in the sidebar → it gets a subtle highlight ring
- Release over a collection → items are assigned to it, selection clears, ghost disappears
- Release outside any collection → selection clears, no change to items
- Verify in the app: the items now appear when you click that collection

### Step 8 — Commit

```bash
git add src/App.jsx src/components/Sidebar.jsx src/App.css
git commit -m "feat: drag selected cards to sidebar to assign collection"
```
