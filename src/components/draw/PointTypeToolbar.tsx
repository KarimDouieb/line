import { cn } from "@/lib/utils";
import type { PointKind } from "@/lib/line-math";

const KINDS: { key: PointKind; title: string }[] = [
  { key: "corner", title: "corner — sharp, no curve" },
  { key: "smooth", title: "smooth — mirrored angle & length" },
  { key: "asymmetric", title: "asymmetric — mirrored angle, independent length" },
  { key: "free", title: "free — split, fully independent handles" },
];

/**
 * Anchor + tangent-handle pictograms — each depicts the actual shape the
 * kind produces (a peak, a symmetric dome, a lopsided dome, a cusp), with
 * the handles drawn as small squares and the anchor as a solid dot to match
 * exactly how InkCanvas draws them on the curve itself (see the whisker
 * `rect`s and anchor `circle`s there), rather than an abstract diagram.
 */
function PointIcon({ kind }: { kind: PointKind }) {
  switch (kind) {
    case "corner":
      return (
        <svg viewBox="0 0 26 18" width="22" height="15">
          <path d="M13 4 L1 17 M13 4 L25 17" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="13" cy="4" r="2.2" fill="currentColor" />
        </svg>
      );
    case "smooth":
      return (
        <svg viewBox="0 0 24 18" width="22" height="15">
          <path
            d="M1.5 16.5 C1.6 8.6 5.2 4.6 12 4.5 C18.8 4.4 22.4 8.4 22.5 16.5"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line x1="1.5" y1="4.4" x2="22.5" y2="4.4" stroke="currentColor" strokeWidth="1" />
          <rect x="0" y="3" width="3" height="3" fill="currentColor" />
          <rect x="21" y="3" width="3" height="3" fill="currentColor" />
          <circle cx="12" cy="4.5" r="2.2" fill="currentColor" />
        </svg>
      );
    case "asymmetric":
      return (
        <svg viewBox="0 0 29 18" width="22" height="15">
          <path
            d="M1.5 16.5 C1.6 8.5 5.2 4.5 12 4.5 C20 4.5 24.9 8.5 26.8 16.5"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line x1="1.5" y1="4.4" x2="27.5" y2="4.4" stroke="currentColor" strokeWidth="1" />
          <rect x="0" y="3" width="3" height="3" fill="currentColor" />
          <rect x="25.5" y="3" width="3" height="3" fill="currentColor" />
          <circle cx="12" cy="4.5" r="2.2" fill="currentColor" />
        </svg>
      );
    case "free":
      return (
        <svg viewBox="0 0 27 18" width="22" height="15">
          <path
            d="M1.5 16.5 C1.6 8.5 5.2 4.5 12 4.5 C18.2 8.5 23.1 12.5 26.8 16.5"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line x1="1.5" y1="4.4" x2="12" y2="4.4" stroke="currentColor" strokeWidth="1" />
          <line x1="21.5" y1="11.4" x2="12" y2="4.4" stroke="currentColor" strokeWidth="1" />
          <rect x="0" y="3" width="3" height="3" fill="currentColor" />
          <rect x="19" y="9" width="3" height="3" fill="currentColor" transform="rotate(41 20.5 10.5)" />
          <circle cx="12" cy="4.5" r="2.2" fill="currentColor" />
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
