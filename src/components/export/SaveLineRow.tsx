import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useLineStore } from "@/store/line-store";
import { downloadLineFile } from "@/lib/export-line";

/** The "save the editable line itself" row — distinct from the other export rows, which produce a physical-output artifact (SVG/PDF/STL); this one round-trips back into the app via the header's import menu. */
export function SaveLineRow() {
  const nodes = useLineStore((s) => s.nodes);
  const heightCm = useLineStore((s) => s.heightCm);
  const vesselSet = useLineStore((s) => s.vesselSet);
  const adapt = useLineStore((s) => s.adapt);
  const layout = useLineStore((s) => s.layout);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const disabled = !nodes || nodes.length < 2;

  const save = () => {
    const ok = nodes && downloadLineFile({ nodes, heightCm, vesselSet, adapt, layout }, name || "line");
    toast(ok ? "saved — .line file" : "draw a line first");
    setOpen(false);
    setName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div
        onClick={() => !disabled && setOpen(true)}
        className={cn(
          "flex items-center justify-between border-t border-border px-1 py-4 transition-colors",
          disabled ? "opacity-55" : "cursor-pointer hover:bg-secondary/40",
        )}
      >
        <div>
          <div className={cn("font-serif text-sm", disabled ? "text-foreground/55" : "text-foreground")}>Save file</div>
          <div className={cn("mt-0.5 text-[11px]", disabled ? "text-foreground/45" : "text-muted-foreground")}>
            points, anchors, family & variant — reopen later from "input"
          </div>
        </div>
        {!disabled && (
          <Button
            size="sm"
            className="rounded-full text-[11px] font-medium tracking-[0.06em]"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
          >
            save
          </Button>
        )}
      </div>

      <DialogContent>
        <DialogTitle>save line file</DialogTitle>
        <DialogDescription>name it — the date and time are added to the filename automatically.</DialogDescription>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my vase"
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="mt-4"
        />
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose
            render={
              <Button variant="ghost" size="sm">
                cancel
              </Button>
            }
          />
          <Button size="sm" onClick={save}>
            save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
