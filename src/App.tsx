import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Download, HardDrive, Library as LibraryIcon, LogOut, Redo2, Save, Sparkles, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Toaster } from "@/components/ui/sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Brand } from "@/components/Brand"
import { ConnectScreen, type LcdState } from "@/components/ConnectScreen"
import { Library } from "@/components/Library"
import { SystemRail } from "@/components/SystemRail"
import { CollectionsPanel } from "@/components/CollectionsPanel"
import { SuggestDialog } from "@/components/SuggestDialog"
import { LibraryView } from "@/components/library/LibraryView"
import { renderCover } from "@/lib/cover"
import { ConflictDialog, CoverDialog, NameDialog, type NameRequest, SaveDialog } from "@/components/Dialogs"
import { type CardDir, FsaDir, MemDir } from "@/lib/fs"
import { buildDemoCard } from "@/lib/demo"
import { setArtRoot } from "@/lib/art"
import { ensurePermission, recallHandle, rememberHandle } from "@/lib/persist"
import {
  type Collection,
  type Rom,
  type SavePlan,
  type ScanResult,
  ConflictError,
  NotSpruceError,
  loadCollections,
  saveCollections,
  scanCard,
  serializeCollections,
} from "@/lib/spruce"
import { type CardMode, useWorkspace } from "@/state/useWorkspace"

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? "⌘" : "Ctrl"

