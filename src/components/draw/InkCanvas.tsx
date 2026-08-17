import { useEffect, useRef, useState } from "react";
import { select } from "d3";
import { useLineStore } from "@/store/line-store";
import { useReferenceImageStore } from "@/store/reference-image-store";
import { fitStrokeToProfile, maxRadius, resolveHandle, type ControlPoint, type CurveNode } from "@/lib/line-math";
import { renderInkStroke } from "@/lib/ink-style";
import { useElementSize } from "@/hooks/use-element-size";
import { PointTypeToolbar } from "@/components/draw/PointTypeToolbar";
import { CurveModeSwitch } from "@/components/draw/CurveModeSwitch";
import { ReferenceImageLayer } from "@/components/draw/ReferenceImageLayer";

type Layout = { cx: number; topY: number; Hpx: number };
type RawPoint = { x: number; y: number };
type HandleSide = "in" | "out";

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
function hitAnchor(x: number, y: number, nodes: CurveNode[], L: Layout): number {
  for (let i = 0; i < nodes.length; i++) {
    const q = toCanvas(nodes[i], L);
    if (Math.hypot(q.x - x, q.y - y) < 16) return i;
  }
  return -1;
}
function hitHandleSquare(x: number, y: number, nodes: CurveNode[], index: number, L: Layout): HandleSide | null {
  const node = nodes[index];
  if (node.kind === "corner") return null;
  for (const side of ["out", "in"] as const) {
    const h = resolveHandle(nodes, index, side);
    const q = toCanvas({ r: node.r + h.r, y: node.y + h.y }, L);
    if (Math.hypot(q.x - x, q.y - y) < 14) return side;
  }
  return null;
}

/**
 * The freehand silhouette editor: draw one side of a form, get a mirrored,
 * draggable curve back. Interaction (drag/insert/remove/freehand-capture) is
 * a single unified pointer handler on the SVG, matching how the original
 * mockup's custom element worked; the actual painting is a D3 data-driven
 * redraw keyed on the profile from the store.
 *
 * In "advanced" curve mode, tapping an anchor also selects it, revealing its
 * tangent handles (only the selected node's — keeps the canvas readable)
 * and the point-type toolbar. Simple mode never selects/shows handles, so
 * its interaction and rendering are unchanged from before advanced mode
 * existed.
 */
