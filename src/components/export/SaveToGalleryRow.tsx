import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useLineStore } from "@/store/line-store";
import { useAuthStore } from "@/store/auth-store";
import { saveToGallery } from "@/lib/gallery-client";
import { SignInModal } from "@/components/auth/SignInModal";

/** Persists the current line to the signed-in user's cloud gallery — prompts sign-in first if needed. */
export function SaveToGalleryRow() {
  const nodes = useLineStore((s) => s.nodes);
  const heightCm = useLineStore((s) => s.heightCm);
  const vesselSet = useLineStore((s) => s.vesselSet);
  const adapt = useLineStore((s) => s.adapt);
  const layout = useLineStore((s) => s.layout);
  const isAuthed = useAuthStore((s) => s.status === "authenticated");

  const [signInOpen, setSignInOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const disabled = !nodes || nodes.length < 2;

  const startSave = () => {
    if (disabled) return;
    if (!isAuthed) {
      setSignInOpen(true);
      return;
    }
    setNameOpen(true);
  };

  const save = async () => {
    if (!nodes) return;
    setSaving(true);
    try {
      await saveToGallery(name || "untitled", { nodes, heightCm, vesselSet, adapt, layout });
      toast("saved to your gallery");
      setNameOpen(false);
      setName("");
    } catch {
      toast("couldn't save — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={startSave}
        className={cn(
          "flex items-center justify-between border-t border-border px-1 py-4 transition-colors",
          disabled ? "opacity-55" : "cursor-pointer hover:bg-secondary/40",
        )}
      >
        <div>
          <div className={cn("font-serif text-sm", disabled ? "text-foreground/55" : "text-foreground")}>
            Save to gallery
          </div>
          <div className={cn("mt-0.5 text-[11px]", disabled ? "text-foreground/45" : "text-muted-foreground")}>
            keep it in your account — revisit anytime from "gallery"
          </div>
        </div>
        {!disabled && (
          <Button
            size="sm"
            className="rounded-full text-[11px] font-medium tracking-[0.06em]"
            onClick={(e) => {
              e.stopPropagation();
              startSave();
            }}
          >
            save
          </Button>
        )}
      </div>

      <SignInModal
        open={signInOpen}
        onOpenChange={setSignInOpen}
        onSuccess={() => {
          setSignInOpen(false);
          setNameOpen(true);
        }}
      />

      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent>
          <DialogTitle>save to gallery</DialogTitle>
          <DialogDescription>name this design — you'll see it in your gallery.</DialogDescription>
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
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "saving…" : "save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
