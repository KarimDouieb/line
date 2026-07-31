/**
 * Line — silhouette geometry.
 *
 * Pure math: curve fitting, simplification, and aspect remapping for a
 * pot/vessel profile. No DOM, no D3, no React — every function here takes
 * plain data in and returns plain data out, so it can be unit-tested and
 * reused by both the draw canvas and the family board without either one
 * caring how the other renders.
 *
 * A "profile" is a list of control points `{ r, y }` where both are
 * normalized 0..1: `y` runs rim (0) to foot (1), and `r` is the radius at
 * that height as a fraction of the vessel's total height. The profile
 * describes one (right-hand) side of the vessel; every renderer mirrors it
 * across a vertical axis to draw the full silhouette.
 */

export type ControlPoint = { r: number; y: number };
export type RawPoint = { x: number; y: number };
export type AdaptMode = "uniform" | "neck" | "foot" | "ends" | "weight";
export type VesselSetName = "studio" | "classical" | "cafe" | "ikebana";

export type Variant = { label: string; w: number; h: number };

/**
 * A point's tangent-handle behavior — the "simple mode" editor only ever
 * produces `"smooth"` points with auto (`null`) handles; `"advanced" mode
 * lets a point become a sharp `"corner"`, an `"asymmetric"` smooth point
 * (mirrored angle, independent handle lengths), or fully `"free"`
 * (disconnected handles, for an intentional cusp).
 */
export type PointKind = "corner" | "smooth" | "asymmetric" | "free";

/** A tangent handle, as an (r,y) offset *relative to its anchor*. `null` = auto (resolved from neighbors). */
export type Handle = { r: number; y: number } | null;

/** An editable curve anchor: the profile the draw canvas actually edits. */
export type CurveNode = { r: number; y: number; kind: PointKind; handleIn: Handle; handleOut: Handle };

/** Deterministic pseudo-random noise, seeded — used so ink jitter is stable across re-renders. */
export function rnd(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Signed variant of {@link rnd}, in -0.5..0.5. */
export function srnd(seed: number): number {
  return rnd(seed) - 0.5;
}

/** Wraps a plain point list (from `fitStrokeToProfile` or `PRESETS`) into all-smooth, all-auto curve nodes. */
export function controlPointsToNodes(cps: ControlPoint[]): CurveNode[] {
  return cps.map((p) => ({ r: p.r, y: p.y, kind: "smooth", handleIn: null, handleOut: null }));
}

function autoTangent(nodes: CurveNode[], i: number): { r: number; y: number } {
  const prev = nodes[Math.max(i - 1, 0)];
  const next = nodes[Math.min(i + 1, nodes.length - 1)];
  return { r: (next.r - prev.r) / 6, y: (next.y - prev.y) / 6 };
}

/**
 * The effective (resolved) handle for one side of a node: the explicit
 * offset if the user set one, otherwise the auto tangent — the exact
 * Catmull-Rom-equivalent formula (`(next - prev) / 6`, mirrored between
 * `in`/`out`), using the same neighbor-clamping the old Catmull-Rom spline
 * used at the ends. `"corner"` points always resolve to zero (no handle),
 * regardless of any stored value.
 */
export function resolveHandle(nodes: CurveNode[], i: number, side: "in" | "out"): { r: number; y: number } {
  const node = nodes[i];
  if (node.kind === "corner") return { r: 0, y: 0 };
  const explicit = side === "out" ? node.handleOut : node.handleIn;
  if (explicit) return explicit;
  const tangent = autoTangent(nodes, i);
  return side === "out" ? tangent : { r: -tangent.r, y: -tangent.y };
}

/**
 * Applies the per-`kind` mirroring rule for a dragged handle and returns the
 * updated node: `"smooth"` mirrors the opposite handle's angle *and*
 * length, `"asymmetric"` mirrors only the angle (keeping the opposite
 * handle's own length), `"free"` leaves the opposite handle untouched.
 * `"corner"` points never reach here — the UI doesn't offer a handle to drag.
 */
export function applyHandleDrag(
  nodes: CurveNode[],
  i: number,
  side: "in" | "out",
  offset: { r: number; y: number },
): CurveNode {
  const node = nodes[i];
  const otherSide = side === "out" ? "in" : "out";
  let nextOther: Handle = side === "out" ? node.handleIn : node.handleOut;

  if (node.kind === "smooth") {
    nextOther = { r: -offset.r, y: -offset.y };
  } else if (node.kind === "asymmetric") {
    const resolvedOther = resolveHandle(nodes, i, otherSide);
    const len = Math.hypot(resolvedOther.r, resolvedOther.y) || Math.hypot(offset.r, offset.y) || 0.001;
    const angle = Math.atan2(offset.y, offset.r) + Math.PI;
    nextOther = { r: Math.cos(angle) * len, y: Math.sin(angle) * len };
  }

  if (side === "out") return { ...node, handleOut: offset, handleIn: nextOther };
  return { ...node, handleIn: offset, handleOut: nextOther };
}

function evalCubicBezier(p0: ControlPoint, p1: ControlPoint, p2: ControlPoint, p3: ControlPoint, t: number): ControlPoint {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return { r: a * p0.r + b * p1.r + c * p2.r + d * p3.r, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/**
 * Samples a piecewise-cubic-Bezier curve through `nodes` — the dense curve
 * actually drawn/exported. For any node still on its auto ("smooth", no
 * explicit handles) tangent, this reproduces the old Catmull-Rom spline
 * exactly (see `autoTangent`); customized nodes (corners, asymmetric or
 * free handles) bend the same math to whatever the user set.
 */
export function densifyCurve(nodes: CurveNode[], resolutionPerSegment = 16): ControlPoint[] {
  if (nodes.length < 2) return nodes.map((n) => ({ r: n.r, y: n.y }));
  const out: ControlPoint[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const outH = resolveHandle(nodes, i, "out");
    const inH = resolveHandle(nodes, i + 1, "in");
    const p0: ControlPoint = { r: a.r, y: a.y };
    const p1: ControlPoint = { r: a.r + outH.r, y: a.y + outH.y };
    const p2: ControlPoint = { r: b.r + inH.r, y: b.y + inH.y };
    const p3: ControlPoint = { r: b.r, y: b.y };
    for (let j = 0; j < resolutionPerSegment; j++) {
      out.push(evalCubicBezier(p0, p1, p2, p3, j / resolutionPerSegment));
    }
  }
  const last = nodes[nodes.length - 1];
  out.push({ r: last.r, y: last.y });
  return out;
}

/** Ramer-Douglas-Peucker simplification of a raw pointer trail. */
export function douglasPeucker(pts: RawPoint[], eps: number): RawPoint[] {
  if (pts.length < 3) return pts.slice();
  let dmax = 0;
  let idx = 0;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i].x - a.x) * dy - (pts[i].y - a.y) * dx) / len;
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > eps) {
    const l = douglasPeucker(pts.slice(0, idx + 1), eps);
    const r = douglasPeucker(pts.slice(idx), eps);
    return l.slice(0, -1).concat(r);
  }
  return [a, b];
}

