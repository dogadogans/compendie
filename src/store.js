// Data layer — reads/writes ~/compendie/data.json
// Schema: { collections: [...], items: [...] }

import {
  BaseDirectory, readTextFile, writeTextFile,
  mkdir, exists, writeFile, remove, readFile,
} from "@tauri-apps/plugin-fs";
import { v4 as uuidv4 } from "uuid";

const IMAGES_DIR = "compendie/images";
const DATA_FILE  = "compendie/data.json";

async function ensureDirs() {
  if (!(await exists("compendie",       { baseDir: BaseDirectory.Home })))
    await mkdir("compendie",       { baseDir: BaseDirectory.Home, recursive: true });
  if (!(await exists(IMAGES_DIR,   { baseDir: BaseDirectory.Home })))
    await mkdir(IMAGES_DIR,   { baseDir: BaseDirectory.Home, recursive: true });
}

async function loadData() {
  await ensureDirs();
  if (!(await exists(DATA_FILE, { baseDir: BaseDirectory.Home })))
    return { collections: [], items: [] };
  const raw    = await readTextFile(DATA_FILE, { baseDir: BaseDirectory.Home });
  const parsed = JSON.parse(raw);
  // Old formats (plain array or folders-based) → start fresh
  if (Array.isArray(parsed) || parsed.folders !== undefined)
    return { collections: [], items: [] };
  return parsed;
}

async function saveData(data) {
  await ensureDirs();
  await writeTextFile(DATA_FILE, JSON.stringify(data, null, 2), {
    baseDir: BaseDirectory.Home,
  });
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function loadItems() {
  return (await loadData()).items;
}

async function saveImage(bytes, originalName) {
  await ensureDirs();
  const ext      = originalName.split(".").pop() || "png";
  const filename = `${uuidv4()}.${ext}`;
  await writeFile(`${IMAGES_DIR}/${filename}`, bytes, { baseDir: BaseDirectory.Home });
  return `compendie/images/${filename}`;
}

export async function addItem({ imageBytes, originalName, title, tags, collections, note }) {
  const data      = await loadData();
  const imagePath = await saveImage(imageBytes, originalName);
  const item = {
    id:         uuidv4(),
    type:       "image",
    title:      title       || "",
    image_path: imagePath,
    tags:       tags        || [],
    collections: collections || [],
    note:       note        || "",
    created_at: new Date().toISOString(),
  };
  data.items.unshift(item);
  await saveData(data);
  return item;
}

export async function updateItem(id, changes) {
  const data = await loadData();
  const idx  = data.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error("Item not found");
  data.items[idx] = { ...data.items[idx], ...changes };
  await saveData(data);
  return data.items[idx];
}

export async function deleteItem(id) {
  const data = await loadData();
  const item = data.items.find((i) => i.id === id);
  if (!item) throw new Error("Item not found");
  if (item.type !== "flow") {
    try { await remove(item.image_path, { baseDir: BaseDirectory.Home }); }
    catch (e) { console.warn("Could not remove image file:", e); }
  }
  data.items = data.items.filter((i) => i.id !== id);
  await saveData(data);
}

// Takes a full array of item IDs in their new desired order.
// Reorders data.items to match, then saves.
export async function reorderItems(newOrderedIds) {
  const data = await loadData();
  const itemMap = new Map(data.items.map((i) => [i.id, i]));
  data.items = newOrderedIds
    .filter((id) => itemMap.has(id))
    .map((id) => itemMap.get(id));
  await saveData(data);
}

// Each screen: { id?: string, file?: File, image_path?: string, note?: string }
// screens with `file` → save to disk; screens with `image_path` → use as-is
export async function addFlow({ title, screens, tags, collections, note }) {
  const data = await loadData();
  const savedScreens = await Promise.all(
    screens.map(async (s) => {
      if (s.file) {
        const bytes = new Uint8Array(await s.file.arrayBuffer());
        const path  = await saveImage(bytes, s.file.name);
        return { id: s.id || uuidv4(), image_path: path, note: s.note || "" };
      }
      return { id: s.id || uuidv4(), image_path: s.image_path, note: s.note || "" };
    })
  );
  const item = {
    id:          uuidv4(),
    type:        "flow",
    title:       title       || "",
    screens:     savedScreens,
    tags:        tags        || [],
    collections: collections || [],
    note:        note        || "",
    created_at:  new Date().toISOString(),
  };
  data.items.unshift(item);
  await saveData(data);
  return item;
}

// Saves new screen Files to disk, keeps existing image_paths as-is.
// Pass the full screens array — order is preserved.
export async function updateFlow(id, { title, screens, tags, collections, note }) {
  const data = await loadData();
  const idx  = data.items.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error("Flow not found");
  const savedScreens = await Promise.all(
    screens.map(async (s) => {
      if (s.file) {
        const bytes = new Uint8Array(await s.file.arrayBuffer());
        const path  = await saveImage(bytes, s.file.name);
        return { id: s.id || uuidv4(), image_path: path, note: s.note || "" };
      }
      return { id: s.id || uuidv4(), image_path: s.image_path, note: s.note || "" };
    })
  );
  data.items[idx] = {
    ...data.items[idx],
    ...(title       !== undefined && { title }),
    ...(tags        !== undefined && { tags }),
    ...(collections !== undefined && { collections }),
    ...(note        !== undefined && { note }),
    screens: savedScreens,
  };
  await saveData(data);
  return data.items[idx];
}

export async function getImageUrl(imagePath) {
  const bytes = await readFile(imagePath, { baseDir: BaseDirectory.Home });
  return URL.createObjectURL(new Blob([bytes]));
}

// ─── Collections ──────────────────────────────────────────────────────────────

export async function loadCollections() {
  return (await loadData()).collections;
}

export async function addCollection({ name, icon = "📁", parentId = null }) {
  const data       = await loadData();
  const collection = {
    id:         uuidv4(),
    name,
    icon,
    parent_id:  parentId,
    archived:   false,
    created_at: new Date().toISOString(),
  };
  data.collections.push(collection);
  await saveData(data);
  return collection;
}

export async function updateCollection(id, changes) {
  const data = await loadData();
  const idx  = data.collections.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Collection not found");
  data.collections[idx] = { ...data.collections[idx], ...changes };
  await saveData(data);
  return data.collections[idx];
}

export async function archiveCollection(id) {
  return updateCollection(id, { archived: true });
}

export async function deleteCollection(id) {
  const data = await loadData();
  // Collect ids to remove: this collection + its sub-collections
  const toRemove = new Set([id]);
  data.collections.forEach((c) => { if (c.parent_id === id) toRemove.add(c.id); });
  data.collections = data.collections.filter((c) => !toRemove.has(c.id));
  // Strip removed collection ids from every item
  data.items = data.items.map((item) => ({
    ...item,
    collections: item.collections.filter((cid) => !toRemove.has(cid)),
  }));
  await saveData(data);
}
