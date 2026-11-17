/**
 * System detection for a ROM library.
 * BUILTIN comes from spruceOS 4.4 Emu/<SYS>/config.json (id, label, extlist, alternativeFolderNames).
 * EXTRA_ALIASES adds the folder names other tools use (No-Intro/Redump DATs, EmuDeck, Batocera, LaunchBox).
 */

export type BuiltinSystem = [id: string, label: string, extlist: string, aliases: string[]]

// prettier-ignore
export const BUILTIN: BuiltinSystem[] = [["3DS","3DS","3ds|3dsx|z3dsx|elf|axf|cci|zcci|cxi|zcxi|app",["n3ds","new3ds","threeds","nintendo3ds"]],["AMIGA","Amiga","zip|7z|adf|adz|dms|fdi|ipf|hdf|hdz|lha|slave|info|cue|ccd|nrg|mds|iso|chd|uae|m3u|rp9",["amiga","amiga500","Amiga","amiga1200"]],["ARCADE","Arcade","zip",["arcade","Arcade"]],["ARDUBOY","Arduboy","hex|zip",["arduboy","Arduboy"]],["ATARI","Atari 2600","a26|zip|7z|bin",["TWENTYSIXHUNDRED","ATARI2600","Atari2600","A2600","atari","atari2600","a2600","2600"]],["ATARIST","Atari ST","st|msa|stx|dim|ipf|zip|7z",["atarist","Atari ST","st"]],["ATOMISWAVE","Atomiswave","chd|cdi|gdi|cue|iso|m3u|zip|dat",["atomiswave"]],["CHAI","ChaiLove","chailove",["chai","Chai Love","chailove"]],["COCO","COCO","ccc|cas",["coco","xroar","XROAR"]],["COLECO","ColecoVis","zip|7z|rom|ri|mx1|mx2|col|dsk|cas|sg|sc|m3u",["coleco","colecovision","Coleco Vision","COLECOVISION","CV","cv"]],["COMMODORE","C64","d64|zip|7z|t64|crt|prg|nib|m3u|tap",["C64","COMMODORE64","commodore","Commodore64","commodore64","c64"]],["CPC","Amst CPC","zip|7z|sna|dsk|kcr|bin",["AMSTRAD","AMSTRADCPC","amstrad","amstradcpc","cpc"]],["CPS1","CPS1","zip|7z|cue",["cps1","capcomcps1"]],["CPS2","CPS2","zip|7z|cue",["cps2","capcomcps2"]],["CPS3","CPS3","zip|7z|cue",["cps3","capcomcps3"]],["DC","DC","chd|cdi|gdi|cue|iso|m3u|dat",["DREAMCAST","Sega Dreamcast","Dreamcast","dreamcast","dc"]],["DOOM","DOOM","zip|wad|exe",["doom","prboom","PRBOOM"]],["DOS","MS-DOS","zip|dosz|exe|com|bat|iso|ins|img|ima|vhd|jrc|tc|m3u|m3u8|conf",["dos","pc"]],["EASYRPG","EasyRPG","zip|ldb|easyrpg",["easyrpg"]],["EIGHTHUNDRED","Atari 800","zip|7z|xfd|atr|cdm|cas|bin|a52|atx|car|com|xex",["eighthundred","800","a800","atari800","A800","ATARI800"]],["FAIRCHILD","ChannelF","zip|bin|rom|chf",["CHANNELF","fairchild","channelf","fairchildchannelf","chf","CHF"]],["FAKE08","Fake08","p8|png",["fake08","retro8","RETRO8"]],["FBNEO","FBNEO","zip",["fbneo","finalburnneo","FINALBURNNEO"]],["FC","NES","zip|7z|nes|fds|unif|unf",["NES","FAMICOM","nes","famicom","fc"]],["FDS","FDS","zip|7z|fds|nes|unif|unf",["fds","disksystem","famicomdisk","DISKSYSTEM"]],["FIFTYTWOHUNDRED","Atari 5200","a52|zip|7z|atr|bin",["ATARI5200","A5200","atari5200","a5200","fiftytwohundred"]],["GAMETANK","Game Tank","gtr|zip|7z",["gametank","libgametank","gt"]],["GB","GB","gb|gbc|zip|7z|bin|dmg",["GAMEBOY","gb","gameboy","dmg","DMG"]],["GBA","GBA","gba|zip|7z|bin",["GAMEBOYADVANCE","gameboyadvance","gba","agb","AGB"]],["GBC","GBC","gb|gbc|zip|7z|bin|dmg",["GAMEBOYCOLOR","gameboycolor","gbc","cgb","CGB"]],["GG","Game Gear","bin|gg|zip|7z",["GAMEGEAR","gamegear","gg"]],["GW","G&W","mgw|zip|7z",["gameandwatch","gw","GAMEANDWATCH"]],["INTELLIVISION","Intellivis.","zip|7z|bin|int",["intellivision","ITV","itv"]],["J2ME","J2ME","jar|kjx",["j2me","java","JAVA","midp","mobile"]],["JAGUAR","Atari Jaguar","j64|jag|rom|abs|cof|bin|cue|cdi|prg|iso|zip|7z",["jaguar","Atari Jaguar","jag","JAG"]],["LOOPY","Loopy","bin|loopy|zip|7z",["loopy","casioloopy"]],["LYNX","Atari Lynx","lnx|zip",["ATARILYNX","atarilynx","lynx"]],["MAME2003PLUS","MAME 03+","zip",["mame2003plus","MAME","mame"]],["MD","Genesis","zip|7z|gen|smd|md|32x|bin|iso|sms|68k|chd",["GENESIS","md","megadrive","MEGADRIVE"]],["MEGADUCK","Mega Duck","bin|zip|7z|duck|md0|md1|md2|md20s|md25s",["cougarboy","sameduck"]],["MKXP-Z","MKXP","ini|json|rxproj|rvproj|rvproj2|mkxp|mkxpz|zip|7z",["mkxp","mkxp-z","rpgmaker","RPGMAKER"]],["MS","Sega MS","gen|smd|md|32x|bin|iso|sms|68k|chd|zip|7z",["SMS","MASTERSYSTEM","ms","sms"]],["MSU1","MSU1","sfc|smc|zip|7z|fig|bs|st",["msu","msu1","MSU"]],["MSUMD","MSUMD","zip|7z|gen|smd|md|32x|bin|iso|sms|68k|chd",["msumd"]],["MSX","MSX","zip|7z|rom|mx1|mx2|dsk|cas|m3u",["MSX2","msx","msx2","MSX1","msx1"]],["N64","N64","zip|7z|n64|z64|v64",["NINTENDO64","nintendo64","n64"]],["NAOMI","Naomi","chd|cdi|gdi|cue|iso|m3u|zip|dat",["naomi"]],["NDS","NDS","nds|zip|7z|rar|cia|dsi|srl",["nds","DS","ds","nintendods","NINTENDODS"]],["NDSI","DSi","nds|zip|7z|cia|dsi|srl",["ndsi","DSi","DSI","dsi","nintendodsi","NINTENDODSI"]],["NEOCD","Neo CD","cue|chd|m3u",["NEOGEOCD","neocd","neogeocd"]],["NEOGEO","NeoGeo","zip|7z",["NG","ng","NeoGeo","neogeo"]],["NGP","NGP","ngp|ngc|zip|7z",["ngp","neogeopocket","NEOGEOPOCKET"]],["NGPC","NGPC","ngp|ngc|zip|7z",["ngpc","neogeopocketcolor","NEOGEOPOCKETCOLOR"]],["ODYSSEY","Odyssey2","bin|zip|7z",["odyssey2","odyssey","ODYSSEY2"]],["OPENBOR","OpenBOR","pak",["openbor","OpenBOR"]],["PC98","PC 98","d98|zip|98d|fdi|fdd|2hd|tfd|d88|88d|hdm|xdf|dup|cmd|hdi|thd|nhd|hdd|hdn",["pc98","necpc98","NECPC98"]],["PCE","TG-16","pce|zip|7z|ccd|iso|img|chd|cue",["pce","PCENGINE","pcengine","TURBOGRAFX","TURBOGRAFX16","turbografx","turbografx16"]],["PCECD","TG-CD","iso|img|chd|pce|ccd|cue|zip|7z",["pcecd","pcenginecd","PCENGINECD","tgcd","TGCD","turbografxcd","TURBOGRAFXCD","turbocd","TURBOCD"]],["PICO8","Pico-8","p8|png|splore",["pico8","pico-8","PICO-8"]],["POKE","Pokemini","min|zip|7z",["poke","pokemini","POKEMINI","POKEMONMINI","pokemonmini"]],["PS","PSX","m3u|chd|cue|img|mdf|pbp|PBP|toc|cbn|iso",["PSX","PSONE","PLAYSTATION","psx","ps","psone","playstation"]],["PSP","PSP","iso|cso|chd|pbp",["psp","ppsspp","PPSSPP","playstationportable","PLAYSTATIONPORTABLE"]],["QUAKE","Quake","fbl|pak",["quake","TYRQUAKE","tyrquake"]],["SATELLAVIEW","Satella","zip|7z|bs|sfc|smc|swc|fig|st",["BSX","SATELLA","bsx","satella","satellaview"]],["SATURN","Saturn","m3u|chd|zip|mds|ccd|iso|cue",["saturn","segasaturn","SEGASATURN","ss","SS"]],["SCUMMVM","ScummVM","scummvm",["scummvm"]],["SEGACD","Sega CD","chd|m3u|zip|7z|gen|smd|md|32x|cue|iso|sms|68k",["segacd","mdcd","MDCD","megacd","MEGACD"]],["SEGASGONE","SG-1000","zip|7z|sms|gg|sg|mv|bin|rom",["SGONETHOUSAND","sgonethousand","segasgone","sg1000","SG1000","segasg1000","SEGASG1000","sg1k","SG1K"]],["SEVENTYEIGHTHUNDRED","Atari 7800","a78|zip|bin|7z",["seventyeighthundred","ATARI7800","A7800","7800","atari7800","a7800"]],["SFC","SNES","zip|7z|smc|sfc|fig|gd3|gd7|dx2|bsx|bs|swc|st",["sfc","SNES","snes","supernes","SUPERNES","SUPERFAMICOM","superfamicom"]],["SGB","SGB","gb|gbc|gba|zip|7z|bin",["sgb","supergameboy","SUPERGAMEBOY"]],["SGFX","SuperGfx","zip|7z|pce|sgx|cue|ccd|chd",["sgfx","SUPERGRAFX","supergrafx","necsgfx","NECSGFX","sgx","SGX"]],["SUFAMI","Sufami","smc|zip|7z",["sufami","sufamiturbo","SUFAMITURBO"]],["SUPERVISION","Supervision","zip|7z|sv|bin",["supervision","watara","WATARA"]],["THIRTYTWOX","Sega 32X","zip|7z|gen|smd|md|32x|bin|iso|sms|68k|chd",["thirtytwox","32X","32x","sega32x","SEGA32X"]],["TIC","TIC-80","tic|zip|7z|fd|sap|k7|m7|rom",["TIC80","tic-80","TIC-80","tic"]],["VB","VirtualBoy","vb|vboy|zip|7z",["vb","virtualboy","VIRTUALBOY"]],["VECTREX","Vectrex","vec|zip|7z",["vectrex","vec","VEC"]],["VIC20","VIC-20","zip|7z|m3u|d64|d6z|d71|d7z|d80|d81|d82|d8z|g64|g6z|g41|g4z|x64|x6z|nib|nbz|d2m|d4m|t64|tap|tcrt|prg|p00|crt|bin|cmd|vfl|vsf|gz|20|40|60|a0|b0|rom",["vic20"]],["VIDEOPAC","VideoPac","bin|zip|7z",["videopac"]],["WOLF","Wolf3D","ecwolf|exe",["wolf","wolfenstein","wolf3d","ecwolf","WOLFENSTEIN","WOLF3D","ECWOLF","WOLFENSTEIN3D","wolfenstein3d"]],["WS","WndrSwan","ws|wsc|zip|7z|pc2",["ws","wonderswan","WONDERSWAN"]],["WSC","WndrSwnC","ws|wsc|zip|7z|pc2",["wonderswancolor","wsc","wonderswanc","WONDERSWANCOLOR","WONDERSWANC"]],["X68000","X68000","dim|zip|img|m3u|7z|d88|88d|hdm|dup|2hd|xdf|hdf|cmd",["x68000","x68k","X68K","sharpx6800","SHARPX6800","sharpx68k","SHARPX68K"]],["ZXS","ZXS","zip|7z|tzx|tap|z80|rzx|scl|trd",["zxs","spectrum","zxspectrum","SPECTRUM","ZXSPECTRUM","SPEC","spec"]]]


