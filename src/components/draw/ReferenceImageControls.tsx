import { Check, Move, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReferenceImageStore } from "@/store/reference-image-store";

/** Floating controls for the reference-photo tracing aid — see ReferenceImageLayer. */
export function ReferenceImageControls() {
  const url = useReferenceImageStore((s) => s.url);
  const adjusting = useReferenceImageStore((s) => s.adjusting);
  const opacity = useReferenceImageStore((s) => s.opacity);
  const setAdjusting = useReferenceImageStore((s) => s.setAdjusting);
  const setOpacity = useReferenceImageStore((s) => s.setOpacity);
  const clearImage = useReferenceImageStore((s) => s.clearImage);

  if (!url) return null;

  return (
    <div className="absolute right-6 top-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card/90 px-2.5 py-1.5 shadow-sm">
      <Button
        variant={adjusting ? "default" : "outline"}
        size="sm"
        className="rounded-full text-xs font-medium"
        onClick={() => setAdjusting(!adjusting)}
      >
        {adjusting ? (
          <>
            <Check className="size-3.5" /> done
          </>
        ) : (
          <>
            <Move className="size-3.5" /> adjust photo
          </>
        )}
      </Button>
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="text-[10px] text-muted-foreground">opacity</span>
        <input
          type="range"
          min={0.1}
          max={0.9}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="h-1 w-16 accent-accent"
        />
      </div>
      <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={clearImage} aria-label="remove photo">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
