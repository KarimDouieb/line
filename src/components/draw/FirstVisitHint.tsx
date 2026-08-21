import { useEffect, useState } from "react";
import { useLineStore } from "@/store/line-store";

const STORAGE_KEY = "line-seen-new-line-hint";

/**
 * A one-time onboarding nudge, shown only to a first-time visitor before
 * they've touched anything — the app loads with a pre-drawn default line, so
 * it's not obvious you can either play with that one or start a blank one of
 * your own. Points at the "new line" button (see CanvasActions). Dismissed
 * for good — via localStorage, so it never comes back on a later visit —
 * the moment they edit the line, click "new line" themselves, or close it
 * directly, whichever happens first. `undoStack` already grows by one on
 * every real edit (see line-store's `snapshot`), the same signal
 * FamilyInviteButton uses for the mirror-image nudge shown *after* editing.
 */
export function FirstVisitHint() {
  const hasEdited = useLineStore((s) => s.undoStack.length > 0);
  const [seen, setSeen] = useState(true); // default true until storage is checked, so it never flashes on then off

  useEffect(() => {
    setSeen(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (hasEdited) {
      localStorage.setItem(STORAGE_KEY, "1");
      setSeen(true);
    }
  }, [hasEdited]);

  if (seen) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setSeen(true);
  };

  return (
    <button
      type="button"
      onClick={dismiss}
      className="absolute right-52 top-3 z-20 flex items-center gap-1.5 text-left"
      aria-label="dismiss hint"
    >
      <span className="-rotate-2 font-hand text-[26px] leading-none text-accent">draw your own</span>
      {/* A short, mostly-horizontal sweep — rises slightly then levels out
          to land directly on "new line" — the first (left) button in
          CanvasActions — since it now sits at the same height as the
          button row instead of pointing up into it from below. */}
      <svg width="46" height="30" viewBox="0 0 46 30" fill="none" className="mb-1 text-accent">
        <path d="M2 24 Q 22 2, 40 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M28 6 L40 12 L30 17"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
