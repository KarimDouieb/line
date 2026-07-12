/**
 * Shared D3 rendering helpers for painting a silhouette curve as a stylized
 * ink stroke — used by both the draw canvas and the family board so every
 * vessel in the app reads as the same "brush", instead of each renderer
 * reinventing it. This is presentation, not geometry: it takes already
 * device-space points (see line-math.ts for the actual curve math) and
 * draws them.
 */
import { line as d3Line, curveCatmullRom, type Selection } from "d3";
import { catmullRom, srnd, type ControlPoint } from "@/lib/line-math";

export const INK = "#262219";

export type Point = { x: number; y: number };

const lineGen = d3Line<Point>()
  .x((d) => d.x)
  .y((d) => d.y)
  .curve(curveCatmullRom.alpha(0.6));

function jitter(pts: Point[], amount: number, seed: number): Point[] {
  return pts.map((p, i) => ({
    x: p.x + srnd(seed + i * 7) * amount,
    y: p.y + srnd(seed + i * 13) * amount,
  }));
}

/**
 * Paints an ink stroke through `points` into `g`: a soft, wide underlay plus
 * a crisp core, both lightly jittered so the line reads as brushed rather
 * than mechanically plotted.
 */
export function renderInkStroke(
  g: Selection<SVGGElement, unknown, any, any>,
  points: Point[],
  opts: { seed?: number; width?: number; color?: string; opacity?: number } = {},
) {
  if (points.length < 2) return;
  const seed = opts.seed ?? 7;
  const width = opts.width ?? 3;
  const color = opts.color ?? INK;
  const opacity = opts.opacity ?? 1;

  g.append("path")
    .attr("d", lineGen(jitter(points, 1.1, seed + 41)))
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", width * 1.9)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("opacity", opacity * 0.16);

  g.append("path")
    .attr("d", lineGen(jitter(points, 0.5, seed)))
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", width)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("opacity", opacity);
}

/**
 * Renders one full mirrored vessel outline (a pair of ink strokes plus a
 * light base squiggle and, optionally, a rim hint) at the given canvas box.
 * `cx`/`topY`/`heightPx` place the box; `cps` is the profile to draw.
 */
export function renderPot(
  g: Selection<SVGGElement, unknown, any, any>,
  cps: ControlPoint[],
  cx: number,
  topY: number,
  heightPx: number,
  opts: { seed?: number; width?: number; opacity?: number; rim?: boolean; base?: boolean } = {},
) {
  const dense = catmullRom(cps, 22);
  const right = dense.map((p) => ({ x: cx + p.r * heightPx, y: topY + p.y * heightPx }));
  const left = dense.map((p) => ({ x: cx - p.r * heightPx, y: topY + p.y * heightPx }));
  const seed = opts.seed ?? 7;
  const width = opts.width ?? 2.4;
  const opacity = opts.opacity ?? 1;

  renderInkStroke(g, right, { seed, width, opacity });
  renderInkStroke(g, left, { seed: seed + 41, width, opacity: opacity * 0.82 });

  const rb = dense[dense.length - 1].r * heightPx;
  if (opts.base !== false && rb > 2) {
    const by = topY + heightPx;
    renderInkStroke(
      g,
      [
        { x: cx - rb, y: by },
        { x: cx - rb * 0.3, y: by + 0.8 },
        { x: cx + rb * 0.4, y: by + 0.8 },
        { x: cx + rb, y: by },
      ],
      { seed: seed + 83, width: width * 0.85, opacity },
    );
  }
  if (opts.rim) {
    const rt = dense[0].r * heightPx;
    renderInkStroke(
      g,
      [
        { x: cx - rt, y: topY },
        { x: cx - rt * 0.2, y: topY - 1.2 },
        { x: cx + rt * 0.3, y: topY - 1 },
        { x: cx + rt, y: topY },
      ],
      { seed: seed + 29, width: width * 0.6, opacity: opacity * 0.8 },
    );
  }
}
