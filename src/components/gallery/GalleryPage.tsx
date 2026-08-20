import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { listGallery, renameGalleryItem, type GalleryItem } from "@/lib/gallery-client";
import { useLineStore } from "@/store/line-store";
import { serializeLineFile } from "@/lib/line-file";
import { GalleryThumbnail } from "@/components/gallery/GalleryThumbnail";
import { EditableName } from "@/components/ui/editable-name";

export function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const loadLineFile = useLineStore((s) => s.loadLineFile);
  const openGallery = useLineStore((s) => s.openGallery);
  const setOpenGallery = useLineStore((s) => s.setOpenGallery);
  const navigate = useNavigate();

  useEffect(() => {
    listGallery()
      .then(setItems)
      .catch(() => {
        toast("couldn't load your gallery");
        setItems([]);
      });
  }, []);

  const open = (item: GalleryItem) => {
    loadLineFile(item.data);
    setOpenGallery({ id: item.id, name: item.name, snapshot: serializeLineFile(item.data) });
    navigate({ to: "/draw", search: { id: item.id, name: item.name } });
  };

  const rename = async (item: GalleryItem, name: string) => {
    setItems((prev) => prev?.map((it) => (it.id === item.id ? { ...it, name } : it)) ?? prev);
    // Keep the header's name in sync too, in case this is the line currently open elsewhere.
    if (openGallery?.id === item.id) setOpenGallery({ ...openGallery, name });
    try {
      await renameGalleryItem(item.id, name);
    } catch {
      toast("couldn't rename — try again");
      setItems((prev) => prev?.map((it) => (it.id === item.id ? { ...it, name: item.name } : it)) ?? prev);
      if (openGallery?.id === item.id) setOpenGallery({ ...openGallery, name: item.name });
    }
  };

  return (
    <div className="mx-auto mt-14 w-full max-w-4xl px-5 pb-16">
      <div className="font-serif text-[22px] text-foreground">gallery</div>
      <div className="mb-6 mt-1 text-[11.5px] text-muted-foreground">
        your saved lines — tap one to bring it back to the draw page
      </div>

      {items === null && <p className="text-sm text-muted-foreground">loading…</p>}
      {items !== null && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          nothing saved yet — from the export page, save a line to your gallery.
        </p>
      )}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
        {items?.map((item) => (
          <div key={item.id} className="group flex flex-col gap-2">
            <button
              type="button"
              onClick={() => open(item)}
              className="relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-border bg-card text-left transition-colors group-hover:border-accent/50"
            >
              <GalleryThumbnail data={item.data} />
            </button>
            <EditableName
              value={item.name}
              onRename={(name) => rename(item, name)}
              className="truncate text-sm font-medium text-foreground"
              inputClassName="w-full truncate border-b border-border text-sm font-medium text-foreground"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
