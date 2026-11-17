/**
 * SpruceOS adapter. Mirrors PyUI's own rules (spruceOS v4.4.x, App/PyUI/main-ui):
 *  - systems come from Emu/<SYS>/config.json; the folder name is the system id
 *  - ROM folders are Roms/<SYS> plus config.alternativeFolderNames
 *  - a file is a ROM when its extension is in config.extlist (empty extlist =
 *    anything but .xml/.txt/.db); dot-files, Imgs/ and config.ignoreList are skipped
 *  - collections live in Collections/collections.json as
 *    [{ collection_name, game_list: [{ rom_file_path, game_system_name }] }]
 *  - collection covers live in Collections/Imgs/<collection_name>.png
 */
import { type CardDir, readText, resolveDir } from "./fs"

export const DEVICE_ROOT = "/mnt/SDCARD"
export const COLLECTIONS_DIR = "Collections"
export const COLLECTIONS_FILE = "collections.json"

export interface GameSystem {
  id: string // Emu folder name, e.g. "GBC" — what PyUI stores as game_system_name
  label: string
  folders: string[] // existing folders under Roms/ that belong to this system
  extlist: Set<string> // ".gb", ".zip"…
  themeColor?: string
  romCount: number
}

export interface Rom {
  /** Absolute path as the device sees it — the identity used in collections.json. */
  path: string
  /** Path relative to the card root, for reading files in the browser. */
  cardPath: string
  systemId: string
  fileName: string
  /** Name shown on the device: gamelist.xml name, else filename minus known extensions. */
  name: string
  /** Card-relative candidates for box art, best first. */
  art: string[]
  /** Genre from gamelist.xml, when the card has one. */
  genre?: string
}

export interface CardInfo {
  version: string | null
  hasPyUI: boolean
}

export interface ScanResult {
  info: CardInfo
  systems: GameSystem[]
  roms: Rom[]
  byPath: Map<string, Rom>
}

export class NotSpruceError extends Error {}

type EmuConfig = {
  label?: string
  extlist?: string
  alternativeFolderNames?: string[]
  ignoreList?: string[]
  scanSubfolders?: boolean
  themecolor?: string
}

export function toDevicePath(cardPath: string) {
  return `${DEVICE_ROOT}/${cardPath}`
}

export function baseName(path: string) {
  return path.slice(path.lastIndexOf("/") + 1)
}

/** PyUI RomFileNameUtils: strip extensions while they are in the system's extlist. */
export function stripKnownExtensions(fileName: string, extlist: Set<string>) {
  let base = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName
  for (;;) {
    const dot = base.lastIndexOf(".")
    if (dot <= 0) break
    const ext = base.slice(dot).toLowerCase()
    if (!extlist.has(ext)) break
    base = base.slice(0, dot)
  }
  return base
}

export async function detectCard(root: CardDir): Promise<CardInfo> {
  const names = new Set((await root.list()).map((e) => e.name))
  const hasEmu = names.has("Emu") || names.has("Emus")
  if (!names.has("Roms") || !hasEmu) {
    if (["GB", "GBA", "SFC", "PS", "FC", "MD"].some((n) => names.has(n)))
      throw new NotSpruceError("This looks like the Roms folder. Pick the root of the SD card instead.")
    throw new NotSpruceError("No Roms and Emu folders here. Pick the root of a spruceOS SD card.")
  }
  const version = (await readText(root, "spruce/spruce"))?.trim().split(/\s+/)[0] ?? null
  const hasPyUI = !!(await resolveDir(root, "App/PyUI"))
  return { version: version && /^\d+\.\d+/.test(version) ? version : null, hasPyUI }
}

type Gamelist = Map<string, { name?: string; image?: string; genre?: string }>

