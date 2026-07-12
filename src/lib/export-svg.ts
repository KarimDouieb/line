import { buildSvgExport, type ControlPoint } from "@/lib/line-math";

/** Triggers a real-size SVG file download for the given profile. Returns false if there's nothing to export. */
export function downloadSvgProfile(cps: ControlPoint[] | null, heightCm: number): boolean {
  if (!cps || cps.length < 2) return false;
  const { svg, filename } = buildSvgExport(cps, heightCm);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
