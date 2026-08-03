/**
 * Printable turning ribs — one solid per vessel in the current family, all
 * laid out side by side in a single binary STL. Each rib's working edge
 * traces the vessel's own wall profile exactly (the same curve `export-pdf.ts`
 * draws flat on paper, swept into a real 3D tool instead): at every height,
 * the rib's cross-section is a rounded ellipse at least MIN_WIDTH_MM wide and
 * up to MAX_THICKNESS_MM thick, tapering to a thin edge on both the working
 * side (which tracks the profile) and the far side. The vessel's label is
 * raised in relief near the rim end, rendered through the browser's own font
 * (as a small pixel grid of raised boxes) rather than a hand-built vector
 * font — that guarantees legible letterforms for whatever label text shows
 * up, at the cost of a slightly blocky look at this scale. A second raised
 * mark — a straight vertical ridge running up the back of the base flare,
 * not a ring wrapped around the girth — positions the rib itself: it's
 * labeled with the vessel's true foot radius, the distance the rib needs to
 * sit from the wheel's spinning center, on both faces of the rib.
 *
 * No STL library needed: the binary format is simple enough (an 80-byte
 * header, a triangle count, then 50 bytes per triangle — a normal plus three
 * vertices, all float32) to write directly with a DataView.
 */
import { maxRadius, remapProfile, resolveVariants, type AdaptMode, type ControlPoint, type VesselSetName } from "@/lib/line-math";

const MIN_WIDTH_MM = 30;
const BASE_WIDTH_MM = 80; // the foot flares out to this — a wide, flat base the potter can rest level on the wheel head
const BASE_TAPER_MM = 55; // how much of the rib's height (measured up from the foot) the flare-out covers
const MAX_THICKNESS_MM = 8;
const RING_SEGMENTS = 16;
const RIB_GAP_MM = 12; // spacing between ribs when laid out side by side

const TEXT_HEIGHT_MM = 6;
const TEXT_BUMP_MM = 0.6;
const TEXT_ANCHOR_Y_MM = 8; // how far in from the rim tip the label starts

// A raised vertical ridge up the back of the base flare — not a ring around
// the girth (which only ever describes a height on the rib itself, not a
// position relative to the wheel). This ridge marks the rib's own required
// distance from the wheel's spinning center: the vessel's true foot radius,
// the number to line up against a wheel head's concentric guide rings (there's
// no single "standard" spacing across manufacturers, so instead of assuming
// one, the ridge is labeled with its own true distance and you match it
// against whichever ring on your own wheel corresponds).
const MARK_HEIGHT_MM = 20; // how far up from the foot the ridge runs
const MARK_EASE_MM = 5; // smoothstep transition length where the ridge rises from the surface
const MARK_WIDTH_BUMP = 3; // extra width (in X, at the back of the rib) the ridge adds

