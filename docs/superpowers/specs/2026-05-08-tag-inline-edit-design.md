# Tag Inline Create & Rename — Design Spec
**Date:** 2026-05-08
**Scope:** DetailPanel tag section

---

## Problem

The current "+" button in the DetailPanel tags section opens a full ContextMenu picker (all existing tags togglable, searchable). This is more than needed for the common case of adding or renaming a tag. Clicking an existing tag chip body does nothing — there is no way to rename a tag.

---

## Goal

- Clicking **+** should directly create a new tag via an inline text input in the pills row
- Clicking an existing **tag chip body** should let you rename or delete it in-place
- Both interactions should feel minimal and fast — no overlay, no modal

---

## Design

### "+" → Inline create

Replace the `+` button → ContextMenu picker pattern in DetailPanel's tags section with the existing `TagInputBox` component in compact mode.

**Behavior:**
- Clicking `+` reveals a bare text input in the pills row
- Typing shows autocomplete suggestions drawn from `allTags` (tags not already on this item)
- Selecting a suggestion or pressing Enter with typed text adds the tag and collapses the input
- Pressing Escape or blurring an empty input collapses without adding
- The ContextMenu tag picker is removed entirely from this section

**Implementation:** Swap the current `{tags.map(...)} <button ref={tagBtnRef} ... onClick={openTagPicker}>` block with `<TagInputBox compact label={null} tags={tags} allTags={allTags} onAdd={addTag} onRemove={removeTag} />`. Remove `tagBtnRef`, `tagPickerPos`, `tagMenuItems`, and the tag picker portal from DetailPanel.

---

### Tag chip body click → Inline rename

`TagChip` gains an optional `onRename` prop. When provided, clicking the chip body enters edit mode.

**Visual:**
- `#` icon stays visible
- Label text becomes an `<input>` — no background, no border box, bottom underline only (`border-bottom: 1px solid currentColor`, `outline: none`)
- Input is pre-filled with the current tag name and focused immediately

**Behavior:**
- **Enter** or **blur** → if the value changed and is non-empty, call `onRename(oldLabel, newLabel)`. This removes the old tag string and adds the new one on the item. Since tags are per-item strings (no global registry), other items with the same tag are unaffected.
- **Escape** → cancel, restore the original label, exit edit mode
- **X button** → still works at all times (calls `onRemove`)
- Click events on the chip body stop propagating when in edit mode to prevent activating the TagInputBox input simultaneously

**State:** A single `editing` boolean lives inside `TagChip`. No state lifted to parent needed — the parent only receives `onRename(old, new)` when a rename is confirmed.

---

## Data behavior

Tags are plain strings in each item's `tags[]` array. "Renaming" a tag:
1. Removes the old string from the array
2. Adds the new string

This affects only the current item. No global tag rename. This matches Tome's architecture — there is no tag registry, only per-item string arrays.

---

## Out of scope

- AddOverlay tag section (same pattern exists there; can be updated in a follow-up)
- Global tag rename (all items with `"old"` → `"new"`)
- Tag reordering

---

## Files changed

| File | Change |
|------|--------|
| `src/components/ui/TagChip.jsx` | Add `onRename` prop, `editing` state, inline input render |
| `src/components/DetailPanel.jsx` | Replace `+` picker pattern with `TagInputBox` compact; pass `onRename` to `TagChip`; remove `tagBtnRef`, `tagPickerPos`, `tagMenuItems`, tag picker portal |
| `src/App.css` / `src/globals.css` | Style for inline rename input (`apv2-tag-rename-input` or similar) |