/** 5-point moving average — takes the jitter out of a freehand pointer trail before fitting. */
export function smoothPoints(pts: RawPoint[]): RawPoint[] {
  const out: RawPoint[] = [];
  for (let i = 0; i < pts.length; i++) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let k = -2; k <= 2; k++) {
      const j = Math.min(pts.length - 1, Math.max(0, i + k));
      sx += pts[j].x;
      sy += pts[j].y;
      n++;
    }
    out.push({ x: sx / n, y: sy / n });
  }
  return out;
}

/**
 * Fit a raw freehand pointer trail to a normalized profile.
 * `axisX` is the mirror axis, in the same coordinate space as `raw`.
 * Returns null if the stroke is too short/flat to be a usable silhouette.
 */
export function fitStrokeToProfile(raw: RawPoint[], axisX: number): ControlPoint[] | null {
  if (raw.length < 4) return null;
  let pts = smoothPoints(raw);
  if (pts[0].y > pts[pts.length - 1].y) pts = pts.slice().reverse();
  const ys = pts.map((p) => p.y);
  const top = Math.min(...ys);
  const bot = Math.max(...ys);
  const H = bot - top;
  if (H < 20) return null;

  let eps = H * 0.012;
  let cps = douglasPeucker(pts, eps);
  let guard = 0;
  while (cps.length > 9 && guard++ < 12) {
    eps *= 1.4;
    cps = douglasPeucker(pts, eps);
  }

  const norm: ControlPoint[] = cps.map((p) => ({
    r: Math.max(0.01, Math.abs(p.x - axisX) / H),
    y: (p.y - top) / H,
  }));
  for (let i = 1; i < norm.length; i++) {
    if (norm[i].y <= norm[i - 1].y) norm[i].y = norm[i - 1].y + 0.005;
  }
  norm[0].y = 0;
  norm[norm.length - 1].y = Math.max(norm[norm.length - 1].y, 1);
  const s = norm[norm.length - 1].y;
  norm.forEach((p) => (p.y = p.y / s));
  return norm;
}

