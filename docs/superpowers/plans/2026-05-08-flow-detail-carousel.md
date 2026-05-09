# Flow Detail Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FlowDetail's fullscreen takeover with a DetailPanel-style modal that shows flow screens as a draggable peek carousel, with a matching flow-level metadata panel on the right.

**Architecture:** FlowDetail.jsx is fully rewritten. It reuses DetailPanel's existing CSS shell classes (detail-backdrop, detail-modal, detail-topbar, detail-body, detail-meta-side, etc.) so both detail views feel identical. The carousel is an absolutely-positioned flex track shifted via `translateX` — computed from a ResizeObserver-measured container width. Adjacent screens peek 80 px in from each edge at reduced opacity. A mousedown/mousemove/mouseup drag handler animates the track live; releasing snaps to the nearest screen. The metadata panel is an exact functional copy of DetailPanel's right side, adapted for flow-level fields.

**Tech Stack:** React hooks (useState, useEffect, useRef, useCallback), ResizeObserver, CSS transforms, localStorage

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/App.css` | Modify | Add `.flow-carousel-*` styles after the existing `.flow-detail-*` block |
| `src/components/FlowDetail.jsx` | Full rewrite | Peek carousel detail view |
| `src/App.jsx` | Modify | Update FlowDetail call site (~line 943) with new props |

---

### Task 1: Add carousel CSS

**Files:**
- Modify: `src/App.css` (after the `.flow-detail-panel .panel-note` block, around line 2087)

- [ ] **Step 1: Add carousel styles after the existing flow-detail CSS block**

Find the line `/* ── FlowDetail zoom controls ──` in `src/App.css` and insert the following block directly before it:

```css
/* ── Flow carousel ──────────────────────────────────────────────────────── */
.flow-carousel-area {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.flow-carousel-track {
  display: flex;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  will-change: transform;
}

.flow-carousel-card {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  transition: opacity 200ms ease;
}

.flow-carousel-card img {
  max-height: calc(100% - 32px);
  max-width: 100%;
  object-fit: contain;
  border-radius: 6px;
  pointer-events: none;
  display: block;
}

.flow-carousel-card--adjacent {
  opacity: 0.35;
}

.flow-carousel-placeholder {
  width: 120px;
  height: 200px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

```

- [ ] **Step 2: Commit**

```bash
git add src/App.css
git commit -m "style: add flow carousel CSS"
```

---

### Task 2: Rewrite FlowDetail.jsx — shell, topbar, static view

**Files:**
- Rewrite: `src/components/FlowDetail.jsx`

This task sets up the full modal shell with working topbar (arrows, counter, hide panel, dot menu, close) and shows the selected screen statically. The carousel slide logic is added in Task 3.

- [ ] **Step 1: Replace the entire file**

```jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import * as LucideIcons from "lucide-react";
import { TagInputBox } from "./ui/TagInputBox";
import { CollectionChip } from "./ui/CollectionChip";
import ContextMenu from "./ContextMenu";

export default function FlowDetail({
  flow,
  imageUrls,
  collections,
  allTags = [],
  onUpdate,
  onDelete,
  onClose,
  onAddNewCollection,
}) {
  const screens = flow.screens ?? [];

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [metaHidden, setMetaHidden]   = useState(false);
  const [metaWidth,  setMetaWidth]    = useState(
    () => parseInt(localStorage.getItem("tome_flow_detail_meta_width") || "320")
  );
  const [dotMenuPos, setDotMenuPos]   = useState(null);

  const dotBtnRef = useRef(null);

  const hasPrev = selectedIdx > 0;
  const hasNext = selectedIdx < screens.length - 1;

  const goTo = useCallback((idx) => {
    setSelectedIdx(Math.max(0, Math.min(idx, screens.length - 1)));
  }, [screens.length]);

  // Reset to first screen when flow changes
  useEffect(() => {
    setSelectedIdx(0);
    setDotMenuPos(null);
  }, [flow.id]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft"  && hasPrev) goTo(selectedIdx - 1);
      if (e.key === "ArrowRight" && hasNext) goTo(selectedIdx + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, hasPrev, hasNext, selectedIdx, goTo]);

  const openDotMenu = () => {
    const rect = dotBtnRef.current?.getBoundingClientRect();
    if (rect) setDotMenuPos({ x: rect.right - 160, y: rect.bottom + 4 });
  };

  const handleMetaResizeStart = (e) => {
    e.preventDefault();
    const startX    = e.clientX;
    const startWidth = metaWidth;
    const onMove = (ev) => {
      const next = Math.min(520, Math.max(240, startWidth + (startX - ev.clientX)));
      setMetaWidth(next);
      localStorage.setItem("tome_flow_detail_meta_width", next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",  onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  };

  const formattedDate = new Date(flow.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const dotMenuItems = [
    {
      icon: LucideIcons.Trash2,
      label: "Delete",
      danger: true,
      action: () => { onDelete(flow.id); onClose(); },
    },
  ];

  return (
    <div className="detail-backdrop" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Topbar ── */}
        <div className="detail-topbar">
          <div className="detail-topbar-nav">
            <button
              className="btn-icon"
              onClick={() => hasPrev && goTo(selectedIdx - 1)}
              disabled={!hasPrev}
              title="Previous screen (←)"
            >
              <LucideIcons.ChevronLeft size={15} />
            </button>
            <button
              className="btn-icon"
              onClick={() => hasNext && goTo(selectedIdx + 1)}
              disabled={!hasNext}
              title="Next screen (→)"
            >
              <LucideIcons.ChevronRight size={15} />
            </button>
            {screens.length > 1 && (
              <span className="detail-topbar-counter">
                {selectedIdx + 1} / {screens.length}
              </span>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <div className="detail-topbar-actions">
            <button
              className="btn-icon"
              onClick={() => setMetaHidden((v) => !v)}
              title={metaHidden ? "Show panel" : "Hide panel"}
            >
              <LucideIcons.PanelRight size={15} />
            </button>
            <button
              ref={dotBtnRef}
              className="btn-icon"
              onClick={openDotMenu}
              title="More options"
            >
              <LucideIcons.MoreHorizontal size={15} />
            </button>
            <button className="btn-icon" onClick={onClose} title="Close (Esc)">
              <LucideIcons.X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="detail-body">

          {/* Carousel area — static placeholder, wired up in Task 3 */}
          <div className="flow-carousel-area">
            {screens[selectedIdx] && imageUrls[screens[selectedIdx].id]
              ? <img
                  src={imageUrls[screens[selectedIdx].id]}
                  alt={`Screen ${selectedIdx + 1}`}
                  style={{
                    maxHeight: "calc(100% - 32px)",
                    maxWidth: "calc(100% - 160px)",
                    objectFit: "contain",
                    borderRadius: 6,
                  }}
                />
              : <div className="flow-carousel-placeholder" />
            }
          </div>

          {/* Metadata panel — placeholder, filled in Task 4 */}
          {!metaHidden && (
            <>
              <div className="detail-meta-resize-handle" onMouseDown={handleMetaResizeStart} />
              <div className="detail-meta-side" style={{ width: metaWidth, flex: "none" }}>
                <div className="detail-meta-footer">
                  <p className="panel-date">{formattedDate}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dot menu portal */}
      {dotMenuPos && createPortal(
        <div onClick={(e) => e.stopPropagation()}>
          <ContextMenu
            x={dotMenuPos.x}
            y={dotMenuPos.y}
            items={dotMenuItems}
            onClose={() => setDotMenuPos(null)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in the app**

Open a flow. You should see the modal shell open with the correct topbar (arrows, counter, hide panel, dot, close). Arrows step through screens. Esc closes.

- [ ] **Step 3: Commit**

```bash
git add src/components/FlowDetail.jsx
git commit -m "feat: flow detail modal shell and topbar"
```

---

### Task 3: Carousel — sliding track, drag gesture, transitions

**Files:**
- Modify: `src/components/FlowDetail.jsx`

This task replaces the static placeholder in the carousel area with the full sliding track.

- [ ] **Step 1: Add carousel state and refs**

Add these declarations directly after `const [dotMenuPos, setDotMenuPos] = useState(null);`:

```jsx
const areaRef         = useRef(null);
const selectedIdxRef  = useRef(selectedIdx);
const [cardWidth,  setCardWidth]  = useState(0);
const [dragDelta,  setDragDelta]  = useState(0);
const [isSnapping, setIsSnapping] = useState(true);
```

- [ ] **Step 2: Keep selectedIdxRef in sync and measure the area**

Add these two effects after the existing keyboard `useEffect`:

```jsx
useEffect(() => { selectedIdxRef.current = selectedIdx; }, [selectedIdx]);

useEffect(() => {
  if (!areaRef.current) return;
  const ro = new ResizeObserver(([entry]) => {
    setCardWidth(entry.contentRect.width - 160);
  });
  ro.observe(areaRef.current);
  return () => ro.disconnect();
}, []);
```

- [ ] **Step 3: Add the drag handler**

Add after the two new effects:

```jsx
const handleCarouselMouseDown = useCallback((e) => {
  e.preventDefault();
  const startX = e.clientX;
  let delta = 0;

  const onMove = (ev) => {
    delta = ev.clientX - startX;
    setDragDelta(delta);
    setIsSnapping(false);
  };

  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup",   onUp);
    const idx = selectedIdxRef.current;
    const len = screens.length;
    if (delta < -60 && idx < len - 1) goTo(idx + 1);
    else if (delta > 60 && idx > 0)   goTo(idx - 1);
    setDragDelta(0);
    setIsSnapping(true);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup",   onUp);
}, [screens.length, goTo]);
```

- [ ] **Step 4: Replace the static carousel area JSX**

Find the `{/* Carousel area — static placeholder, wired up in Task 3 */}` block and replace it:

```jsx
{/* Carousel */}
<div
  ref={areaRef}
  className="flow-carousel-area"
  style={{ cursor: "grab" }}
  onMouseDown={handleCarouselMouseDown}
>
  {cardWidth > 0 && (
    <div
      className="flow-carousel-track"
      style={{
        transform:  `translateX(${80 - selectedIdx * cardWidth + dragDelta}px)`,
        transition: isSnapping ? "transform 200ms ease-out" : "none",
        width: cardWidth * screens.length,
      }}
    >
      {screens.map((screen, idx) => (
        <div
          key={screen.id}
          className={`flow-carousel-card${idx !== selectedIdx ? " flow-carousel-card--adjacent" : ""}`}
          style={{ width: cardWidth }}
        >
          {imageUrls[screen.id]
            ? <img src={imageUrls[screen.id]} alt={`Screen ${idx + 1}`} />
            : <div className="flow-carousel-placeholder" />
          }
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 5: Verify in the app**

Open a flow. Check:
- Selected screen is centered; adjacent screens bleed in ~80 px from each edge at reduced opacity
- Clicking the topbar arrows slides with a 200 ms ease-out transition
- Dragging left/right tracks the mouse live (no transition); releasing snaps to nearest screen
- At the first screen, nothing peeks from the left; at the last, nothing from the right

- [ ] **Step 6: Commit**

```bash
git add src/components/FlowDetail.jsx
git commit -m "feat: carousel sliding track with drag and snap"
```

---

### Task 4: Metadata panel — title, note, collections, tags

**Files:**
- Modify: `src/components/FlowDetail.jsx`

- [ ] **Step 1: Add title, tags, note state and refs**

Add these after `const [isSnapping, setIsSnapping] = useState(true);`:

```jsx
const [title,       setTitle]       = useState(flow.title);
const [tags,        setTags]        = useState(flow.tags  ?? []);
const [note,        setNote]        = useState(flow.note  ?? "");
const [colPickerPos, setColPickerPos] = useState(null);

const titleRef  = useRef(null);
const noteRef   = useRef(null);
const colBtnRef = useRef(null);

const autoResize = (el) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
};
```

- [ ] **Step 2: Expand the flow-change effect to sync all fields**

Replace the existing:

```jsx
useEffect(() => {
  setSelectedIdx(0);
  setDotMenuPos(null);
}, [flow.id]);
```

With:

```jsx
useEffect(() => {
  setSelectedIdx(0);
  setTitle(flow.title);
  setTags(flow.tags  ?? []);
  setNote(flow.note  ?? "");
  setColPickerPos(null);
  setDotMenuPos(null);
  if (titleRef.current) titleRef.current.innerText = flow.title || "";
  requestAnimationFrame(() => autoResize(noteRef.current));
}, [flow.id]);
```

- [ ] **Step 3: Add save, tag, and collection helpers**

Add after `autoResize`:

```jsx
const saveTitle = () => {
  const t = (titleRef.current?.innerText ?? "").replace(/\n/g, " ").trim();
  if (t !== flow.title) onUpdate(flow.id, { title: t });
};
const saveNote = () => { if (note !== flow.note) onUpdate(flow.id, { note }); };

const addTag = (t) => {
  const cleaned = t.trim().toLowerCase();
  if (!cleaned || tags.includes(cleaned)) return;
  const next = [...tags, cleaned];
  setTags(next);
  onUpdate(flow.id, { tags: next });
};
const removeTag = (t) => {
  const next = tags.filter((x) => x !== t);
  setTags(next);
  onUpdate(flow.id, { tags: next });
};
const renameTag = (oldTag, newTag) => {
  const cleaned = newTag.trim().toLowerCase();
  if (!cleaned || cleaned === oldTag || tags.includes(cleaned)) return;
  const next = tags.map((tg) => (tg === oldTag ? cleaned : tg));
  setTags(next);
  onUpdate(flow.id, { tags: next });
};

const toggleCollection = (colId) => {
  const next = flow.collections.includes(colId)
    ? flow.collections.filter((id) => id !== colId)
    : [...flow.collections, colId];
  onUpdate(flow.id, { collections: next });
};

const openColPicker = () => {
  const rect = colBtnRef.current?.getBoundingClientRect();
  if (rect) setColPickerPos({ x: rect.left, y: rect.bottom + 4 });
};

const activeCollections = (collections ?? []).filter((c) => flow.collections.includes(c.id));

const colMenuItems = (collections ?? [])
  .filter((c) => !c.archived)
  .map((c) => ({
    icon: LucideIcons[c.icon] ?? LucideIcons.Folder,
    iconColor: c.color || undefined,
    label: c.name,
    checked: flow.collections.includes(c.id),
    action: () => toggleCollection(c.id),
  }));
```

- [ ] **Step 4: Replace the placeholder metadata panel JSX**

Find the `{/* Metadata panel — placeholder, filled in Task 4 */}` block and replace it:

```jsx
{/* Metadata panel */}
{!metaHidden && (
  <>
    <div className="detail-meta-resize-handle" onMouseDown={handleMetaResizeStart} />
    <div className="detail-meta-side" style={{ width: metaWidth, flex: "none" }}>

      <div className="detail-meta-title-row" onClick={() => titleRef.current?.focus()}>
        <div
          ref={titleRef}
          className="detail-meta-title"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Untitled flow"
          onInput={(e) => {
            const text = e.currentTarget.innerText.replace(/\n/g, " ");
            if (text.length > 120) {
              e.currentTarget.innerText = text.slice(0, 120);
              const range = document.createRange();
              range.selectNodeContents(e.currentTarget);
              range.collapse(false);
              const sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            }
            setTitle(e.currentTarget.innerText);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          onBlur={saveTitle}
        />
      </div>

      <textarea
        ref={noteRef}
        className="detail-meta-note"
        placeholder="no notes"
        value={note}
        maxLength={1000}
        style={{ fontSize: note.length < 600 ? 14 : Math.max(11, 14 - ((note.length - 600) / 400) * 3) + "px" }}
        onChange={(e) => { setNote(e.target.value); autoResize(e.target); }}
        onBlur={saveNote}
      />

      <div className="detail-meta-divider" />

      <span className="detail-meta-label">Collections</span>
      <div className="detail-pills-row">
        {activeCollections.map((col) => (
          <CollectionChip
            key={col.id}
            name={col.name}
            color={col.color}
            icon={col.icon}
            onRemove={() => toggleCollection(col.id)}
          />
        ))}
        <button ref={colBtnRef} className="detail-add-btn" onClick={openColPicker}>
          <LucideIcons.Plus size={16} />
        </button>
      </div>

      <span className="detail-meta-label" style={{ marginTop: "14px" }}>Tags</span>
      <TagInputBox
        compact
        tags={tags}
        allTags={allTags}
        onAdd={addTag}
        onRemove={removeTag}
        onRename={renameTag}
      />

      <div className="detail-meta-footer">
        <p className="panel-date">{formattedDate}</p>
      </div>

    </div>
  </>
)}
```

- [ ] **Step 5: Add the collection picker portal**

Add this block directly before the closing `</div>` of the component return, after the dot menu portal:

```jsx
{/* Collection picker portal */}
{colPickerPos && createPortal(
  <div onClick={(e) => e.stopPropagation()}>
    <ContextMenu
      x={colPickerPos.x}
      y={colPickerPos.y}
      items={colMenuItems}
      searchable
      onAddNew={(name) => {
        setColPickerPos(null);
        onAddNewCollection?.(name);
      }}
      onClose={() => setColPickerPos(null)}
    />
  </div>,
  document.body
)}
```

- [ ] **Step 6: Verify in the app**

Open a flow. The right panel should show:
- Editable title (click, type, blur to save)
- Note textarea (blur to save)
- Collections chips with working add button and picker
- Tags input (add, remove, rename via right-click)
- Creation date at the bottom
- Panel hides/shows via the topbar toggle button
- Panel is resizable by dragging the left edge; width persists across page reloads

- [ ] **Step 7: Commit**

```bash
git add src/components/FlowDetail.jsx
git commit -m "feat: flow detail metadata panel"
```

---

### Task 5: Update App.jsx call site

**Files:**
- Modify: `src/App.jsx` (around line 943)

- [ ] **Step 1: Replace the existing FlowDetail JSX block**

Find:

```jsx
{flowDetail && !flowBuilder && (
  <FlowDetail
    flow={flowDetail}
    imageUrls={imageUrls}
    onClose={() => setFlowDetail(null)}
    onEdit={() => setFlowBuilder({ mode: "edit", flow: flowDetail })}
    onUpdateScreenNote={handleUpdateScreenNote}
  />
)}
```

Replace with:

```jsx
{flowDetail && !flowBuilder && (
  <FlowDetail
    flow={flowDetail}
    imageUrls={imageUrls}
    collections={collections}
    allTags={allTags}
    onUpdate={handleUpdate}
    onDelete={(id) => {
      setAlertDialog({
        title: "Delete this flow?",
        message: "This will permanently remove the flow and all its screens from Tome.",
        confirmLabel: "Delete",
        onConfirm: () => { setAlertDialog(null); handleDelete(id); },
      });
    }}
    onClose={() => setFlowDetail(null)}
    onAddNewCollection={(name) => setCollectionPickerModal({ prefillName: name, itemId: flowDetail.id })}
  />
)}
```

- [ ] **Step 2: Verify end-to-end**

- Open a flow → modal opens, carousel shows screens, metadata panel visible
- Arrow buttons and drag gesture navigate between screens
- Edit title → persists after blur
- Add/remove a tag → updates immediately
- Add a collection via the + button → picker opens, selection sticks
- Dot menu → Delete → confirm dialog appears → confirming removes the flow
- Esc → closes the modal

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire FlowDetail carousel into App"
```
