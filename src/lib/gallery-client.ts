import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { serializeLineFile, parseLineFile, type LineFileData } from "@/lib/line-file";

const client = generateClient<Schema>();

export type GalleryItem = { id: string; name: string; data: LineFileData };

/** Persists the current line + its family/vessel/adapt/layout selection to the signed-in user's gallery. */
export async function saveToGallery(name: string, data: LineFileData): Promise<void> {
  const { errors } = await client.models.Line.create({ name, data: serializeLineFile(data) });
  if (errors) throw new Error(errors[0]?.message ?? "couldn't save");
}

/** Lists the signed-in user's saved lines, newest first. Entries that fail to parse are silently dropped. */
export async function listGallery(): Promise<GalleryItem[]> {
  const { data: items, errors } = await client.models.Line.list();
  if (errors) throw new Error(errors[0]?.message ?? "couldn't load gallery");

  const parsed: (GalleryItem & { createdAt: string })[] = [];
  for (const item of items) {
    const data = parseLineFile(item.data);
    if (data) parsed.push({ id: item.id, name: item.name ?? "untitled", data, createdAt: item.createdAt });
  }
  return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Fetches one gallery entry by id — used to reopen a line linked to directly by URL (e.g. after a refresh). */
export async function getGalleryItem(id: string): Promise<GalleryItem | null> {
  const { data: item, errors } = await client.models.Line.get({ id });
  if (errors || !item) return null;
  const data = parseLineFile(item.data);
  if (!data) return null;
  return { id: item.id, name: item.name ?? "untitled", data };
}

/** Overwrites an already-saved gallery entry in place — used by the draw/family "save" button once it's dirty. */
export async function updateGalleryItem(id: string, name: string, data: LineFileData): Promise<void> {
  const { errors } = await client.models.Line.update({ id, name, data: serializeLineFile(data) });
  if (errors) throw new Error(errors[0]?.message ?? "couldn't save");
}

/** Renames a gallery entry without touching its saved curve/data. */
export async function renameGalleryItem(id: string, name: string): Promise<void> {
  const { errors } = await client.models.Line.update({ id, name });
  if (errors) throw new Error(errors[0]?.message ?? "couldn't rename");
}
