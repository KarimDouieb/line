import { remapProfile, srnd } from "@/lib/line-math";
import { renderClayFill, CLAY_TONES } from "@/lib/ink-style";
import { labelIfSelected, splitIntoRows } from "./shared";
import type { HitBox, LayoutCtx } from "./types";

/** "still life · 3D" — clay-toned vessels on a soft studio backdrop, back row lightly fogged. */
export function renderSceneLayout(ctx: LayoutCtx): HitBox[] {
  const { root, w, h, cps, adapt, cm, mR, variants: vs, selected, gradientId } = ctx;
  const hits: HitBox[] = [];

  const defsEl = root.append("defs");
  const sky = defsEl.append("linearGradient").attr("id", `${gradientId}-sky`).attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
  sky.append("stop").attr("offset", 0).attr("stop-color", "#ece4d2");
  sky.append("stop").attr("offset", 0.56).attr("stop-color", "#f3ecdd");
  sky.append("stop").attr("offset", 0.6).attr("stop-color", "#d6cbb4");
  sky.append("stop").attr("offset", 1).attr("stop-color", "#c3b69c");
  const fog = defsEl.append("linearGradient").attr("id", `${gradientId}-fog`).attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
  fog.append("stop").attr("offset", 0).attr("stop-color", "rgba(238,231,216,0)");
  fog.append("stop").attr("offset", 0.55).attr("stop-color", "rgba(238,231,216,.55)");
  fog.append("stop").attr("offset", 1).attr("stop-color", "rgba(238,231,216,0)");

  const g = root.append("g");
  g.append("rect").attr("x", 0).attr("y", 0).attr("width", w).attr("height", h).attr("fill", `url(#${gradientId}-sky)`);

  const rows = splitIntoRows(vs);
  const maxH = Math.max(...vs.map((v) => v.h));
  const unit = Math.min((h * 0.42) / maxH, w / Math.max(3, mR * 2 * 6.4));
  const defs = [
    { items: rows.back, base: h * 0.7, s: 0.78, fog: true },
    { items: rows.front, base: h * 0.9, s: 1, fog: false },
  ];

  let gi = 0;
  defs.forEach((row, ri) => {
    const n = row.items.length;
    if (!n) return;
    row.items.forEach((v, i) => {
      const cx = w * 0.5 + (i - (n - 1) / 2) * (w / (n + 0.9)) + srnd(ri * 11 + i * 5) * 14;
      const rc = remapProfile(cps, v.w, v.h, adapt);
      const Hpx = unit * v.h * row.s;
      renderClayFill(g, rc, cx, row.base - Hpx, Hpx, CLAY_TONES[(gi * 3 + ri) % CLAY_TONES.length], {
        opacity: row.fog ? 0.8 : 1,
        blurPx: row.fog ? 1.6 : 0,
      });
      labelIfSelected(g, gi, selected, v, cx, row.base, cm, mR, h);
      hits.push({ x: cx - mR * v.w * unit * row.s, y: row.base - Hpx, w: mR * 2 * v.w * unit * row.s, h: Hpx });
      gi++;
    });
    if (row.fog) {
      g.append("rect")
        .attr("x", 0)
        .attr("y", h * 0.4)
        .attr("width", w)
        .attr("height", h * 0.38)
        .attr("fill", `url(#${gradientId}-fog)`);
    }
  });

  g.append("text")
    .attr("x", w / 2)
    .attr("y", h - 12)
    .attr("text-anchor", "middle")
    .attr("font-size", 10.5)
    .attr("font-family", "'Zen Kaku Gothic New', sans-serif")
    .attr("fill", "rgba(60,50,35,.45)")
    .text("still life — tap a vessel to read its size");

  return hits;
}