function parseGamelist(xml: string): Gamelist {
  const out: Gamelist = new Map()
  try {
    const doc = new DOMParser().parseFromString(xml, "application/xml")
    for (const g of Array.from(doc.getElementsByTagName("game"))) {
      const p = g.getElementsByTagName("path")[0]?.textContent?.trim()
      if (!p) continue
      const key = p.replace(/^\.\//, "")
      const name = g.getElementsByTagName("name")[0]?.textContent?.trim() || undefined
      const image = g.getElementsByTagName("image")[0]?.textContent?.trim().replace(/^\.\//, "") || undefined
      const genre = g.getElementsByTagName("genre")[0]?.textContent?.trim() || undefined
      out.set(key, { name, image, genre })
    }
  } catch {
    /* a broken gamelist just means filenames are used */
  }
  return out
}

export interface ScanProgress {
  system: string
  done: number
  total: number
  roms: number
}

export async function scanCard(root: CardDir, onProgress?: (p: ScanProgress) => void): Promise<ScanResult> {
  const info = await detectCard(root)
  const emu = (await root.dir("Emu")) ?? (await root.dir("Emus"))
  const romsRoot = await root.dir("Roms")
  if (!emu || !romsRoot) throw new NotSpruceError("Missing Emu or Roms folder.")

  const romFolderNames = new Set(
    (await romsRoot.list()).filter((e) => e.kind === "directory").map((e) => e.name),
  )
  const emuDirs = (await emu.list()).filter((e) => e.kind === "directory" && !e.name.startsWith("."))

  const systems: GameSystem[] = []
  const roms: Rom[] = []
  let done = 0

  for (const { name: id } of emuDirs) {
    done++
    const sysDir = await emu.dir(id)
    const raw = sysDir ? await (await sysDir.file("config.json"))?.text() : null
    if (!raw) continue
    let cfg: EmuConfig
    try {
      cfg = JSON.parse(raw)
    } catch {
      continue // PyUI skips systems with a broken config.json too
    }
    const extlist = new Set(
      (cfg.extlist ?? "")
        .toLowerCase()
        .split("|")
        .filter(Boolean)
        .map((e) => `.${e}`),
    )
    const ignore = new Set(cfg.ignoreList ?? [])
    const scanSub = cfg.scanSubfolders ?? true
    const folders = [id, ...(cfg.alternativeFolderNames ?? [])].filter(
      (f, i, a) => romFolderNames.has(f) && a.indexOf(f) === i,
    )
    if (!folders.length) continue

    onProgress?.({ system: cfg.label ?? id, done, total: emuDirs.length, roms: roms.length })
    const sysRoms: Rom[] = []

    for (const folder of folders) {
      const dir = await romsRoot.dir(folder)
      if (!dir) continue
      const gamelistXml =
        (await (await dir.file("miyoogamelist.xml"))?.text()) ?? (await (await dir.file("gamelist.xml"))?.text())
      const gamelist = gamelistXml ? parseGamelist(gamelistXml) : new Map()

      const walk = async (d: CardDir, rel: string[]) => {
        for (const e of await d.list()) {
          if (e.name.startsWith(".")) continue
          if (e.kind === "directory") {
            if (!scanSub || e.name === "Imgs") continue
            const sub = await d.dir(e.name)
            if (sub) await walk(sub, [...rel, e.name])
            continue
          }
          const dot = e.name.lastIndexOf(".")
          const suffix = dot >= 0 ? e.name.slice(dot).toLowerCase() : ""
          const ok = extlist.size ? extlist.has(suffix) : ![".xml", ".txt", ".db"].includes(suffix)
          if (!ok || ignore.has(e.name)) continue

          const inFolder = [...rel, e.name].join("/")
          const cardPath = `Roms/${folder}/${inFolder}`
          const gl = gamelist.get(inFolder)
          const base = stripKnownExtensions(e.name, extlist)
          const art = [`Roms/${folder}/Imgs/${[...rel, base].join("/")}.png`]
          if (gl?.image) art.unshift(`Roms/${folder}/${gl.image}`)
          sysRoms.push({
            path: toDevicePath(cardPath),
            cardPath,
            systemId: id,
            fileName: e.name,
            name: gl?.name || base,
            art,
            genre: gl?.genre,
          })
        }
      }
      await walk(dir, [])
    }

    if (!sysRoms.length) continue
    sysRoms.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }))
    roms.push(...sysRoms)
    systems.push({
      id,
      label: cfg.label ?? id,
      folders,
      extlist,
      themeColor: cfg.themecolor ? `#${cfg.themecolor.replace("#", "")}` : undefined,
      romCount: sysRoms.length,
    })
  }

  systems.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
  const order = new Map(systems.map((s, i) => [s.id, i]))
  roms.sort((a, b) => order.get(a.systemId)! - order.get(b.systemId)!) // stable: keeps name order inside a system
  return { info, systems, roms, byPath: new Map(roms.map((r) => [r.path, r])) }
}

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

export interface CollectionEntry {
  rom_file_path: string
  game_system_name: string
}

export interface Collection {
  /** Local id only; never written to the card. */
  uid: string
  name: string
  games: CollectionEntry[]
  /** Name this collection had on the card when loaded (null = new). Used for cover renames and the diff. */
  originalName: string | null
}

export interface LoadedCollections {
  collections: Collection[]
  /** Raw file text as read, used to detect changes made elsewhere before writing. */
  snapshot: string | null
  warnings: string[]
}

let uidCounter = 0
export const newUid = () => `c${Date.now().toString(36)}${(uidCounter++).toString(36)}`