function download(name: string, data: Blob | string) {
  const url = URL.createObjectURL(typeof data === "string" ? new Blob([data], { type: "application/json" }) : data)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function App() {
  const ws = useWorkspace()
  const { session, collections, actions } = ws
  const [lcd, setLcd] = useState<LcdState>({ kind: "idle" })
  const [remembered, setRemembered] = useState<FileSystemDirectoryHandle | null>(null)
  const [systemFilter, setSystemFilter] = useState<string | null>(null)
  const [nameReq, setNameReq] = useState<NameRequest | null>(null)
  const [coverFor, setCoverFor] = useState<Collection | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [coverEpoch, setCoverEpoch] = useState(0)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const latestScan = useRef<ScanResult | null>(null)

  useEffect(() => {
    recallHandle().then(setRemembered)
  }, [])

  /* ---------------- opening a card ---------------- */

  const load = useCallback(
    async (root: CardDir, mode: CardMode) => {
      setLcd({ kind: "scanning", progress: null })
      try {
        setArtRoot(root)
        const scan = await scanCard(root, (progress) => setLcd({ kind: "scanning", progress }))
        const loaded = await loadCollections(root)
        if (!scan.roms.length) throw new NotSpruceError("The card has no games in its Roms folder yet.")
        ws.open({ root, mode, scan, snapshot: loaded.snapshot, warnings: loaded.warnings }, loaded.collections)
        setSystemFilter(null)
        setLcd({ kind: "idle" })
        loaded.warnings.forEach((w) => toast.warning(w))
        if (!scan.info.hasPyUI) toast.warning("This card doesn't have PyUI. Collections need spruceOS 4.x.")
        toast.success(`${scan.roms.length} games on ${scan.systems.length} systems`, {
          description:
            mode === "demo"
              ? "Demo card. Changes stay in this tab."
              : mode === "readonly"
                ? "Read-only. You'll download collections.json when you save."
                : `spruceOS ${scan.info.version ?? "version unknown"}`,
        })
      } catch (e) {
        const message = e instanceof NotSpruceError ? e.message : `Couldn't read the card: ${(e as Error).message}`
        setLcd({ kind: "error", message })
        toast.error(message)
      }
    },
    [ws],
  )

  const openCard = async () => {
    try {
      const h = await window.showDirectoryPicker({ id: "spruce-card", mode: "readwrite" })
      await rememberHandle(h)
      setRemembered(h)
      await load(new FsaDir(h), "card")
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") toast.error(`Couldn't open the folder: ${(e as Error).message}`)
    }
  }

  const reopen = async () => {
    if (!remembered) return
    try {
      if (!(await ensurePermission(remembered))) {
        toast.error("Permission wasn't granted. Open the card again.")
        return
      }
      await load(new FsaDir(remembered), "card")
    } catch {
      toast.error("That card isn't connected anymore. Open it again.")
    }
  }

  /* ---------------- editing ---------------- */

  const active = collections.find((c) => c.uid === ws.selected) ?? null
  const scan = session?.scan
  latestScan.current = scan ?? null

  const refreshCard = async (): Promise<ScanResult | null> => {
    if (!session) return null
    try {
      const fresh = await scanCard(session.root)
      latestScan.current = fresh
      ws.updateScan(fresh)
      return fresh
    } catch (e) {
      toast.error(`Couldn't reread the card: ${(e as Error).message}`)
      return null
    }
  }

  const collectionFromPaths = (name: string, paths: string[]) => {
    const s = latestScan.current
    if (!s) return
    const roms = paths.map((p) => s.byPath.get(p)).filter((r): r is Rom => !!r)
    if (roms.length) actions.createMany([{ name, roms }])
  }

  const askNew = (roms: Rom[] = []) =>
    setNameReq({
      title: "New collection",
      action: "Create",
      initial: "",
      hint: roms.length ? `Starts with ${roms.length} selected ${roms.length === 1 ? "game" : "games"}.` : undefined,
      onSubmit: (name) => {
        actions.create(name, roms)
        toast.success(`Created ${name}`)
      },
    })

  const addTo = (uid: string, roms: Rom[]) => {
    const target = collections.find((c) => c.uid === uid)
    const n = actions.addGames(uid, roms)
    ws.setSelected(uid)
    if (n) toast.success(`Added ${n} ${n === 1 ? "game" : "games"} to ${target?.name}`)
    else toast.info(`Those games are already in ${target?.name}`)
  }

  const toggleInActive = (rom: Rom) => {
    if (!active) return
    if (active.games.some((g) => g.rom_file_path === rom.path)) actions.removeGames(active.uid, [rom.path])
    else actions.addGames(active.uid, [rom])
  }

  const createSuggested = async (items: { name: string; roms: Rom[] }[], makeCovers: boolean) => {
    const res = actions.createMany(items)
    const made = res.filter((r) => !r.merged)
    const merged = res.length - made.length
    toast.success(`Created ${made.length} ${made.length === 1 ? "collection" : "collections"}`, {
      description: [merged ? `Added games to ${merged} existing.` : "", "Review them, then save to the card."].filter(Boolean).join(" "),
      action: { label: "Undo", onClick: () => ws.undo() },
    })
    if (makeCovers) {
      for (const r of made) {
        try {
          actions.setCover(r.uid, await renderCover(r.name, r.roms, "grid4"))
        } catch {
          /* a missing cover is fine */
        }
      }
    }
  }

  const remove = (c: Collection) => {
    actions.remove(c.uid)
    toast(`Deleted ${c.name}`, { action: { label: "Undo", onClick: () => ws.undo() } })
  }

  /* ---------------- saving ---------------- */

  const plan = (): SavePlan => ({
    json: serializeCollections(collections),
    covers: collections.filter((c) => ws.covers[c.uid]).map((c) => ({ name: c.name, blob: ws.covers[c.uid] })),
    coverRenames: collections
      .filter((c) => c.originalName && c.originalName !== c.name && !ws.covers[c.uid])
      .map((c) => ({ from: c.originalName!, to: c.name })),
  })

  const doSave = async (force = false) => {
    if (!session) return
    const p = plan()
    if (session.mode === "readonly") {
      download("collections.json", p.json)
      p.covers.forEach((c) => download(`${c.name}.png`, c.blob))
      ws.markSaved(p.json)
      setSaveOpen(false)
      toast.success("Downloaded collections.json", {
        description: p.covers.length ? "Copy the PNG covers into Collections/Imgs on the card." : "Copy it into the Collections folder on the card.",
      })
      return
    }
    setSaving(true)
    try {
      const res = await saveCollections(session.root, p, session.snapshot, { force })
      ws.markSaved(res.snapshot)
      setCoverEpoch((n) => n + 1)
      setSaveOpen(false)
      setConflict(false)
      toast.success(session.mode === "demo" ? "Saved to the demo card" : "Saved to card", {
        description: res.backup ? `Previous file kept as ${res.backup}` : "Eject the card safely before moving it to the handheld.",
      })
    } catch (e) {
      if (e instanceof ConflictError) {
        setSaveOpen(false)
        setConflict(true)
      } else toast.error(`Couldn't save: ${(e as Error).message}`, { description: "Nothing was changed on the card." })
    } finally {
      setSaving(false)
    }
  }

  const reloadFromCard = async () => {
    if (!session) return
    setConflict(false)
    const loaded = await loadCollections(session.root)
    ws.open({ ...session, snapshot: loaded.snapshot, warnings: loaded.warnings }, loaded.collections)
    toast.info("Reloaded collections from the card")
  }

  const dirty = ws.diff.total > 0

  /* ---------------- keyboard + leave guard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!session) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const typing = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      const k = e.key.toLowerCase()
      if (k === "s") {
        e.preventDefault()
        if (dirty) setSaveOpen(true)
      } else if (!typing && k === "z") {
        e.preventDefault()
        if (e.shiftKey) ws.redo()
        else ws.undo()
      } else if (!typing && k === "y") {
        e.preventDefault()
        ws.redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [session, dirty, ws])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  const coverRoms = useMemo(
    () => (coverFor && scan ? coverFor.games.map((g) => scan.byPath.get(g.rom_file_path)).filter((r): r is Rom => !!r) : []),
    [coverFor, scan],
  )

  /* ---------------- render ---------------- */

  if (!session || !scan) {
    return (
      <>
        <ConnectScreen
          lcd={lcd}
          rememberedName={remembered?.name ?? null}
          onOpen={openCard}
          onReconnect={reopen}
          onDemo={() => load(buildDemoCard(), "demo")}
          onFolder={(files) => load(MemDir.fromFileList(files), "readonly")}
        />
        <Toaster position="bottom-right" />
      </>
    )
  }

  const readOnly = session.mode === "readonly"

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-shell-2/80 px-5 py-3 backdrop-blur">
          <Brand />
          <div className="flex min-w-0 items-center gap-2 rounded-md bg-panel px-3 py-1.5 text-sm ring-1 ring-line">
            <HardDrive className="size-4 shrink-0 text-btn-b" />
            <span className="truncate font-medium">{session.root.name}</span>
            <span className="hidden text-ink-dim sm:inline">
              {session.mode === "demo" ? "demo" : readOnly ? "read-only" : `spruceOS ${scan.info.version ?? "?"}`}
            </span>
            <span className="hidden text-ink-dim md:inline">{scan.roms.length} games</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant={libraryOpen ? "default" : "secondary"}
              className="press"
              onClick={() => setLibraryOpen((o) => !o)}
              aria-pressed={libraryOpen}
            >
              <LibraryIcon className={libraryOpen ? "" : "text-btn-b"} /> Library
            </Button>
            <Button variant="secondary" className="press mr-2" onClick={() => setSuggestOpen(true)} disabled={libraryOpen}>
              <Sparkles className="text-btn-b" /> Suggest with AI
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => ws.undo()} disabled={!ws.canUndo} aria-label="Undo">
                  <Undo2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Undo <Kbd>{MOD}</Kbd>
                <Kbd>Z</Kbd>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => ws.redo()} disabled={!ws.canRedo} aria-label="Redo">
                  <Redo2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Redo <Kbd>{MOD}</Kbd>
                <Kbd>⇧</Kbd>
                <Kbd>Z</Kbd>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Close card"
                  onClick={() => {
                    if (dirty && !confirm("You have unsaved changes. Close the card anyway?")) return
                    ws.close()
                    setArtRoot(null)
                  }}
                >
                  <LogOut />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close card</TooltipContent>
            </Tooltip>
            <Button className="press ml-2" onClick={() => setSaveOpen(true)} disabled={!dirty}>
              {readOnly ? <Download /> : <Save />}
              {readOnly ? "Download" : "Save to card"}
              {dirty && (
                <span className="ml-0.5 rounded-sm bg-primary-foreground/20 px-1.5 font-pixel text-[11px] leading-5">{ws.diff.total}</span>
              )}
            </Button>
          </div>
        </header>

        {libraryOpen ? (
          <LibraryView
            card={session.root}
            cardWritable={session.mode !== "readonly"}
            cardScan={scan}
            collections={collections}
            onBack={() => setLibraryOpen(false)}
            onCardChanged={refreshCard}
            onMakeCollection={collectionFromPaths}
          />
        ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <SystemRail systems={scan.systems} total={scan.roms.length} value={systemFilter} onChange={setSystemFilter} />
          <Library
            roms={scan.roms}
            systems={scan.systems}
            systemFilter={systemFilter}
            collections={collections}
            active={active}
            onToggleInActive={toggleInActive}
            onAddTo={addTo}
            onNewFrom={askNew}
          />
          <CollectionsPanel
            root={session.root}
            collections={collections}
            selected={ws.selected}
            covers={ws.covers}
            coverEpoch={coverEpoch}
            byPath={scan.byPath}
            systems={scan.systems}
            onSelect={ws.setSelected}
            onNew={() => askNew()}
            onRename={(c) =>
              setNameReq({
                title: "Rename collection",
                action: "Rename",
                initial: c.name,
                selfUid: c.uid,
                onSubmit: (name) => actions.rename(c.uid, name),
              })
            }
            onDuplicate={(c) =>
              setNameReq({
                title: "Duplicate collection",
                action: "Duplicate",
                initial: `${c.name} copy`,
                onSubmit: (name) => actions.duplicate(c.uid, name),
              })
            }
            onMove={actions.move}
            onCover={setCoverFor}
            onDelete={remove}
            onRemoveGames={actions.removeGames}
          />
        </div>
        )}
      </div>

      <NameDialog req={nameReq} collections={collections} onClose={() => setNameReq(null)} />
      <CoverDialog
        target={coverFor}
        roms={coverRoms}
        systems={scan.systems}
        onClose={() => setCoverFor(null)}
        onUse={(blob) => {
          if (!coverFor) return
          actions.setCover(coverFor.uid, blob)
          toast.success(`Cover ready for ${coverFor.name}`, { description: "It's written to the card when you save." })
        }}
      />
      <SuggestDialog
        open={suggestOpen}
        roms={scan.roms}
        systems={scan.systems}
        collections={collections}
        onClose={() => setSuggestOpen(false)}
        onCreate={createSuggested}
      />
      <SaveDialog open={saveOpen} diff={ws.diff} readOnly={readOnly} saving={saving} onClose={() => setSaveOpen(false)} onConfirm={() => doSave()} />
      <ConflictDialog open={conflict} onCancel={() => setConflict(false)} onOverwrite={() => doSave(true)} onReload={reloadFromCard} />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
