import { remapProfile, computeDimensionsLabel, effectiveMaxRadius } from "@/lib/line-math";
import { renderPot } from "@/lib/ink-style";
import type { HitBox, LayoutCtx } from "./types";

/** "mosaic" — each study gets its own sheet in a grid, dimensions always labeled. */
export function renderGridLayout(ctx: LayoutCtx): HitBox[] {
  const { root, w, h, cps, adapt, cm, mR, variants: vs } = ctx;
  const hits: HitBox[] = [];
  const g = root.append("g");

  const n = vs.length;
  const cols = n > 6 ? 4 : 3;
  const rows = Math.ceil(n / cols);
  const pad = 10;
  const cw = (w - pad * 2) / cols;
  const ch = (h - pad * 2) / rows;
  const maxH = Math.max(...vs.map((v) => v.h));

  vs.forEach((v, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x0 = pad + c * cw;
    const y0 = pad + r * ch;

    g.append("rect")
      .attr("x", x0 + 3)
      .attr("y", y0 + 3)
      .attr("width", cw - 6)
      .attr("height", ch - 6)
      .attr("fill", v.label === "original" ? "rgba(180,67,46,.07)" : "none")
      .attr("stroke", "rgba(60,50,35,.1)");

    const availH = ch - 40;
    const availW = cw - 26;
    let Hpx = availH * (v.h / maxH);
    const halfW = Hpx * effectiveMaxRadius(mR, v, adapt);
    if (halfW * 2 > availW) Hpx *= availW / (halfW * 2);
    const cx = x0 + cw / 2;

    renderPot(g, remapProfile(cps, v.w, v.h, adapt), cx, y0 + 10 + (availH - Hpx), Hpx, {
      width: 1.9,
      seed: 17 + i * 13,
      rim: true,
    });

    g.append("text")
      .attr("x", cx)
      .attr("y", y0 + ch - 9)
      .attr("text-anchor", "middle")
      .attr("font-size", 9.5)
      .attr("font-family", "'Zen Kaku Gothic New', sans-serif")
      .attr("fill", "rgba(60,50,35,.55)")
      .text(`${v.label} · ${computeDimensionsLabel(cm, mR, v, adapt)}`);

    hits.push({ x: x0, y: y0, w: cw, h: ch });
  });

  return hits;
}
