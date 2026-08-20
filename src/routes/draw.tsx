import { createFileRoute } from "@tanstack/react-router";
import { DrawPage } from "@/components/draw/DrawPage";
import { validateGallerySearch } from "@/lib/gallery-search";

export const Route = createFileRoute("/draw")({
  validateSearch: validateGallerySearch,
  component: DrawPage,
});
