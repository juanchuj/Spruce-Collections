import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, ChevronDown, CircleCheck, FolderOpen, Gamepad2, Library, RefreshCw, RotateCcw, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { SystemRail } from "@/components/SystemRail"
import { type CardDir, FsaDir, MemDir, supportsFsAccess } from "@/lib/fs"
import type { Collection, GameSystem, ScanResult } from "@/lib/spruce"
import { type CopyResult, measureCard, planCopy } from "@/lib/library/copy"
import { type DatFile, DatIndex } from "@/lib/library/dat"
import { buildDemoLibrary } from "@/lib/library/demo"
import { type LibGame, type LibraryProgress, type LibraryScan, formatBytes, rechoose, scanLibrary } from "@/lib/library/scan"
import {
  type LibrarySettings,
  DEFAULT_SETTINGS,
  addDat,
  loadCache,
  loadDats,
  loadSettings,
  recallLibrary,
  rememberLibrary,
  removeDat,
  saveCache,
  saveSettings,
} from "@/lib/library/store"
import { SystemMatcher } from "@/lib/library/systems"
import { cn } from "@/lib/utils"
import { AskAiPanel, CopyPanel, SettingsPanel } from "./LibraryPanels"

const ROW = 56

interface Props {
  card: CardDir
  cardWritable: boolean
  cardScan: ScanResult
  collections: Collection[]
  onBack: () => void
  /** Rescan the card after copying; returns the fresh scan. */
  onCardChanged: () => Promise<ScanResult | null>
  onMakeCollection: (name: string, paths: string[]) => void
}

