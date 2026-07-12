import type { Selection } from "d3";
import type { AdaptMode, ControlPoint, Variant } from "@/lib/line-math";

export type HitBox = { x: number; y: number; w: number; h: number };

export type LayoutCtx = {
  root: Selection<SVGSVGElement, unknown, null, undefined>;
  w: number;
  h: number;
  cps: ControlPoint[];
  adapt: AdaptMode;
  cm: number;
  mR: number;
  variants: Variant[];
  selected: number;
  gradientId: string;
};

export type LayoutRenderer = (ctx: LayoutCtx) => HitBox[];
