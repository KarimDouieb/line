/**
 * The `.line` save format: the editable curve exactly as drawn (anchors,
 * their tangent handles, and each point's kind — corner/smooth/asymmetric/
 * free) plus the family & variant selection, serialized to JSON. Everything
 * else in the app (dense profile, PDF/STL/SVG exports) is derived from this,
 * so a `.line` file is a complete, reopenable save — not just one output.
 */
import type { AdaptMode, CurveNode, FamilyLayout, Handle, PointKind, VesselSetName } from "@/lib/line-math";

const POINT_KINDS: PointKind[] = ["corner", "smooth", "asymmetric", "free"];
const VESSEL_SETS: VesselSetName[] = ["studio", "classical", "cafe", "ikebana"];
const ADAPT_MODES: AdaptMode[] = ["uniform", "neck", "foot", "ends", "weight", "flare"];
const FAMILY_LAYOUTS: FamilyLayout[] = ["overlap", "grid", "organic", "echo", "scene"];

export type LineFileData = {
  heightCm: number;
  vesselSet: VesselSetName;
  adapt: AdaptMode;
  layout: FamilyLayout;
  nodes: CurveNode[];
};

export function serializeLineFile(data: LineFileData): string {
  return JSON.stringify({ type: "line-file", version: 1, ...data }, null, 2);
}

function readHandle(v: unknown): Handle {
  if (!v || typeof v !== "object") return null;
  const h = v as Record<string, unknown>;
  return typeof h.r === "number" && typeof h.y === "number" ? { r: h.r, y: h.y } : null;
}

/** Parses and validates a `.line` file's text. Returns `null` if it isn't a recognizable, usable file. */
export function parseLineFile(text: string): LineFileData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (d.type !== "line-file" || !Array.isArray(d.nodes) || d.nodes.length < 2) return null;

  const nodes: CurveNode[] = [];
  for (const n of d.nodes) {
    if (!n || typeof n !== "object") return null;
    const node = n as Record<string, unknown>;
    if (typeof node.r !== "number" || typeof node.y !== "number") return null;
    const kind = POINT_KINDS.includes(node.kind as PointKind) ? (node.kind as PointKind) : "smooth";
    nodes.push({ r: node.r, y: node.y, kind, handleIn: readHandle(node.handleIn), handleOut: readHandle(node.handleOut) });
  }

  return {
    heightCm: typeof d.heightCm === "number" && d.heightCm > 0 ? d.heightCm : 18,
    vesselSet: VESSEL_SETS.includes(d.vesselSet as VesselSetName) ? (d.vesselSet as VesselSetName) : "studio",
    adapt: ADAPT_MODES.includes(d.adapt as AdaptMode) ? (d.adapt as AdaptMode) : "uniform",
    // Older `.line` files (and gallery entries saved before this field existed) won't have it.
    layout: FAMILY_LAYOUTS.includes(d.layout as FamilyLayout) ? (d.layout as FamilyLayout) : "overlap",
    nodes,
  };
}
