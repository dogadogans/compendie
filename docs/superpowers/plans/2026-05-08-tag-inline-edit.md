# Tag Inline Create & Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tag picker overlay in DetailPanel with an inline text input for creating tags, and let clicking a tag chip rename it in-place with a bottom-underline input.

**Architecture:** Three focused changes — (1) `TagChip` grows an `onRename` prop that enters an inline edit mode, (2) `TagInputBox` forwards `onRename` down to each chip, (3) `DetailPanel` swaps its `+` → ContextMenu pattern for `TagInputBox` compact and adds a `renameTag` handler. The ContextMenu tag picker and all its supporting state (`tagBtnRef`, `tagPickerPos`, `tagMenuItems`, `openTagPicker`) are removed entirely.

**Tech Stack:** React 18, Lucide React, CSS custom properties (App.css)

---

### Task 1: Add CSS for the rename input

**Files:**
- Modify: `src/App.css:3321-3324` (after `.ui-tag-chip-label`)

- [ ] **Step 1: Open `src/App.css` and locate `.ui-tag-chip-label` (around line 3321). Insert the new rule directly after the closing brace of `.ui-tag-chip-label`:**

```css
.ui-tag-chip-rename-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid currentColor;
  outline: none;
  font-size: 12px;
  color: inherit;
  padding: 0;
  min-width: 4ch;
  max-width: 120px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.css
git commit -m "style: add ui-tag-chip-rename-input for inline tag editing"
```

---

### Task 2: Update TagChip with inline rename mode

**Files:**
- Modify: `src/components/ui/TagChip.jsx`

- [ ] **Step 1: Replace the entire contents of `src/components/ui/TagChip.jsx` with:**

```jsx
import { useState } from "react";
import { Hash, X } from "lucide-react";

export function TagChip({ label, onRemove, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(label);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim().toLowerCase();
    if (trimmed && trimmed !== label) onRename(trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
  };

  return (
    <span className="ui-tag-chip">
      <Hash size={12} strokeWidth={2} />
      {editing ? (
        <input
          className="ui-tag-chip-rename-input"
          value={draft}
          size={Math.max(4, draft.length + 1)}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="ui-tag-chip-label"
          onClick={onRename ? startEdit : undefined}
          style={onRename ? { cursor: "text" } : undefined}
        >
          {label}
        </span>
      )}
      {onRemove && (
        <button
          className="ui-tag-chip-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          tabIndex={-1}
          aria-label={`Remove tag ${label}`}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Start the dev server and open the app**

```bash
npm run dev
```

Open a detail panel on any image that has tags. Verify the chips still render correctly (no visual change yet — `onRename` isn't wired up in DetailPanel yet, so the label is not clickable).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/TagChip.jsx
git commit -m "feat: add inline rename mode to TagChip"
```

---

### Task 3: Forward onRename through TagInputBox

**Files:**
- Modify: `src/components/ui/TagInputBox.jsx`

- [ ] **Step 1: Add `onRename` to the function signature (line 5):**

```jsx
export function TagInputBox({ label, tags = [], allTags = [], onAdd, onRemove, onRename, placeholder = "add tag...", compact = false }) {
```

- [ ] **Step 2: In the compact return block (around line 99), update the `tags.map()` to pass `onRename` to each chip:**

Old:
```jsx
{tags.map((t) => (
  <TagChip key={t} label={t} onRemove={() => onRemove(t)} />
))}
```

New:
```jsx
{tags.map((t) => (
  <TagChip key={t} label={t} onRemove={() => onRemove(t)} onRename={onRename ? (newName) => onRename(t, newName) : undefined} />
))}
```

- [ ] **Step 3: In the non-compact return block (around line 129), apply the same change:**

Old:
```jsx
{tags.map((t) => (
  <TagChip key={t} label={t} onRemove={() => onRemove(t)} />
))}
```

New:
```jsx
{tags.map((t) => (
  <TagChip key={t} label={t} onRemove={() => onRemove(t)} onRename={onRename ? (newName) => onRename(t, newName) : undefined} />
))}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/TagInputBox.jsx
git commit -m "feat: forward onRename prop through TagInputBox to TagChip"
```

---

### Task 4: Update DetailPanel — swap tag section, remove picker

**Files:**
- Modify: `src/components/DetailPanel.jsx`

- [ ] **Step 1: Add the `TagInputBox` import. Find the existing import line for `TagChip` (line 4) and replace it:**

Old:
```jsx
import { TagChip } from "./ui/TagChip";
```

