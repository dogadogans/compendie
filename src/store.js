// Data layer — reads/writes ~/tome/data.json
// Schema: { collections: [...], items: [...] }

import {
  BaseDirectory, readTextFile, writeTextFile,
  mkdir, exists, writeFile, remove, readFile,
} from "@tauri-apps/plugin-fs";
import { v4 as uuidv4 } from "uuid";

const IMAGES_DIR = "tome/images";
const DATA_FILE  = "tome/data.json";

async function ensureDirs() {
  if (!(await exists("tome",       { baseDir: BaseDirectory.Home })))
    await mkdir("tome",       { baseDir: BaseDirectory.Home, recursive: true });
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
  return `tome/images/${filename}`;
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
  try { await remove(item.image_path, { baseDir: BaseDirectory.Home }); }
  catch (e) { console.warn("Could not remove image file:", e); }
  data.items = data.items.filter((i) => i.id !== id);
  await saveData(data);
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
