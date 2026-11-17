import { openDB } from "idb"
import type { DatFile } from "./dat"
import type { ZipEntry } from "./zip"

/** Everything the Library tool keeps between visits, in this browser only. */
const dbp =
  typeof indexedDB !== "undefined"
    ? openDB("spruce-library", 1, {
        upgrade(db) {
          db.createObjectStore("kv")
          db.createObjectStore("dats", { keyPath: "id" })
          db.createObjectStore("cache")
        },
      })
    : null

export interface LibrarySettings {
  regionOrder: string[]
  preferTranslations: boolean
  showExtras: boolean
  hideOnCard: boolean
  cardCapacityGB: number | null
  checksumLoose: boolean
  /** folder path (relative to library root) → system id, or "ignore" */
  folderMap: Record<string, string>
}

export const DEFAULT_SETTINGS: LibrarySettings = {
  regionOrder: ["USA", "World", "Europe", "Japan"],
  preferTranslations: true,
  showExtras: false,
  hideOnCard: true,
  cardCapacityGB: null,
  checksumLoose: false,
  folderMap: {},
}

export async function loadSettings(): Promise<LibrarySettings> {
  try {
    const s = (await (await dbp)?.get("kv", "settings")) as Partial<LibrarySettings> | undefined
    return { ...DEFAULT_SETTINGS, ...s, folderMap: { ...(s?.folderMap ?? {}) } }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function saveSettings(s: LibrarySettings) {
  try {
    await (await dbp)?.put("kv", s, "settings")
  } catch {
    /* not critical */
  }
}

export async function rememberLibrary(h: FileSystemDirectoryHandle) {
  try {
    await (await dbp)?.put("kv", h, "library")
  } catch {
    /* not critical */
  }
}

export async function recallLibrary(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return ((await (await dbp)?.get("kv", "library")) as FileSystemDirectoryHandle | undefined) ?? null
  } catch {
    return null
  }
}

export async function loadDats(): Promise<DatFile[]> {
  try {
    return ((await (await dbp)?.getAll("dats")) as DatFile[]) ?? []
  } catch {
    return []
  }
}
export async function addDat(d: DatFile) {
  await (await dbp)?.put("dats", d)
}
export async function removeDat(id: string) {
  await (await dbp)?.delete("dats", id)
}

export interface CachedFile {
  size: number
  mtime: number
  zip?: ZipEntry[] | null
  crc?: string
}
export type ScanCache = Record<string, CachedFile>

export async function loadCache(libraryName: string): Promise<ScanCache> {
  try {
    return ((await (await dbp)?.get("cache", libraryName)) as ScanCache | undefined) ?? {}
  } catch {
    return {}
  }
}
export async function saveCache(libraryName: string, cache: ScanCache) {
  try {
    await (await dbp)?.put("cache", cache, libraryName)
  } catch {
    /* a full disk just means a slower next scan */
  }
}
