import { Button } from "@/components/ui/button";
import { FamilyBoard } from "@/components/family/FamilyBoard";
import { useLineStore } from "@/store/line-store";

/** The bottom slide-up strip on the draw page — a compact, always-shelf preview of the family. */
export function FamilyPeek() {
  const visible = useLineStore((s) => s.familyVisible);
  const toggle = useLineStore((s) => s.toggleFamilyVisible);

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[200px] transition-transform duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{
          transform: visible ? "translateY(0%)" : "translateY(112%)",
          background: "linear-gradient(rgba(247,242,231,0), rgba(247,242,231,.94) 30%)",
        }}
      >
        <FamilyBoard fixedLayout="shelf" />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={toggle}
        className="absolute right-6 z-[12] rounded-full bg-card/90 text-xs font-medium transition-[bottom] duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ bottom: visible ? "210px" : "16px" }}
      >
        {visible ? "hide family" : "show family"}
      </Button>
    </>
  );
}
