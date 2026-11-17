import { MemDir } from "./fs"

/** A small fake spruceOS card so the app can be tried without a real SD card. */

const SYSTEMS: Record<string, { label: string; ext: string; color: string; alt?: string[]; games: string[] }> = {
  GB: {
    label: "GB",
    ext: "gb|gbc|zip|7z",
    color: "#7a8b3a",
    games: [
      "Tetris (World) (Rev 1).gb",
      "Kirby's Dream Land (USA, Europe).gb",
      "Super Mario Land (World) (Rev 1).gb",
      "Metroid II - Return of Samus (World).gb",
      "Pokemon - Red Version (USA, Europe).gb",
      "Mega Man - Dr. Wily's Revenge (USA).gb",
      "Castlevania - The Adventure (USA).gb",
      "Donkey Kong (World) (Rev 1).gb",
    ],
  },
  GBC: {
    label: "GBC",
    ext: "gbc|gb|zip|7z",
    color: "#5a3fb5",
    games: [
      "Legend of Zelda, The - Link's Awakening DX (USA, Europe) (Rev 2).gbc",
      "Legend of Zelda, The - Oracle of Seasons (USA).gbc",
      "Legend of Zelda, The - Oracle of Ages (USA).gbc",
      "Pokemon - Crystal Version (USA, Europe) (Rev 1).gbc",
      "Shantae (USA).gbc",
      "Wario Land 3 (World).gbc",
      "Dragon Warrior III (USA).gbc",
      "Metal Gear Solid (USA).gbc",
    ],
  },
  GBA: {
    label: "GBA",
    ext: "gba|zip|7z",
    color: "#4b3c9e",
    games: [
      "Metroid Fusion (USA).gba",
      "Metroid - Zero Mission (USA).gba",
      "Legend of Zelda, The - The Minish Cap (USA).gba",
      "Golden Sun (USA, Europe).gba",
      "Advance Wars (USA).gba",
      "Castlevania - Aria of Sorrow (USA).gba",
      "Mother 3 (Japan) [T-En].gba",
      "Fire Emblem (USA, Australia).gba",
      "Mario Kart - Super Circuit (USA).gba",
      "Kirby & The Amazing Mirror (USA).gba",
      "Final Fantasy VI Advance (USA).gba",
      "Pokemon - Emerald Version (USA, Europe).gba",
    ],
  },
  FC: {
    label: "FC",
    ext: "nes|fds|unf|unif|zip|7z",
    color: "#c9302c",
    alt: ["NES"],
    games: [
      "Super Mario Bros. 3 (USA) (Rev 1).nes",
      "Legend of Zelda, The (USA) (Rev 1).nes",
      "Metroid (USA).nes",
      "Mega Man 2 (USA).nes",
      "Castlevania (USA) (Rev 1).nes",
      "Contra (USA).nes",
      "Kirby's Adventure (USA) (Rev 1).nes",
      "Punch-Out!! (USA).nes",
    ],
  },
  SFC: {
    label: "SFC",
    ext: "smc|sfc|zip|7z|bs",
    color: "#8a8fa3",
    alt: ["SNES"],
    games: [
      "Super Metroid (Japan, USA) (En,Ja).sfc",
      "Legend of Zelda, The - A Link to the Past (USA).sfc",
      "Chrono Trigger (USA).sfc",
      "Super Mario World (USA).sfc",
      "EarthBound (USA).sfc",
      "Final Fantasy III (USA) (Rev 1).sfc",
      "Donkey Kong Country (USA) (Rev 2).sfc",
      "Kirby Super Star (USA).sfc",
      "Super Mario RPG - Legend of the Seven Stars (USA).sfc",
      "Mega Man X (USA) (Rev 1).sfc",
    ],
  },
  MD: {
    label: "MD",
    ext: "gen|smd|md|32x|bin|iso|sms|zip|7z",
    color: "#2a2a2a",
    games: [
      "Sonic The Hedgehog 2 (World) (Rev A).md",
      "Streets of Rage 2 (USA).md",
      "Gunstar Heroes (USA).md",
      "Castlevania - Bloodlines (USA).md",
      "Phantasy Star IV (USA).md",
      "Shinobi III - Return of the Ninja Master (USA).md",
    ],
  },
  PS: {
    label: "PSX",
    ext: "m3u|chd|cue|img|mdf|pbp|toc|cbn|iso",
    color: "#3d6fd6",
    alt: ["PSX"],
    games: [
      "Castlevania - Symphony of the Night (USA).chd",
      "Final Fantasy VII (USA).m3u",
      "Metal Gear Solid (USA).m3u",
      "Crash Bandicoot (USA).chd",
      "Spyro the Dragon (USA).chd",
      "Silent Hill (USA).chd",
      "Resident Evil 2 (USA).m3u",
    ],
  },
  N64: { label: "N64", ext: "n64|v64|z64|zip|7z", color: "#1f8a4c", games: [] },
}

