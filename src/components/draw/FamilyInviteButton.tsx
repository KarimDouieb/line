import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useLineStore } from "@/store/line-store";

/**
 * A one-line nudge toward the next step, shown once the user has actually
 * touched the line — not just loaded with the default preset. `undoStack`
 * already grows by one on every real edit (drag, freehand stroke, template
 * pick, node insert/remove — see line-store's `snapshot`), so it doubles as
 * an "has the user made a change yet" flag with no extra state needed.
 * Docked above FamilyPeek's show/hide toggle, sharing its animated offset so
 * the two never collide whether the shelf strip is open or closed.
 */
export function FamilyInviteButton() {
  const hasEdited = useLineStore((s) => s.undoStack.length > 0);
  const hasLine = useLineStore((s) => s.controlPoints !== null);
  const familyVisible = useLineStore((s) => s.familyVisible);

  if (!hasEdited || !hasLine) return null;

  return (
    <Link
      to="/family"
      className="group absolute right-6 z-[13] transition-[bottom] duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)]"
      style={{ bottom: familyVisible ? "250px" : "56px" }}
    >
      <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-accent transition-colors duration-150 group-hover:bg-foreground/[0.06]">
        shape the family
        <ArrowRight className="size-4" strokeWidth={2.25} />
      </span>
    </Link>
  );
}
