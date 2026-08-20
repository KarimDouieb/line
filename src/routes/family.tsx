import { createFileRoute } from "@tanstack/react-router";
import { FamilyPage } from "@/components/family/FamilyPage";
import { validateGallerySearch } from "@/lib/gallery-search";

export const Route = createFileRoute("/family")({
  validateSearch: validateGallerySearch,
  component: FamilyPage,
});
