/**
 * Logiqx XML DAT files (No-Intro, Redump, MAME/FBNeo). Parsed with a light
 * scanner instead of DOMParser so big arcade DATs don't freeze the tab.
 */
export interface DatFile {
  id: string
  name: string // header <name>, e.g. "Nintendo - Game Boy Advance"
  fileName: string
  /** crc32 (lowercase hex) → game name */
  crc: Record<string, string>
  /** set/game name → description (arcade DATs: "sf2" → "Street Fighter II: The World Warrior") */
  sets: Record<string, string>
  games: number
}

const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")

export function parseDat(text: string, fileName: string): DatFile {
  if (!/<datafile|<mame|<\?xml/i.test(text.slice(0, 2000)))
    throw new Error("This isn't a Logiqx XML DAT. Download the XML version of the DAT.")
  const header = text.match(/<header>[\s\S]*?<name>([^<]*)<\/name>/i)
  const dat: DatFile = {
    id: `dat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: unescape(header?.[1]?.trim() ?? fileName.replace(/\.(dat|xml)$/i, "")),
    fileName,
    crc: {},
    sets: {},
    games: 0,
  }
  const gameRe = /<(game|machine)\s+[^>]*?name="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/g
  for (let m; (m = gameRe.exec(text)); ) {
    const gameName = unescape(m[2])
    const body = m[3]
    const desc = body.match(/<description>([^<]*)<\/description>/)
    dat.sets[gameName] = unescape(desc?.[1] ?? gameName)
    const romRe = /<rom\s[^>]*?crc="([0-9a-fA-F]{8})"/g
    for (let r; (r = romRe.exec(body)); ) dat.crc[r[1].toLowerCase()] ??= gameName
    dat.games++
  }
  if (!dat.games) throw new Error("No games found in this DAT.")
  return dat
}

/** Lookup across all imported DATs. */
export class DatIndex {
  private crc = new Map<string, { game: string; dat: DatFile }>()
  private sets = new Map<string, string>()
  readonly dats: DatFile[]
  constructor(dats: DatFile[]) {
    this.dats = dats
    for (const d of dats) {
      for (const [c, g] of Object.entries(d.crc)) if (!this.crc.has(c)) this.crc.set(c, { game: g, dat: d })
      for (const [s, desc] of Object.entries(d.sets)) if (!this.sets.has(s)) this.sets.set(s, desc)
    }
  }
  get size() {
    return this.dats.length
  }
  byCrc(crc: string) {
    return this.crc.get(crc.toLowerCase())
  }
  /** Arcade: "sf2" → full title, when the DAT's game names differ from their descriptions. */
  setTitle(setName: string) {
    const d = this.sets.get(setName)
    return d && d !== setName ? d : null
  }
}
