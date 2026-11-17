/**
 * Parses No-Intro / Redump / GoodTools style file names:
 *   "Metroid Fusion (USA) (Rev 1) [!].gba"  "Final Fantasy VII (USA) (Disc 2).chd"
 *   "Mother 3 (Japan) [T-En by Tomato].gba" "Sonic (U) [b1].md"
 */
import { cleanTitle } from "../prompt"

export interface ParsedName {
  /** Title without tags, articles moved to the front: "The Legend of Zelda - Minish Cap". */
  title: string
  /** Grouping key: lowercase, accents and punctuation removed. Numbers are kept, so "Mario 2" ≠ "Mario". */
  key: string
  regions: string[]
  revision: number
  disc: number | null
  translated: boolean
  verified: boolean
  /** Bad or over dumps: never picked. */
  broken: boolean
  /** Beta, prototype, demo, sample, hack, pirate…: hidden unless the user asks for them. */
  extra: string | null
  tags: string[]
}

const REGION_WORDS: Record<string, string> = {
  usa: "USA", us: "USA", u: "USA", world: "World", w: "World", europe: "Europe", eu: "Europe", e: "Europe",
  japan: "Japan", jp: "Japan", j: "Japan", korea: "Korea", k: "Korea", asia: "Asia", brazil: "Brazil", b: "Brazil",
  australia: "Australia", canada: "Canada", france: "France", f: "France", germany: "Germany", g: "Germany",
  spain: "Spain", s: "Spain", italy: "Italy", i: "Italy", netherlands: "Netherlands", sweden: "Sweden",
  china: "China", c: "China", taiwan: "Taiwan", russia: "Russia", uk: "UK", latinamerica: "Latin America",
}
const GOOD_COMBOS: Record<string, string[]> = { ue: ["USA", "Europe"], ju: ["Japan", "USA"], jue: ["Japan", "USA", "Europe"] }

const EXTRA = /^(beta|proto|prototype|demo|sample|kiosk|debug|pirate|hack|preview|promo|alpha)\b/i

export function titleKey(title: string) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function stripExt(name: string) {
  const d = name.lastIndexOf(".")
  return d > 0 ? name.slice(0, d) : name
}

export function parseName(fileName: string): ParsedName {
  const base = stripExt(fileName)
  const firstTag = base.search(/\s*[([]/)
  const rawTitle = (firstTag > 0 ? base.slice(0, firstTag) : base).trim()
  const tagText = firstTag > 0 ? base.slice(firstTag) : ""
  const found = [...tagText.matchAll(/([([])([^)\]]*)[)\]]/g)].map((m) => ({ square: m[1] === "[", text: m[2].trim() }))
  const tags = found.map((f) => f.text)

  const p: ParsedName = {
    title: cleanTitle(rawTitle || base),
    key: "",
    regions: [],
    revision: 0,
    disc: null,
    translated: false,
    verified: false,
    broken: false,
    extra: null,
    tags,
  }

  for (const { square, text: t } of found) {
    const low = t.toLowerCase()
    if (square) {
      // GoodTools flags live in square brackets.
      if (low === "!") p.verified = true
      else if (/^(b|o)\d*$/.test(low)) p.broken = true
      else if (/^t[+-]/.test(low) || /translat/.test(low)) p.translated = true
      else if (/^(h|p)\d*/.test(low) || /hack/.test(low)) p.extra ??= "Hack"
      continue
    }
    const parts = low.split(/\s*,\s*/)
    if (parts.every((x) => REGION_WORDS[x.replace(/\s+/g, "")])) {
      for (const x of parts) p.regions.push(REGION_WORDS[x.replace(/\s+/g, "")])
      continue
    }
    if (GOOD_COMBOS[low]) {
      p.regions.push(...GOOD_COMBOS[low])
      continue
    }
    let m: RegExpMatchArray | null
    if ((m = low.match(/^rev\s*([0-9a-z]+)$/))) {
      const v = m[1]
      p.revision = /^\d+$/.test(v) ? Number(v) : v.charCodeAt(0) - 96
      continue
    }
    if ((m = low.match(/^v\s?(\d+(?:\.\d+)?)/))) {
      p.revision = Math.max(p.revision, Number(m[1]))
      continue
    }
    if ((m = low.match(/^dis[ck]\s*(\d+)/))) {
      p.disc = Number(m[1])
      continue
    }
    if (low === "!") {
      p.verified = true
      continue
    }
    if (/^(b|o)\d*$/.test(low) || /^bad dump/.test(low)) {
      p.broken = true
      continue
    }
    if (/^t[+-]/.test(low) || /translat/.test(low)) {
      p.translated = true
      continue
    }
    if (/^h\d*$/.test(low) || /^(hack|p\d*)$/.test(low)) {
      p.extra ??= "Hack"
      continue
    }
    if ((m = t.match(EXTRA))) p.extra ??= m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
  }
  p.key = titleKey(p.title)
  return p
}

/** Short labels shown on a version: "USA", "Rev 1", "EN patch", "Beta". */
export function versionLabels(p: ParsedName) {
  const out: string[] = []
  if (p.regions.length) out.push(p.regions.join(", "))
  if (p.revision) out.push(`Rev ${p.revision}`)
  if (p.translated) out.push("Translation")
  if (p.extra) out.push(p.extra)
  if (p.broken) out.push("Bad dump")
  return out
}
