# Changelog

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
