import { useState, useLayoutEffect, useEffect, useRef, useCallback } from "react";

const GAP = 12;      // matches the old column-gap
const PADDING = 20;  // matches .grid padding

export default function useMasonryLayout(items, minColWidth = 180) {
  const containerRef = useRef(null);
  const itemsRef     = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const [layout, setLayout] = useState({
    positions: {},
    containerHeight: 0,
    columnWidth: minColWidth,
  });

  // Keep minColWidth accessible inside the stable recalculate callback
  const minColWidthRef = useRef(minColWidth);
  useEffect(() => { minColWidthRef.current = minColWidth; }, [minColWidth]);

  const recalculate = useCallback((currentItems) => {
    const container = containerRef.current;
    if (!container) return;

    // clientWidth includes padding (PADDING px each side), so subtract 2*PADDING for usable width
    const usable = container.clientWidth - PADDING * 2;
    if (usable <= 0) return;

    const mcw      = minColWidthRef.current;
    const colCount   = Math.max(1, Math.floor((usable + GAP) / (mcw + GAP)));
    const colWidth   = (usable - GAP * (colCount - 1)) / colCount;
    const colHeights = Array(colCount).fill(0);
    const positions  = {};

    currentItems.forEach((item) => {
      const card = container.querySelector(`[data-item-id="${item.id}"]`);
      if (!card) return;
      const col = colHeights.indexOf(Math.min(...colHeights));
      positions[item.id] = {
        x: PADDING + col * (colWidth + GAP),
        y: PADDING + colHeights[col],
        width: colWidth,
      };
      colHeights[col] += card.offsetHeight + GAP;
    });

    setLayout({
      positions,
      containerHeight: colHeights.length > 0 ? Math.max(...colHeights) + PADDING * 2 : 0,
      columnWidth: colWidth,
    });
  }, []);

  // Re-run after every items change (synchronous, before browser paint)
  useLayoutEffect(() => {
    recalculate(items);
  }, [items, recalculate]);

  // Re-run when zoom changes — needs two passes:
  // Pass 1: compute new column count/width so React renders cards at new widths.
  // Pass 2 (after RAF): DOM has settled at new widths, remeasure actual card heights.
  useEffect(() => {
    recalculate(itemsRef.current);
    const id = requestAnimationFrame(() => recalculate(itemsRef.current));
    return () => cancelAnimationFrame(id);
  }, [minColWidth, recalculate]);

  // Re-run on container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalculate(itemsRef.current));
    ro.observe(el);
    return () => ro.disconnect();
  }, [recalculate]);

  const recalculateNow = useCallback(() => recalculate(itemsRef.current), [recalculate]);

  return { ...layout, containerRef, recalculate: recalculateNow };
}
