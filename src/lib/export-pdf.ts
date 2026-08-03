/**
 * Real-scale, print-ready PDF of the current family: one page per vessel,
 * each page sized exactly to that vessel's own physical bounding box (like
 * `buildSvgExport`, generalized across every variant) with a light 1cm grid
 * and a title/dimensions label — meant to be printed, cut, and held against
 * the wheel. Followed by one fixed-size A4 page per board layout (sequence,
 * mosaic, studio wall, echo), a raster snapshot of the same D3 renderers the
 * family board itself uses, for a look at the whole set together. jsPDF is
 * dynamically imported so it never loads for anyone who doesn't use this
 * export (see SceneThree's Three.js split for the same reasoning).
 */
import { select } from "d3";
import {
  computeDimensionsLabel,
  maxRadius,
  remapProfile,
  resolveVariants,
  type AdaptMode,
  type ControlPoint,
  type VesselSetName,
} from "@/lib/line-math";
import { renderOverlapLayout } from "@/components/family/layouts/overlap";
import { renderGridLayout } from "@/components/family/layouts/grid";
import { renderOrganicLayout } from "@/components/family/layouts/organic";
import { renderEchoLayout } from "@/components/family/layouts/echo";
import type { LayoutCtx, LayoutRenderer } from "@/components/family/layouts/types";

const MARGIN = 14;
const LABEL_H = 14;
const MIN_TOP = MARGIN + LABEL_H;
const GRID_MM = 10;

// A4 landscape — every layout page shares this one fixed format, unlike the
// per-shape pages above which are each sized to their own real bounding box.
const A4_W = 297;
const A4_H = 210;
const LAYOUT_MARGIN = 8;
const LAYOUT_CAPTION_H = 12;
const RASTER_PX_PER_MM = 6; // ~150dpi — plenty for line art, keeps the PDF small

// Mirrors FamilySidebar's LAYOUT copy — duplicated rather than shared since
// that file's array also interleaves vessel-set entries it alone needs.
const LAYOUT_PAGES: { render: LayoutRenderer; title: string; desc: string }[] = [
  { render: renderOverlapLayout, title: "sequence", desc: "one shelf, side by side" },
  { render: renderGridLayout, title: "mosaic", desc: "each study on its own sheet" },
  { render: renderOrganicLayout, title: "studio wall", desc: "one line, layered and overlapping" },
  { render: renderEchoLayout, title: "echo", desc: "every size, one footprint" },
];

type Doc = InstanceType<typeof import("jspdf").jsPDF>;

/** A light, unobtrusive 1cm reference grid across the whole page. */
function drawGrid(doc: Doc, pageW: number, pageH: number) {
  doc.setDrawColor(226);
  doc.setLineWidth(0.1);
  for (let x = GRID_MM; x < pageW; x += GRID_MM) doc.line(x, 0, x, pageH);
  for (let y = GRID_MM; y < pageH; y += GRID_MM) doc.line(0, y, pageW, y);
}

/** The mirrored wall outline plus a dashed center axis, at true 1:1 scale — same construction as `buildSvgExport`. */
function drawProfile(doc: Doc, cps: ControlPoint[], mmHeight: number, cx: number, top: number) {
  doc.setDrawColor(30);
  doc.setLineWidth(0.35);
  const pts: [number, number][] = cps.map((p): [number, number] => [cx + p.r * mmHeight, top + p.y * mmHeight]);
  for (let i = cps.length - 1; i >= 0; i--) pts.push([cx - cps[i].r * mmHeight, top + cps[i].y * mmHeight]);
  for (let i = 0; i < pts.length - 1; i++) doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);

  doc.setDrawColor(170);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([1, 1.4], 0);
  doc.line(cx, top, cx, top + mmHeight);
  doc.setLineDashPattern([], 0);
}

function drawLabel(doc: Doc, pageW: number, title: string, dims: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12.5);
  doc.setTextColor(35);
  doc.text(title, pageW / 2, MARGIN * 0.6, { align: "center" });
  doc.setFontSize(8.5);
  doc.setTextColor(140);
  doc.text(dims, pageW / 2, MARGIN * 0.6 + 5, { align: "center" });
}

/**
 * Runs a board-layout renderer into a detached (never-attached-to-the-page)
 * SVG at the given pixel size and rasterizes it to a PNG data URL. None of
 * the four layout renderers measure the DOM (no getBBox/getBoundingClientRect
 * — checked), so they work fine against an SVG that was never inserted
 * anywhere. `selected: -1` matches the board's own default (nothing
 * highlighted); `gradientId` is unused by every current renderer but is part
 * of the shared `LayoutCtx` shape.
 */