function stripTags(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/\s*[([].*$/, "")
    .trim()
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
}

/** Stand-in box art: a flat "cartridge label" in the system color. */
function fakeArt(title: string, color: string, sys: string) {
  const words = title.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    if ((cur + " " + w).trim().length > 14) {
      if (cur) lines.push(cur)
      cur = w
    } else cur = (cur + " " + w).trim()
  }
  if (cur) lines.push(cur)
  const text = lines
    .slice(0, 4)
    .map((l, i) => `<text x="16" y="${92 + i * 22}" font-family="monospace" font-size="17" font-weight="700" fill="#fff">${esc(l)}</text>`)
    .join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
<rect width="200" height="200" fill="${color}"/>
<rect x="0" y="0" width="200" height="56" fill="rgba(0,0,0,0.28)"/>
<text x="16" y="36" font-family="monospace" font-size="20" font-weight="700" fill="rgba(255,255,255,0.85)">${esc(sys)}</text>
<rect x="150" y="16" width="34" height="24" rx="3" fill="rgba(255,255,255,0.25)"/>
${text}
<rect x="0" y="184" width="200" height="16" fill="rgba(0,0,0,0.25)"/>
</svg>`
  return new File([svg], "art.png", { type: "image/svg+xml" })
}

const json = (v: unknown) => new File([JSON.stringify(v, null, 2)], "config.json", { type: "application/json" })

export function buildDemoCard(): MemDir {
  const card = MemDir.empty("SDCARD (demo)", true)
  card.put("spruce/spruce", new File(["4.4.2"], "spruce"))
  card.put("App/PyUI/launch.sh", new File([""], "launch.sh"))

  for (const [id, s] of Object.entries(SYSTEMS)) {
    card.put(
      `Emu/${id}/config.json`,
      json({ label: s.label, extlist: s.ext, themecolor: s.color.slice(1), ...(s.alt ? { alternativeFolderNames: s.alt } : {}) }),
    )
    card.put(`Roms/${id}/.keep`, new File([""], ".keep"))
    s.games.forEach((g, i) => {
      card.put(`Roms/${id}/${g}`, new File(["demo"], g))
      if (i % 5 !== 4) {
        const base = g.replace(/\.[^.]+$/, "")
        card.put(`Roms/${id}/Imgs/${base}.png`, fakeArt(stripTags(g), s.color, s.label))
      }
    })
  }
  // A macOS leftover that must not show up as a game.
  card.put("Roms/GBA/._Metroid Fusion (USA).gba", new File([""], "._x"))

  // A gamelist with friendlier names for SFC.
  card.put(
    "Roms/SFC/miyoogamelist.xml",
    new File(
      [
        `<?xml version="1.0"?><gameList>
<game><path>./Legend of Zelda, The - A Link to the Past (USA).sfc</path><name>Zelda: A Link to the Past</name><image>./Imgs/Legend of Zelda, The - A Link to the Past (USA).png</image></game>
<game><path>./Final Fantasy III (USA) (Rev 1).sfc</path><name>Final Fantasy VI</name><image>./Imgs/Final Fantasy III (USA) (Rev 1).png</image></game>
</gameList>`,
      ],
      "miyoogamelist.xml",
    ),
  )

  // An existing collection on the card, including one game that has since been deleted.
  card.put(
    "Collections/collections.json",
    new File(
      [
        JSON.stringify(
          [
            {
              collection_name: "Metroidvania",
              game_list: [
                { rom_file_path: "/mnt/SDCARD/Roms/SFC/Super Metroid (Japan, USA) (En,Ja).sfc", game_system_name: "SFC" },
                { rom_file_path: "/mnt/SDCARD/Roms/GBA/Metroid Fusion (USA).gba", game_system_name: "GBA" },
                { rom_file_path: "/mnt/SDCARD/Roms/PS/Castlevania - Symphony of the Night (USA).chd", game_system_name: "PS" },
                { rom_file_path: "/mnt/SDCARD/Roms/GBA/Castlevania - Harmony of Dissonance (USA).gba", game_system_name: "GBA" },
              ],
            },
          ],
          null,
          4,
        ),
      ],
      "collections.json",
    ),
  )
  return card
}
