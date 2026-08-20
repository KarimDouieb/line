/** Shared `id`/`name` URL search-param shape for /draw and /family — see useGalleryUrlSync. */
export type GallerySearch = { id?: string; name?: string };

export function validateGallerySearch(search: Record<string, unknown>): GallerySearch {
  return {
    id: typeof search.id === "string" ? search.id : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
  };
}
