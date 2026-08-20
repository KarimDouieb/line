import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useLineStore } from "@/store/line-store";
import { getGalleryItem } from "@/lib/gallery-client";
import { serializeLineFile } from "@/lib/line-file";
import type { GallerySearch } from "@/lib/gallery-search";

/**
 * Keeps a gallery entry's id/name reflected in the URL on /draw and /family,
 * in both directions:
 *  - URL has an `id` the store doesn't know about yet (a shared link, or a
 *    page refresh) → fetch it and load it into the store.
 *  - The store has an open gallery entry the current URL doesn't show yet
 *    (e.g. just navigated here from the other of /draw or /family, whose
 *    Link doesn't carry search params) → write it into the URL in place.
 * Once the two agree, both branches are no-ops, so this can't loop.
 */
export function useGalleryUrlSync() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname }) as "/draw" | "/family";
  const search = useLocation({ select: (l) => l.search }) as GallerySearch;
  const openGalleryId = useLineStore((s) => s.openGallery?.id);
  const loadLineFile = useLineStore((s) => s.loadLineFile);
  const setOpenGallery = useLineStore((s) => s.setOpenGallery);

  useEffect(() => {
    if (search.id && search.id !== openGalleryId) {
      let cancelled = false;
      getGalleryItem(search.id).then((item) => {
        if (cancelled || !item) return;
        loadLineFile(item.data);
        setOpenGallery({ id: item.id, name: item.name, snapshot: serializeLineFile(item.data) });
      });
      return () => {
        cancelled = true;
      };
    }
    if (!search.id && openGalleryId) {
      const name = useLineStore.getState().openGallery?.name;
      if (name) navigate({ to: pathname, search: { id: openGalleryId, name }, replace: true });
    }
  }, [search.id, openGalleryId, pathname, navigate, loadLineFile, setOpenGallery]);
}
