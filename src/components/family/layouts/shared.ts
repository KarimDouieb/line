import type { Selection } from "d3";
import { computeDimensionsLabel, type Variant } from "@/lib/line-math";

/** Selection marker + dimension label, shown under a vessel when it's the tapped one. */
export function labelIfSelected(
  g: Selection<SVGGElement, unknown, any, any>,
  index: number,
  selected: number,
  variant: Variant,
  cx: number,
  baseY: number,
  cm: number,
  mR: number,
  containerH: number,
) {
  if (selected !== index) return;
  g.append("circle").attr("cx", cx).attr("cy", baseY + 16).attr("r", 2.6).attr("fill", "#b4432e");
  g.append("text")
    .attr("x", cx)
    .attr("y", Math.min(containerH - 4, baseY + 30))
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "'Zen Kaku Gothic New', sans-serif")
    .attr("fill", "rgba(60,50,35,.72)")
    .text(`${variant.label} · ${computeDimensionsLabel(cm, mR, variant)}`);
}

/** Stable back/front row split used by the organic and scene layouts: tallest vessels alternate
 *  into a farther "back" row and a nearer "front" row, front kept in visual (mirrored) order. */
export function splitIntoRows<T extends { h: number }>(variants: T[]): { back: T[]; front: T[] } {
  const ord = [...variants].sort((a, b) => b.h - a.h);
  const back: T[] = [];
  const front: T[] = [];
  ord.forEach((v, i) => (i % 2 ? front : back).push(v));
  front.reverse();
  return { back, front };
}
