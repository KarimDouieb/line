import { useRef } from "react";
import { useReferenceImageStore } from "@/store/reference-image-store";

const FIT_FRACTION = 0.72;

type DragMove = { startX: number; startY: number; startOffX: number; startOffY: number };
type DragHandle = {
  centerClientX: number;
  centerClientY: number;
  startDist: number;
  startAngle: number;
  startScale: number;
  startRotation: number;
};

/**
 * Renders the uploaded reference photo behind the ink canvas, at low opacity,
 * so the user can trace over it. While `adjusting`, a single corner handle
 * drives scale + rotation together (distance from center = scale, angle =
 * rotation) and dragging the photo body moves it — the rest of the time the
 * layer is pointer-events:none so it doesn't interfere with drawing.
 */
export function ReferenceImageLayer({ width, height }: { width: number; height: number }) {
  const url = useReferenceImageStore((s) => s.url);
  const naturalWidth = useReferenceImageStore((s) => s.naturalWidth);
  const naturalHeight = useReferenceImageStore((s) => s.naturalHeight);
  const offsetXFrac = useReferenceImageStore((s) => s.offsetXFrac);
  const offsetYFrac = useReferenceImageStore((s) => s.offsetYFrac);
  const scale = useReferenceImageStore((s) => s.scale);
  const rotationDeg = useReferenceImageStore((s) => s.rotationDeg);
  const opacity = useReferenceImageStore((s) => s.opacity);
  const adjusting = useReferenceImageStore((s) => s.adjusting);
  const setOffsetFrac = useReferenceImageStore((s) => s.setOffsetFrac);
  const setScaleRotation = useReferenceImageStore((s) => s.setScaleRotation);

  const outerRef = useRef<HTMLDivElement | null>(null);
  const dragMove = useRef<DragMove | null>(null);
  const dragHandle = useRef<DragHandle | null>(null);

  if (!url || !width || !height) return null;

  const aspect = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1;
  let baseW = width * FIT_FRACTION;
  let baseH = baseW / aspect;
  if (baseH > height * FIT_FRACTION) {
    baseH = height * FIT_FRACTION;
    baseW = baseH * aspect;
  }
  const renderW = baseW * scale;
  const renderH = baseH * scale;
  const centerX = width / 2 + offsetXFrac * width;
  const centerY = height / 2 + offsetYFrac * height;

  const onBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragMove.current = { startX: e.clientX, startY: e.clientY, startOffX: offsetXFrac, startOffY: offsetYFrac };
  };
  const onBodyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragMove.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setOffsetFrac(d.startOffX + dx / width, d.startOffY + dy / height);
  };
  const onBodyPointerUp = () => {
    dragMove.current = null;
  };

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = outerRef.current!.getBoundingClientRect();
    const centerClientX = rect.left + centerX;
    const centerClientY = rect.top + centerY;
    const dx = e.clientX - centerClientX;
    const dy = e.clientY - centerClientY;
    dragHandle.current = {
      centerClientX,
      centerClientY,
      startDist: Math.max(1, Math.hypot(dx, dy)),
      startAngle: Math.atan2(dy, dx),
      startScale: scale,
      startRotation: rotationDeg,
    };
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragHandle.current;
    if (!d) return;
    const dx = e.clientX - d.centerClientX;
    const dy = e.clientY - d.centerClientY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const newScale = d.startScale * (dist / d.startDist);
    const newRotation = d.startRotation + (angle - d.startAngle) * (180 / Math.PI);
    setScaleRotation(newScale, newRotation);
  };
  const onHandlePointerUp = () => {
    dragHandle.current = null;
  };

  return (
    <div
      ref={outerRef}
      className={`absolute inset-0 ${adjusting ? "z-30" : ""}`}
      style={{ pointerEvents: adjusting ? "auto" : "none" }}
    >
      <div
        onPointerDown={onBodyPointerDown}
        onPointerMove={onBodyPointerMove}
        onPointerUp={onBodyPointerUp}
        onPointerCancel={onBodyPointerUp}
        style={{
          position: "absolute",
          left: centerX,
          top: centerY,
          width: renderW,
          height: renderH,
          transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
          opacity,
          cursor: adjusting ? "grab" : "default",
          touchAction: "none",
        }}
      >
        <img src={url} draggable={false} className="block h-full w-full select-none" alt="reference" />
        {adjusting && (
          <>
            <div className="pointer-events-none absolute inset-0 border border-dashed border-accent/70" />
            <div
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              className="absolute size-6 rounded-full border-2 border-accent bg-card shadow-sm"
              style={{ right: -12, top: -12, cursor: "grab", touchAction: "none" }}
            />
          </>
        )}
      </div>
    </div>
  );
}
