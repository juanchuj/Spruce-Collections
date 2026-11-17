/**
 * "What should I add to my card?" prompt, adaptive to library size:
 *  - catalog mode: the library's games (not on the card) are listed with IDs; the AI answers with IDs
 *  - taste mode: the library is too big to send, so the AI suggests titles from its own knowledge
 *    and the app matches them against the library
 */
import { cleanTitle } from "../prompt"
import type { Collection, Rom } from "../spruce"
import { extractJson } from "../suggest"
import { titleKey } from "./names"
import { type LibGame, formatBytes } from "./scan"
import type { SystemMatcher } from "./systems"

export const LIB_FORMAT = "spruce-library-suggestions/v1"
export const CATALOG_LIMIT = 100_000 // characters of catalog before switching to taste mode

export interface LibPromptInput {
  count: number
  focus: string
  candidates: LibGame[] // library games the AI may pick from (already filtered)
  librarySystems: { id: string; label: string; count: number }[]
  cardRoms: Rom[]
  collections: Collection[]
  freeBytes: number | null
  matcher: SystemMatcher
}

function sampleEvenly<T>(list: T[], max: number) {
  if (list.length <= max) return list
  const step = list.length / max
  return Array.from({ length: max }, (_, i) => list[Math.floor(i * step)])
}

export function buildLibraryPrompt(o: LibPromptInput): { text: string; mode: "catalog" | "taste" } {
  const bySys = new Map<string, LibGame[]>()
  for (const g of o.candidates) {
    const l = bySys.get(g.system)
    if (l) l.push(g)
    else bySys.set(g.system, [g])
  }
  const catalogLines: string[] = []
  for (const [sys, list] of [...bySys].sort((a, b) => o.matcher.label(a[0]).localeCompare(o.matcher.label(b[0])))) {
    catalogLines.push("", `## ${sys}: ${o.matcher.label(sys)} (${list.length})`)
    for (const g of list) catalogLines.push(`${g.id} ${g.title}`)
  }
  const catalog = catalogLines.join("\n")
  const mode = catalog.length <= CATALOG_LIMIT ? "catalog" : "taste"
  const ask = mode === "catalog" ? o.count : o.count * 2

  const L: string[] = []
  L.push(
    `I play retro games on a small handheld running spruceOS. I have a big ROM library on my computer and want to choose what to put on the SD card. Suggest ${ask} games to add.`,
    "",
    "Rules:",
    "- Base the picks on my taste (the games and collections already on the card) and on what I ask for below. Mix well-known classics with a few hidden gems.",
    "- Don't suggest games already on my card.",
    "- Favor games that play well on a small screen with a d-pad and face buttons. Be careful with demanding 3D games on N64, Dreamcast, Saturn and PSP; only suggest ones known to run well on low-power ARM handhelds.",
  )
  if (o.freeBytes != null) L.push(`- About ${formatBytes(Math.max(0, o.freeBytes))} is free on the card. Keep the total size within that.`)
  if (o.focus.trim()) L.push(`- What I'm looking for: ${o.focus.trim()}`)
  if (mode === "catalog") {
    L.push("- Pick only from the catalog below and refer to each game by its ID (the code before the title). Never invent IDs.")
  } else {
    L.push(
      "- My library is too big to list. Suggest games by their exact official title, as written in No-Intro or Redump names, and use a system code from the list below. I'll keep the ones I own, so list them in order of preference.",
      "",
      "Systems in my library (code: name, number of games):",
      ...o.librarySystems.map((s) => `${s.id}: ${s.label} (${s.count})`),
    )
  }
  L.push(
    "",
    "Reply with one JSON code block and nothing else, in exactly this format:",
    "```json",
    "{",
    `  "format": "${LIB_FORMAT}",`,
    '  "suggestions": [',
    mode === "catalog"
      ? '    { "id": "k3j9a1", "title": "Game title", "system": "GBA", "reason": "One short sentence on why it fits" }'
      : '    { "title": "Game title", "system": "GBA", "reason": "One short sentence on why it fits" }',
    "  ]",
    "}",
    "```",
  )

  // Taste: collections first (strongest signal), then a sample of what's on the card.
  if (o.collections.length) {
    const byPath = new Map(o.cardRoms.map((r) => [r.path, r]))
    L.push("", "My collections on the card:")
    for (const c of o.collections.slice(0, 25)) {
      const names = c.games
        .map((g) => byPath.get(g.rom_file_path))
        .filter((r): r is Rom => !!r)
        .slice(0, 15)
        .map((r) => cleanTitle(r.name))
      L.push(`- ${c.name}: ${names.join("; ")}`)
    }
  }
  const cardBySys = new Map<string, string[]>()
  for (const r of o.cardRoms) {
    const l = cardBySys.get(r.systemId)
    if (l) l.push(cleanTitle(r.name))
    else cardBySys.set(r.systemId, [cleanTitle(r.name)])
  }
  const perSys = Math.max(15, Math.floor(600 / Math.max(1, cardBySys.size)))
  L.push("", `Games already on my card (${o.cardRoms.length}${o.cardRoms.length > 600 ? ", sample" : ""}):`)
  for (const [sys, names] of cardBySys) L.push(`${sys}: ${sampleEvenly(names, perSys).join("; ")}`)

  if (mode === "catalog") L.push("", `Catalog: ${o.candidates.length} games from my library that aren't on the card.`, catalog)
  return { text: L.join("\n"), mode }
}

/* ------------------------------------------------------------------ */

export interface LibSuggestion {
  title: string
  system: string
  reason: string
  game: LibGame | null
}

export function parseLibrarySuggestions(
  text: string,
  games: LibGame[],
  matcher: SystemMatcher,
): { items: LibSuggestion[]; error?: string } {
  if (!text.trim()) return { items: [] }
  const data = extractJson(text)
  if (data === undefined) return { items: [], error: "No JSON found. Paste the whole reply, including the ```json block." }
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { suggestions?: unknown }).suggestions)
      ? (data as { suggestions: unknown[] }).suggestions
      : null
  if (!list) return { items: [], error: 'The JSON has no "suggestions" list. Ask the AI to use the exact format.' }

  const byId = new Map(games.map((g) => [g.id, g]))
  const byKey = new Map<string, LibGame[]>()
  for (const g of games) {
    const l = byKey.get(g.key)
    if (l) l.push(g)
    else byKey.set(g.key, [g])
  }

  const items: LibSuggestion[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue
    const it = raw as { id?: unknown; title?: unknown; name?: unknown; system?: unknown; reason?: unknown }
    const title = String(it.title ?? it.name ?? "").trim()
    const sysRaw = String(it.system ?? "").trim()
    const sys = matcher.defs.has(sysRaw.toUpperCase()) ? sysRaw.toUpperCase() : (matcher.folder(sysRaw) ?? sysRaw)
    let game = it.id != null ? (byId.get(String(it.id).trim().toLowerCase()) ?? null) : null
    if (!game && title) {
      const cands = byKey.get(titleKey(cleanTitle(title))) ?? []
      game = cands.find((g) => g.system === sys) ?? cands[0] ?? null
    }
    const k = game?.id ?? `${sys}|${titleKey(title)}`
    if (seen.has(k) || (!title && !game)) continue
    seen.add(k)
    items.push({ title: game?.title ?? title, system: game?.system ?? sys, reason: String(it.reason ?? "").trim(), game })
  }
  if (!items.length) return { items, error: "The reply has no suggestions." }
  return { items }
}
