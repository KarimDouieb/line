/**
 * Real-scale, print-ready PDF of the current family: one page per vessel,
 * each page sized exactly to that vessel's own physical bounding box (like
 * `buildSvgExport`, generalized across every variant) with a light 1cm grid
 * and a title/dimensions label — meant to be printed, cut, and held against
 * the wheel. jsPDF is dynamically imported so it never loads for anyone who
 * doesn't use this export (see SceneThree's Three.js split for the same
 * reasoning).
 */
import {
  computeDimensionsLabel,
  maxRadius,
  remapProfile,
  resolveVariants,
  type AdaptMode,
  type ControlPoint,
  type VesselSetName,
} from "@/lib/line-math";

const MARGIN = 14;
const LABEL_H = 14;
const TOP = MARGIN + LABEL_H;
const GRID_MM = 10;

type Doc = InstanceType<typeof import("jspdf").jsPDF>;

/** A light, unobtrusive 1cm reference grid across the whole page. */
function drawGrid(doc: Doc, pageW: number, pageH: number) {
  doc.setDrawColor(226);
  doc.setLineWidth(0.1);
  for (let x = GRID_MM; x < pageW; x += GRID_MM) doc.line(x, 0, x, pageH);
  for (let y = GRID_MM; y < pageH; y += GRID_MM) doc.line(0, y, pageW, y);
}

/** The mirrored wall outline plus a dashed center axis, at true 1:1 scale — same construction as `buildSvgExport`. */
function drawProfile(doc: Doc, cps: ControlPoint[], mmHeight: number, cx: number) {
  doc.setDrawColor(30);
  doc.setLineWidth(0.35);
  const pts: [number, number][] = cps.map((p): [number, number] => [cx + p.r * mmHeight, TOP + p.y * mmHeight]);
  for (let i = cps.length - 1; i >= 0; i--) pts.push([cx - cps[i].r * mmHeight, TOP + cps[i].y * mmHeight]);
  for (let i = 0; i < pts.length - 1; i++) doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);

  doc.setDrawColor(170);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([1, 1.4], 0);
  doc.line(cx, TOP, cx, TOP + mmHeight);
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
    const pageW = maxRadius(rc) * mmHeight * 2 + MARGIN * 2;
    const pageH = TOP + mmHeight + MARGIN;
    const orientation = pageW > pageH ? "landscape" : "portrait";

    if (!doc) doc = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation });
    else doc.addPage([pageW, pageH], orientation);

    drawGrid(doc, pageW, pageH);
    drawProfile(doc, rc, mmHeight, pageW / 2);
    drawLabel(doc, pageW, v.label, computeDimensionsLabel(heightCm, mR, v, adapt));
  });

  doc!.save(`line-${vesselSet}-${heightCm}cm.pdf`);
  return true;
}