// prettier-ignore
const EXTRA_ALIASES: Record<string, string[]> = {
  FC: ["Nintendo - Nintendo Entertainment System", "Nintendo Entertainment System", "Famicom"],
  FDS: ["Nintendo - Family Computer Disk System", "Famicom Disk System"],
  SFC: ["Nintendo - Super Nintendo Entertainment System", "Super Nintendo Entertainment System", "Super Nintendo", "Super Famicom"],
  GB: ["Nintendo - Game Boy", "Game Boy"],
  GBC: ["Nintendo - Game Boy Color", "Game Boy Color"],
  GBA: ["Nintendo - Game Boy Advance", "Game Boy Advance"],
  N64: ["Nintendo - Nintendo 64", "Nintendo 64"],
  NDS: ["Nintendo - Nintendo DS", "Nintendo DS"],
  VB: ["Nintendo - Virtual Boy", "Virtual Boy"],
  POKE: ["Nintendo - Pokemon Mini", "Pokemon Mini"],
  GW: ["Nintendo - Game & Watch", "Game & Watch", "Game and Watch"],
  SATELLAVIEW: ["Nintendo - Satellaview"],
  SUFAMI: ["Nintendo - Sufami Turbo"],
  MD: ["Sega - Mega Drive - Genesis", "Sega Genesis", "Mega Drive", "Genesis"],
  MS: ["Sega - Master System - Mark III", "Sega Master System", "Master System"],
  GG: ["Sega - Game Gear", "Sega Game Gear", "Game Gear"],
  THIRTYTWOX: ["Sega - 32X", "Sega 32X"],
  SEGACD: ["Sega - Mega-CD - Sega CD", "Sega CD", "Mega-CD", "Mega CD"],
  SATURN: ["Sega - Saturn", "Sega Saturn"],
  DC: ["Sega - Dreamcast", "Sega Dreamcast"],
  SEGASGONE: ["Sega - SG-1000", "SG-1000"],
  PS: ["Sony - PlayStation", "Sony PlayStation", "PlayStation", "PS1"],
  PSP: ["Sony - PlayStation Portable", "Sony PSP", "PlayStation Portable"],
  PCE: ["NEC - PC Engine - TurboGrafx-16", "NEC TurboGrafx-16", "PC Engine", "TurboGrafx-16", "TG16", "TG-16"],
  PCECD: ["NEC - PC Engine CD - TurboGrafx-CD", "NEC TurboGrafx-CD", "PC Engine CD", "TurboGrafx-CD"],
  SGFX: ["NEC - PC Engine SuperGrafx", "SuperGrafx"],
  NGP: ["SNK - Neo Geo Pocket", "Neo Geo Pocket"],
  NGPC: ["SNK - Neo Geo Pocket Color", "Neo Geo Pocket Color"],
  NEOCD: ["SNK - Neo Geo CD", "Neo Geo CD"],
  ATARI: ["Atari - 2600", "Atari 2600"],
  FIFTYTWOHUNDRED: ["Atari - 5200", "Atari 5200"],
  SEVENTYEIGHTHUNDRED: ["Atari - 7800", "Atari 7800"],
  LYNX: ["Atari - Lynx", "Atari Lynx"],
  JAGUAR: ["Atari - Jaguar", "Atari Jaguar"],
  ATARIST: ["Atari - ST", "Atari ST"],
  WS: ["Bandai - WonderSwan", "WonderSwan"],
  WSC: ["Bandai - WonderSwan Color", "WonderSwan Color"],
  COLECO: ["Coleco - ColecoVision", "ColecoVision"],
  INTELLIVISION: ["Mattel - Intellivision", "Intellivision"],
  VECTREX: ["GCE - Vectrex", "Vectrex"],
  MSX: ["Microsoft - MSX", "Microsoft - MSX2", "MSX"],
  COMMODORE: ["Commodore - 64", "Commodore 64"],
  AMIGA: ["Commodore - Amiga", "Commodore Amiga"],
  ZXS: ["Sinclair - ZX Spectrum", "ZX Spectrum"],
  CPC: ["Amstrad - CPC", "Amstrad CPC"],
  SUPERVISION: ["Watara - Supervision"],
  FAIRCHILD: ["Fairchild - Channel F"],
  ODYSSEY: ["Magnavox - Odyssey2", "Magnavox Odyssey 2"],
  X68000: ["Sharp - X68000"],
  PICO8: ["PICO-8"],
  NEOGEO: ["SNK - Neo Geo", "Neo Geo"],
}

