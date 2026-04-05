# Add Overlay Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current left/right split add overlay with a centered modal that shows Image and Flow modes via tabs — Image mode shows all cards simultaneously with per-card inline fields, Flow mode shows a prominent title/note form with collection toggle pills.

**Architecture:** Full rewrite of `AddOverlay.jsx` (no new files). One small handler update in `App.jsx` to accept `collections[]` instead of a single `collectionId` from the flow save. All new CSS appended to `App.css`; existing `.add-panel` override replaces the old layout.

**Tech Stack:** React 18, Vite, Tauri 2. No test runner — verification is done by running `npm run dev` (web preview) or `cargo tauri dev`.

---

## File Map

| File | What changes |
|------|-------------|
| `src/App.jsx` | Update `handleSaveNewFlow` to accept `data.collections[]` instead of `data.collectionId` |
| `src/components/AddOverlay.jsx` | Full rewrite — new layout, tab state, image card row, flow form with collection pills |
| `src/App.css` | Override `.add-panel` to flex-column; add all new add-overlay classes |

---

## Task 1: Update App.jsx — handleSaveNewFlow

**Files:**
- Modify: `src/App.jsx`

The current `handleSaveNewFlow` reads `data.collectionId` (single). The new overlay passes `data.collections` (array). This change is needed before saving a flow from the new overlay will work correctly.

- [ ] **Step 1 — Find and replace `handleSaveNewFlow` in `src/App.jsx`**

Find this (around line 147):
```jsx
const handleSaveNewFlow = async (data) => {
  const collectionIds = data.collectionId
    ? [data.collectionId]
    : activeView.type === "collection" ? [activeView.id] : [];
  const item = await addFlow({ ...data, collections: collectionIds });
  setItems((prev) => [item, ...prev]);
  setPendingFiles([]);
};
```

Replace with:
```jsx
const handleSaveNewFlow = async (data) => {
  const collectionIds = data.collections?.length
    ? data.collections
    : activeView.type === "collection" ? [activeView.id] : [];
  const item = await addFlow({ ...data, collections: collectionIds });
  setItems((prev) => [item, ...prev]);
  setPendingFiles([]);
};
```

- [ ] **Step 2 — Commit**

```bash
git add src/App.jsx
git commit -m "fix: handleSaveNewFlow accepts collections array from new overlay"
```

---

## Task 2: Rewrite AddOverlay.jsx

**Files:**
- Modify: `src/components/AddOverlay.jsx`

Full rewrite. The component keeps the same props (`imageFiles, collections, onSave, onSaveFlow, onCancel`) and same save API for image mode. Flow mode now passes `collections: string[]` instead of `collectionId: string`.

- [ ] **Step 1 — Replace the entire contents of `src/components/AddOverlay.jsx`**