type Vec3 = [number, number, number];
type Tri = [Vec3, Vec3, Vec3];

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function faceNormal(t: Tri): Vec3 {
  const n = cross(subtract(t[1], t[0]), subtract(t[2], t[0]));
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

/**
 * The rib's width at a given real height: MIN_WIDTH_MM everywhere except the
 * last BASE_TAPER_MM approaching the foot, where it widens out to
 * BASE_WIDTH_MM — a stable, level-able base, distinct from (and usually much
 * wider than) the vessel's own foot. Capped to 40% of the rib's own height so
 * a very short rib (e.g. a "plate") doesn't taper across its entire length.
 * Eased with a smoothstep, not a straight ramp: a linear ramp has a sudden
 * change of slope right where the taper starts (flat, then instantly
 * widening) — a visible crease. Smoothstep has zero slope at *both* ends, so
 * it picks up from the flat section and arrives at the base with no kink.
 */
function widthAt(y: number, mmHeight: number): number {
  const taperLen = Math.min(BASE_TAPER_MM, mmHeight * 0.4);
  const taperStart = mmHeight - taperLen;
  if (y <= taperStart) return MIN_WIDTH_MM;
  const t = taperLen > 0 ? (y - taperStart) / taperLen : 1;
  const eased = t * t * (3 - 2 * t);
  return MIN_WIDTH_MM + (BASE_WIDTH_MM - MIN_WIDTH_MM) * eased;
}

/**
 * 0 below `start`, smoothstep-easing up to 1 over `start..start+ease`, then a
 * flat 1 the rest of the way — a one-sided ramp rather than a symmetric
 * bump, since the vertical mark rises once near the foot and simply stays
 * risen (it doesn't need to fade back out the way a band centered on one
 * height would).
 */
function easeUp(y: number, start: number, ease: number): number {
  if (y <= start) return 0;
  if (ease <= 0 || y >= start + ease) return 1;
  const t = (y - start) / ease;
  return t * t * (3 - 2 * t);
}

/**
 * A closed lens-shaped ring at height `y`: a true ellipse (major axis
 * `width` along X, minor axis MAX_THICKNESS_MM along Z), so the ring
 * naturally pinches to a point at its two X extremes instead of needing a
 * separate "top half / bottom half" construction. `centerX` is expected to
 * already be `profileX + width / 2`, which is what keeps the ring's working
 * edge (theta = π) exactly on the vessel's profile regardless of `width`.
 */
function ellipseRing(centerX: number, y: number, width: number): Vec3[] {
  const halfW = width / 2;
  const halfT = MAX_THICKNESS_MM / 2;
  const pts: Vec3[] = [];
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const theta = (i / RING_SEGMENTS) * Math.PI * 2;
    pts.push([centerX + halfW * Math.cos(theta), y, halfT * Math.sin(theta)]);
  }
  return pts;
}

/** Connects two equal-length rings with a quad strip (2 triangles per segment), wound so normals face outward — see the module's design notes for the derivation. */
function loftRings(ringA: Vec3[], ringB: Vec3[], triangles: Tri[]) {
  const n = ringA.length;
  for (let i = 0; i < n; i++) {
    const a0 = ringA[i];
    const a1 = ringA[(i + 1) % n];
    const b0 = ringB[i];
    const b1 = ringB[(i + 1) % n];
    triangles.push([a0, b0, a1]);
    triangles.push([a1, b0, b1]);
  }
}

/** Fan-triangulates a ring closed, from its (known, analytic) center — `flip` reverses winding for the far end cap so both ends face outward. */
function capRing(ring: Vec3[], center: Vec3, triangles: Tri[], flip: boolean) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p0 = ring[i];
    const p1 = ring[(i + 1) % n];
    triangles.push(flip ? [center, p1, p0] : [center, p0, p1]);
  }
}

/**
 * A single axis-aligned box, all 6 faces wound outward. `flip` reverses
 * every face's winding — needed when the box itself is mirrored through a
 * plane (see the bottom-face copy of the ring-mark label in
 * `buildRaisedText`): a reflection always flips which winding order reads
 * as "outward", the same reason `capRing`'s far end needs its own flip.
 */
type Bounds = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

function pushBox(triangles: Tri[], { x0, x1, y0, y1, z0, z1 }: Bounds, flip = false) {
  const p = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const v000 = p(x0, y0, z0);
  const v100 = p(x1, y0, z0);
  const v110 = p(x1, y1, z0);
  const v010 = p(x0, y1, z0);
  const v001 = p(x0, y0, z1);
  const v101 = p(x1, y0, z1);
  const v111 = p(x1, y1, z1);
  const v011 = p(x0, y1, z1);
  const face = (a: Vec3, b: Vec3, c: Vec3) => triangles.push(flip ? [a, c, b] : [a, b, c]);
  face(v000, v010, v100);
  face(v100, v010, v110); // -Z
  face(v001, v101, v011);
  face(v101, v111, v011); // +Z
  face(v000, v100, v001);
  face(v100, v101, v001); // -Y
  face(v010, v011, v110);
  face(v110, v011, v111); // +Y
  face(v000, v001, v010);
  face(v001, v011, v010); // -X
  face(v100, v110, v101);
  face(v110, v111, v101); // +X
}

