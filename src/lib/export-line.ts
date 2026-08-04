import { serializeLineFile, type LineFileData } from "@/lib/line-file";

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Triggers a `.line` save-file download, named `<name>-<date-time>.line`. Returns false if there's nothing to save. */
export function downloadLineFile(data: LineFileData, name: string): boolean {
  if (data.nodes.length < 2) return false;
  const json = serializeLineFile(data);
  const safeName = name.trim().replace(/[^a-z0-9 _-]/gi, "").trim().replace(/\s+/g, "-") || "line";
  const filename = `${safeName}-${timestamp()}.line`;

  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
