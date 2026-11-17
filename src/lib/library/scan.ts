/**
 * Library scan: walk a ROM folder, detect each file's system, group the files
 * that belong together (cue+bin, gdi tracks, m3u discs), then collapse every
 * region / revision / format / dump of a game into one entry with a chosen best version.
 */
import type { CardDir } from "../fs"
import type { Rom } from "../spruce"
import { hashId } from "../suggest"
import type { DatIndex } from "./dat"
import { type ParsedName, parseName, titleKey, versionLabels } from "./names"
import type { CachedFile, LibrarySettings, ScanCache } from "./store"
import { EXT_SYSTEM, type SystemMatcher } from "./systems"
import { type ZipEntry, crc32, readZipIndex } from "./zip"

export interface LibFile {
  path: string // relative to the library root, "/"-separated
  dir: string
  name: string
  ext: string
  size: number
  system: string | null
  zip?: ZipEntry[] | null
  crc?: string
}

export interface Unit {
  main: LibFile
  files: LibFile[]
  parsed: ParsedName
  identified: boolean // matched a DAT entry
  /** Official name from the DAT, when identified by checksum. */
  datName?: string
  discs?: Unit[] // m3u playlists and grouped multi-disc sets
}

export interface Variant {
  id: string
  system: string
  units: Unit[] // one per disc
  parsed: ParsedName
  labels: string[]
  format: string
  size: number
  identified: boolean
  fromPlaylist: boolean
}

export interface LibGame {
  id: string
  system: string
  title: string
  key: string
  variants: Variant[]
  best: number
  onCard: boolean
  extra: boolean // every version is a beta/demo/hack
}

export interface UnrecognizedFolder {
  path: string
  files: number
}

export interface LibraryScan {
  name: string
  files: number
  games: LibGame[]
  unrecognized: UnrecognizedFolder[]
  systems: { id: string; label: string; count: number }[]
  duplicatesRemoved: number
  identified: number
}

export interface LibraryProgress {
  phase: "Listing files" | "Reading archives" | "Grouping games"
  files: number
  detail: string
}

const SKIP_DIRS = new Set(["imgs", "images", "boxart", "box art", "covers", "media", "snaps", "snap", "screenshots", "manuals", "videos", "bios", "saves", "states", "titles"])
const ARCHIVES = new Set([".zip", ".7z"])
const DISC_EXTS = new Set([".cue", ".gdi", ".m3u", ".chd", ".iso", ".pbp", ".cso", ".bin", ".img", ".cdi", ".mdf", ".ccd"])
const CONTAINERS = new Set([".cue", ".gdi", ".m3u"])
const ARCADE = new Set(["ARCADE", "FBNEO", "MAME2003PLUS", "NEOGEO", "CPS1", "CPS2", "CPS3", "NAOMI", "ATOMISWAVE"])
const FORMAT_RANK: Record<string, number> = { ".chd": 0, ".pbp": 1, ".m3u": 2, ".cue": 3, ".gdi": 3, ".iso": 4, ".cso": 4, ".zip": 5, ".7z": 6 }
const CHECKSUM_LIMIT = 64 * 1024 * 1024

const extOf = (n: string) => {
  const d = n.lastIndexOf(".")
  return d > 0 ? n.slice(d).toLowerCase() : ""
}
const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)

function systemForPath(dirParts: string[], matcher: SystemMatcher, folderMap: Record<string, string>) {
  for (let i = dirParts.length; i > 0; i--) {
    const p = dirParts.slice(0, i).join("/")
    if (folderMap[p]) return folderMap[p]
    const s = matcher.folder(dirParts[i - 1])
    if (s) return s
  }
  return null
}

/** Resolve "a/../b.bin" style references relative to a container's folder. */
function resolveRef(dir: string, ref: string) {
  const parts = [...(dir ? dir.split("/") : []), ...ref.replace(/\\/g, "/").split("/")]
  const out: string[] = []
  for (const p of parts) {
    if (!p || p === ".") continue
    if (p === "..") out.pop()
    else out.push(p)
  }
  return out.join("/")
}

