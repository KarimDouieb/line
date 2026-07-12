import type { Selection } from "d3";
import { computeDimensionsLabel, type AdaptMode, type Variant } from "@/lib/line-math";

type LabelOpts = {
  index: number;
  selected: number;
  variant: Variant;
  cx: number;
  baseY: number;
  cm: number;
  mR: number;
  containerH: number;
  mode: AdaptMode;
};

/** Selection marker + dimension label, shown under a vessel when it's the tapped one. */
export function labelIfSelected(g: Selection<SVGGElement, unknown, any, any>, opts: LabelOpts) {
  const { index, selected, variant, cx, baseY, cm, mR, containerH, mode } = opts;
  if (selected !== index) return;
  g.append("circle").attr("cx", cx).attr("cy", baseY + 16).attr("r", 2.6).attr("fill", "#b4432e");
  g.append("text")
    .attr("x", cx)
    .attr("y", Math.min(containerH - 4, baseY + 30))
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "'Zen Kaku Gothic New', sans-serif")
    .attr("fill", "rgba(60,50,35,.72)")
    .text(`${variant.label} · ${computeDimensionsLabel(cm, mR, variant, mode)}`);
}
