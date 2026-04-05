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