/** Largest radius in the profile — used to size the vessel's bounding box. Input is expected to already be dense (see `densifyCurve`); a direct max avoids rounding off a sharp corner the way re-splining would. */
export function maxRadius(cps: ControlPoint[]): number {
  return Math.max(...cps.map((p) => p.r));
}

/**
 * Clamps a "keep this fraction true-sized" ratio to a band around its
 * baseline (a quarter to one-and-a-half times it) instead of only ever
 * capping it at the baseline. A plain `Math.min(baseline, baseline / h)`
 * is a no-op for every `h <= 1` (which is most variants in most vessel
 * sets — `baseline / h >= baseline` whenever `h <= 1`, so the min always
 * picks `baseline`), which is why neck/foot/ends used to look identical
 * to "stretch all" for anything shorter than the original. The band still
 * protects the opposite end (a very tall `h`) from shrinking the kept
 * region to a razor-thin sliver.
 */
function clampKeep(baseline: number, h: number): number {
  const raw = baseline / h;
  return Math.min(baseline * 1.5, Math.max(baseline * 0.25, raw));
}

/**
 * Feature-preserving aspect remap: stretches a profile to target width/height
 * ratios `w`/`h` (relative to the original), while keeping the rim/foot
 * proportions recognizable per `mode` instead of naively squashing everything.
 */
export function remapProfile(cps: ControlPoint[], w: number, h: number, mode: AdaptMode): ControlPoint[] {
  return cps.map((p) => {
    let y = p.y;
    if (mode === "neck") {
      const keep = clampKeep(0.3, h);
      y = p.y <= 0.3 ? p.y * (keep / 0.3) : keep + (p.y - 0.3) * ((1 - keep) / 0.7);
    } else if (mode === "foot") {
      const keep = clampKeep(0.22, h);
      y = p.y >= 0.78 ? 1 - (1 - p.y) * (keep / 0.22) : p.y * ((1 - keep) / 0.78);
    } else if (mode === "ends") {
      const kt = clampKeep(0.26, h);
      const kb = clampKeep(0.18, h);
      if (p.y <= 0.26) y = p.y * (kt / 0.26);
      else if (p.y >= 0.82) y = 1 - (1 - p.y) * (kb / 0.18);
      else y = kt + (p.y - 0.26) * ((1 - kt - kb) / 0.56);
    }
    const r = (p.r * w) / h;
    return { r: mode === "weight" ? r * massFactor(h) : r, y };
  });
}

/**
 * "weight" mode's extra width-follows-height multiplier, relative to plain
 * `w/h` scaling — bounded so a very short variant (e.g. a plate) doesn't
 * balloon past what the layouts allocate space for; see `effectiveMaxRadius`,
 * which every layout uses to size/space vessels and must stay in lockstep
 * with this factor.
 */
function massFactor(h: number): number {
  return Math.min(1.8, Math.max(1 / 1.8, 1 / Math.sqrt(h)));
}

/**
 * The actual max radius (as a fraction of height) a variant renders at once
 * `remapProfile` gets done with it — `mR * v.w` alone is only correct when
 * `v.h === 1`; every other variant also gets divided by `v.h` (and, in
 * "weight" mode, further scaled by `massFactor`). Layouts must size and
 * space vessels using this, not the raw `mR * v.w`, or the on-screen result
 * drifts from — and can overflow — what was actually allocated for it.
 */
export function effectiveMaxRadius(mR: number, v: Variant, mode: AdaptMode): number {
  const base = (mR * v.w) / v.h;
  return mode === "weight" ? base * massFactor(v.h) : base;
}

export const PRESETS: Record<"bowl" | "cup" | "vase" | "bottle", ControlPoint[]> = {
  bowl: [
    { r: 0.62, y: 0 },
    { r: 0.58, y: 0.28 },
    { r: 0.44, y: 0.62 },
    { r: 0.24, y: 0.88 },
    { r: 0.18, y: 1 },
  ],
  cup: [
    { r: 0.36, y: 0 },
    { r: 0.36, y: 0.35 },
    { r: 0.34, y: 0.7 },
    { r: 0.28, y: 0.92 },
    { r: 0.26, y: 1 },
  ],
  vase: [
    { r: 0.16, y: 0 },
    { r: 0.13, y: 0.14 },
    { r: 0.3, y: 0.42 },
    { r: 0.36, y: 0.66 },
    { r: 0.28, y: 0.9 },
    { r: 0.2, y: 1 },
  ],
  bottle: [
    { r: 0.09, y: 0 },
    { r: 0.09, y: 0.2 },
    { r: 0.26, y: 0.45 },
    { r: 0.3, y: 0.72 },
    { r: 0.27, y: 0.94 },
    { r: 0.22, y: 1 },
  ],
};

