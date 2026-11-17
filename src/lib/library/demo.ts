import { MemDir } from "../fs"
import { makeZip } from "./zip"

/**
 * A small fake ROM library in mixed layouts (No-Intro folders, EmuDeck folders, a stray folder)
 * with the usual mess: several regions, revisions, a fan translation, a beta, cue/bin, multi-disc CHDs.
 */
const bytes = (seed: string, kb: number) => {
  const a = new Uint8Array(kb * 1024)
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  for (let i = 0; i < a.length; i += 97) a[i] = (h + i) & 0xff
  return a
}
const file = (name: string, kb = 64) => new File([bytes(name, kb)], name)
const zipOf = (name: string, inner: string, kb = 96) => new File([makeZip([{ name: inner, data: bytes(inner, kb) }])], name)

function art(title: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${color}"/><text x="14" y="110" font-family="monospace" font-size="18" font-weight="700" fill="#fff">${title.replace(/&/g, "&amp;")}</text></svg>`
  return new File([svg], "art.png", { type: "image/svg+xml" })
}

export function buildDemoLibrary(): MemDir {
  const lib = MemDir.empty("ROM Library (demo)", false)
  const gba = "Nintendo - Game Boy Advance"
  const put = (p: string, f: File) => lib.put(p, f)

  for (const [z, inner] of [
    ["Golden Sun (USA, Europe).zip", "Golden Sun (USA, Europe).gba"],
    ["Golden Sun (Japan).zip", "Golden Sun (Japan).gba"],
    ["Metroid Fusion (USA).zip", "Metroid Fusion (USA).gba"],
    ["Metroid Fusion (Europe) (En,Fr,De,Es,It).zip", "Metroid Fusion (Europe) (En,Fr,De,Es,It).gba"],
    ["Castlevania - Circle of the Moon (USA).zip", "Castlevania - Circle of the Moon (USA).gba"],
    ["Wario Land 4 (USA, Europe).zip", "Wario Land 4 (USA, Europe).gba"],
    ["gs2.zip", "Golden Sun - The Lost Age (USA, Europe).gba"],
  ])
    put(`${gba}/${z}`, zipOf(z, inner))
  put(`${gba}/Mother 3 (Japan).gba`, file("Mother 3 (Japan).gba", 128))
  put(`${gba}/Mother 3 (Japan) [T-En by Tomato v1.3].gba`, file("Mother 3 (Japan) [T-En by Tomato v1.3].gba", 128))
  put(`${gba}/Advance Wars (USA).gba`, file("Advance Wars (USA).gba", 96))
  put(`${gba}/Advance Wars (USA) (Rev 1).gba`, file("Advance Wars (USA) (Rev 1).gba", 96))
  put(`${gba}/Super Mario Advance 2 (USA) (Beta).gba`, file("Super Mario Advance 2 (USA) (Beta).gba", 96))
  put(`${gba}/Kuru Kuru Kururin (Europe).gba`, file("Kuru Kuru Kururin (Europe).gba", 64))
  put(`${gba}/Imgs/Golden Sun (USA, Europe).png`, art("Golden Sun", "#b0702a"))
  put(`${gba}/Imgs/Mother 3 (Japan) [T-En by Tomato v1.3].png`, art("Mother 3", "#3c8a5a"))

  for (const n of [
    "Secret of Mana (USA).sfc",
    "Secret of Mana (Europe).sfc",
    "Seiken Densetsu 3 (Japan).sfc",
    "Seiken Densetsu 3 (Japan) [T-En by Neill Corlett v1.01].sfc",
    "Super Mario World (USA).sfc",
    "Super Mario World 2 - Yoshi's Island (USA, Asia) (Rev 1).sfc",
    "Contra III - The Alien Wars (USA).sfc",
    "Kirby's Dream Course (USA).sfc",
    "Terranigma (Europe).sfc",
  ])
    put(`snes/${n}`, file(n, 128))
  put("snes/boxart/Secret of Mana (USA).png", art("Secret of Mana", "#2f6fb0"))

  const ps = "Sony - PlayStation"
  for (let d = 1; d <= 4; d++) put(`${ps}/Final Fantasy IX (USA) (Disc ${d}).chd`, file(`ffix${d}`, 256))
  for (let d = 1; d <= 3; d++) put(`${ps}/Final Fantasy VII (Europe) (Disc ${d}).chd`, file(`ff7e${d}`, 256))
  put(`${ps}/Vagrant Story (USA).cue`, new File([`FILE "Vagrant Story (USA).bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n`], "x.cue"))
  put(`${ps}/Vagrant Story (USA).bin`, file("vs.bin", 512))
  put(
    `${ps}/Suikoden II (USA).cue`,
    new File([`FILE "Suikoden II (USA) (Track 1).bin" BINARY\n  TRACK 01 MODE2/2352\nFILE "Suikoden II (USA) (Track 2).bin" BINARY\n  TRACK 02 AUDIO\n`], "x.cue"),
  )
  put(`${ps}/Suikoden II (USA) (Track 1).bin`, file("s2t1", 384))
  put(`${ps}/Suikoden II (USA) (Track 2).bin`, file("s2t2", 64))
  put(`${ps}/Tony Hawk's Pro Skater 2 (USA).chd`, file("thps2", 256))
  put(`${ps}/Castlevania - Symphony of the Night (USA).chd`, file("sotn", 256))

  for (const n of ["Sonic The Hedgehog 3 (USA).md", "Streets of Rage 2 (USA).md", "Streets of Rage 2 (Europe).md", "Ristar (USA, Europe).md"])
    put(`genesis/${n}`, file(n, 96))

  put("Fukuoka/Yu Yu Hakusho (Japan).bin", file("yyh", 96))
  put("Fukuoka/readme.txt", new File(["hi"], "readme.txt"))
  put("Pocket Monsters Pinball (Japan).gbc", file("pinball", 64))
  return lib
}