```jsx
import { useState, useEffect } from "react";

function makeImageMeta() { return { title: "", tagInput: "", collectionId: "" }; }

export default function AddOverlay({ imageFiles, collections, onSave, onSaveFlow, onCancel }) {
  const [mode,            setMode]            = useState("image");
  const [imageMetas,      setImageMetas]      = useState(() => imageFiles.map(makeImageMeta));
  const [flowTitle,       setFlowTitle]       = useState("");
  const [flowTagInput,    setFlowTagInput]    = useState("");
  const [flowNote,        setFlowNote]        = useState("");
  const [flowCollections, setFlowCollections] = useState([]);
  const [previewUrls,     setPreviewUrls]     = useState([]);
  const [saving,          setSaving]          = useState(false);

  // Keep imageMetas in sync when imageFiles grows (new paste/drop while panel open)
  useEffect(() => {
    setImageMetas((prev) => {
      if (prev.length === imageFiles.length) return prev;
      return imageFiles.map((_, i) => prev[i] ?? makeImageMeta());
    });
  }, [imageFiles]);

  useEffect(() => {
    const urls = imageFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [imageFiles]);

  const updateMeta = (i, field, value) =>
    setImageMetas((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));

  const parseTags = (str) =>
    str.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

  const toggleFlowCollection = (id) =>
    setFlowCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === "flow") {
        await onSaveFlow({
          title:       flowTitle,
          screens:     imageFiles.map((f) => ({ file: f })),
          tags:        parseTags(flowTagInput),
          note:        flowNote,
          collections: flowCollections,
        });
      } else {
        const dataList = await Promise.all(
          imageFiles.map(async (f, i) => ({
            imageBytes:   new Uint8Array(await f.arrayBuffer()),
            originalName: f.name,
            title:        imageMetas[i]?.title       ?? "",
            tags:         parseTags(imageMetas[i]?.tagInput ?? ""),
            note:         "",
            collectionId: imageMetas[i]?.collectionId || null,
          }))
        );
        await onSave(dataList);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { onCancel(); return; }
    if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      handleSave();
    }
  };

  const saveLabel = saving
    ? "Saving…"
    : mode === "flow"
      ? "Save Flow"
      : imageFiles.length > 1 ? `Save ${imageFiles.length} Images` : "Save";

  return (
    <div className="overlay" onKeyDown={handleKeyDown}>
      <div className="overlay-backdrop" onClick={onCancel} />
      <div className="add-panel">

        <div className="add-header">
          <div className="add-tabs">
            <button
              className={`add-tab-btn${mode === "image" ? " active" : ""}`}
              onClick={() => setMode("image")}
            >Image</button>
            <button
              className={`add-tab-btn${mode === "flow" ? " active" : ""}`}
              onClick={() => setMode("flow")}
            >Flow</button>
          </div>
          <button className="add-close" onClick={onCancel}>×</button>
        </div>

        <div className="add-body">
          {mode === "image" ? (
            <div className="add-image-row">
              {previewUrls.map((url, i) => (
                <div key={i} className="add-image-card">
                  <div className="add-card-preview">
                    <img src={url} alt="" />
                  </div>
                  <div className="add-card-fields">
                    <input
                      className="add-card-input"
                      placeholder="Title"
                      value={imageMetas[i]?.title ?? ""}
                      onChange={(e) => updateMeta(i, "title", e.target.value)}
                      autoFocus={i === 0}
                    />
                    <input
                      className="add-card-input"
                      placeholder="Tags, comma separated"
                      value={imageMetas[i]?.tagInput ?? ""}
                      onChange={(e) => updateMeta(i, "tagInput", e.target.value)}
                    />
                    {collections.length > 0 && (
                      <select
                        className="add-card-input add-card-select"
                        value={imageMetas[i]?.collectionId ?? ""}
                        onChange={(e) => updateMeta(i, "collectionId", e.target.value)}
                      >
                        <option value="">No collection</option>
                        {collections.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="add-flow-body">
              <div className="add-flow-strip">
                {previewUrls.map((url, i) => (
                  <div key={i} className="add-flow-thumb">
                    <img src={url} alt="" />
                  </div>
                ))}
              </div>
              <input
                className="add-title-large"
                placeholder="Flow name"
                value={flowTitle}
                onChange={(e) => setFlowTitle(e.target.value)}
                autoFocus
              />
              <input
                className="field-input"
                placeholder="Tags, comma separated"
                value={flowTagInput}
                onChange={(e) => setFlowTagInput(e.target.value)}
              />
              <textarea
                className="field-input field-textarea"
                placeholder="Add a note…"
                value={flowNote}
                onChange={(e) => setFlowNote(e.target.value)}
                rows={3}
              />
              {collections.length > 0 && (
                <div className="add-collection-pills">
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`collection-pill${flowCollections.includes(c.id) ? " active" : ""}`}
                      onClick={() => toggleFlowCollection(c.id)}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="add-footer">
          <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saveLabel}
          </button>
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2 — Commit**

```bash
git add src/components/AddOverlay.jsx
git commit -m "feat: redesign add overlay — Image/Flow tabs, card row, collection pills"
```

---

## Task 3: CSS — New Add Overlay Styles

**Files:**
- Modify: `src/App.css`

Override `.add-panel` to flex-column layout and add all new inner classes. The old add-* classes (`add-thumbs`, `add-fields`, etc.) stay in the file — they are no longer referenced so they cause no harm and don't need to be deleted.

- [ ] **Step 1 — Find and replace the `.add-panel` rule in `src/App.css`**

Find this block (around line 395):
```css
/* ── Add panel ───────────────────────────────────────────────────────────── */
.add-panel {
  position: relative;
  z-index: 1;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  display: flex;
  gap: 0;
  max-width: 760px;
  width: 90vw;
  max-height: 90vh;
  overflow: hidden;
}
```

Replace with:
```css
/* ── Add panel ───────────────────────────────────────────────────────────── */
.add-panel {
  position: relative;
  z-index: 1;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  width: 640px;
  max-width: 92vw;
  max-height: 82vh;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.12), 0 2px 10px rgba(0,0,0,0.06);
}
```

- [ ] **Step 2 — Append new CSS classes to the end of `src/App.css`**

```css
/* ── Add overlay redesign ────────────────────────────────────────────────── */
.add-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.add-tabs { display: flex; gap: 4px; }

