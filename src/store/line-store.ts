import { create } from "zustand";
import {
  PRESETS,
  applyHandleDrag,
  controlPointsToNodes,
  densifyCurve,
  type AdaptMode,
  type ControlPoint,
  type CurveNode,
  type PointKind,
  type VesselSetName,
} from "@/lib/line-math";
import type { LineFileData } from "@/lib/line-file";

export type FamilyLayout = "overlap" | "grid" | "organic" | "echo" | "scene";
export type CurveMode = "simple" | "advanced";

const UNDO_LIMIT = 40;
/** Bezier samples per segment for the derived dense profile — see densifyCurve. */
const DENSIFY_RESOLUTION = 16;
/**
 * Dragging the rim or foot anchor rescales every other point's height to
 * keep the profile normalized to 0..1 (see moveNode) — a nice way to reshape
 * the whole curve from one end, but applying the cursor's raw position
 * instantly made that rescale feel like a snap rather than a drag. Easing
 * toward the cursor (a fraction of the remaining distance per pointermove)
 * instead of jumping straight to it turns the same rescale into a smooth,
 * springy follow.
 */
const ENDPOINT_DRAG_EASE = 0.05;

function cloneNodes(nodes: CurveNode[] | null): CurveNode[] | null {
  if (!nodes) return null;
  return nodes.map((n) => ({
    ...n,
    handleIn: n.handleIn ? { ...n.handleIn } : null,
    handleOut: n.handleOut ? { ...n.handleOut } : null,
  }));
}

function densify(nodes: CurveNode[] | null): ControlPoint[] | null {
  return nodes ? densifyCurve(nodes, DENSIFY_RESOLUTION) : null;
}

type LineStore = {
  /** The editable, sparse source of truth (anchors + tangent handles). */
  nodes: CurveNode[] | null;
  /** Dense samples derived from `nodes` — this is the profile every other part of the app (family layouts, the 3D scene, export) consumes, unchanged from before advanced editing existed. */
  controlPoints: ControlPoint[] | null;
  undoStack: (CurveNode[] | null)[];
  heightCm: number;
  layout: FamilyLayout;
  vesselSet: VesselSetName;
  adapt: AdaptMode;
  familyVisible: boolean;
  curveMode: CurveMode;

  /** Snapshot the current nodes onto the undo stack (call before a destructive edit). */
  snapshot: () => void;
  /** Replace the whole profile — used once a freehand stroke has been fitted. */
  setControlPoints: (cps: ControlPoint[] | null) => void;
  applyTemplate: (name: keyof typeof PRESETS) => void;
  /** Replaces the whole editable state (curve, height, family & variant) from an imported `.line` file. */
  loadLineFile: (data: LineFileData) => void;
  clear: () => void;
  undo: () => void;

  /** Move a single anchor, clamped so it can't cross its neighbors; renormalizes if an end moved. */
  moveNode: (i: number, next: ControlPoint) => void;
  insertNode: (i: number, point: ControlPoint) => void;
  removeNode: (i: number) => void;

  setCurveMode: (mode: CurveMode) => void;
  /** Drag one tangent handle; mirrors the opposite handle per the node's point kind (see applyHandleDrag). */
  setNodeHandle: (i: number, side: "in" | "out", offset: { r: number; y: number }) => void;
  setNodeKind: (i: number, kind: PointKind) => void;

  setHeightCm: (v: number) => void;
  setLayout: (l: FamilyLayout) => void;
  setVesselSet: (s: VesselSetName) => void;
  setAdapt: (a: AdaptMode) => void;
  toggleFamilyVisible: () => void;
};

const initialNodes = controlPointsToNodes(PRESETS.vase.map((p) => ({ ...p })));