export function LibraryView({ card, cardWritable, cardScan, collections, onBack, onCardChanged, onMakeCollection }: Props) {
  const [settings, setSettings] = useState<LibrarySettings>(DEFAULT_SETTINGS)
  const [dats, setDats] = useState<DatFile[]>([])
  const [root, setRoot] = useState<CardDir | null>(null)
  const [remembered, setRemembered] = useState<FileSystemDirectoryHandle | null>(null)
  const [scan, setScan] = useState<LibraryScan | null>(null)
  const [progress, setProgress] = useState<LibraryProgress | null>(null)
  const [systemFilter, setSystemFilter] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [queue, setQueue] = useState<string[]>([])
  const [override, setOverride] = useState<Record<string, number>>({})
  const [tab, setTab] = useState("ai")
  const [usedBytes, setUsedBytes] = useState<number | null>(null)
  const abort = useRef<AbortController | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)
  const scroller = useRef<HTMLDivElement>(null)

  const matcher = useMemo(
    () => new SystemMatcher(cardScan.emu.map((e) => ({ id: e.id, label: e.label, extlist: e.extlist, aliases: e.aliases }))),
    [cardScan.emu],
  )

  useEffect(() => {
    loadSettings().then(setSettings)
    loadDats().then(setDats)
    recallLibrary().then(setRemembered)
  }, [])

  useEffect(() => {
    const ctl = new AbortController()
    setUsedBytes(null)
    measureCard(card, ctl.signal).then((n) => !ctl.signal.aborted && setUsedBytes(n))
    return () => ctl.abort()
  }, [card, cardScan])

  const updateSettings = (s: LibrarySettings) => {
    setSettings(s)
    saveSettings(s)
  }

  const runScan = useCallback(
    async (lib: CardDir, s: LibrarySettings = settings, d: DatFile[] = dats) => {
      const ctl = new AbortController()
      abort.current = ctl
      setProgress({ phase: "Listing files", files: 0, detail: "" })
      try {
        const cache = lib instanceof FsaDir ? await loadCache(lib.name) : {}
        const res = await scanLibrary({
          root: lib,
          matcher,
          settings: s,
          dats: new DatIndex(d),
          cache,
          cardRoms: cardScan.roms,
          onProgress: setProgress,
          signal: ctl.signal,
        })
        if (lib instanceof FsaDir) saveCache(lib.name, res.cache)
        setScan(res.scan)
        setOverride({})
        toast.success(`${res.scan.games.length.toLocaleString()} games in your library`, {
          description: `${res.scan.files.toLocaleString()} files, ${res.scan.duplicatesRemoved.toLocaleString()} extra versions folded in${
            res.scan.identified ? `, ${res.scan.identified.toLocaleString()} identified by checksum` : ""
          }.`,
        })
      } catch (e) {
        if ((e as DOMException).name !== "AbortError") toast.error(`Couldn't read the library: ${(e as Error).message}`)
      } finally {
        setProgress(null)
        abort.current = null
      }
    },
    [settings, dats, matcher, cardScan.roms],
  )

  const open = async () => {
    try {
      const h = await window.showDirectoryPicker({ id: "spruce-library", mode: "read" })
      await rememberLibrary(h)
      setRemembered(h)
      const lib = new FsaDir(h)
      setRoot(lib)
      runScan(lib)
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") toast.error((e as Error).message)
    }
  }
  const reopen = async () => {
    if (!remembered) return
    try {
      const ok = (await remembered.queryPermission({ mode: "read" })) === "granted" || (await remembered.requestPermission({ mode: "read" })) === "granted"
      if (!ok) return toast.error("Permission wasn't granted. Open the library again.")
      const lib = new FsaDir(remembered)
      setRoot(lib)
      runScan(lib)
    } catch {
      toast.error("That folder isn't available anymore. Open it again.")
    }
  }

  // Re-pick best versions when preferences change — no rescan needed.
  const view = useMemo(() => (scan ? rechoose(scan, settings) : null), [scan, settings])
  const variantOf = useCallback((g: LibGame) => g.variants[override[g.id] ?? g.best], [override])

  const supported = useMemo(() => new Set(cardScan.emu.map((e) => e.id)), [cardScan.emu])
  const visible = useMemo(() => {
    if (!view) return []
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return view.games.filter((g) => {
      if (systemFilter && g.system !== systemFilter) return false
      if (!settings.showExtras && g.extra) return false
      if (settings.hideOnCard && g.onCard && !query) return false
      if (!terms.length) return true
      const hay = `${g.title} ${g.system} ${matcher.label(g.system)}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [view, systemFilter, settings.showExtras, settings.hideOnCard, query, matcher])

  const candidates = useMemo(
    () => (view ? view.games.filter((g) => !g.onCard && !g.extra && supported.has(g.system) && (!systemFilter || g.system === systemFilter)) : []),
    [view, supported, systemFilter],
  )

  const byId = useMemo(() => new Map(view?.games.map((g) => [g.id, g]) ?? []), [view])
  const queueSet = useMemo(() => new Set(queue), [queue])
  const jobs = useMemo(
    () => queue.map((id) => byId.get(id)).filter((g): g is LibGame => !!g).map((g) => planCopy(g, variantOf(g), cardScan.emu)),
    [queue, byId, variantOf, cardScan.emu],
  )

  const toggleQueue = (id: string) => setQueue((q) => (q.includes(id) ? q.filter((x) => x !== id) : [...q, id]))
  const addToQueue = (ids: string[]) => {
    setQueue((q) => [...q, ...ids.filter((id) => !q.includes(id))])
    setTab("copy")
    toast.success(`Added ${ids.length} to the copy list`)
  }

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [view])
  useEffect(() => scroller.current?.scrollTo({ top: 0 }), [systemFilter, query])

  const onCopied = async (results: CopyResult[], collectionName: string | null) => {
    const copied = results.filter((r) => r.status === "copied").length
    const skipped = results.filter((r) => r.status === "skipped").length
    const failed = results.filter((r) => r.status === "failed")
    const fresh = await onCardChanged()
    const okJobs = results.filter((r) => r.status !== "failed").map((r) => r.job)
    if (collectionName && okJobs.length) onMakeCollection(collectionName, okJobs.map((j) => `/mnt/SDCARD/${j.mainDest}`))
    setQueue((q) => q.filter((id) => failed.some((f) => f.job.game.id === id)))
    if (failed.length)
      toast.error(`${failed.length} ${failed.length === 1 ? "game" : "games"} didn't copy`, { description: failed.map((f) => `${f.job.game.title}: ${f.error}`).slice(0, 3).join(" ") })
    if (copied || skipped)
      toast.success(`Copied ${copied} ${copied === 1 ? "game" : "games"} to the card`, {
        description: [skipped ? `${skipped} were already there.` : "", collectionName ? `Added to ${collectionName}; save to write the collection.` : ""].filter(Boolean).join(" "),
      })
    if (fresh && scan) {
      // Mark newly copied games as on the card.
      const ids = new Set(okJobs.map((j) => j.game.id))
      setScan({ ...scan, games: scan.games.map((g) => (ids.has(g.id) ? { ...g, onCard: true } : g)) })
    }
  }

  const railSystems: GameSystem[] = useMemo(() => {
    const colors = new Map(cardScan.systems.map((s) => [s.id, s.themeColor]))
    return (view?.systems ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      folders: [],
      extlist: new Set<string>(),
      themeColor: colors.get(s.id),
      romCount: view!.games.filter((g) => g.system === s.id && (settings.showExtras || !g.extra) && (!settings.hideOnCard || !g.onCard)).length,
    }))
  }, [view, cardScan.systems, settings.showExtras, settings.hideOnCard])

  /* ---------------- render ---------------- */

  const topBar = (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-shell-2/60 px-5 py-2.5">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft /> Collections
      </Button>
      <div className="flex items-center gap-2">
        <Library className="size-4 text-btn-b" />
        <span className="font-pixel text-sm text-ink">Library</span>
        {root && <span className="truncate text-sm text-ink-dim">{root.name}</span>}
      </div>
      {view && (
        <span className="text-xs text-ink-dim">
          {view.files.toLocaleString()} files, {view.games.length.toLocaleString()} games, {view.games.filter((g) => g.onCard).length.toLocaleString()} on the card
        </span>
      )}
      {root && (
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => runScan(root)} disabled={!!progress}>
            <RefreshCw /> Rescan
          </Button>
          <Button size="sm" variant="ghost" onClick={() => (supportsFsAccess() ? open() : undefined)} disabled={!!progress || !supportsFsAccess()}>
            <FolderOpen /> Other folder
          </Button>
        </div>
      )}
    </div>
  )

  if (!root || (!view && !progress)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topBar}
        <div className="grid flex-1 place-items-center p-8">
          <div className="max-w-lg space-y-6 text-center">
            <Library className="mx-auto size-10 text-btn-b" />
            <h2 className="font-pixel text-2xl text-ink">Open your ROM library</h2>
            <p className="leading-relaxed text-ink-dim">
              Point this at the folder where you keep all your games: a drive, a NAS share or a folder on this computer. It's read-only: the
              tool lists every game once, picks the best version of each and helps you choose what goes on the card.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {supportsFsAccess() ? (
                <Button size="lg" className="press" onClick={open}>
                  <FolderOpen /> Open library folder
                </Button>
              ) : (
                <p className="text-sm text-amber">Opening a library needs Chrome or Edge.</p>
              )}
              {remembered && supportsFsAccess() && (
                <Button size="lg" variant="secondary" className="press" onClick={reopen}>
                  <RotateCcw /> Reopen {remembered.name}
                </Button>
              )}
              <Button
                size="lg"
                variant="ghost"
                className="text-btn-b hover:text-btn-b"
                onClick={() => {
                  const lib: MemDir = buildDemoLibrary()
                  setRoot(lib)
                  runScan(lib)
                }}
              >
                <Gamepad2 /> Try the demo library
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (progress || !view) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topBar}
        <div className="grid flex-1 place-items-center p-8">
          <div className="lcd-bezel w-full max-w-md rounded-[20px] p-5">
            <div className="lcd space-y-3 rounded-md p-5 font-pixel" role="status" aria-live="polite">
              <div className="text-lg leading-none">{progress?.phase ?? "Reading"}</div>
              <div className="text-sm">{(progress?.files ?? 0).toLocaleString()} files</div>
              <div className="truncate font-sans text-xs font-semibold opacity-80">{progress?.detail}</div>
            </div>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const start = Math.max(0, Math.floor(scrollTop / ROW) - 6)
  const end = Math.min(visible.length, Math.ceil((scrollTop + height) / ROW) + 6)
  const allVisibleQueued = visible.length > 0 && visible.every((g) => queueSet.has(g.id))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {topBar}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <SystemRail systems={railSystems} total={railSystems.reduce((n, s) => n + s.romCount, 0)} value={systemFilter} onChange={setSystemFilter} />

        <section className="flex h-[70vh] min-w-0 shrink-0 flex-col lg:h-auto lg:flex-1 lg:shrink" aria-label="Library games">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
            <Checkbox
              checked={allVisibleQueued ? true : visible.some((g) => queueSet.has(g.id)) ? "indeterminate" : false}
              onCheckedChange={() =>
                setQueue((q) => (allVisibleQueued ? q.filter((id) => !visible.some((g) => g.id === id)) : [...q, ...visible.map((g) => g.id).filter((id) => !q.includes(id))]))
              }
              aria-label="Add all shown games to the copy list"
              disabled={visible.length > 500 && !allVisibleQueued}
            />
            <h2 className="font-pixel text-sm text-ink">
              {systemFilter ? matcher.label(systemFilter) : "All systems"} <span className="text-ink-dim">{visible.length}</span>
            </h2>
            <label className="flex items-center gap-2 text-xs text-ink-dim">
              <Checkbox checked={settings.hideOnCard} onCheckedChange={(v) => updateSettings({ ...settings, hideOnCard: v === true })} />
              Hide games on the card
            </label>
            <div className="relative ml-auto w-full max-w-xs sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-dim" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search library" className="h-9 bg-shell-2 pl-9" aria-label="Search library" />
              {query && (
                <button className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-dim hover:text-ink" onClick={() => setQuery("")} aria-label="Clear search">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
            {visible.length === 0 ? (
              <Empty className="h-full border-0">
                <EmptyHeader>
                  <EmptyTitle className="font-pixel">Nothing to show</EmptyTitle>
                  <EmptyDescription>{settings.hideOnCard ? "Everything here is already on the card. Untick Hide games on the card to see them." : "No games match."}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul style={{ height: visible.length * ROW }} className="relative" role="list">
                {visible.slice(start, end).map((g, i) => {
                  const v = variantOf(g)
                  const queued = queueSet.has(g.id)
                  const canCopy = supported.has(g.system)
                  return (
                    <li
                      key={g.id}
                      className={cn("absolute inset-x-0 flex items-center gap-3 border-b border-line/50 px-5 hover:bg-panel/60", queued && "bg-btn-b/8")}
                      style={{ top: (start + i) * ROW, height: ROW }}
                    >
                      <Checkbox checked={queued} onCheckedChange={() => toggleQueue(g.id)} disabled={!canCopy} aria-label={`Add ${g.title} to the copy list`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-ink" title={g.title}>
                            {g.title}
                          </span>
                          {v.identified && <CircleCheck className="size-3.5 shrink-0 text-lcd" aria-label="Identified by checksum" />}
                        </div>
                        <div className="truncate text-xs text-ink-dim">
                          {matcher.label(g.system)}, {v.labels.join(", ")}
                          {!canCopy && <span className="ml-1.5 text-amber">no emulator on this card</span>}
                        </div>
                      </div>
                      {g.onCard && <span className="shrink-0 rounded-sm bg-lcd/15 px-1.5 py-0.5 text-[11px] font-semibold text-lcd">On card</span>}
                      {g.variants.length > 1 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-ink-dim">
                              {g.variants.length} versions <ChevronDown className="size-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-80">
                            <DropdownMenuLabel className="text-xs text-ink-dim">Version to copy</DropdownMenuLabel>
                            <DropdownMenuRadioGroup value={String(override[g.id] ?? g.best)} onValueChange={(val) => setOverride((o) => ({ ...o, [g.id]: Number(val) }))}>
                              {g.variants.map((vv, k) => (
                                <DropdownMenuRadioItem key={vv.id} value={String(k)} className="items-start">
                                  <span className="min-w-0">
                                    <span className="block truncate">{vv.units[0].main.name}</span>
                                    <span className="block text-xs text-ink-dim">
                                      {vv.labels.join(", ")}, {formatBytes(vv.size)}
                                      {k === g.best ? ", best match" : ""}
                                    </span>
                                  </span>
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                      <span className="w-16 shrink-0 text-right text-xs text-ink-dim">{formatBytes(v.size)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-line bg-shell-2/60 lg:w-[420px] lg:border-t-0 lg:border-l">
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="px-4 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="ai">Ask AI</TabsTrigger>
                <TabsTrigger value="copy">Copy list{queue.length ? ` (${queue.length})` : ""}</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <TabsContent value="ai" className="mt-0">
                <AskAiPanel
                  candidates={candidates}
                  allGames={view.games}
                  scan={view}
                  matcher={matcher}
                  cardRoms={cardScan.roms}
                  collections={collections}
                  freeBytes={settings.cardCapacityGB && usedBytes != null ? settings.cardCapacityGB * 1e9 - usedBytes : null}
                  inQueue={queueSet}
                  onQueue={addToQueue}
                />
              </TabsContent>
              <TabsContent value="copy" className="mt-0">
                <CopyPanel
                  jobs={jobs}
                  card={card}
                  library={root}
                  cardWritable={cardWritable}
                  usedBytes={usedBytes}
                  capacityGB={settings.cardCapacityGB}
                  onCapacity={(gb) => updateSettings({ ...settings, cardCapacityGB: gb })}
                  onRemove={(id) => setQueue((q) => q.filter((x) => x !== id))}
                  onClear={() => setQueue([])}
                  onDone={onCopied}
                  existingNames={collections.map((c) => c.name)}
                />
              </TabsContent>
              <TabsContent value="settings" className="mt-0">
                <SettingsPanel
                  settings={settings}
                  onChange={updateSettings}
                  dats={dats}
                  onAddDat={(d) => {
                    addDat(d)
                    setDats((x) => [...x, d])
                    toast.success(`Imported ${d.name}`, { description: `${d.games.toLocaleString()} games. Rescan to apply.` })
                  }}
                  onRemoveDat={(id) => {
                    removeDat(id)
                    setDats((x) => x.filter((d) => d.id !== id))
                  }}
                  scan={view}
                  emu={cardScan.emu}
                  onRescan={() => runScan(root, settings, dats)}
                />
              </TabsContent>
            </div>
          </Tabs>
        </aside>
      </div>
    </div>
  )
}