.add-tab-btn {
  all: unset;
  font-size: 13px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--muted);
  transition: color 0.1s, background 0.1s;
}
.add-tab-btn:hover  { color: var(--text); background: var(--accent-bg); }
.add-tab-btn.active { color: var(--text); background: var(--accent-bg); }

.add-close {
  all: unset;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 18px;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.add-close:hover { background: var(--accent-bg); color: var(--text); }

.add-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.add-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* ── Image mode ──────────────────────────────────────────────────────────── */
.add-image-row {
  display: flex;
  gap: 12px;
  padding: 16px;
  overflow-x: auto;
  align-items: flex-start;
  min-height: 300px;
}
/* center single card */
.add-image-row:has(.add-image-card:only-child) { justify-content: center; }

.add-image-card {
  flex-shrink: 0;
  width: 200px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--surface);
}

.add-card-preview {
  height: 155px;
  overflow: hidden;
  background: var(--grey-100);
  flex-shrink: 0;
}
.add-card-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.add-card-fields {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--border);
}

.add-card-input {
  all: unset;
  font-size: 12px;
  font-family: inherit;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 5px 8px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.1s;
}
.add-card-input:focus { border-color: var(--accent); outline: none; }
.add-card-input::placeholder { color: var(--muted); }
.add-card-select { cursor: pointer; appearance: auto; }

/* ── Flow mode ───────────────────────────────────────────────────────────── */
.add-flow-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.add-flow-strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.add-flow-thumb {
  flex-shrink: 0;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--grey-100);
}
.add-flow-thumb img {
  height: 100%;
  width: auto;
  object-fit: cover;
  display: block;
}

.add-title-large {
  all: unset;
  font-size: 18px;
  font-weight: 500;
  font-family: inherit;
  color: var(--text);
  padding: 4px 0;
  border-bottom: 1.5px solid var(--border);
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.1s;
}
.add-title-large:focus { border-bottom-color: var(--accent); outline: none; }
.add-title-large::placeholder { color: var(--muted); font-weight: 400; }

.add-collection-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.collection-pill {
  all: unset;
  font-size: 12px;
  font-family: inherit;
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid var(--border);
  color: var(--muted);
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.collection-pill:hover  { color: var(--text); border-color: var(--accent); }
.collection-pill.active { background: var(--accent); color: #fff; border-color: var(--accent); }
```

- [ ] **Step 3 — Run dev and verify**

Run: `npm run dev` (or `cargo tauri dev` for full Tauri).

Check these:
- Drag or paste an image → overlay opens in Image mode
- Image card shows preview + Title/Tags/Collection fields
- Paste a second image → second card appears in the row, both editable independently
- Click Flow tab → flow mode renders: screen strip, Flow name input, Tags, Note, collection pills
- Click a collection pill → it fills (active state)
- Click it again → it goes back to outlined
- Escape → closes overlay
- Save in image mode → images appear in grid with correct per-image metadata
- Save in flow mode → flow appears in grid, assigned to the toggled collections

- [ ] **Step 4 — Commit**

```bash
git add src/App.css
git commit -m "feat: add overlay redesign CSS — card row, flow form, collection pills"
```
