import { remapProfile, effectiveMaxRadius, type Variant } from "@/lib/line-math";
import { renderPot, renderInkStroke } from "@/lib/ink-style";
import { labelIfSelected } from "./shared";
import type { HitBox, LayoutCtx } from "./types";

/** "echo" — every variant centered on the same axis with its foot on the same baseline, smallest to largest. */
export function renderEchoLayout(ctx: LayoutCtx): HitBox[] {
  const { root, w, h, cps, adapt, cm, mR, variants: vs, selected } = ctx;
  const hits: HitBox[] = [];
  const g = root.append("g");

  // `effectiveMaxRadius` is a radius *as a fraction of `v.h`* (see its own
  // doc comment) — every other layout only ever multiplies it straight into
  // `Hpx` (`= unit * v.h`), which is what cancels that `v.h` back out into an
  // actual pixel radius. Multiplying by `unit` alone here instead (as this
  // layout briefly did) skips that cancellation, so short/wide variants
  // (small `v.h`) read as needing far more width than they actually render
  // at — starving `unit` for every vessel over a budget nothing was near.
  const radiusOf = (v: Variant) => effectiveMaxRadius(mR, v, adapt) * v.h;
  const ord = [...vs].sort((a, b) => radiusOf(a) - radiusOf(b));
  const maxH = Math.max(...ord.map((v) => v.h));
  const maxW = Math.max(...ord.map((v) => 2 * radiusOf(v)));
  const unit = Math.min((h - 76) / maxH, (w - 80) / maxW);
  const base = h - 40;
  const cx = w / 2;

  ord.forEach((v, i) => {
    const rc = remapProfile(cps, v.w, v.h, adapt);
    const Hpx = unit * v.h;
    renderPot(g, rc, cx, base - Hpx, Hpx, {
      width: 2.1,
      seed: 23 + i * 19,
      opacity: 1 - 0.5 * (i / Math.max(1, ord.length - 1)),
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