/** The "studio riffs" default family — proportional cousins of whatever line was drawn. */
export const STUDIO_VARIANTS: Variant[] = [
  { label: "slender", w: 0.68, h: 1.28 },
  { label: "tall", w: 0.92, h: 1.5 },
  { label: "original", w: 1, h: 1 },
  { label: "wide", w: 1.45, h: 0.95 },
  { label: "low", w: 1.2, h: 0.62 },
  { label: "grand", w: 1.35, h: 1.45 },
  { label: "mini", w: 0.72, h: 0.55 },
];

type SetDef = { label: string; A: number; s: number };

/** Named vessel sets: `A` = target aspect (width/height), `s` = height relative to the drawn line. */
export const VESSEL_SETS: Record<Exclude<VesselSetName, "studio">, SetDef[]> = {
  classical: [
    { label: "plate", A: 4.2, s: 0.16 },
    { label: "bowl", A: 1.7, s: 0.5 },
    { label: "cup", A: 1.05, s: 0.42 },
    { label: "jar", A: 0.8, s: 0.72 },
    { label: "vase", A: 0.55, s: 1.05 },
    { label: "bottle", A: 0.4, s: 1.3 },
  ],
  cafe: [
    { label: "espresso", A: 1.05, s: 0.32 },
    { label: "cappuccino", A: 1.45, s: 0.38 },
    { label: "mug", A: 0.82, s: 0.55 },
    { label: "glass", A: 0.5, s: 0.68 },
    { label: "pitcher", A: 0.62, s: 0.95 },
    { label: "carafe", A: 0.45, s: 1.15 },
  ],
  ikebana: [
    { label: "tray", A: 5, s: 0.14 },
    { label: "basin", A: 2.4, s: 0.4 },
    { label: "moon", A: 0.95, s: 0.8 },
    { label: "bud", A: 0.32, s: 0.95 },
    { label: "cylinder", A: 0.48, s: 1 },
  ],
};

/** Resolve a named vessel set (plus "original") into concrete w/h ratios for `remapProfile`. */
export function resolveVariants(set: VesselSetName, mR: number): Variant[] {
  if (set === "studio") return STUDIO_VARIANTS;
  const defs = VESSEL_SETS[set];
  return [{ label: "original", w: 1, h: 1 }, ...defs.map((v) => ({
    label: v.label,
    h: v.s,
    w: Math.max(0.08, (v.A * v.s) / (2 * mR)),
  }))];
}

/** "18 × 32 cm"-style dimension label for a variant, given the base height, max radius, and adapt mode. */
export function computeDimensionsLabel(cm: number, mR: number, v: Variant, mode: AdaptMode): string {
  return `${(cm * v.h).toFixed(0)} × ${(cm * 2 * effectiveMaxRadius(mR, v, mode)).toFixed(0)} cm`;
}

/** Real-size (mm) SVG document for the profile at the given height — the actual export artifact. `cps` is expected to already be dense (see `densifyCurve`). */
export function buildSvgExport(cps: ControlPoint[], heightCm: number): { svg: string; filename: string } {
  const mm = heightCm * 10;
  const dense = cps;
  const mR = maxRadius(cps);
  const width = mR * 2 * mm + 20;
  const height = mm + 20;
  const cx = width / 2;
  const top = 10;

  let d = "";
  dense.forEach((pt, i) => {
    d += `${i ? "L" : "M"}${(cx + pt.r * mm).toFixed(2)} ${(top + pt.y * mm).toFixed(2)} `;
  });
  for (let i = dense.length - 1; i >= 0; i--) {
    d += `L${(cx - dense[i].r * mm).toFixed(2)} ${(top + dense[i].y * mm).toFixed(2)} `;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(1)}mm" height="${height.toFixed(1)}mm" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}">` +
    `<title>Line — profile, height ${heightCm} cm (units: mm)</title>` +
    `<path d="${d}" fill="none" stroke="#000" stroke-width="0.5"/>` +
    `<line x1="${cx}" y1="0" x2="${cx}" y2="${height}" stroke="#999" stroke-width="0.2" stroke-dasharray="2 3"/></svg>`;

  return { svg, filename: `line-profile-${heightCm}cm.svg` };
}
