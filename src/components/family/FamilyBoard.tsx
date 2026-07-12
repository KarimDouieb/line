import { lazy, Suspense } from "react";
import { useLineStore, type FamilyLayout } from "@/store/line-store";
import { FamilyBoardCanvas } from "@/components/family/FamilyBoardCanvas";

// Three.js is a large dependency only the 3D scene needs — split it into its
// own chunk so /draw (which mounts FamilyBoard for its peek strip) and the
// 2D family layouts never pay for it.
const SceneThree = lazy(() =>
  import("@/components/family/layouts/SceneThree").then((m) => ({ default: m.SceneThree })),
);

type FamilyBoardProps = {
  /** Force a specific layout regardless of the store's selection (used by the draw-page peek). */
  fixedLayout?: FamilyLayout | "shelf";
  className?: string;
};

/**
 * Dispatches to the right renderer for the current layout: every 2D layout
 * (sequence/mosaic/studio-wall) is drawn with D3/SVG by FamilyBoardCanvas;
 * "still life · 3D" is a real, orbitable Three.js scene (SceneThree).
 */
export function FamilyBoard({ fixedLayout, className }: FamilyBoardProps) {
  const storeLayout = useLineStore((s) => s.layout);
  const layout = fixedLayout ?? storeLayout;

  if (layout === "scene") {
    return (
      <Suspense
        fallback={
          <div className={className ?? "absolute inset-0"}>
            <div className="flex h-full items-center justify-center text-xs text-foreground/40">loading scene…</div>
          </div>
        }
      >
        <SceneThree className={className} />
      </Suspense>
    );
  }
  return <FamilyBoardCanvas layout={layout} className={className} />;
}
