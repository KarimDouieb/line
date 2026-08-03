import { buildSvgExport, type AdaptMode, type ControlPoint, type VesselSetName } from "@/lib/line-math";

/** Triggers a real-size SVG file download of every variant in the current vessel set. Returns false if there's nothing to export. */
export function downloadSvgProfile(
  cps: ControlPoint[] | null,
  heightCm: number,
  vesselSet: VesselSetName,
  adapt: AdaptMode,
): boolean {
  if (!cps || cps.length < 2) return false;
  const { svg, filename } = buildSvgExport(cps, heightCm, vesselSet, adapt);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