New:
```jsx
import { TagInputBox } from "./ui/TagInputBox";
```

(`TagChip` is no longer used directly in DetailPanel — it's rendered inside `TagInputBox`.)

- [ ] **Step 2: Remove the `tagPickerPos` state declaration (line 34):**

Old:
```jsx
const [tagPickerPos, setTagPickerPos] = useState(null);
```

New: delete this line entirely.

- [ ] **Step 3: Remove the `tagBtnRef` ref (line 39):**

Old:
```jsx
const tagBtnRef  = useRef(null);
```

New: delete this line entirely.

- [ ] **Step 4: In the `useEffect` that resets state on `item.id` change (around line 63), remove the `setTagPickerPos(null)` call:**

Old:
```jsx
setTagPickerPos(null);
setColPickerPos(null);
```

New:
```jsx
setColPickerPos(null);
```

- [ ] **Step 5: Remove the `tagMenuItems` variable (lines 163–170):**

Old:
```jsx
// ContextMenu items for tags
const tagMenuItems = allTags.map((t) => ({
  icon: LucideIcons.Hash,
  iconColor: "var(--green-300)",
  label: t,
  checked: tags.includes(t),
  action: () => toggleTag(t),
}));
```

New: delete these lines entirely.

- [ ] **Step 6: Remove the `openTagPicker` function (lines 193–196):**

Old:
```jsx
const openTagPicker = () => {
  const rect = tagBtnRef.current?.getBoundingClientRect();
  if (rect) setTagPickerPos({ x: rect.left, y: rect.bottom + 4 });
};
```

New: delete these lines entirely.

- [ ] **Step 6b: Remove the `toggleTag` function (lines 135–141) — it was only used by `tagMenuItems` which is now gone:**

Old:
```jsx
const toggleTag = (t) => {
  const next = tags.includes(t)
    ? tags.filter((x) => x !== t)
    : [...tags, t.trim().toLowerCase()];
  setTags(next);
  onUpdate(item.id, { tags: next });
};
```

New: delete these lines entirely.

- [ ] **Step 7: Add the `renameTag` helper after the existing `removeTag` function (after line 153):**

```jsx
const renameTag = (oldTag, newTag) => {
  const cleaned = newTag.trim().toLowerCase();
  if (!cleaned || cleaned === oldTag || tags.includes(cleaned)) return;
  const next = tags.map((t) => (t === oldTag ? cleaned : t));
  setTags(next);
  onUpdate(item.id, { tags: next });
};
```

- [ ] **Step 8: Replace the Tags section in the JSX (lines 383–389). Find:**

Old:
```jsx
{/* Tags */}
<span className="detail-meta-label" style={{ marginTop: "14px" }}>Tags</span>
<div className="detail-pills-row">
  {tags.map((t) => (
    <TagChip key={t} label={t} onRemove={() => removeTag(t)} />
  ))}
  <button ref={tagBtnRef} className="detail-add-btn" onClick={openTagPicker}><LucideIcons.Plus size={16} /></button>
</div>
```

New:
```jsx
{/* Tags */}
<span className="detail-meta-label" style={{ marginTop: "14px" }}>Tags</span>
<TagInputBox
  compact
  tags={tags}
  allTags={allTags}
  onAdd={addTag}
  onRemove={removeTag}
  onRename={renameTag}
/>
```

- [ ] **Step 9: Remove the tag picker portal (lines 403–418). Find and delete:**

```jsx
{/* Tag picker portal */}
{tagPickerPos && createPortal(
  <div onClick={(e) => e.stopPropagation()}>
    <ContextMenu
      x={tagPickerPos.x}
      y={tagPickerPos.y}
      items={tagMenuItems}
      searchable
      onAddNew={(name) => {
        setTagPickerPos(null);
        addTag(name);
      }}
      onClose={() => setTagPickerPos(null)}
    />
  </div>,
  document.body
)}
```

Delete these lines entirely.

- [ ] **Step 10: Verify the app in the browser**

```bash
npm run dev
```

Open a detail panel on an image. In the Tags section:
- Tags render as chips
- Clicking `+` reveals an inline text input; typing shows suggestions; Enter adds the tag
- Clicking a tag chip label turns it into an underlined input pre-filled with the tag name; Enter saves; Escape cancels
- The X button still removes tags instantly
- The old ContextMenu tag picker no longer appears

- [ ] **Step 11: Commit**

```bash
git add src/components/DetailPanel.jsx
git commit -m "feat: replace tag picker with TagInputBox, wire tag rename in detail panel"
```
