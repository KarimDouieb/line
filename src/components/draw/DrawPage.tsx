import { InkCanvas } from "@/components/draw/InkCanvas";
import { FamilyPeek } from "@/components/draw/FamilyPeek";
import { ReferenceImageControls } from "@/components/draw/ReferenceImageControls";

export function DrawPage() {
  return (
    <div className="relative min-h-0 flex-1">
      <InkCanvas />
      <ReferenceImageControls />
      <p className="pointer-events-none absolute bottom-3 left-6 z-[5] text-[10.5px] text-foreground/45">
        tap the line to add a point · double-tap a point to remove · drag to shape
      </p>
      <FamilyPeek />
    </div>
  );
}
