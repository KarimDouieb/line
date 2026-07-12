/**
 * Spatial arrangement for a "family" of vessels: largest-first, grouped by
 * width into clusters of 2-3, each successive cluster offset into the gaps
 * of the one before it. Pure and dimension/unit-agnostic — callers decide
 * what "width"/"height" and what coordinate space (SVG pixels, 3D world
 * units) the numbers mean. This is the "studio wall" arrangement algorithm;
 * both the 2D organic layout and the 3D still-life scene build on it.
 */
import { srnd } from "@/lib/line-math";

export type GroupedPlacement<T> = { item: T; x: number; groupIndex: number };
export type Circle = { x: number; z: number; radius: number };

/**
 * Splits a size-sorted (largest-first) list into groups of 2-3: narrower
 * elements cluster into bigger groups of 3, wider ones stay in pairs — an
 * adaptive 2-3-2-3 / 3-2-3-2 rhythm rather than a fixed one.
 */
export function groupByWidth<T>(sorted: T[], widthOf: (item: T) => number): T[][] {
  const meanWidth = sorted.reduce((sum, item) => sum + widthOf(item), 0) / sorted.length;
  const groups: T[][] = [];
  let i = 0;
  while (i < sorted.length) {
    const remaining = sorted.length - i;
    let size: number;
    if (remaining <= 2) size = remaining;
    else size = widthOf(sorted[i]) > meanWidth ? 2 : 3;
    groups.push(sorted.slice(i, i + size));
    i += size;
  }
  return groups;
}

/**
 * Positions for the next group: the midpoints between the previous group's
 * positions (so each new item sits roughly between two earlier ones),
 * padded outward at the ends when a group needs more slots than that
 * gives, with a touch of random jitter so it doesn't read as a grid.
 */
export function interleavedPositions(prevX: number[], spacing: number, count: number, seed: number): number[] {
  const mids: number[] = [];
  for (let i = 0; i < prevX.length - 1; i++) mids.push((prevX[i] + prevX[i + 1]) / 2);
  let leftEdge = prevX[0] ?? 0;
  let rightEdge = prevX.at(-1) ?? 0;
  let addLeft = true;
  while (mids.length < count) {
    if (addLeft) {
      leftEdge -= spacing;
      mids.unshift(leftEdge);
    } else {
      rightEdge += spacing;
      mids.push(rightEdge);
    }
    addLeft = !addLeft;
  }
  const start = Math.floor((mids.length - count) / 2);
  return mids.slice(start, start + count).map((x, i) => x + srnd(seed + i * 13) * spacing * 0.12);
}

/**
 * Full "studio wall" placement: groups the set (largest-first, by width)
 * and lays each group's items out along one axis, each group interleaved
 * into the previous one's gaps. Returns unit-less positions plus which
 * group (layering pass) each item belongs to, so a caller can turn that
 * into a second axis (e.g. depth) if it wants real 3D separation.
 */
export function computeClusterX<T>(
  items: T[],
  opts: { widthOf: (item: T) => number; heightOf: (item: T) => number; spacingFactor?: number },
): GroupedPlacement<T>[] {
  const { widthOf, heightOf, spacingFactor = 0.78 } = opts;
  const sorted = [...items].sort((a, b) => heightOf(b) - heightOf(a));
  const groups = groupByWidth(sorted, widthOf);
  const avgWidth = items.reduce((sum, item) => sum + widthOf(item), 0) / items.length;
  const spacing = avgWidth * spacingFactor;

  const placed: GroupedPlacement<T>[] = [];
  let prevX: number[] = [];
  groups.forEach((group, gi) => {
    let xs: number[];
    if (gi === 0) {
      const totalW = group.length * spacing;
      const start = -totalW / 2 + spacing / 2;
      xs = group.map((_, i) => start + i * spacing + srnd(i * 7) * spacing * 0.08);
    } else {
      xs = interleavedPositions(prevX, spacing, group.length, gi * 97);
    }
    group.forEach((item, i) => placed.push({ item, x: xs[i], groupIndex: gi }));
    prevX = xs;
  });
  return placed;
}

/**
 * Pushes apart any circles (center + radius) that overlap, iteratively,
 * until every pair clears `margin` — a real, geometry-aware separation
 * guarantee for cases (like actual 3D volumes) where overlapping outlines
 * would look like clipping instead of an intentional layered composition.
 */
export function declumpCircles<T extends Circle>(circles: T[], margin = 0, iterations = 8): T[] {
  const out = circles.map((c) => ({ ...c }));
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 0.0001;
        const minDist = a.radius + b.radius + margin;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uz = dz / dist;
          a.x -= ux * push;
          a.z -= uz * push;
          b.x += ux * push;
          b.z += uz * push;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return out;
}