export function InkCanvas() {
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const nodes = useLineStore((s) => s.nodes);
  const controlPoints = useLineStore((s) => s.controlPoints);
  const heightCm = useLineStore((s) => s.heightCm);
  const curveMode = useLineStore((s) => s.curveMode);
  const adjustingReference = useReferenceImageStore((s) => s.adjusting && s.url !== null);

  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const effectiveSelected =
    curveMode === "advanced" && selectedNode !== null && nodes && selectedNode < nodes.length ? selectedNode : null;

  // Gesture state is transient — refs so it doesn't trigger a React render on every pointermove.
  const dragIndex = useRef<number | null>(null);
  const dragHandle = useRef<{ index: number; side: HandleSide } | null>(null);
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

    if (!controlPoints || !nodes) {
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
      const dense = controlPoints;
      const right = dense.map((p) => toCanvas(p, L));
      const left = dense.map((p) => toCanvas({ ...p, r: -p.r }, L));

      const bottomPt = toCanvas(nodes.at(-1)!, L);
      root
        .append("line")
        .attr("x1", L.cx - (bottomPt.x - L.cx))
        .attr("x2", bottomPt.x)
        .attr("y1", bottomPt.y)
        .attr("y2", bottomPt.y)
        .attr("stroke", "rgba(60,50,35,.32)")
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round");

      const strokeG = root.append("g");
      renderInkStroke(strokeG, left, { seed: 51, width: 3.2, opacity: 0.28 });
      renderInkStroke(strokeG, right, { seed: 9, width: 3.4, opacity: 1 });

      if (effectiveSelected !== null) {
        const node = nodes[effectiveSelected];
        const anchorPt = toCanvas(node, L);
        const whiskerG = root.append("g");
        if (node.kind !== "corner") {
          (["out", "in"] as const).forEach((side) => {
            const h = resolveHandle(nodes, effectiveSelected, side);
            const hPt = toCanvas({ r: node.r + h.r, y: node.y + h.y }, L);
            whiskerG
              .append("line")
              .attr("x1", anchorPt.x)
              .attr("y1", anchorPt.y)
              .attr("x2", hPt.x)
              .attr("y2", hPt.y)
              .attr("stroke", "rgba(180,67,46,.55)")
              .attr("stroke-width", 1);
            const sz = 5.5;
            whiskerG
              .append("rect")
              .attr("x", hPt.x - sz / 2)
              .attr("y", hPt.y - sz / 2)
              .attr("width", sz)
              .attr("height", sz)
              .attr("fill", "#fbf7ee")
              .attr("stroke", "#b4432e")
              .attr("stroke-width", 1.4)
              .style("cursor", "grab");
          });
        }
      }

      const anchorsG = root.append("g");
      nodes.forEach((n, i) => {
        const q = toCanvas(n, L);
        const isSelected = i === effectiveSelected;
        anchorsG
          .append("circle")
          .attr("cx", q.x)
          .attr("cy", q.y)
          .attr("r", isSelected ? 5.5 : 4.5)
          .attr("fill", isSelected ? "#b4432e" : "rgba(38,34,25,.82)")
          .style("cursor", "grab");
      });
    }
  }, [size.width, size.height, controlPoints, nodes, heightCm, effectiveSelected]);

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

    if (nodes) {
      if (curveMode === "advanced" && effectiveSelected !== null) {
        const side = hitHandleSquare(x, y, nodes, effectiveSelected, L);
        if (side) {
          store.snapshot();
          dragHandle.current = { index: effectiveSelected, side };
          if (svgRef.current) svgRef.current.style.cursor = "grabbing";
          return;
        }
      }

      const hi = hitAnchor(x, y, nodes, L);
      if (hi >= 0) {
        store.snapshot();
        dragIndex.current = hi;
        if (svgRef.current) svgRef.current.style.cursor = "grabbing";
        return;
      }

      const dense = controlPoints ?? [];
      let best = Infinity;
      for (const p of dense) best = Math.min(best, Math.hypot(toCanvas(p, L).x - x, toCanvas(p, L).y - y));
      if (best < 18) {
        const np = fromCanvas(x, y, L);
        let ins = nodes.length - 1;
        for (let i = 0; i < nodes.length - 1; i++) {
          if (np.y > nodes[i].y && np.y <= nodes[i + 1].y) {
            ins = i + 1;
            break;
          }
        }
        store.insertNode(ins, np);
        dragIndex.current = ins;
        return;
      }

      if (curveMode === "advanced") setSelectedNode(null);
      return;
    }
    drawing.current = true;
    rawPoints.current = [{ x, y }];
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = getPos(e);
    if (dragHandle.current) {
      const L = computeLayout(size.width, size.height, controlPoints);
      const { index, side } = dragHandle.current;
      const anchor = nodes![index];
      const p = fromCanvas(x, y, L);
      useLineStore.getState().setNodeHandle(index, side, { r: p.r - anchor.r, y: p.y - anchor.y });
      return;
    }
    if (dragIndex.current !== null) {
      const L = computeLayout(size.width, size.height, controlPoints);
      useLineStore.getState().moveNode(dragIndex.current, fromCanvas(x, y, L));
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
    if (dragHandle.current) {
      dragHandle.current = null;
      if (svgRef.current) svgRef.current.style.cursor = "";
      return;
    }
    if (dragIndex.current !== null) {
      if (curveMode === "advanced") setSelectedNode(dragIndex.current);
      dragIndex.current = null;
      if (svgRef.current) svgRef.current.style.cursor = "";
      return;
    }
    if (drawing.current) {
      drawing.current = false;
      const L = computeLayout(size.width, size.height, null);
      const fit = fitStrokeToProfile(rawPoints.current, L.cx);
      rawPoints.current = [];
      if (fit) {
        setSelectedNode(null);
        useLineStore.getState().setControlPoints(fit);
      } else if (svgRef.current) {
        select(svgRef.current).select("g.raw-stroke").remove();
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!nodes) return;
    const minCount = curveMode === "advanced" ? 2 : 4;
    if (nodes.length <= minCount) return;
    const { x, y } = getPos(e);
    const L = computeLayout(size.width, size.height, controlPoints);
    const hi = hitAnchor(x, y, nodes, L);
    if (hi > 0 && hi < nodes.length - 1) {
      useLineStore.getState().removeNode(hi);
      setSelectedNode((prev) => {
        if (prev === null) return null;
        if (prev === hi) return null;
        return prev > hi ? prev - 1 : prev;
      });
    }
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      <ReferenceImageLayer width={size.width} height={size.height} />
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        className="block touch-none"
        style={adjustingReference ? { pointerEvents: "none" } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />
      {/* <CurveModeSwitch /> */}
      {effectiveSelected !== null && nodes && (
        <PointTypeToolbar
          kind={nodes[effectiveSelected].kind}
          onPick={(kind) => useLineStore.getState().setNodeKind(effectiveSelected, kind)}
        />
      )}
    </div>
  );
}