/** Extensions that point to one system even outside a recognised folder. */
// prettier-ignore
export const EXT_SYSTEM: Record<string, string> = {
  ".gb": "GB", ".gbc": "GBC", ".gba": "GBA", ".nes": "FC", ".fds": "FDS", ".sfc": "SFC", ".smc": "SFC",
  ".n64": "N64", ".z64": "N64", ".v64": "N64", ".md": "MD", ".gen": "MD", ".smd": "MD", ".sms": "MS",
  ".gg": "GG", ".32x": "THIRTYTWOX", ".pce": "PCE", ".sgx": "SGFX", ".nds": "NDS", ".vb": "VB",
  ".ws": "WS", ".wsc": "WSC", ".ngp": "NGP", ".ngc": "NGPC", ".lnx": "LYNX", ".a26": "ATARI",
  ".a52": "FIFTYTWOHUNDRED", ".a78": "SEVENTYEIGHTHUNDRED", ".min": "POKE", ".col": "COLECO",
  ".int": "INTELLIVISION", ".vec": "VECTREX", ".j64": "JAGUAR", ".jag": "JAGUAR", ".sv": "SUPERVISION",
  ".cso": "PSP", ".p8": "PICO8", ".tic": "TIC",
}

/**
 * BIOS files a system usually needs, checked against the card's BIOS folder.
 * Each inner list is "any one of these".
 */
