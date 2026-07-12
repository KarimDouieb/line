import { useEffect, useRef } from "react";
import { select } from "d3";
import { useLineStore } from "@/store/line-store";
import { catmullRom, fitStrokeToProfile, maxRadius, type ControlPoint } from "@/lib/line-math";
import { renderInkStroke } from "@/lib/ink-style";
import { useElementSize } from "@/hooks/use-element-size";

type Layout = { cx: number; topY: number; Hpx: number };
type RawPoint = { x: number; y: number };

function computeLayout(w: number, h: number, cps: ControlPoint[] | null): Layout {
  const mR = cps ? Math.max(0.35, maxRadius(cps)) : 0.5;
  const Hpx = Math.min(h * 0.68, (w * 0.42) / mR);
  return { cx: w / 2, topY: (h - Hpx) / 2, Hpx };
}
function toCanvas(p: ControlPoint, L: Layout) {
  return { x: L.cx + p.r * L.Hpx, y: L.topY + p.y * L.Hpx };
}
function fromCanvas(x: number, y: number, L: Layout): ControlPoint {
  return { r: Math.max(0.005, Math.abs(x - L.cx) / L.Hpx), y: (y - L.topY) / L.Hpx };
}
function hitHandle(x: number, y: number, cps: ControlPoint[], L: Layout): number {
  for (let i = 0; i < cps.length; i++) {
    const q = toCanvas(cps[i], L);
    if (Math.hypot(q.x - x, q.y - y) < 16) return i;
  }
  return -1;
}

/**
 * The freehand silhouette editor: draw one side of a form, get a mirrored,
 * draggable curve back. Interaction (drag/insert/remove/freehand-capture) is
 * a single unified pointer handler on the SVG, matching how the original
 * mockup's custom element worked; the actual painting is a D3 data-driven
 * redraw keyed on the profile from the store.
 */
