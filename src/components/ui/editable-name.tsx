import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A text label that becomes an inline text input + confirm/cancel icons on
 * double-click. Enter or the check commits, Escape or the x cancels, blur
 * elsewhere also commits. Renders inert (not editable) while `value` is
 * empty, since there's nothing meaningful to double-click into yet.
 */
export function EditableName({
  value,
  onRename,
  className,
  inputClassName,
}: {
  value: string;
  onRename: (name: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onRename(trimmed);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") {
              e.stopPropagation();
              cancel();
            }
          }}
          className={cn("bg-transparent outline-none", inputClassName ?? className)}
        />
        {/* preventDefault on mousedown keeps the input focused so these fire
            their own onClick instead of losing the race to the input's blur
            (which would otherwise silently commit before "cancel" runs). */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          className="text-accent transition-opacity hover:opacity-70"
          aria-label="confirm rename"
        >
          <Check className="size-3.5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          className="text-foreground/45 transition-opacity hover:opacity-70"
          aria-label="cancel rename"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </button>
      </span>
    );
  }

  return (
    <span className="group/editable inline-flex min-w-0 max-w-full items-center gap-1">
      <span onDoubleClick={startEdit} title="double-click to rename" className={cn("min-w-0 truncate", className)}>
        {value}
      </span>
      <button
        type="button"
        onClick={startEdit}
        className="shrink-0 text-foreground/35 opacity-0 transition-opacity group-hover/editable:opacity-100 hover:text-foreground/70"
        aria-label="rename"
      >
        <Pencil className="size-3" strokeWidth={2} />
      </button>
    </span>
  );
}
