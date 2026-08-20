import { LineSquiggle, Undo2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useLineStore } from "@/store/line-store";

/** Floating "new line" / "undo" controls over the canvas, top right — moved out of the app header so they read as canvas actions, not global nav. */
export function CanvasActions() {
  const clear = useLineStore((s) => s.clear);
  const undo = useLineStore((s) => s.undo);
  const navigate = useNavigate();

  const startNewLine = () => {
    clear();
    // clear() detaches from any open gallery entry in the store, but leaves
    // a stale ?id=… in the URL — without dropping that too, useGalleryUrlSync
    // would see the URL still pointing at the old entry and reload it right
    // back in, undoing this button's whole point.
    navigate({ to: "/draw", search: {}, replace: true });
  };

  return (
    <div className="absolute right-6 top-4 z-20 flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-full bg-card/90 text-xs font-medium"
        onClick={startNewLine}
      >
        <LineSquiggle />
        new line
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-full bg-card/90 text-xs font-medium"
        onClick={() => undo()}
      >
        <Undo2 />
        undo
      </Button>
    </div>
  );
}
