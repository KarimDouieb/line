import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { listGallery, type GalleryItem } from "@/lib/gallery-client";
import { useLineStore } from "@/store/line-store";
import { GalleryThumbnail } from "@/components/gallery/GalleryThumbnail";

export function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const loadLineFile = useLineStore((s) => s.loadLineFile);
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
    navigate({ to: "/draw" });
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
          <button key={item.id} onClick={() => open(item)} className="group flex flex-col gap-2 text-left">
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-card transition-colors group-hover:border-accent/50">
              <GalleryThumbnail data={item.data} />
            </div>
            <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
