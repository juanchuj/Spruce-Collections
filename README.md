# Spruce Collections

Build spruceOS collections on your computer and save them straight to the SD card.
Works with any spruceOS 4.x card (TrimUI Brick / Brick Pro / Smart Pro, Miyoo, Anbernic).

## Use it
1. Turn the handheld off and put the SD card in a card reader.
2. Open the app in Chrome or Edge and choose **Open SD card**. Pick the card root (the folder with `Roms` and `Emu`).
3. Pick a collection on the right, then click **+** on games in the library (or tick several and use **Add to…**).
4. **Save to card** (Ctrl/⌘+S). Eject the card and put it back in the handheld.

Firefox and Safari can read the card but not write to it: there you download `collections.json` and copy it into `Collections/` yourself.

## Suggest collections with AI
**Suggest with AI** builds a prompt with your whole library for Claude, Gemini or ChatGPT. Paste the reply back and the app creates the collections. Replies use this format:
```json
{ "format": "spruce-collections/v1",
  "collections": [ { "name": "Zelda Saga", "description": "…", "games": ["k3j9a1", "0bq7zz"] } ] }
```
Game IDs are short hashes of each ROM path, so they stay the same between sessions.

## What it writes
- `Collections/collections.json` — same schema PyUI's `CollectionsManager` uses:
  `[{ "collection_name": "...", "game_list": [{ "rom_file_path": "/mnt/SDCARD/Roms/GBA/x.gba", "game_system_name": "GBA" }] }]`
- `Collections/collections.json.bak-YYYYMMDD-HHMMSS` — the previous file, on every save.
- `Collections/Imgs/<collection name>.png` — optional cover generated from box art.

ROM detection mirrors PyUI: systems from `Emu/<SYS>/config.json` (`extlist`, `alternativeFolderNames`, `ignoreList`, `scanSubfolders`), names from `miyoogamelist.xml`/`gamelist.xml`, box art from `Roms/<SYS>/Imgs/<name>.png`.

## Develop
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # single self-contained dist/index.html
```
Stack: Vite, React 19, TypeScript, Tailwind CSS 4, shadcn/ui (new-york-v4 components), Sonner.
Deploys to GitHub Pages via `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).

Unofficial; not affiliated with the spruceOS team.
