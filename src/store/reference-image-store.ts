import { create } from "zustand";

/**
 * A photo of a real pot/vase/bottle, shown as a low-opacity guide behind the
 * ink canvas so the user can trace over it by hand — see InkCanvas and
 * ReferenceImageLayer. Deliberately kept out of line-store: it's a tracing
 * aid, not part of the profile, and isn't saved to `.line` files.
 */
type ReferenceImageState = {
  url: string | null;
  naturalWidth: number;
  naturalHeight: number;
  /** Center offset as a fraction of the canvas size, so it survives container resizes. */
  offsetXFrac: number;
  offsetYFrac: number;
  /** Multiplier on the image's "fit to canvas" base size. */
  scale: number;
  rotationDeg: number;
  opacity: number;
  /** Whether the move/scale/rotate handles are active (vs. click-through for drawing). */
  adjusting: boolean;

  setImage: (url: string, naturalWidth: number, naturalHeight: number) => void;
  clearImage: () => void;
  setOffsetFrac: (x: number, y: number) => void;
  setScaleRotation: (scale: number, rotationDeg: number) => void;
  setOpacity: (opacity: number) => void;
  setAdjusting: (v: boolean) => void;
};

export const useReferenceImageStore = create<ReferenceImageState>((set, get) => ({
  url: null,
  naturalWidth: 0,
  naturalHeight: 0,
  offsetXFrac: 0,
  offsetYFrac: 0,
  scale: 1,
  rotationDeg: 0,
  opacity: 0.35,
  adjusting: false,

  setImage: (url, naturalWidth, naturalHeight) => {
    const prev = get().url;
    if (prev) URL.revokeObjectURL(prev);
    set({
      url,
      naturalWidth,
      naturalHeight,
      offsetXFrac: 0,
      offsetYFrac: 0,
      scale: 1,
      rotationDeg: 0,
      opacity: 0.35,
      adjusting: true,
    });
  },

  clearImage: () => {
    const prev = get().url;
    if (prev) URL.revokeObjectURL(prev);
    set({ url: null, adjusting: false });
  },

  setOffsetFrac: (x, y) => set({ offsetXFrac: x, offsetYFrac: y }),
  setScaleRotation: (scale, rotationDeg) => set({ scale: Math.min(6, Math.max(0.12, scale)), rotationDeg }),
  setOpacity: (opacity) => set({ opacity }),
  setAdjusting: (v) => set({ adjusting: v }),
}));