export const BIOS_NEEDS: Record<string, { files: string[][]; note: string }> = {
  FDS: { files: [["disksys.rom"]], note: "disksys.rom" },
  PCECD: { files: [["syscard3.pce"]], note: "syscard3.pce" },
  SEGACD: { files: [["bios_CD_U.bin", "bios_CD_E.bin", "bios_CD_J.bin"]], note: "bios_CD_U.bin (or the E/J version)" },
  DC: { files: [["dc/dc_boot.bin"], ["dc/dc_flash.bin"]], note: "dc/dc_boot.bin and dc/dc_flash.bin" },
  LYNX: { files: [["lynxboot.img"]], note: "lynxboot.img" },
}

export const normKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "")

const VENDORS = ["nintendo", "sega", "sony", "nec", "snk", "atari", "bandai", "microsoft", "commodore", "coleco", "mattel"]

export interface SystemDef {
  id: string
  label: string
  ext: Set<string>
}

export class SystemMatcher {
  private byAlias = new Map<string, string>()
  readonly defs = new Map<string, SystemDef>()

  /** cardEmu: systems from the card's own Emu configs; they win over the built-in table. */
  constructor(cardEmu: { id: string; label: string; extlist: Set<string>; aliases: string[] }[] = []) {
    for (const [id, label, ext, aliases] of BUILTIN) {
      this.defs.set(id, { id, label, ext: new Set(ext.toLowerCase().split("|").filter(Boolean).map((e) => `.${e}`)) })
      for (const a of [id, label, ...aliases, ...(EXTRA_ALIASES[id] ?? [])]) this.addAlias(a, id)
    }
    for (const e of cardEmu) {
      this.defs.set(e.id, { id: e.id, label: e.label, ext: e.extlist })
      for (const a of [e.id, ...e.aliases]) this.addAlias(a, e.id)
    }
  }

  private addAlias(alias: string, id: string) {
    const k = normKey(alias)
    if (k && !this.byAlias.has(k)) this.byAlias.set(k, id)
  }

  /** System for a folder name, or null. */
  folder(name: string): string | null {
    const k = normKey(name)
    if (!k) return null
    const hit = this.byAlias.get(k)
    if (hit) return hit
    for (const v of VENDORS) if (k.startsWith(v) && this.byAlias.has(k.slice(v.length))) return this.byAlias.get(k.slice(v.length))!
    return null
  }

  label(id: string) {
    return this.defs.get(id)?.label ?? id
  }

  accepts(id: string, ext: string) {
    const d = this.defs.get(id)
    return !d || d.ext.size === 0 || d.ext.has(ext)
  }
}
