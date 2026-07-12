import { remapProfile, srnd, effectiveMaxRadius } from "@/lib/line-math";
import { renderPot, renderInkStroke } from "@/lib/ink-style";
import { labelIfSelected } from "./shared";
import type { HitBox, LayoutCtx } from "./types";

/** "sequence" — tallest-first overlapping row on one shelf; this is the default family view. */
export function renderOverlapLayout(ctx: LayoutCtx): HitBox[] {
  const { root, w, h, cps, adapt, cm, mR, variants: vs, selected } = ctx;
  const hits: HitBox[] = [];
  const g = root.append("g");

  const ord = [...vs].sort((a, b) => b.h - a.h);
  const radiusOf = (v: (typeof vs)[number]) => effectiveMaxRadius(mR, v, adapt);
  const maxH = Math.max(...ord.map((v) => v.h));
  const widths = ord.map((v) => Math.max(0.3, 2 * radiusOf(v)));
  const totalW = widths.reduce((s, x) => s + x, 0);
  const unit = Math.min((h - 76) / maxH, (w - 100) / (totalW * 0.74));
  const base = h - 40;
  let x = w / 2 - (totalW * 0.74 * unit) / 2 + widths[0] * unit * 0.37;

  ord.forEach((v, i) => {
    const cx = x + srnd(i * 9) * 10;
    x += widths[i] * unit * 0.74;
    const rc = remapProfile(cps, v.w, v.h, adapt);
    const Hpx = unit * v.h;
    renderPot(g, rc, cx, base - Hpx, Hpx, {
      width: 2.3,
      seed: 23 + i * 19,
      opacity: 0.5 + 0.5 * (i / Math.max(1, ord.length - 1)),
      rim: true,
    });
    labelIfSelected(g, { index: i, selected, variant: v, cx, baseY: base, cm, mR, containerH: h, mode: adapt });
    hits.push({ x: cx - radiusOf(v) * unit, y: base - Hpx, w: 2 * radiusOf(v) * unit, h: Hpx });
  });

  renderInkStroke(
    g,
    [
      { x: 24, y: base + 8 },
      { x: w / 2, y: base + 6.5 },
      { x: w - 24, y: base + 8.5 },
    ],
    { width: 1.6, seed: 3, opacity: 0.45 },
  );

  return hits;
}
