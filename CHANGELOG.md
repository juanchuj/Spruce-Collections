# Changelog

## v0.3.1 — 2026-11-17
- New "Reorder collections" tool (button next to New collection): drag and drop, up/down arrows, Alt+↑/↓ from the keyboard, quick sorts (A–Z, Z–A, most games first) and a handheld preview. Applied in one undo step; the handheld shows collections in this order after saving.
- The collection preview now says games are listed A–Z by file name, as spruceOS does on the device.

## v0.3.0 — 2026-11-17
New Library tool (header button "Library").
- Open your ROM library folder read-only (drive, NAS share or local folder), reopen it in one click; demo library included.
- System detection from folder names (spruceOS, No-Intro/Redump, EmuDeck, Batocera, LaunchBox styles), file extensions and the files inside zips; unrecognized folders can be assigned to a system or ignored.
- Duplicates folded into one entry per game: regions, revisions, fan translations, betas/demos/hacks, bad dumps, file formats (CHD, PBP, CUE/BIN, GDI, ISO, ZIP) and multi-disc sets (Disc N files and M3U playlists).
- Best version chosen by your region order (default USA › World › Europe › Japan), latest revision, preferred format; override per game from the versions menu.
- "On card" detection against the open SD card; option to hide those games.
- Ask AI: prompt for Claude, Gemini or ChatGPT with your taste (collections and games on the card), free space and focus. Small libraries send the full list with IDs; big ones let the AI suggest by name and the tool matches them against your library. Reply format: spruce-library-suggestions/v1.
- Copy to card with progress, stop and resume: Roms/<system>, cue+bin kept together, multi-disc games in a hidden folder with an .m3u playlist, box art copied when the library has it, checksum-identified files renamed to their official names.
- Checks before copying: free space (enter the card size once), 4 GB FAT32 limit, missing BIOS for FDS, PC Engine CD, Sega CD, Dreamcast and Lynx, systems without an emulator on the card.
- Optional collection for the copied games.
- DAT import (No-Intro, Redump, MAME/FBNeo Logiqx XML): exact identification by CRC32 from zips for free, optional checksums of loose files up to 64 MB, arcade set names shown as full titles.
- Scan cache: later scans only read files that changed.

## v0.2.1 — 2026-11-17
- Suggest with AI: new option to ask for a single collection (1, 3, 5 or 10).
- With one collection, the focus box asks what the collection should be about and the prompt asks for one theme built around it; left empty, the AI picks the theme.

## v0.2.0 — 2026-11-17
- New "Suggest with AI" button: builds a prompt with every game on the card (short stable IDs, titles, systems, gamelist genres) for Claude, Gemini or ChatGPT.
- Choose 3, 5 or 10 collections, max games per collection (12, 20 or 30) and an optional focus ("games for my kids", "short sessions"…). Existing collections are listed so the AI doesn't repeat them.
- Copy the prompt, download it as .txt for large libraries, or open the chosen AI in a new tab.
- Paste the reply back: the app reads the standard JSON format (spruce-collections/v1), matches games by ID (or by title as a fallback), skips games not on the card and cleans names the card can't store.
- Review before creating: include or skip each suggestion, edit names; a name that matches an existing collection adds its games there.
- Batch creation in one undo step, with optional box-art covers for each new collection.

## v0.1.1 — 2026-11-17
- Cover dialog now has two tabs: "From box art" (the existing collage) and "Your image".
- Your image: a Nano Banana prompt written from the collection's games (titles, systems, gamelist genres), with three art styles, an option to ask for the collection name in the artwork, Copy prompt and Open Gemini.
- Upload any PNG, JPG or WebP by clicking, dragging or pasting from the clipboard; crop to square or show the whole image, with an optional name bar. Saved as a 480 × 480 PNG in Collections/Imgs.
- Library reads genres from gamelist.xml.
- "Make cover" renamed to "Set cover".

## v0.1.0 — 2026-11-17
First release.
- Open a spruceOS SD card from Chrome/Edge (File System Access API); reopen the last card in one click.
- Read-only mode for Firefox/Safari with collections.json download.
- Demo card to try the app without a card.
- Library of every installed game, detected with PyUI's own rules (extlist, alternative folders, ignore list, subfolders, gamelist names, box art).
- Search, filter by system, multi-select.
- Create, rename, duplicate, reorder and delete collections; add/remove games with one click.
- Handheld-style preview in the device's sort order; flags games no longer on the card.
- Cover generator (4-game grid, 9-game grid, title card) saved to Collections/Imgs.
- Safe save: change summary, dated backup, conflict check if the card changed since opening.
- Undo/redo (Ctrl/⌘+Z, Shift+Ctrl/⌘+Z), Ctrl/⌘+S to save, / to search.