async function rasterizeLayout(render: LayoutRenderer, ctx: Omit<LayoutCtx, "root">, pxW: number, pxH: number): Promise<string> {
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg") as unknown as SVGSVGElement;
  svgEl.setAttribute("width", String(pxW));
  svgEl.setAttribute("height", String(pxH));
  svgEl.setAttribute("viewBox", `0 0 ${pxW} ${pxH}`);
  render({ ...ctx, root: select(svgEl) });

  const svgText = new XMLSerializer().serializeToString(svgEl);
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("failed to rasterize layout SVG"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = pxW;
    canvas.height = pxH;
    const c2d = canvas.getContext("2d")!;
    c2d.fillStyle = "#ffffff"; // the SVG itself has no background — without this the canvas (and PDF page) would be transparent
    c2d.fillRect(0, 0, pxW, pxH);
    c2d.drawImage(img, 0, 0, pxW, pxH);
    // JPEG, not PNG: these renderers paint each stroke as a soft, low-opacity
    // "underlay" glow behind a crisp core (see ink-style.ts) — that's a lot of
    // smooth anti-aliased gradient, which PNG's lossless compression handles
    // badly (tens of MB across 4 pages) and JPEG handles well, at a quality
    // level no one will notice on line art like this.
    return canvas.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Triggers a real-size, multi-page PDF download — one page per variant in
 * the current vessel set/adaptation. Returns false if there's nothing to export.
 */
export async function downloadFamilyPdf(
  controlPoints: ControlPoint[] | null,
  heightCm: number,
  vesselSet: VesselSetName,
  adapt: AdaptMode,
): Promise<boolean> {
  if (!controlPoints || controlPoints.length < 2) return false;
  const { jsPDF } = await import("jspdf");

  const mR = Math.max(0.2, maxRadius(controlPoints));
  const variants = resolveVariants(vesselSet, mR);

  let doc: Doc | null = null;
  variants.forEach((v) => {
    const rc = remapProfile(controlPoints, v.w, v.h, adapt);
    const mmHeight = heightCm * v.h * 10;
    const halfW = maxRadius(rc) * mmHeight;
    // Grid lines sit at multiples of GRID_MM from the page edge (see
    // drawGrid) — "halfW + MARGIN" almost never lands on one of those, so
    // the dashed center axis used to drift off-grid. Snapping the center to
    // the next grid line first, then building the page symmetrically around
    // it, keeps it exactly on-grid every time (at the cost of up to one
    // extra half-cell of margin on either side).
    const cx = Math.ceil((halfW + MARGIN) / GRID_MM) * GRID_MM;
    const pageW = cx * 2;
    // Same idea, vertically: pick the smallest `top` >= MIN_TOP such that the
    // *foot* (top + mmHeight, not top itself) lands exactly on a grid line —
    // otherwise the base of the shape drifts off-grid just like the center
    // axis used to.
    const top = Math.ceil((MIN_TOP + mmHeight) / GRID_MM) * GRID_MM - mmHeight;
    const pageH = top + mmHeight + MARGIN;
    const orientation = pageW > pageH ? "landscape" : "portrait";

    if (!doc) doc = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation });
    else doc.addPage([pageW, pageH], orientation);

    drawGrid(doc, pageW, pageH);
    drawProfile(doc, rc, mmHeight, cx, top);
    drawLabel(doc, pageW, v.label, computeDimensionsLabel(heightCm, mR, v, adapt));
  });

  const imgW = A4_W - LAYOUT_MARGIN * 2;
  const imgH = A4_H - LAYOUT_CAPTION_H - LAYOUT_MARGIN;
  const pxW = Math.round(imgW * RASTER_PX_PER_MM);
  const pxH = Math.round(imgH * RASTER_PX_PER_MM);

  for (const { render, title, desc } of LAYOUT_PAGES) {
    const jpeg = await rasterizeLayout(
      render,
      { w: pxW, h: pxH, cps: controlPoints, adapt, cm: heightCm, mR, variants, selected: -1, gradientId: "pdf-export" },
      pxW,
      pxH,
    );

    doc!.addPage([A4_W, A4_H], "landscape");
    doc!.addImage(jpeg, "JPEG", LAYOUT_MARGIN, LAYOUT_CAPTION_H, imgW, imgH);
    doc!.setFont("helvetica", "normal");
    doc!.setFontSize(12.5);
    doc!.setTextColor(35);
    doc!.text(title, A4_W / 2, LAYOUT_MARGIN * 0.7, { align: "center" });
    doc!.setFontSize(8.5);
    doc!.setTextColor(140);
    doc!.text(desc, A4_W / 2, LAYOUT_MARGIN * 0.7 + 4.5, { align: "center" });
  }

  doc!.save(`line-${vesselSet}-${heightCm}cm.pdf`);
  return true;
}
