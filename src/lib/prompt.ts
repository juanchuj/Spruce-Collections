import type { GameSystem, Rom } from "./spruce"

export type PromptStyle = "pixel" | "painted" | "poster"

export const STYLE_LABELS: Record<PromptStyle, string> = {
  pixel: "Pixel art",
  painted: "Painted box art",
  poster: "Minimal poster",
}

const STYLE_TEXT: Record<PromptStyle, string> = {
  pixel:
    "Detailed 16-bit pixel art with a limited, vibrant palette, crisp pixels and no anti-aliasing, like a classic console title screen.",
  painted:
    "Hand-painted 1990s video game box art: dramatic lighting, rich colors, airbrushed textures and a heroic composition.",
  poster:
    "Bold minimalist poster: flat shapes, two or three strong colors, simple iconography and generous negative space.",
}

/** "Legend of Zelda, The - Minish Cap (USA) [T-En]" → "The Legend of Zelda - Minish Cap" */
export function cleanTitle(name: string) {
  let t = name
    .replace(/\s*[([][^)\]]*[)\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  t = t.replace(/^(.+?), (The|A|An)(\b.*)$/i, (_, base: string, art: string, rest: string) => `${art} ${base}${rest}`)
  return t
}

function listWithAnd(items: string[]) {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

export interface PromptOptions {
  name: string
  roms: Rom[]
  systems: GameSystem[]
  style: PromptStyle
  withTitle: boolean
}

/** A prompt for Nano Banana (Gemini image generation) built from the collection's games. */
export function buildCoverPrompt({ name, roms, systems, style, withTitle }: PromptOptions) {
  const sysById = new Map(systems.map((s) => [s.id, s.label]))
  const titles = [...new Set(roms.map((r) => cleanTitle(r.name)))]
  const shown = titles.slice(0, 12)
  const more = titles.length - shown.length
  const sysLabels = [...new Set(roms.map((r) => sysById.get(r.systemId) ?? r.systemId))]
  const genres = [...new Set(roms.map((r) => r.genre).filter((g): g is string => !!g))].slice(0, 5)

  const lines = [
    `Create a square (1:1) cover image for a video game collection called "${name}", shown in the menu of a retro handheld console.`,
    `Style: ${STYLE_TEXT[style]}`,
  ]
  if (shown.length) {
    lines.push(
      `The collection holds ${roms.length} ${roms.length === 1 ? "game" : "games"}${
        sysLabels.length ? ` for ${listWithAnd(sysLabels)}` : ""
      }: ${shown.join("; ")}${more > 0 ? `; and ${more} more` : ""}.`,
    )
    if (genres.length) lines.push(`Genres: ${genres.join(", ")}.`)
    lines.push(
      "Capture the mood, setting and themes these games share in one original scene. Do not copy existing characters, logos or box art.",
    )
  } else {
    lines.push(`Build an original scene that fits the name "${name}".`)
  }
  lines.push(
    withTitle
      ? `Show the title "${name}" in bold, highly readable lettering across the lower third.`
      : "No text, letters, numbers or logos anywhere in the image.",
  )
  lines.push("One strong focal point and high contrast so it reads well at about 250 pixels wide. No borders or frames.")
  return lines.join("\n\n")
}
