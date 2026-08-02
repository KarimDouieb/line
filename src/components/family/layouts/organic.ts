import { remapProfile, effectiveMaxRadius, type Variant } from "@/lib/line-math";
import { computeClusterX } from "@/lib/cluster-layout";
import { renderPot, renderInkStroke } from "@/lib/ink-style";
import { labelIfSelected } from "./shared";
import type { HitBox, LayoutCtx } from "./types";

/**
 * "studio wall" — every vessel on one shared ground line: 2-3 of the
 * largest first, then each following cluster offset into the gaps of the
 * one before it, layering into a single dense, overlapping composition
 * (see src/lib/cluster-layout.ts for the placement algorithm itself, also
 * reused by the 3D still-life scene). The cluster is laid out in abstract
 * (unit-less) space first, then scaled up as far as it can go without
 * overflowing the available height or width — so it always fills the panel
 * rather than sitting small in the middle.
 */
export function renderOrganicLayout(ctx: LayoutCtx): HitBox[] {
  const { root, w, h, cps, adapt, cm, mR, variants: vs, selected } = ctx;
  const hits: HitBox[] = [];
  const g = root.append("g");

  // See overlap.ts: `effectiveMaxRadius` is a radius as a fraction of `v.h`,
  // so it needs `* v.h` here to become an actual width — otherwise short/
  // squat variants read as needing more space than they actually render at.
  const radiusOf = (v: Variant) => effectiveMaxRadius(mR, v, adapt) * v.h;
  const widthOf = (v: Variant) => Math.max(0.3, 2 * radiusOf(v));
  const placed = computeClusterX(vs, { widthOf, heightOf: (v) => v.h });

  // Scale the whole (still unit-less) cluster to just fill the available
  // height or width, whichever is the tighter fit, then center it.
  const maxH = Math.max(...vs.map((v) => v.h));
  const left = Math.min(...placed.map((p) => p.x - widthOf(p.item) / 2));
  const right = Math.max(...placed.map((p) => p.x + widthOf(p.item) / 2));
  const spanX = Math.max(1e-6, right - left);
  const midX = (left + right) / 2;

  const marginTop = h * 0.1;
  const marginX = w * 0.06;
  const base = h * 0.88;
  const unit = Math.min((base - marginTop) / maxH, (w - marginX * 2) / spanX);

  renderInkStroke(
    g,
    [
      { x: w * 0.06, y: base + 7 },
      { x: w * 0.5, y: base + 5.5 },
      { x: w * 0.94, y: base + 7.5 },
    ],
    { width: 1.6, seed: 3, opacity: 0.45 },
  );

  placed.forEach(({ item: v, x: abstractCx }, i) => {
    const cx = w / 2 + (abstractCx - midX) * unit;
    const rc = remapProfile(cps, v.w, v.h, adapt);
    const Hpx = unit * v.h;
    renderPot(g, rc, cx, base - Hpx, Hpx, { width: 2, seed: 31 + i * 19, opacity: 0.86, rim: true });
    labelIfSelected(g, { index: i, selected, variant: v, cx, baseY: base, cm, mR, containerH: h, mode: adapt });
    hits.push({ x: cx - radiusOf(v) * unit, y: base - Hpx, w: 2 * radiusOf(v) * unit, h: Hpx });
  });

  return hits;
}
