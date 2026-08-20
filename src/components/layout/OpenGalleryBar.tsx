import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EditableName } from "@/components/ui/editable-name";
import { useLineStore, selectIsGalleryDirty } from "@/store/line-store";
import { updateGalleryItem, renameGalleryItem } from "@/lib/gallery-client";
import { serializeLineFile } from "@/lib/line-file";
import type { GallerySearch } from "@/lib/gallery-search";

/** Shows the currently-open gallery entry's name next to the wordmark on /draw and /family, renameable in place, with a "save" button once it's diverged from what's stored. */
export function OpenGalleryBar() {
  const openGallery = useLineStore((s) => s.openGallery);
  const dirty = useLineStore(selectIsGalleryDirty);
  const nodes = useLineStore((s) => s.nodes);
  const heightCm = useLineStore((s) => s.heightCm);
  const vesselSet = useLineStore((s) => s.vesselSet);
  const adapt = useLineStore((s) => s.adapt);
  const layout = useLineStore((s) => s.layout);
  const setOpenGallery = useLineStore((s) => s.setOpenGallery);
  const [saving, setSaving] = useState(false);
  const pathname = useLocation({ select: (l) => l.pathname }) as "/draw" | "/family";
  const search = useLocation({ select: (l) => l.search }) as GallerySearch;
  const navigate = useNavigate();

  if (!openGallery || !nodes) return null;

  const save = async () => {
    setSaving(true);
    try {
      const data = { nodes, heightCm, vesselSet, adapt, layout };
      await updateGalleryItem(openGallery.id, openGallery.name, data);
      setOpenGallery({ id: openGallery.id, name: openGallery.name, snapshot: serializeLineFile(data) });
      toast("saved");
    } catch {
      toast("couldn't save — try again");
    } finally {
      setSaving(false);
    }
  };

  const rename = async (name: string) => {
    const previous = openGallery.name;
    setOpenGallery({ ...openGallery, name });
    if (search.id === openGallery.id) navigate({ to: pathname, search: { ...search, name }, replace: true });
    try {
      await renameGalleryItem(openGallery.id, name);
    } catch {
      toast("couldn't rename — try again");
      setOpenGallery({ ...openGallery, name: previous });
      if (search.id === openGallery.id) navigate({ to: pathname, search: { ...search, name: previous }, replace: true });
    }
  };

  return (
    <>
      <div className="mx-1 h-4 w-px bg-border" />
      <EditableName
        value={openGallery.name}
        onRename={rename}
        className="max-w-[160px] truncate text-sm text-foreground/70"
        inputClassName="max-w-[160px] truncate border-b border-border text-sm text-foreground/70"
      />
      {dirty && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-full text-[11px] font-medium"
          onClick={save}
          disabled={saving}
        >
          {saving ? "saving…" : "save"}
        </Button>
      )}
    </>
  );
}