export const useLineStore = create<LineStore>((set, get) => ({
  nodes: initialNodes,
  controlPoints: densify(initialNodes),
  undoStack: [],
  heightCm: 18,
  layout: "overlap",
  vesselSet: "studio",
  adapt: "uniform",
  familyVisible: true,
  curveMode: "simple",

  snapshot: () =>
    set((s) => {
      const stack = [...s.undoStack, cloneNodes(s.nodes)];
      if (stack.length > UNDO_LIMIT) stack.shift();
      return { undoStack: stack };
    }),

  setControlPoints: (cps) => {
    get().snapshot();
    const nodes = cps ? controlPointsToNodes(cps) : null;
    set({ nodes, controlPoints: densify(nodes) });
  },

  applyTemplate: (name) => {
    get().snapshot();
    const nodes = controlPointsToNodes(PRESETS[name].map((p) => ({ ...p })));
    set({ nodes, controlPoints: densify(nodes) });
  },

  loadLineFile: (data) => {
    get().snapshot();
    set({
      nodes: data.nodes,
      controlPoints: densify(data.nodes),
      heightCm: data.heightCm,
      vesselSet: data.vesselSet,
      adapt: data.adapt,
    });
  },

  clear: () => {
    get().snapshot();
    set({ nodes: null, controlPoints: null });
  },

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const stack = s.undoStack.slice(0, -1);
      const prevNodes = s.undoStack.at(-1) ?? null;
      return { undoStack: stack, nodes: prevNodes, controlPoints: densify(prevNodes) };
    }),

  moveNode: (i, next) =>
    set((s) => {
      if (!s.nodes) return s;
      const nodes = s.nodes.map((n) => ({ ...n }));
      const lo = i > 0 ? nodes[i - 1].y + 0.01 : -0.06;
      const hi = i < nodes.length - 1 ? nodes[i + 1].y - 0.01 : 1.06;
      const targetY = Math.min(hi, Math.max(lo, next.y));
      const isEndpoint = i === 0 || i === nodes.length - 1;
      const y = isEndpoint ? nodes[i].y + (targetY - nodes[i].y) * ENDPOINT_DRAG_EASE : targetY;
      nodes[i] = { ...nodes[i], r: Math.min(1.4, next.r), y };
      if (isEndpoint) {
        const y0 = nodes[0].y;
        const y1 = nodes.at(-1)!.y;
        const span = y1 - y0;
        if (span > 0.2) nodes.forEach((n) => (n.y = (n.y - y0) / span));
      }
      return { nodes, controlPoints: densify(nodes) };
    }),

  insertNode: (i, point) => {
    get().snapshot();
    set((s) => {
      if (!s.nodes) return s;
      const nodes = s.nodes.map((n) => ({ ...n }));
      nodes.splice(i, 0, { r: point.r, y: point.y, kind: "smooth", handleIn: null, handleOut: null });
      return { nodes, controlPoints: densify(nodes) };
    });
  },

  removeNode: (i) => {
    get().snapshot();
    set((s) => {
      if (!s.nodes) return s;
      const nodes = s.nodes.map((n) => ({ ...n }));
      nodes.splice(i, 1);
      return { nodes, controlPoints: densify(nodes) };
    });
  },

  setCurveMode: (mode) => set({ curveMode: mode }),

  setNodeHandle: (i, side, offset) =>
    set((s) => {
      if (!s.nodes) return s;
      const nodes = s.nodes.slice();
      nodes[i] = applyHandleDrag(s.nodes, i, side, offset);
      return { nodes, controlPoints: densify(nodes) };
    }),

  setNodeKind: (i, kind) => {
    get().snapshot();
    set((s) => {
      if (!s.nodes) return s;
      const nodes = s.nodes.map((n) => ({ ...n }));
      const node = { ...nodes[i], kind };
      if (kind === "corner") {
        node.handleIn = null;
        node.handleOut = null;
      } else if (kind === "smooth") {
        if (node.handleOut) node.handleIn = { r: -node.handleOut.r, y: -node.handleOut.y };
        else if (node.handleIn) node.handleOut = { r: -node.handleIn.r, y: -node.handleIn.y };
      }
      nodes[i] = node;
      return { nodes, controlPoints: densify(nodes) };
    });
  },

  setHeightCm: (v) => set({ heightCm: v }),
  setLayout: (l) => set({ layout: l }),
  setVesselSet: (s) => set({ vesselSet: s }),
  setAdapt: (a) => set({ adapt: a }),
  toggleFamilyVisible: () => set((s) => ({ familyVisible: !s.familyVisible })),
}));
