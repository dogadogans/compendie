# Flow Detail Carousel — Design Spec

**Date:** 2026-05-08
**Status:** Approved

---

## Problem

The current `FlowDetail` is a fullscreen takeover with a different structure, feel, and interaction model than `DetailPanel`. Opening a flow feels like entering a separate mode. The goal is to unify both experiences: a flow opens in the same modal shell as an image, with the image area replaced by a peek carousel of its screens.

---

## Layout

Identical shell to `DetailPanel`:

- Dark backdrop (click to close)
- Modal with `detail-topbar` + `detail-body`
- `detail-body` splits into: **image area** (left, flexible) + **meta panel** (right, resizable, hideable)

`FlowDetail.jsx` is replaced entirely. `DetailPanel.jsx` is not changed.

---

## Topbar

| Zone | Content |
|------|---------|
| Left | ← → icon buttons to step between screens · counter "2 / 4" |
| Center | *(empty — no zoom slider for flows)* |
| Right | Hide panel toggle · dot menu (Delete flow) · Close (Esc) |

Arrow buttons are disabled at the first/last screen. Counter is hidden when the flow has only one screen.

---

## Main Area — Peek Carousel

The selected screen is centered and fills most of the vertical space. The adjacent screens bleed in from the left and right edges — clipped to ~80–100px, dimmed to ~40% opacity — so the user always sees that more screens exist. At the first screen there is no left bleed; at the last screen there is no right bleed.

**Drag gesture:** Dragging left/right anywhere in the image area slides the carousel. On release, it snaps to the nearest screen with a smooth ease-out. A drag of more than ~60px commits to the adjacent screen; less snaps back.

**Transition:** CSS `transform: translateX()` with `transition: transform 200ms ease-out` while snapping. No transition while actively dragging (follows finger directly).

**Keyboard:** ← → arrow keys navigate screens (when no input is focused). Esc closes.

No zoom, no pan — screens are shown fit-to-height, non-interactive.

---

## Metadata Panel (Right)

Identical to `DetailPanel`'s meta side — flow-level data only:

- **Title** — contentEditable, saves on blur, max 120 chars
- **Note** — textarea, auto-resizes, saves on blur, max 1000 chars
- Divider
- **Collections** — CollectionChip pills + add button → ContextMenu picker
- **Tags** — TagInputBox (compact)
- **Footer** — creation date, muted

No per-screen notes in this view.

Panel is resizable (drag handle on left edge, same as DetailPanel). Width persists in `localStorage` under `tome_flow_detail_meta_width` (separate key so it doesn't interfere with image detail width).

---

## Navigation Between Flows

The ← → arrows and counter refer to **screens within the current flow**, not to other flows in the library. To view a different flow, the user closes this modal and opens another from the grid.

---

## Props

```jsx
<FlowDetail
  flow={flow}           // the flow item (id, title, screens, tags, collections, note, created_at)
  imageUrls={imageUrls} // { [screenId]: objectURL }
  collections={collections}
  allTags={allTags}
  onUpdate={onUpdate}   // (flowId, patch) => void
  onDelete={onDelete}   // (flowId) => void
  onClose={onClose}
  onAddNewCollection={onAddNewCollection}
/>
```

`onEdit` (FlowBuilder entry point) is omitted — not part of this design. Can be added back later if needed.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/FlowDetail.jsx` | Full rewrite |
| `src/App.css` | Add carousel styles (`.flow-carousel-*`) |
| `src/App.jsx` | Update FlowDetail props passed in |

No new dependencies.

---

## Out of Scope

- Per-screen notes (not surfaced in this view)
- Zoom/pan on individual screens
- Navigation between flows via arrows
- Edit flow / FlowBuilder entry from this panel
