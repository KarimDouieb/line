import { remapProfile, srnd, type Variant } from "@/lib/line-math";
import { renderPot, renderInkStroke } from "@/lib/ink-style";
import { labelIfSelected } from "./shared";
import type { HitBox, LayoutCtx } from "./types";

/**
 * Splits a size-sorted (largest-first) variant list into groups of 2-3,
 * narrower elements clustering into bigger groups of 3, wider ones staying
 * in pairs — an adaptive 2-3-2-3 / 3-2-3-2 rhythm rather than a fixed one.
 */
function groupByWidth(sorted: Variant[], widthOf: (v: Variant) => number): Variant[][] {
  const meanWidth = sorted.reduce((sum, v) => sum + widthOf(v), 0) / sorted.length;
  const groups: Variant[][] = [];
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
 * x-positions (so each new vessel sits roughly between two earlier ones),
 * padded outward at the ends when a group needs more slots than that gives,
 * with a touch of random jitter so it doesn't read as a grid.
 */
function interleavedPositions(prevX: number[], spacing: number, count: number, seed: number): number[] {
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
 * "studio wall" — every vessel on one shared ground line: 2-3 of the
 * largest first, then each following cluster offset into the gaps of the
 * one before it, layering into a single dense, overlapping composition.
 */
export function renderOrganicLayout(ctx: LayoutCtx): HitBox[] {
  const { root, w, h, cps, adapt, cm, mR, variants: vs, selected } = ctx;
  const hits: HitBox[] = [];
  const g = root.append("g");

  const widthOf = (v: Variant) => Math.max(0.3, mR * 2 * v.w);
  const sorted = [...vs].sort((a, b) => b.h - a.h);
  const groups = groupByWidth(sorted, widthOf);

  const maxH = Math.max(...vs.map((v) => v.h));
  const base = h * 0.88;
  const unit = Math.min((base - h * 0.1) / maxH, w / (vs.length * 1.15));
  const spacing = (vs.reduce((sum, v) => sum + widthOf(v), 0) / vs.length) * unit * 0.78;

  renderInkStroke(
    g,
    [
      { x: w * 0.06, y: base + 7 },
      { x: w * 0.5, y: base + 5.5 },
      { x: w * 0.94, y: base + 7.5 },
    ],
    { width: 1.6, seed: 3, opacity: 0.45 },
  );

  const placed: { v: Variant; cx: number }[] = [];
  let prevX: number[] = [];
  groups.forEach((group, gi) => {
    let xs: number[];
    if (gi === 0) {
      const totalW = group.length * spacing;
      const start = w / 2 - totalW / 2 + spacing / 2;
      xs = group.map((_, i) => start + i * spacing + srnd(i * 7) * spacing * 0.08);
    } else {
      xs = interleavedPositions(prevX, spacing, group.length, gi * 97);
    }
    group.forEach((v, i) => placed.push({ v, cx: xs[i] }));
    prevX = xs;
  });

  placed.forEach(({ v, cx }, i) => {
    const rc = remapProfile(cps, v.w, v.h, adapt);
    const Hpx = unit * v.h;
    renderPot(g, rc, cx, base - Hpx, Hpx, { width: 2, seed: 31 + i * 19, opacity: 0.86, rim: true });
    labelIfSelected(g, i, selected, v, cx, base, cm, mR, h);
    hits.push({ x: cx - mR * v.w * unit, y: base - Hpx, w: mR * 2 * v.w * unit, h: Hpx });
  });

  return hits;
}
