import { remapProfile, computeDimensionsLabel } from "@/lib/line-math";
import { renderPot, renderInkStroke } from "@/lib/ink-style";
import type { HitBox, LayoutCtx } from "./types";

/** "sequence" on a single shelf — the compact view used by the draw-page family peek. */
export function renderShelfLayout(ctx: LayoutCtx): HitBox[] {
  const { root, w, h, cps, adapt, cm, mR, variants: vs, selected } = ctx;
  const hits: HitBox[] = [];
  const g = root.append("g");

  const maxH = Math.max(...vs.map((v) => v.h));
  const totalUnits = vs.reduce((s, v) => s + Math.max(0.3, mR * 2 * v.w), 0);
  const unit = Math.min((h - 46) / maxH, w / (totalUnits * 1.15 + 0.5));
  const base = h - 26;
  let x = (w - vs.reduce((s, v) => s + Math.max(0.3, mR * 2 * v.w) * unit * 1.15, 0)) / 2;

  renderInkStroke(
    g,
    [
      { x: 14, y: base + 6 },
      { x: w * 0.4, y: base + 5 },
      { x: w - 14, y: base + 7 },
    ],
    { width: 1.6, seed: 3, opacity: 0.5 },
  );

  vs.forEach((v, i) => {
    const rc = remapProfile(cps, v.w, v.h, adapt);
    const Hpx = unit * v.h;
    const wpx = Math.max(0.3, mR * 2 * v.w) * unit * 1.15;
    const cx = x + wpx / 2;
    renderPot(g, rc, cx, base - Hpx, Hpx, {
      width: 2.4,
      seed: 11 + i * 7,
      opacity: v.label === "original" ? 1 : 0.88,
      rim: true,
    });
    if (selected === i) {
      g.append("circle").attr("cx", cx).attr("cy", base + 15).attr("r", 2.6).attr("fill", "#b4432e");
      g.append("text")
        .attr("x", cx)
        .attr("y", h - 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("font-family", "'Zen Kaku Gothic New', sans-serif")
        .attr("fill", "rgba(60,50,35,.7)")
        .text(`${v.label} · ${computeDimensionsLabel(cm, mR, v)}`);
    }
    hits.push({ x, y: base - Hpx - 10, w: wpx, h: Hpx + 20 });
    x += wpx;
  });

  return hits;
}
