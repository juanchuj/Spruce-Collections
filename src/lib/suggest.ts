/**
 * AI-suggested collections.
 * 1. buildSuggestPrompt() lists the whole library with short, stable IDs.
 * 2. The user runs it in Claude, Gemini or ChatGPT.
 * 3. parseSuggestions() reads the standard JSON reply back into collections.
 */
import { cleanTitle } from "./prompt"
import type { Collection, GameSystem, Rom } from "./spruce"

export const SUGGEST_FORMAT = "spruce-collections/v1"

export type Assistant = "claude" | "gemini" | "chatgpt"

export const ASSISTANTS: Record<Assistant, { label: string; url: string }> = {
  claude: { label: "Claude", url: "https://claude.ai/new" },
  gemini: { label: "Gemini", url: "https://gemini.google.com/app" },
  chatgpt: { label: "ChatGPT", url: "https://chatgpt.com/" },
}

/** FNV-1a → base36. Same game gets the same ID every time, so an old reply still matches. */
function hashId(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36).padStart(7, "0").slice(-6)
}

export interface Catalog {
  byId: Map<string, Rom>
  idOf: Map<string, string> // rom path → id
  byTitle: Map<string, Rom[]>
}

const titleKey = (s: string) =>
  cleanTitle(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

export function buildCatalog(roms: Rom[]): Catalog {
  const byId = new Map<string, Rom>()
  const idOf = new Map<string, string>()
  const byTitle = new Map<string, Rom[]>()
  for (const r of roms) {
    let id = hashId(r.path)
    for (let n = 1; byId.has(id); n++) id = hashId(`${r.path}#${n}`)
    byId.set(id, r)
    idOf.set(r.path, id)
    const k = titleKey(r.name)
    byTitle.set(k, [...(byTitle.get(k) ?? []), r])
  }
  return { byId, idOf, byTitle }
}

export interface SuggestOptions {
  count: number
  focus: string
  maxPerCollection: number
  roms: Rom[]
  systems: GameSystem[]
  existing: Collection[]
  catalog: Catalog
}

export function buildSuggestPrompt(o: SuggestOptions) {
  const lines: string[] = []
  lines.push(
    `I play retro games on a handheld running spruceOS. Below is every game on my SD card. Suggest exactly ${o.count} collections to organize it.`,
    "",
    "Rules:",
    "- Give each collection a clear theme: a franchise, genre, mood, setting, era, play style (co-op, short sessions, long RPGs), difficulty, hidden gems, or similar. Mix kinds of themes.",
    `- Each collection holds between 4 and ${o.maxPerCollection} games. A game can be in more than one collection, and not every game needs to be used.`,
    "- Use only games from the catalog and refer to them by their ID (the code before each title). Never invent IDs.",
    "- Collection names: short (max 40 characters), no emoji, and none of these characters: \\ / : * ? \" < > |",
  )
  if (o.existing.length)
    lines.push(`- I already have these collections, so don't repeat them: ${o.existing.map((c) => `"${c.name}"`).join(", ")}.`)
  if (o.focus.trim()) lines.push(`- What I'm looking for: ${o.focus.trim()}`)
  lines.push(
    "",
    "Reply with one JSON code block and nothing else, in exactly this format:",
    "```json",
    "{",
    `  "format": "${SUGGEST_FORMAT}",`,
    '  "collections": [',
    '    { "name": "Collection name", "description": "One sentence on the theme", "games": ["id1", "id2", "id3", "id4"] }',
    "  ]",
    "}",
    "```",
    "",
    `Catalog: ${o.roms.length} games. Each line is: ID, title, then the genre in brackets when known.`,
  )

  const bySystem = new Map<string, Rom[]>()
  for (const r of o.roms) bySystem.set(r.systemId, [...(bySystem.get(r.systemId) ?? []), r])
  for (const s of o.systems) {
    const list = bySystem.get(s.id)
    if (!list?.length) continue
    lines.push("", `## ${s.label} (${list.length})`)
    for (const r of list) lines.push(`${o.catalog.idOf.get(r.path)} ${cleanTitle(r.name)}${r.genre ? ` [${r.genre}]` : ""}`)
  }
  return lines.join("\n")
}

/* ------------------------------------------------------------------ */

export interface Suggestion {
  name: string
  description: string
  roms: Rom[]
  unknown: string[]
}

export interface ParseResult {
  suggestions: Suggestion[]
  error?: string
}

function extractJson(text: string): unknown {
  const candidates: string[] = []
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi
  for (let m; (m = fence.exec(text)); ) candidates.push(m[1])
  const first = text.indexOf("{")
  const last = text.lastIndexOf("}")
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1))
  const a1 = text.indexOf("[")
  const a2 = text.lastIndexOf("]")
  if (a1 >= 0 && a2 > a1) candidates.push(text.slice(a1, a2 + 1))

  for (const c of candidates) {
    for (const attempt of [c, c.replace(/,\s*([}\]])/g, "$1").replace(/[“”]/g, '"')]) {
      try {
        return JSON.parse(attempt)
      } catch {
        /* try next */
      }
    }
  }
  return undefined
}

export function parseSuggestions(text: string, catalog: Catalog): ParseResult {
  if (!text.trim()) return { suggestions: [] }
  const data = extractJson(text)
  if (data === undefined)
    return { suggestions: [], error: "No JSON found. Paste the whole reply, including the ```json block." }

  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { collections?: unknown }).collections)
      ? (data as { collections: unknown[] }).collections
      : null
  if (!list) return { suggestions: [], error: 'The JSON has no "collections" list. Ask the AI to use the exact format.' }

  const suggestions: Suggestion[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const it = item as { name?: unknown; title?: unknown; description?: unknown; games?: unknown }
    const name = String(it.name ?? it.title ?? "")
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (!name) continue
    const roms: Rom[] = []
    const unknown: string[] = []
    const seen = new Set<string>()
    for (const g of Array.isArray(it.games) ? it.games : []) {
      let rom: Rom | undefined
      let label = ""
      if (typeof g === "string" || typeof g === "number") {
        label = String(g).trim()
        rom = catalog.byId.get(label.toLowerCase()) ?? catalog.byTitle.get(titleKey(label))?.[0]
      } else if (g && typeof g === "object") {
        const o = g as { id?: unknown; title?: unknown; name?: unknown }
        label = String(o.id ?? o.title ?? o.name ?? "")
        rom =
          (o.id != null ? catalog.byId.get(String(o.id).trim().toLowerCase()) : undefined) ??
          catalog.byTitle.get(titleKey(String(o.title ?? o.name ?? "")))?.[0]
      }
      if (rom) {
        if (!seen.has(rom.path)) {
          seen.add(rom.path)
          roms.push(rom)
        }
      } else if (label) unknown.push(label)
    }
    suggestions.push({ name: name.slice(0, 60), description: String(it.description ?? "").trim(), roms, unknown })
  }
  if (!suggestions.length) return { suggestions, error: "The reply has no collections with names." }
  return { suggestions }
}

/** Rough token estimate (≈4 characters per token) to warn before pasting a huge prompt. */
export const estimateTokens = (s: string) => Math.round(s.length / 4)
