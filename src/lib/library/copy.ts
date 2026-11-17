/**
 * Copy games from the library to the card the way spruceOS expects:
 *  - Roms/<system folder>/<file>
 *  - multi-disc games: discs in a hidden ".<Title>" folder plus "<Title>.m3u"
 *    (PyUI skips dot-folders, so only the playlist shows up)
 *  - box art (when the library has it) to Roms/<system>/Imgs/<name>.png
 * Files already on the card with the same size are skipped, so a stopped copy can be resumed.
 */
import { loadImage } from "../art"
import { type CardDir, ensureDirPath, resolveDir, resolveFile } from "../fs"
import type { EmuInfo } from "../spruce"
import { stripExt } from "./names"
import type { LibFile, LibGame, Variant } from "./scan"
import { BIOS_NEEDS } from "./systems"

const FAT32_MAX = 4 * 1024 ** 3 - 1
const BAD_CHARS = /[\\/:*?"<>|]/g
const sanitize = (n: string) => n.replace(BAD_CHARS, "_")

export interface CopyFile {
  src: string // library-relative
  dest: string // card-relative
  size: number
}

export interface CopyJob {
  game: LibGame
  variant: Variant
  files: CopyFile[]
  playlist?: { dest: string; content: string }
  art: { candidates: string[]; dest: string }
  /** Card path of the file the handheld lists (used for collections). */
  mainDest: string
  size: number
  warnings: string[]
  blocked: string | null
}

const ART_DIRS = ["Imgs", "imgs", "boxart", "Boxart", "covers", "Covers", "images", "Images", "media/box2dfront", "Named_Boxarts"]

export function planCopy(game: LibGame, variant: Variant, emu: EmuInfo[]): CopyJob {
  const sys = emu.find((e) => e.id === variant.system)
  const job: CopyJob = {
    game,
    variant,
    files: [],
    art: { candidates: [], dest: "" },
    mainDest: "",
    size: variant.size,
    warnings: [],
    blocked: null,
  }
  if (!sys) {
    job.blocked = `spruceOS on this card has no emulator for ${variant.system}.`
    return job
  }
  const target = `Roms/${sys.folder ?? sys.id}`
  const discs = variant.units
  const usePlaylist = discs.length > 1 && sys.extlist.has(".m3u")
  const renamed = (f: LibFile) => sanitize(f.name) !== f.name

  if (usePlaylist) {
    const base = sanitize(stripExt(discs[0].main.name).replace(/\s*\(Dis[ck]\s*\d+[^)]*\)/i, "").trim())
    const hidden = `.${base}`
    const lines: string[] = []
    for (const d of discs) {
      for (const f of d.files) job.files.push({ src: f.path, dest: `${target}/${hidden}/${sanitize(f.name)}`, size: f.size })
      lines.push(`${hidden}/${sanitize(d.main.name)}`)
    }
    job.playlist = { dest: `${target}/${base}.m3u`, content: lines.join("\n") + "\n" }
    job.mainDest = job.playlist.dest
  } else {
    for (const d of discs)
      for (const f of d.files) {
        // A checksum-identified single file gets its official name ("gs2.zip" → "Golden Sun - The Lost Age (USA, Europe).zip").
        const name = d.datName && d.files.length === 1 ? `${d.datName}${f.ext}` : f.name
        job.files.push({ src: f.path, dest: `${target}/${sanitize(name)}`, size: f.size })
      }
    job.mainDest = job.files[0]?.dest ?? ""
    if (discs.length > 1) job.warnings.push("This system has no playlist support, so each disc shows up on its own.")
  }

  if (discs.some((d) => d.files.some(renamed))) job.warnings.push("Some file names had characters the card can't store and were changed.")
  if (job.files.some((f) => f.size > FAT32_MAX)) job.warnings.push("A file is over 4 GB. That only works on exFAT cards, not FAT32.")

  const head = discs[0].main
  const libBase = stripExt(head.name).replace(/\s*\(Dis[ck]\s*\d+[^)]*\)/i, "")
  const destBase = stripExt(job.mainDest.split("/").pop() ?? "")
  for (const dir of ART_DIRS)
    for (const ext of [".png", ".jpg", ".jpeg"]) {
      job.art.candidates.push(`${head.dir ? head.dir + "/" : ""}${dir}/${stripExt(head.name)}${ext}`)
      if (libBase !== stripExt(head.name)) job.art.candidates.push(`${head.dir ? head.dir + "/" : ""}${dir}/${libBase}${ext}`)
    }
  job.art.dest = `${target}/Imgs/${destBase}.png`
  return job
}