export async function loadCollections(root: CardDir): Promise<LoadedCollections> {
  const text = await readText(root, `${COLLECTIONS_DIR}/${COLLECTIONS_FILE}`)
  if (text == null) return { collections: [], snapshot: null, warnings: [] }
  if (!text.trim()) return { collections: [], snapshot: text, warnings: [] }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return {
      collections: [],
      snapshot: text,
      warnings: ["collections.json is not valid JSON. Saving will replace it; a backup is kept."],
    }
  }
  if (!Array.isArray(data)) {
    return { collections: [], snapshot: text, warnings: ["collections.json is not a list. Saving will replace it; a backup is kept."] }
  }

  const warnings: string[] = []
  const collections: Collection[] = []
  for (const c of data) {
    if (!c || typeof c.collection_name !== "string") {
      warnings.push("Skipped a collection without a name.")
      continue
    }
    const games: CollectionEntry[] = Array.isArray(c.game_list)
      ? c.game_list
          .filter((g: unknown): g is CollectionEntry => {
            const x = g as CollectionEntry
            return !!x && typeof x.rom_file_path === "string" && typeof x.game_system_name === "string"
          })
          .map((g: CollectionEntry) => ({ rom_file_path: g.rom_file_path, game_system_name: g.game_system_name }))
      : []
    collections.push({ uid: newUid(), name: c.collection_name, games, originalName: c.collection_name })
  }
  return { collections, snapshot: text, warnings }
}

/** Exactly the shape PyUI's CollectionsManager.save_to_file() writes (indent 4). */
export function serializeCollections(collections: Collection[]) {
  return JSON.stringify(
    collections.map((c) => ({
      collection_name: c.name,
      game_list: c.games.map((g) => ({ rom_file_path: g.rom_file_path, game_system_name: g.game_system_name })),
    })),
    null,
    4,
  )
}

/** Order the device uses when listing a collection: by file name, case-insensitive. */
export function deviceOrder<T extends { rom_file_path: string }>(games: T[]) {
  return [...games].sort((a, b) => {
    const x = baseName(a.rom_file_path).toLowerCase()
    const y = baseName(b.rom_file_path).toLowerCase()
    return x < y ? -1 : x > y ? 1 : 0
  })
}

const BAD_NAME = /[\\/:*?"<>|]/

export function validateName(name: string, others: Collection[], selfUid?: string): string | null {
  const n = name.trim()
  if (!n) return "Give the collection a name."
  if (n.length > 60) return "Keep the name under 60 characters."
  if (BAD_NAME.test(n)) return 'Names can\'t contain \\ / : * ? " < > |'
  if (n.startsWith(".")) return "Names can't start with a dot."
  // Covers are files on a FAT card, so names that differ only in case would collide.
  if (others.some((c) => c.uid !== selfUid && c.name.toLowerCase() === n.toLowerCase()))
    return "A collection with that name already exists."
  return null
}

export interface SavePlan {
  json: string
  covers: { name: string; blob: Blob }[]
  coverRenames: { from: string; to: string }[]
}

export class ConflictError extends Error {}

function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/**
 * Write collections.json safely:
 *  1. re-read the file and refuse if it changed since it was loaded (device or another tab wrote it)
 *  2. keep a timestamped backup of the old file
 *  3. write the new file (FSA writes to a swap file and swaps on close)
 *  4. write / rename cover images
 */
export async function saveCollections(
  root: CardDir,
  plan: SavePlan,
  snapshot: string | null,
  opts: { force?: boolean } = {},
): Promise<{ snapshot: string; backup: string | null }> {
  const current = await readText(root, `${COLLECTIONS_DIR}/${COLLECTIONS_FILE}`)
  if (!opts.force && current !== snapshot) {
    throw new ConflictError("collections.json changed on the card since you opened it.")
  }
  const dir = await root.ensureDir(COLLECTIONS_DIR)
  let backup: string | null = null
  if (current && current.trim() && current !== plan.json) {
    backup = `${COLLECTIONS_FILE}.bak-${stamp()}`
    await dir.write(backup, current)
  }
  await dir.write(COLLECTIONS_FILE, plan.json)

  if (plan.covers.length || plan.coverRenames.length) {
    const imgs = await dir.ensureDir("Imgs")
    for (const r of plan.coverRenames) {
      const f = await imgs.file(`${r.from}.png`)
      if (!f) continue
      await imgs.write(`${r.to}.png`, f)
      if (r.from.toLowerCase() !== r.to.toLowerCase()) await imgs.remove(`${r.from}.png`).catch(() => {})
    }
    for (const c of plan.covers) await imgs.write(`${c.name}.png`, c.blob)
  }
  return { snapshot: plan.json, backup }
}
