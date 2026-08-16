import { useEffect, useId, useRef } from "react";
import { select } from "d3";
import { densifyCurve, maxRadius, resolveVariants } from "@/lib/line-math";
import { renderOrganicLayout } from "@/components/family/layouts/organic";
import { useElementSize } from "@/hooks/use-element-size";
import type { LineFileData } from "@/lib/line-file";

/**
 * A static "studio wall" render of one saved gallery entry. Reuses the pure
 * `renderOrganicLayout` function directly rather than `FamilyBoardCanvas`,
 * which is wired to the single global line-store — a gallery grid needs
 * many different saved designs rendered side by side at once.
 */
export function GalleryThumbnail({ data }: { data: LineFileData }) {
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gradientId = useId();

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !size.width || !size.height) return;
    const root = select(svg);
    root.selectAll("*").remove();

    const controlPoints = densifyCurve(data.nodes);
    const mR = Math.max(0.2, maxRadius(controlPoints));
    const variants = resolveVariants(data.vesselSet, mR);
    renderOrganicLayout({
      root,
      w: size.width,
      h: size.height,
      cps: controlPoints,
      adapt: data.adapt,
      cm: data.heightCm,
      mR,
      variants,
      selected: -1,
      gradientId,
    });
  }, [size.width, size.height, data, gradientId]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg ref={svgRef} width={size.width} height={size.height} className="block" />
    </div>
  );
}
