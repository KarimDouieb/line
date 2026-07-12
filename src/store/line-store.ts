import { create } from "zustand";
import {
  PRESETS,
  type AdaptMode,
  type ControlPoint,
  type VesselSetName,
} from "@/lib/line-math";

export type FamilyLayout = "overlap" | "grid" | "organic" | "scene";

const UNDO_LIMIT = 40;

type LineStore = {
  controlPoints: ControlPoint[] | null;
  undoStack: (ControlPoint[] | null)[];
  heightCm: number;
  layout: FamilyLayout;
  vesselSet: VesselSetName;
  adapt: AdaptMode;
  familyVisible: boolean;

  /** Snapshot the current profile onto the undo stack (call before a destructive edit). */
  snapshot: () => void;
  /** Replace the whole profile — used once a freehand stroke has been fitted. */
  setControlPoints: (cps: ControlPoint[] | null) => void;
  applyTemplate: (name: keyof typeof PRESETS) => void;
  clear: () => void;
  undo: () => void;

  /** Move a single point, clamped so it can't cross its neighbors; renormalizes if an end moved. */
  updateControlPoint: (i: number, next: ControlPoint) => void;
  insertControlPoint: (i: number, point: ControlPoint) => void;
  removeControlPoint: (i: number) => void;

  setHeightCm: (v: number) => void;
  setLayout: (l: FamilyLayout) => void;
  setVesselSet: (s: VesselSetName) => void;
  setAdapt: (a: AdaptMode) => void;
  toggleFamilyVisible: () => void;
};

export const useLineStore = create<LineStore>((set, get) => ({
  controlPoints: PRESETS.vase.map((p) => ({ ...p })),
  undoStack: [],
  heightCm: 18,
  layout: "overlap",
  vesselSet: "studio",
  adapt: "uniform",
  familyVisible: true,

  snapshot: () =>
    set((s) => {
      const stack = [...s.undoStack, s.controlPoints ? s.controlPoints.map((p) => ({ ...p })) : null];
      if (stack.length > UNDO_LIMIT) stack.shift();
      return { undoStack: stack };
    }),

  setControlPoints: (cps) => {
    get().snapshot();
    set({ controlPoints: cps });
  },

  applyTemplate: (name) => {
    get().snapshot();
    set({ controlPoints: PRESETS[name].map((p) => ({ ...p })) });
  },

  clear: () => {
    get().snapshot();
    set({ controlPoints: null });
  },

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const stack = s.undoStack.slice(0, -1);
      const prev = s.undoStack.at(-1);
      return { undoStack: stack, controlPoints: prev };
    }),

  updateControlPoint: (i, next) =>
    set((s) => {
      if (!s.controlPoints) return s;
      const cps = s.controlPoints.map((p) => ({ ...p }));
      const lo = i > 0 ? cps[i - 1].y + 0.01 : -0.06;
      const hi = i < cps.length - 1 ? cps[i + 1].y - 0.01 : 1.06;
      cps[i] = { r: Math.min(1.4, next.r), y: Math.min(hi, Math.max(lo, next.y)) };
      if (i === 0 || i === cps.length - 1) {
        const y0 = cps[0].y;
        const y1 = cps.at(-1)!.y;
        const span = y1 - y0;
        if (span > 0.2) cps.forEach((p) => (p.y = (p.y - y0) / span));
      }
      return { controlPoints: cps };
    }),

  insertControlPoint: (i, point) => {
    get().snapshot();
    set((s) => {
      if (!s.controlPoints) return s;
      const cps = s.controlPoints.map((p) => ({ ...p }));
      cps.splice(i, 0, point);
      return { controlPoints: cps };
    });
  },

  removeControlPoint: (i) => {
    get().snapshot();
    set((s) => {
      if (!s.controlPoints) return s;
      const cps = s.controlPoints.map((p) => ({ ...p }));
      cps.splice(i, 1);
      return { controlPoints: cps };
    });
  },

  setHeightCm: (v) => set({ heightCm: v }),
  setLayout: (l) => set({ layout: l }),
  setVesselSet: (s) => set({ vesselSet: s }),
  setAdapt: (a) => set({ adapt: a }),
  toggleFamilyVisible: () => set((s) => ({ familyVisible: !s.familyVisible })),
}));