/** BIOS files the card is missing for these systems. */
export async function missingBios(card: CardDir, systems: string[]): Promise<{ system: string; note: string }[]> {
  const out: { system: string; note: string }[] = []
  const bios = await resolveDir(card, "BIOS")
  for (const s of new Set(systems)) {
    const need = BIOS_NEEDS[s]
    if (!need) continue
    let ok = !!bios
    if (bios) {
      for (const anyOf of need.files) {
        let found = false
        for (const f of anyOf) if (await resolveFile(card, `BIOS/${f}`)) found = true
        if (!found) ok = false
      }
    }
    if (!ok) out.push({ system: s, note: need.note })
  }
  return out
}

async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const c = document.createElement("canvas")
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext("2d")!.drawImage(img, 0, 0)
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface CopyProgress {
  done: number // bytes
  total: number
  job: number
  jobs: number
  current: string
}

export interface CopyResult {
  job: CopyJob
  status: "copied" | "skipped" | "failed"
  error?: string
}

export async function runCopy(
  card: CardDir,
  library: CardDir,
  jobs: CopyJob[],
  onProgress: (p: CopyProgress) => void,
  signal: AbortSignal,
): Promise<CopyResult[]> {
  const total = jobs.reduce((n, j) => n + j.size, 0)
  let done = 0
  const results: CopyResult[] = []
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    if (job.blocked) {
      results.push({ job, status: "failed", error: job.blocked })
      continue
    }
    let copiedAny = false
    try {
      for (const f of job.files) {
        if (signal.aborted) throw new DOMException("Copy cancelled", "AbortError")
        onProgress({ done, total, job: i, jobs: jobs.length, current: f.dest.split("/").pop()! })
        const parts = f.dest.split("/")
        const name = parts.pop()!
        const dir = await ensureDirPath(card, parts.join("/"))
        const existing = await dir.file(name)
        if (existing && existing.size === f.size) {
          done += f.size
          continue
        }
        const src = await resolveFile(library, f.src)
        if (!src) throw new Error(`Can't read ${f.src} from the library.`)
        await dir.writeFrom(name, src, (n) => {
          done += n
          onProgress({ done, total, job: i, jobs: jobs.length, current: name })
        }, signal)
        copiedAny = true
      }
      if (job.playlist) {
        const parts = job.playlist.dest.split("/")
        const name = parts.pop()!
        await (await ensureDirPath(card, parts.join("/"))).write(name, job.playlist.content)
      }
      // Box art is a bonus: failures here never fail the game.
      try {
        const imgDirPath = job.art.dest.split("/").slice(0, -1).join("/")
        const artName = job.art.dest.split("/").pop()!
        const imgDir = await resolveDir(card, imgDirPath)
        if (!(imgDir && (await imgDir.file(artName)))) {
          for (const c of job.art.candidates) {
            const img = await resolveFile(library, c)
            if (!img) continue
            await (await ensureDirPath(card, imgDirPath)).write(artName, await toPng(img))
            break
          }
        }
      } catch {
        /* no art */
      }
      results.push({ job, status: copiedAny ? "copied" : "skipped" })
    } catch (e) {
      if ((e as DOMException).name === "AbortError") {
        results.push({ job, status: "failed", error: "Cancelled" })
        break
      }
      results.push({ job, status: "failed", error: (e as Error).message })
    }
  }
  return results
}

/** Total size of everything on the card (for the free-space estimate). */
export async function measureCard(card: CardDir, signal?: AbortSignal): Promise<number> {
  let total = 0
  const walk = async (d: CardDir) => {
    for (const e of await d.list()) {
      if (signal?.aborted) return
      if (e.kind === "directory") {
        const sub = await d.dir(e.name)
        if (sub) await walk(sub)
      } else total += (await d.file(e.name))?.size ?? 0
    }
  }
  await walk(card)
  return total
}