/** The vessel's own wall radius (in real mm) at a given real height, linearly interpolated between the two bracketing dense profile points. */
function profileXAt(rc: ControlPoint[], mmHeight: number, realY: number): number {
  const ny = Math.min(1, Math.max(0, realY / mmHeight));
  for (let i = 0; i < rc.length - 1; i++) {
    const a = rc[i];
    const b = rc[i + 1];
    if (ny >= a.y && ny <= b.y) {
      const t = b.y === a.y ? 0 : (ny - a.y) / (b.y - a.y);
      return (a.r + (b.r - a.r) * t) * mmHeight;
    }
  }
  return rc[rc.length - 1].r * mmHeight;
}

/**
 * The rib body: a lens cross-section (widening to a flat base near the
 * foot) swept along the vessel's own profile curve, capped at both ends,
 * with a raised vertical mark running up the back of the base flare from
 * the foot. Also reports the rib's real X-extent, since it now varies with
 * the profile and the base flare, not just a constant width — layout needs
 * this to place ribs without overlap — plus where the vertical mark starts
 * and the vessel's true foot radius (what it marks), for the caller to
 * label.
 */
function buildRibMesh(
  rc: ControlPoint[],
  mmHeight: number,
): { triangles: Tri[]; minX: number; maxX: number; markStartY: number; footRadius: number } {
  const footRadius = (rc.at(-1)?.r ?? 0) * mmHeight;
  const markStartY = Math.max(0, mmHeight - MARK_HEIGHT_MM);
  const markEaseEndY = Math.min(mmHeight, markStartY + MARK_EASE_MM);

  // Extra samples bracketing the mark's rise, so its edge is crisp regardless
  // of how coarsely the drawn profile happens to be sampled there — the
  // dense profile's own point spacing isn't guaranteed to be fine enough for
  // a transition just a few mm long, especially on a tall rib.
  const extraYs = [markStartY, markEaseEndY].filter((y) => y > 0 && y < mmHeight);
  const samples = [...rc.map((p) => ({ y: p.y * mmHeight, r: p.r })), ...extraYs.map((y) => ({ y, r: profileXAt(rc, mmHeight, y) / mmHeight }))].sort(
    (a, b) => a.y - b.y,
  );
  const deduped = samples.filter((s, i) => i === 0 || s.y - samples[i - 1].y > 1e-4);

  const triangles: Tri[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  const rings = deduped.map(({ y, r }) => {
    const bump = easeUp(y, markStartY, MARK_EASE_MM);
    const width = widthAt(y, mmHeight) + MARK_WIDTH_BUMP * bump;
    const profileX = r * mmHeight;
    minX = Math.min(minX, profileX);
    maxX = Math.max(maxX, profileX + width);
    return ellipseRing(profileX + width / 2, y, width);
  });
  for (let i = 0; i < rings.length - 1; i++) loftRings(rings[i], rings[i + 1], triangles);

  const rimWidth = widthAt(0, mmHeight);
  const footWidth = widthAt(mmHeight, mmHeight) + MARK_WIDTH_BUMP * easeUp(mmHeight, markStartY, MARK_EASE_MM);
  const rimCenterX = rc[0].r * mmHeight + rimWidth / 2;
  const footCenterX = footRadius + footWidth / 2;
  capRing(rings[0], [rimCenterX, 0, 0], triangles, false);
  capRing(rings.at(-1)!, [footCenterX, mmHeight, 0], triangles, true);
  return { triangles, minX, maxX, markStartY, footRadius };
}

/** Run-length-encodes one row's "on" (alpha >= 128) pixels into [start, end) column ranges. */
function rowRuns(img: Uint8ClampedArray, textW: number, py: number): [number, number][] {
  const runs: [number, number][] = [];
  let runStart = -1;
  for (let px = 0; px <= textW; px++) {
    const on = px < textW && img[(py * textW + px) * 4 + 3] >= 128;
    if (on && runStart === -1) runStart = px;
    if (!on && runStart !== -1) {
      runs.push([runStart, px]);
      runStart = -1;
    }
  }
  return runs;
}

/**
 * Raised text at real scale — used both for the vessel's name near the rim
 * and the ring-mark's distance label near the base. Rendered through the
 * actual browser font (a monospace system font, always available — no font
 * file to load) onto an off-screen canvas, then each "on" pixel becomes a
 * small raised box. `centerX` is fixed for the whole label, not recomputed
 * per row: "tiny" text over a few mm of height doesn't need to track the
 * profile curve row by row, and a single value is what lets every box below
 * share exact edge coordinates with its neighbors. `side` puts the text on
 * the rib's +Z face (1, the default) or mirrors it onto -Z (-1) — `pushBox`'s
 * `flip` is what keeps that mirrored copy's normals facing outward.
 */
function buildRaisedText(label: string, centerX: number, topY: number, mmHeight: number, side: 1 | -1 = 1): Tri[] {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontPx = 22;
  ctx.font = `700 ${fontPx}px monospace`;
  const textW = Math.max(1, Math.ceil(ctx.measureText(label).width) + 2);
  const textH = fontPx + 4;
  canvas.width = textW;
  canvas.height = textH;
  ctx.font = `700 ${fontPx}px monospace`; // resizing the canvas resets 2D context state
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000";
  ctx.fillText(label, 1, 1);

  const img = ctx.getImageData(0, 0, textW, textH).data;
  const voxel = TEXT_HEIGHT_MM / textH;
  const realTextWidth = textW * voxel;
  const zNear = MAX_THICKNESS_MM / 2 - 0.05; // slightly recessed into the rib's surface so the two solids fuse cleanly, not just touch at a point
  const zFar = zNear + TEXT_BUMP_MM;
  const z0 = side === 1 ? zNear : -zFar;
  const z1 = side === 1 ? zFar : -zNear;

  const originX = centerX - realTextWidth / 2;
  // Precomputed once and reused by index for every box: touching boxes need
  // to share bit-identical edge coordinates. Computing an edge position
  // fresh at each use (a box's right edge vs. its neighbor's left edge,
  // "originX + px*voxel" evaluated twice) can drift by a float32-rounding
  // epsilon, which breaks the exact vertex match a manifold mesh needs at
  // that shared edge.
  const xEdges = Array.from({ length: textW + 1 }, (_, px) => originX + px * voxel);
  const yEdges = Array.from({ length: textH + 1 }, (_, py) => topY + py * voxel);

  // Run-length-encode each row's "on" pixels into one box per horizontal
  // run (so a solid stroke within a row is one box, not one per pixel).
  // Rows themselves are *not* merged across the vertical axis: two boxes
  // that only touch — not actually merged into one — put four faces on a
  // single edge instead of the two a manifold mesh allows (box A's +Y face
  // and box B's -X face both produce the same directed edge; A's -X and B's
  // -Y both produce its reverse). Rather than detect and merge every way
  // that can happen — including T-junctions, where one row's run only
  // partly overlaps the row above's — each box is inset by a hair on its Y
  // sides, so no two boxes ever share an edge at all. At this scale (a
  // "tiny" label) the gap is imperceptible.
  const rowInset = voxel * 0.12;
  const triangles: Tri[] = [];
  for (let py = 0; py < textH; py++) {
    if (yEdges[py] >= mmHeight) break;
    for (const [runStart, runEnd] of rowRuns(img, textW, py)) {
      // Mirrored horizontally on the front face (textW - end/start, not
      // start/end): the raster itself reads correctly left-to-right
      // (verified against the source canvas), but the embossed result was
      // reading backward, which means the working/natural view of a printed
      // rib is mirrored relative to how the raster's own X axis was laid
      // out. The back face is read by physically turning the rib over
      // around its vertical (Y) axis — which flips the viewer's sense of X
      // a second time — so it needs the *opposite* mapping from the front
      // face (unmirrored) to still read correctly right-side-round.
      const [x0, x1] = side === 1 ? [xEdges[textW - runEnd], xEdges[textW - runStart]] : [xEdges[runStart], xEdges[runEnd]];
      pushBox(triangles, { x0, x1, y0: yEdges[py] + rowInset, y1: yEdges[py + 1] - rowInset, z0, z1 }, side === -1);
    }
  }
  return triangles;
}

function translate(triangles: Tri[], dx: number): Tri[] {
  return triangles.map((t) => t.map(([x, y, z]): Vec3 => [x + dx, y, z]) as Tri);
}

function trianglesToBinarySTL(triangles: Tri[]): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triangles.length, true);
  let offset = 84;
  for (const t of triangles) {
    const n = faceNormal(t);
    for (const c of n) {
      view.setFloat32(offset, c, true);
      offset += 4;
    }
    for (const v of t) {
      for (const c of v) {
        view.setFloat32(offset, c, true);
        offset += 4;
      }
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return buffer;
}

/**
 * Triggers a binary-STL download: one printable rib per variant in the
 * current vessel set/adaptation, side by side. Returns false if there's
 * nothing to export.
 */
export function downloadRibsStl(
  controlPoints: ControlPoint[] | null,
  heightCm: number,
  vesselSet: VesselSetName,
  adapt: AdaptMode,
): boolean {
  if (!controlPoints || controlPoints.length < 2) return false;

  const mR = Math.max(0.2, maxRadius(controlPoints));
  const variants = resolveVariants(vesselSet, mR);

  const all: Tri[] = [];
  // Each rib's real X-extent varies — the profile's own radius change across
  // its height, plus the base flare, can span well more than MIN_WIDTH_MM —
  // so ribs are placed from that actual extent, not a fixed increment (which
  // let wider ribs overlap the next one instead of sitting cleanly beside it).
  let nextLeftEdge = 0;
  for (const v of variants) {
    const rc = remapProfile(controlPoints, v.w, v.h, adapt);
    const mmHeight = heightCm * v.h * 10;
    const rib = buildRibMesh(rc, mmHeight);

    const rimCenterX = profileXAt(rc, mmHeight, TEXT_ANCHOR_Y_MM) + MIN_WIDTH_MM / 2;
    const label = buildRaisedText(v.label, rimCenterX, TEXT_ANCHOR_Y_MM, mmHeight);

    // The vertical mark's distance label sits on the ridge itself, past its
    // ease-in rise so the ridge is at full width there, centered in the
    // (wider, flared) base at that height — and on both faces, so it reads
    // no matter which side of the rib is up.
    const markTextY = Math.min(rib.markStartY + MARK_EASE_MM + 3, mmHeight - 1);
    const markCenterX = profileXAt(rc, mmHeight, markTextY) + (widthAt(markTextY, mmHeight) + MARK_WIDTH_BUMP) / 2;
    const markLabel = `${Math.round(rib.footRadius)}mm`;
    const markTextTop = buildRaisedText(markLabel, markCenterX, markTextY, mmHeight, 1);
    const markTextBottom = buildRaisedText(markLabel, markCenterX, markTextY, mmHeight, -1);

    const dx = nextLeftEdge - rib.minX;
    all.push(...translate([...rib.triangles, ...label, ...markTextTop, ...markTextBottom], dx));
    nextLeftEdge += rib.maxX - rib.minX + RIB_GAP_MM;
  }

  const buffer = trianglesToBinarySTL(all);
  const url = URL.createObjectURL(new Blob([buffer], { type: "model/stl" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `line-${vesselSet}-ribs.stl`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