function containerRefs(ext: string, text: string): string[] {
  if (ext === ".cue") return [...text.matchAll(/^\s*FILE\s+(?:"([^"]+)"|(\S+))/gim)].map((m) => m[1] ?? m[2])
  if (ext === ".m3u") return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  if (ext === ".gdi")
    return text
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.trim().match(/^\d+\s+\d+\s+\d+\s+\d+\s+(?:"([^"]+)"|(\S+))/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => m[1] ?? m[2])
  return []
}

export interface ScanInput {
  root: CardDir
  matcher: SystemMatcher
  settings: LibrarySettings
  dats: DatIndex
  cache: ScanCache
  cardRoms: Rom[]
  onProgress?: (p: LibraryProgress) => void
  signal?: AbortSignal
}

export async function scanLibrary(input: ScanInput): Promise<{ scan: LibraryScan; cache: ScanCache }> {
  const { root, matcher, settings, dats, cache, onProgress, signal } = input
  const files: LibFile[] = []
  const byPath = new Map<string, LibFile>()
  const handles = new Map<string, () => Promise<File | null>>()
  // Every file seen, ROM-like or not: cue sheets may point at .bin tracks a system doesn't list.
  const everything = new Map<string, { dir: string; name: string }>()
  const unrecognized = new Map<string, number>()
  const newCache: ScanCache = {}
  let lastTick = 0
  const tick = (phase: LibraryProgress["phase"], detail: string) => {
    const now = performance.now()
    if (now - lastTick > 120) {
      lastTick = now
      onProgress?.({ phase, files: files.length, detail })
    }
  }

  // 1. Walk.
  const walk = async (dir: CardDir, parts: string[]) => {
    for (const e of await dir.list()) {
      if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError")
      if (e.kind === "directory") {
        if (e.name.startsWith("._") || SKIP_DIRS.has(e.name.toLowerCase())) continue
        const sub = await dir.dir(e.name)
        if (sub) await walk(sub, [...parts, e.name])
        continue
      }
      if (e.name.startsWith(".")) continue
      const ext = extOf(e.name)
      const dirPath = parts.join("/")
      const anyPath = join(dirPath, e.name)
      everything.set(anyPath.toLowerCase(), { dir: dirPath, name: e.name })
      handles.set(anyPath, () => dir.file(e.name))
      const system = systemForPath(parts, matcher, settings.folderMap)
      if (system === "ignore") continue
      let sys = system
      const romLike = sys
        ? matcher.accepts(sys, ext) || ARCHIVES.has(ext) || CONTAINERS.has(ext)
        : !!EXT_SYSTEM[ext] || ARCHIVES.has(ext) || DISC_EXTS.has(ext)
      if (!romLike) continue
      if (!sys) sys = EXT_SYSTEM[ext] ?? null
      const path = join(dirPath, e.name)
      const f: LibFile = { path, dir: dirPath, name: e.name, ext, size: 0, system: sys }
      files.push(f)
      byPath.set(path.toLowerCase(), f)
      tick("Listing files", dirPath || root.name)
    }
  }
  await walk(root, [])

  // 2. Sizes, zip indexes and (optionally) checksums — reused from the cache when size and date match.
  for (const f of files) {
    if (signal?.aborted) throw new DOMException("Scan cancelled", "AbortError")
    const file = await handles.get(f.path)!()
    if (!file) continue
    f.size = file.size
    const prev: CachedFile | undefined = cache[f.path]
    const fresh = prev && prev.size === file.size && prev.mtime === file.lastModified
    const entry: CachedFile = { size: file.size, mtime: file.lastModified }
    if (f.ext === ".zip") {
      entry.zip = fresh && prev!.zip !== undefined ? prev!.zip : await readZipIndex(file).catch(() => null)
      f.zip = entry.zip
      if (!f.system && f.zip?.length) {
        const inner = EXT_SYSTEM[extOf(f.zip[0].name)]
        if (inner) f.system = inner
      }
    } else if (dats.size && settings.checksumLoose && file.size <= CHECKSUM_LIMIT && !CONTAINERS.has(f.ext)) {
      entry.crc = fresh && prev!.crc ? prev!.crc : await crc32(file)
      f.crc = entry.crc
    } else if (fresh && prev!.crc) {
      f.crc = prev!.crc
      entry.crc = prev!.crc
    }
    newCache[f.path] = entry
    tick("Reading archives", f.path)
  }

  // Files whose system is still unknown are reported, not guessed.
  for (const f of files) if (!f.system) unrecognized.set(f.dir || "(library root)", (unrecognized.get(f.dir || "(library root)") ?? 0) + 1)
  const known = files.filter((f) => f.system)

  // 3. Containers claim the files they reference.
  const claimed = new Set<LibFile>()
  const refs = new Map<LibFile, LibFile[]>()
  for (const f of known) {
    if (!CONTAINERS.has(f.ext) || f.size > 256 * 1024) continue
    const text = await (await handles.get(f.path)!())?.text()
    if (!text) continue
    const list: LibFile[] = []
    for (const r of containerRefs(f.ext, text)) {
      const key = resolveRef(f.dir, r).toLowerCase()
      let x = byPath.get(key)
      if (!x) {
        const any = everything.get(key)
        if (!any) continue
        const path = join(any.dir, any.name)
        x = { path, dir: any.dir, name: any.name, ext: extOf(any.name), size: (await handles.get(path)!())?.size ?? 0, system: f.system }
        byPath.set(key, x)
      }
      list.push(x)
    }
    refs.set(f, list)
    list.forEach((x) => claimed.add(x))
  }
  const filesOf = (f: LibFile, seen = new Set<LibFile>()): LibFile[] => {
    if (seen.has(f)) return []
    seen.add(f)
    return [f, ...(refs.get(f) ?? []).flatMap((x) => filesOf(x, seen))]
  }

  // 4. Units, named from the DAT when the checksum is known.
  let identified = 0
  const makeUnit = (f: LibFile): Unit => {
    let name = f.name
    let isIdentified = false
    const crc = f.zip?.length === 1 ? f.zip[0].crc : f.crc
    const hit = crc ? dats.byCrc(crc) : undefined
    if (hit) {
      name = hit.game
      isIdentified = true
    } else if (f.system && ARCADE.has(f.system)) {
      const t = dats.setTitle(f.name.replace(/\.[^.]+$/, ""))
      if (t) {
        name = t
        isIdentified = true
      }
    }
    if (isIdentified) identified++
    return { main: f, files: filesOf(f), parsed: parseName(name), identified: isIdentified, datName: hit ? stripDatExt(hit.game) : undefined }
  }

  onProgress?.({ phase: "Grouping games", files: files.length, detail: "" })
  const units: Unit[] = []
  for (const f of known) {
    if (claimed.has(f)) continue
    const u = makeUnit(f)
    if (f.ext === ".m3u") {
      u.discs = (refs.get(f) ?? []).map(makeUnit)
      u.files = filesOf(f)
    }
    units.push(u)
  }

  // 5. Discs of one release → one variant.
  const variants: Variant[] = []
  const discSets = new Map<string, Unit[]>()
  for (const u of units) {
    if (u.discs?.length) {
      variants.push(toVariant(u.main.system!, u.discs, u, true))
      continue
    }
    if (u.parsed.disc != null) {
      const sig = `${u.main.system}|${u.main.dir}|${u.parsed.key}|${u.parsed.tags.filter((t) => !/^dis[ck]\s*\d/i.test(t)).join("|")}|${u.main.ext}`
      const l = discSets.get(sig)
      if (l) l.push(u)
      else discSets.set(sig, [u])
      continue
    }
    variants.push(toVariant(u.main.system!, [u], u, false))
  }
  for (const set of discSets.values()) {
    set.sort((a, b) => (a.parsed.disc ?? 0) - (b.parsed.disc ?? 0))
    variants.push(toVariant(set[0].main.system!, set, set[0], false))
  }

  // 6. Versions of one game → one entry.
  const groups = new Map<string, Variant[]>()
  for (const v of variants) {
    const k = `${v.system}|${v.parsed.key}`
    const l = groups.get(k)
    if (l) l.push(v)
    else groups.set(k, [v])
  }

  const cardKeys = new Set<string>()
  for (const r of input.cardRoms) {
    cardKeys.add(`${r.systemId}|${parseName(r.fileName).key}`)
    cardKeys.add(`${r.systemId}|${titleKey(r.name)}`)
  }

  const games: LibGame[] = []
  for (const [k, vs] of groups) {
    const [system, key] = [k.slice(0, k.indexOf("|")), k.slice(k.indexOf("|") + 1)]
    const best = pickBest(vs, settings)
    const extra = vs.every((v) => v.parsed.extra || v.parsed.broken)
    games.push({
      id: hashId(k),
      system,
      key,
      title: vs[best].parsed.title,
      variants: vs,
      best,
      onCard: cardKeys.has(k),
      extra,
    })
  }
  games.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }))

  const counts = new Map<string, number>()
  for (const g of games) counts.set(g.system, (counts.get(g.system) ?? 0) + 1)
  const systems = [...counts]
    .map(([id, count]) => ({ id, label: matcher.label(id), count }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return {
    scan: {
      name: root.name,
      files: files.length,
      games,
      unrecognized: [...unrecognized].map(([path, n]) => ({ path, files: n })).sort((a, b) => b.files - a.files),
      systems,
      duplicatesRemoved: variants.length - games.length,
      identified,
    },
    cache: newCache,
  }
}

const stripDatExt = (n: string) => n.replace(/\.(gba|gb|gbc|nes|sfc|smc|md|gen|n64|z64|nds|pce|gg|sms|bin|iso|cue|chd)$/i, "")

function toVariant(system: string, discs: Unit[], head: Unit, fromPlaylist: boolean): Variant {
  const parsed = { ...head.parsed }
  if (fromPlaylist && discs[0]) Object.assign(parsed, { ...discs[0].parsed, disc: null })
  const size = (fromPlaylist ? [head] : discs).flatMap((u) => u.files).reduce((n, f) => n + f.size, 0)
  const labels = versionLabels(parsed)
  const format = (discs[0] ?? head).main.ext.replace(".", "").toUpperCase()
  labels.push(format)
  if (discs.length > 1) labels.push(`${discs.length} discs`)
  return {
    id: hashId(`${system}|${head.main.path}`),
    system,
    units: discs,
    parsed,
    labels,
    format,
    size,
    identified: discs.every((d) => d.identified),
    fromPlaylist,
  }
}

/** Pick the version to copy: no bad dumps, no betas/hacks if avoidable, preferred region, latest revision, best format. */
export function pickBest(vs: Variant[], s: LibrarySettings) {
  const regionScore = (v: Variant) => {
    const order = s.regionOrder
    let best = v.parsed.regions.length ? order.length : order.length + 1
    for (const r of v.parsed.regions) {
      const i = order.indexOf(r)
      if (i >= 0) best = Math.min(best, i)
    }
    if (v.parsed.translated && s.preferTranslations) best = Math.min(best, Math.max(0, order.indexOf("Japan")) - 0.5)
    return best
  }
  const score = (v: Variant): number[] => [
    v.parsed.broken ? 1 : 0,
    v.parsed.extra ? 1 : 0,
    v.parsed.translated && !s.preferTranslations ? 1 : 0,
    regionScore(v),
    -v.units.length, // complete multi-disc sets first
    v.identified || v.parsed.verified ? 0 : 1,
    -v.parsed.revision,
    FORMAT_RANK[`.${v.format.toLowerCase()}`] ?? 9,
    v.size,
  ]
  let bestI = 0
  let bestS = score(vs[0])
  for (let i = 1; i < vs.length; i++) {
    const sc = score(vs[i])
    for (let k = 0; k < sc.length; k++) {
      if (sc[k] === bestS[k]) continue
      if (sc[k] < bestS[k]) {
        bestI = i
        bestS = sc
      }
      break
    }
  }
  return bestI
}

/** Re-pick best versions after the user changes region order or filters, without rescanning. */
export function rechoose(scan: LibraryScan, s: LibrarySettings): LibraryScan {
  return { ...scan, games: scan.games.map((g) => ({ ...g, best: pickBest(g.variants, s), title: g.variants[pickBest(g.variants, s)].parsed.title })) }
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  const u = ["KB", "MB", "GB", "TB"]
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < u.length - 1)
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${u[i]}`
}
