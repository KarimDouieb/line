import { cn } from "@/lib/utils";
import type { PointKind } from "@/lib/line-math";

const KINDS: { key: PointKind; title: string }[] = [
  { key: "corner", title: "corner — sharp, no curve" },
  { key: "smooth", title: "smooth — mirrored angle & length" },
  { key: "asymmetric", title: "asymmetric — mirrored angle, independent length" },
  { key: "free", title: "free — split, fully independent handles" },
];

function PointIcon({ kind }: { kind: PointKind }) {
  switch (kind) {
    case "corner":
      return (
        <svg viewBox="0 0 18 18" width="16" height="16">
          <path d="M3 13 L9 4 L15 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "smooth":
      return (
        <svg viewBox="0 0 18 18" width="16" height="16">
          <line x1="9" y1="9" x2="4" y2="6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <line x1="9" y1="9" x2="14" y2="12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="4" cy="6" r="1.3" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="14" cy="12" r="1.3" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="9" cy="9" r="1.7" fill="currentColor" />
        </svg>
      );
    case "asymmetric":
      return (
        <svg viewBox="0 0 18 18" width="16" height="16">
          <line x1="9" y1="9" x2="6.5" y2="7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <line x1="9" y1="9" x2="14.5" y2="13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="6.5" cy="7" r="1.1" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="14.5" cy="13" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="9" cy="9" r="1.7" fill="currentColor" />
        </svg>
      );
    case "free":
      return (
        <svg viewBox="0 0 18 18" width="16" height="16">
          <line x1="9" y1="9" x2="4" y2="11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <line x1="9" y1="9" x2="14.5" y2="4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="4" cy="11" r="1.3" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="14.5" cy="4.5" r="1.3" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="9" cy="9" r="1.7" fill="currentColor" />
        </svg>
      );
  }
}

/**
 * Contextual toolbar shown in advanced curve mode when an anchor is
 * selected — lets you switch its point kind (sharp corner, mirrored smooth,
 * mirrored-angle-only asymmetric, or fully split/free handles), matching
 * the point-type model Sketch/Illustrator use.
 */
export function PointTypeToolbar({ kind, onPick }: { kind: PointKind; onPick: (kind: PointKind) => void }) {
  return (
    <div className="pointer-events-auto absolute left-6 top-4 z-20 rounded-lg border border-border bg-card/95 px-2.5 py-2 shadow-md">
      <div className="mb-1.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground">POINT TYPE</div>
      <div className="flex gap-1">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            title={k.title}
            onClick={() => onPick(k.key)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md border transition-colors",
              kind === k.key
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-transparent text-foreground/70 hover:bg-secondary",
            )}
          >
            <PointIcon kind={k.key} />
          </button>
        ))}
      </div>
    </div>
  );
}