export function InkCanvas() {
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const controlPoints = useLineStore((s) => s.controlPoints);
  const heightCm = useLineStore((s) => s.heightCm);

  // Gesture state is transient — refs so it doesn't trigger a React render on every pointermove.
  const dragIndex = useRef<number | null>(null);
  const drawing = useRef(false);
  const rawPoints = useRef<RawPoint[]>([]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !size.width || !size.height) return;
    const root = select(svg);
    root.selectAll("*").remove();

    const L = computeLayout(size.width, size.height, controlPoints);

    root
      .append("line")
      .attr("x1", L.cx)
      .attr("x2", L.cx)
      .attr("y1", Math.max(14, L.topY - 46))
      .attr("y2", Math.min(size.height - 14, L.topY + L.Hpx + 46))
      .attr("stroke", "rgba(60,50,35,.28)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "1,7")
      .attr("stroke-linecap", "round");

    if (controlPoints) {
      const pxPerCm = L.Hpx / heightCm;
      if (pxPerCm > 7) {
        const step = pxPerCm > 16 ? 1 : 5;
        const ticks = root.append("g");
        for (let i = 0; i <= heightCm; i += step) {
          const yy = L.topY + L.Hpx - i * pxPerCm;
          ticks
            .append("line")
            .attr("x1", L.cx - 5)
            .attr("x2", L.cx + 5)
            .attr("y1", yy)
            .attr("y2", yy)
            .attr("stroke", "rgba(60,50,35,.13)");
        }
        root
          .append("text")
          .attr("x", L.cx + 10)
          .attr("y", L.topY + 4)
          .attr("font-size", 10)
          .attr("font-family", "'Zen Kaku Gothic New', sans-serif")
          .attr("fill", "rgba(60,50,35,.45)")
          .text(`${heightCm} cm`);
      }
    }

    if (!controlPoints) {
      const text = root.append("g").attr("text-anchor", "middle");
      text
        .append("text")
        .attr("x", L.cx)
        .attr("y", size.height / 2 - 8)
        .style("font", "400 14px 'Shippori Mincho', serif")
        .attr("fill", "rgba(60,50,35,.5)")
        .text("draw one side of your form, rim to foot");
      text
        .append("text")
        .attr("x", L.cx)
        .attr("y", size.height / 2 + 14)
        .attr("font-size", 11)
        .attr("font-family", "'Zen Kaku Gothic New', sans-serif")
        .attr("fill", "rgba(60,50,35,.38)")
        .text("the line will be mirrored across the axis");
    } else {
      const dense = catmullRom(controlPoints, 22);
      const right = dense.map((p) => toCanvas(p, L));
      const left = dense.map((p) => toCanvas({ ...p, r: -p.r }, L));
      const strokeG = root.append("g");
      renderInkStroke(strokeG, left, { seed: 51, width: 3.2, opacity: 0.28 });
      renderInkStroke(strokeG, right, { seed: 9, width: 3.4, opacity: 1 });

      const handles = root.append("g");
      controlPoints.forEach((p) => {
        const q = toCanvas(p, L);
        handles.append("circle").attr("cx", q.x).attr("cy", q.y).attr("r", 4.5).attr("fill", "rgba(38,34,25,.82)");
      });
    }
  }, [size.width, size.height, controlPoints, heightCm]);

  const getPos = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const drawRawStroke = () => {
    if (!svgRef.current) return;
    const root = select(svgRef.current);
    root.select("g.raw-stroke").remove();
    const g = root.append("g").attr("class", "raw-stroke");
    renderInkStroke(g, rawPoints.current, { seed: 5, width: 3, opacity: 0.85 });
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);
    const L = computeLayout(size.width, size.height, controlPoints);
    const store = useLineStore.getState();

    if (controlPoints) {
      const hi = hitHandle(x, y, controlPoints, L);
      if (hi >= 0) {
        store.snapshot();
        dragIndex.current = hi;
        return;
      }
      const dense = catmullRom(controlPoints, 22).map((p) => toCanvas(p, L));
      let best = Infinity;
      for (const p of dense) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
      if (best < 18) {
        const np = fromCanvas(x, y, L);
        let ins = controlPoints.length - 1;
        for (let i = 0; i < controlPoints.length - 1; i++) {
          if (np.y > controlPoints[i].y && np.y <= controlPoints[i + 1].y) {
            ins = i + 1;
            break;
          }
        }
        store.insertControlPoint(ins, np);
        dragIndex.current = ins;
      }
      return;
    }
    drawing.current = true;
    rawPoints.current = [{ x, y }];
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = getPos(e);
    if (dragIndex.current !== null) {
      const L = computeLayout(size.width, size.height, controlPoints);
      useLineStore.getState().updateControlPoint(dragIndex.current, fromCanvas(x, y, L));
      return;
    }
    if (drawing.current) {
      const last = rawPoints.current[rawPoints.current.length - 1];
      if (Math.hypot(x - last.x, y - last.y) > 2.5) {
        rawPoints.current.push({ x, y });
        drawRawStroke();
      }
    }
  };

  const onPointerUp = () => {
    if (dragIndex.current !== null) {
      dragIndex.current = null;
      return;
    }
    if (drawing.current) {
      drawing.current = false;
      const L = computeLayout(size.width, size.height, null);
      const fit = fitStrokeToProfile(rawPoints.current, L.cx);
      rawPoints.current = [];
      if (fit) {
        useLineStore.getState().setControlPoints(fit);
      } else if (svgRef.current) {
        select(svgRef.current).select("g.raw-stroke").remove();
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!controlPoints || controlPoints.length <= 4) return;
    const { x, y } = getPos(e);
    const L = computeLayout(size.width, size.height, controlPoints);
    const hi = hitHandle(x, y, controlPoints, L);
    if (hi > 0 && hi < controlPoints.length - 1) useLineStore.getState().removeControlPoint(hi);
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="block touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}
