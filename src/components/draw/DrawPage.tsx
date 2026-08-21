import { InkCanvas } from "@/components/draw/InkCanvas";
import { FamilyPeek } from "@/components/draw/FamilyPeek";
import { ReferenceImageControls } from "@/components/draw/ReferenceImageControls";
import { FamilyInviteButton } from "@/components/draw/FamilyInviteButton";
import { CanvasActions } from "@/components/draw/CanvasActions";
import { FirstVisitHint } from "@/components/draw/FirstVisitHint";
import { useGalleryUrlSync } from "@/hooks/use-gallery-url-sync";

export function DrawPage() {
  useGalleryUrlSync();

  return (
    <div className="relative min-h-0 flex-1">
      <InkCanvas />
      <ReferenceImageControls />
      <CanvasActions />
      <FirstVisitHint />
      <p className="pointer-events-none absolute top-4 left-1/2 z-[5] -translate-x-1/2 text-[10.5px] text-foreground/45">
        tap the line to add a point · double-tap a point to remove · drag to shape
      </p>
      <FamilyInviteButton />
      <FamilyPeek />
    </div>
  );
}
