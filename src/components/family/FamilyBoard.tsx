import { useEffect, useId, useRef, useState } from "react";
import { select } from "d3";
import { useLineStore, type FamilyLayout } from "@/store/line-store";
import { maxRadius, resolveVariants } from "@/lib/line-math";
import { useElementSize } from "@/hooks/use-element-size";
import { renderShelfLayout } from "./layouts/shelf";
import { renderGridLayout } from "./layouts/grid";
import { renderOverlapLayout } from "./layouts/overlap";
import { renderOrganicLayout } from "./layouts/organic";
import { renderSceneLayout } from "./layouts/scene";
import type { HitBox, LayoutRenderer } from "./layouts/types";

const RENDERERS: Record<FamilyLayout | "shelf", LayoutRenderer> = {
  shelf: renderShelfLayout,
  overlap: renderOverlapLayout,
  grid: renderGridLayout,
  organic: renderOrganicLayout,
  scene: renderSceneLayout,
};

type FamilyBoardProps = {
  /** Force a specific layout regardless of the store's selection (used by the draw-page peek). */
  fixedLayout?: FamilyLayout | "shelf";
  className?: string;
};

/**
 * Renders the family of proportional vessels generated from the drawn line.
 * Layout choice (sequence/mosaic/studio-wall/still-life), vessel set, and
 * adaptation mode all come from the shared store so the draw-page peek and
 * the family page stay in sync automatically.
 */
export function FamilyBoard({ fixedLayout, className }: FamilyBoardProps) {
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hitsRef = useRef<HitBox[]>([]);
  const gradientId = useId();

  const controlPoints = useLineStore((s) => s.controlPoints);
  const heightCm = useLineStore((s) => s.heightCm);
  const adapt = useLineStore((s) => s.adapt);
  const vesselSet = useLineStore((s) => s.vesselSet);
  const storeLayout = useLineStore((s) => s.layout);
  const layout = fixedLayout ?? storeLayout;

  const [selected, setSelected] = useState(-1);
  useEffect(() => setSelected(-1), [layout, vesselSet, adapt]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !size.width || !size.height) return;
    const root = select(svg);
    root.selectAll("*").remove();
    hitsRef.current = [];

    if (!controlPoints) {
      root
        .append("text")
        .attr("x", size.width / 2)
        .attr("y", size.height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("font-family", "'Zen Kaku Gothic New', sans-serif")
        .attr("fill", "rgba(60,50,35,.42)")
        .text("the family appears once a line is drawn");
      return;
    }

    const mR = Math.max(0.2, maxRadius(controlPoints));
    const variants = resolveVariants(vesselSet, mR);
    const renderer = RENDERERS[layout];
    hitsRef.current = renderer({
      root,
      w: size.width,
      h: size.height,
      cps: controlPoints,
      adapt,
      cm: heightCm,
      mR,
      variants,
      selected,
      gradientId,
    });
  }, [size.width, size.height, controlPoints, heightCm, adapt, vesselSet, layout, selected, gradientId]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hits = hitsRef.current;
    for (let i = 0; i < hits.length; i++) {
      const hb = hits[i];
      if (x > hb.x && x < hb.x + hb.w && y > hb.y && y < hb.y + hb.h) {
        setSelected((prev) => (prev === i ? -1 : i));
        return;
      }
    }
  };

  return (
    <div ref={containerRef} className={className ?? "absolute inset-0"}>
      <svg ref={svgRef} width={size.width} height={size.height} className="block" onPointerDown={onPointerDown} />
    </div>
  );
}
