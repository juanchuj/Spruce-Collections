import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  ClipboardPaste,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  HardDriveDownload,
  Loader2,
  ListPlus,
  Square,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Segmented, StepTitle } from "@/components/Dialogs"
import type { CardDir } from "@/lib/fs"
import type { Collection, EmuInfo, Rom } from "@/lib/spruce"
import { ASSISTANTS, type Assistant, estimateTokens } from "@/lib/suggest"
import { type DatFile, parseDat } from "@/lib/library/dat"
import { type CopyJob, type CopyProgress, type CopyResult, missingBios, runCopy } from "@/lib/library/copy"
import { type LibSuggestion, buildLibraryPrompt, parseLibrarySuggestions } from "@/lib/library/prompt"
import { type LibGame, type LibraryScan, formatBytes } from "@/lib/library/scan"
import type { LibrarySettings } from "@/lib/library/store"
import type { SystemMatcher } from "@/lib/library/systems"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Ask AI                                                              */
/* ------------------------------------------------------------------ */

export function AskAiPanel({
  candidates,
  allGames,
  scan,
  matcher,
  cardRoms,
  collections,
  freeBytes,
  inQueue,
  onQueue,
}: {
  candidates: LibGame[]
  allGames: LibGame[]
  scan: LibraryScan
  matcher: SystemMatcher
  cardRoms: Rom[]
  collections: Collection[]
  freeBytes: number | null
  inQueue: Set<string>
  onQueue: (ids: string[]) => void
}) {
  const [count, setCount] = useState(10)
  const [focus, setFocus] = useState("")
  const [assistant, setAssistant] = useState<Assistant>("claude")
  const [reply, setReply] = useState("")
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const prompt = useMemo(
    () =>
      buildLibraryPrompt({ count, focus, candidates, librarySystems: scan.systems, cardRoms, collections, freeBytes, matcher }),
    [count, focus, candidates, scan.systems, cardRoms, collections, freeBytes, matcher],
  )
  const parsed = useMemo(() => parseLibrarySuggestions(reply, allGames, matcher), [reply, allGames, matcher])

  useEffect(() => {
    setPicked(new Set(parsed.items.filter((i) => i.game && !i.game.onCard).map((i) => i.game!.id)))
  }, [parsed])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.text)
      toast.success("Prompt copied", { description: `Paste it into ${ASSISTANTS[assistant].label}, then paste the reply below.` })
    } catch {
      toast.error("Couldn't copy. Use Download instead and attach the file.")
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([prompt.text], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "spruce-library-prompt.txt"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const status = (i: LibSuggestion) => (!i.game ? "missing" : i.game.onCard ? "card" : "library")
  const counts = { library: 0, card: 0, missing: 0 }
  parsed.items.forEach((i) => counts[status(i)]++)

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <StepTitle n={1}>Copy the prompt</StepTitle>
        <div className="space-y-1.5">
          <Label className="text-xs text-ink-dim">Games to suggest</Label>
          <Segmented value={String(count)} options={[10, 25, 50].map((n) => ({ id: String(n), label: String(n) }))} onChange={(v) => setCount(Number(v))} label="Games to suggest" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lib-focus" className="text-xs text-ink-dim">
            Anything in particular? (optional)
          </Label>
          <Input id="lib-focus" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="More RPGs, games for two players, Japanese imports in English…" className="bg-shell-2" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-ink-dim">AI to use</Label>
          <Segmented value={assistant} options={(Object.keys(ASSISTANTS) as Assistant[]).map((id) => ({ id, label: ASSISTANTS[id].label }))} onChange={setAssistant} label="AI to use" />
        </div>
        <div className="rounded-md bg-shell-2 p-3 text-xs leading-relaxed text-ink-dim ring-1 ring-line">
          {prompt.mode === "catalog" ? (
            <>
              Sends the <b className="text-ink">{candidates.length}</b> games shown in the list (not on the card), so the AI picks from what you own.
            </>
          ) : (
            <>
              Your library is too big to send, so the prompt describes your taste and systems. The AI suggests by name and this tool keeps the
              ones you own. Filter by system to send a list instead.
            </>
          )}
          <span className="mt-1 block">About {estimateTokens(prompt.text).toLocaleString()} tokens.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="press" onClick={copy}>
            <Copy /> Copy prompt
          </Button>
          <Button size="sm" variant="secondary" className="press" onClick={download}>
            <Download /> .txt
          </Button>
          <Button size="sm" variant="secondary" className="press" asChild>
            <a href={ASSISTANTS[assistant].url} target="_blank" rel="noreferrer">
              <ExternalLink /> Open {ASSISTANTS[assistant].label}
            </a>
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <StepTitle n={2}>Paste the reply</StepTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                setReply(await navigator.clipboard.readText())
              } catch {
                toast.error("The browser blocked the clipboard. Click in the box and press Ctrl/⌘+V.")
              }
            }}
          >
            <ClipboardPaste /> Paste
          </Button>
        </div>
        <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Paste the whole reply, including the ```json block." className="h-28 resize-y bg-shell-2 font-mono text-xs" aria-label="AI reply" />
        {parsed.error && reply.trim() && <p className="text-sm text-destructive">{parsed.error}</p>}
      </section>

      {parsed.items.length > 0 && (
        <section className="space-y-3">
          <StepTitle n={3}>Pick what to copy</StepTitle>
          <p className="text-xs text-ink-dim">
            {counts.library} in your library{counts.card ? `, ${counts.card} already on the card` : ""}
            {counts.missing ? `, ${counts.missing} you don't have` : ""}.
          </p>
          <ul className="space-y-1.5" role="list">
            {parsed.items.map((i, n) => {
              const st = status(i)
              const id = i.game?.id
              return (
                <li key={n} className={cn("flex items-start gap-2.5 rounded-md p-2 ring-1 ring-line/60", st !== "library" && "opacity-60")}>
                  <Checkbox
                    className="mt-0.5"
                    disabled={st !== "library"}
                    checked={!!id && picked.has(id)}
                    onCheckedChange={(v) =>
                      id &&
                      setPicked((p) => {
                        const s = new Set(p)
                        if (v) s.add(id)
                        else s.delete(id)
                        return s
                      })
                    }
                    aria-label={`Pick ${i.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {i.title} <span className="font-normal text-ink-dim">{matcher.label(i.system)}</span>
                    </div>
                    {i.reason && <p className="text-xs leading-snug text-ink-dim">{i.reason}</p>}
                    <p className={cn("text-xs", st === "library" ? "text-lcd" : st === "card" ? "text-btn-b" : "text-amber")}>
                      {st === "library"
                        ? `In your library${id && inQueue.has(id) ? ", already in the copy list" : ""}`
                        : st === "card"
                          ? "Already on the card"
                          : "Not in your library"}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <Button className="press w-full" disabled={!picked.size} onClick={() => onQueue([...picked])}>
            <ListPlus /> Add {picked.size} to the copy list
          </Button>
        </section>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Copy to card                                                        */
/* ------------------------------------------------------------------ */

export function CopyPanel({
  jobs,
  card,
  library,
  cardWritable,
  usedBytes,
  capacityGB,
  onCapacity,
  onRemove,
  onClear,
  onDone,
  existingNames,
}: {
  jobs: CopyJob[]
  card: CardDir
  library: CardDir
  cardWritable: boolean
  usedBytes: number | null
  capacityGB: number | null
  onCapacity: (gb: number | null) => void
  onRemove: (gameId: string) => void
  onClear: () => void
  onDone: (results: CopyResult[], collectionName: string | null) => void
  existingNames: string[]
}) {
  const [makeCollection, setMakeCollection] = useState(true)
  const [collectionName, setCollectionName] = useState("New on the card")
  const [progress, setProgress] = useState<CopyProgress | null>(null)
  const [bios, setBios] = useState<{ system: string; note: string }[]>([])
  const abort = useRef<AbortController | null>(null)
  const lastPaint = useRef(0)

  const total = jobs.reduce((n, j) => n + (j.blocked ? 0 : j.size), 0)
  const free = capacityGB && usedBytes != null ? capacityGB * 1e9 - usedBytes : null
  const over = free != null && total > free
  const systems = useMemo(() => jobs.map((j) => j.variant.system), [jobs])

  useEffect(() => {
    missingBios(card, systems).then(setBios)
  }, [card, systems])

  const start = async () => {
    const ctl = new AbortController()
    abort.current = ctl
    setProgress({ done: 0, total, job: 0, jobs: jobs.length, current: "" })
    const results = await runCopy(
      card,
      library,
      jobs,
      (p) => {
        const now = performance.now()
        if (now - lastPaint.current > 100 || p.done === p.total) {
          lastPaint.current = now
          setProgress(p)
        }
      },
      ctl.signal,
    )
    setProgress(null)
    abort.current = null
    onDone(results, makeCollection && collectionName.trim() ? collectionName.trim() : null)
  }

  if (!jobs.length)
    return (
      <div className="grid min-h-48 place-items-center rounded-lg border-2 border-dashed border-line p-6 text-center text-sm text-ink-dim">
        Tick games in the list, or add the AI's picks, to build a copy list.
      </div>
    )

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-shell-2 p-3 ring-1 ring-line">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ink">
            {jobs.length} {jobs.length === 1 ? "game" : "games"}, {formatBytes(total)}
          </span>
          {free != null && <span className={cn("text-xs", over ? "text-destructive" : "text-ink-dim")}>{formatBytes(Math.max(0, free))} free</span>}
        </div>
        {free != null && capacityGB && (
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-panel-2">
            <span className="bg-ink-dim/50" style={{ width: `${Math.min(100, ((usedBytes ?? 0) / (capacityGB * 1e9)) * 100)}%` }} />
            <span className={over ? "bg-destructive" : "bg-lcd"} style={{ width: `${Math.min(100, (total / (capacityGB * 1e9)) * 100)}%` }} />
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-dim">
          <Label htmlFor="cap" className="shrink-0">
            Card size
          </Label>
          <Input
            id="cap"
            type="number"
            min={1}
            className="h-7 w-20 bg-panel text-xs"
            value={capacityGB ?? ""}
            placeholder="GB"
            onChange={(e) => onCapacity(e.target.value ? Number(e.target.value) : null)}
          />
          <span>GB{usedBytes == null ? ", measuring what's on the card…" : `, ${formatBytes(usedBytes)} used`}</span>
        </div>
        {over && <p className="mt-2 text-xs text-destructive">The copy list is bigger than the free space. Remove some games.</p>}
      </div>

      {bios.length > 0 && (
        <div className="space-y-1 rounded-md bg-amber/10 p-3 text-xs text-amber ring-1 ring-amber/30">
          {bios.map((b) => (
            <p key={b.system} className="flex gap-2">
              <TriangleAlert className="size-3.5 shrink-0" />
              <span>
                {b.system} games usually need BIOS/{b.note} on the card.
              </span>
            </p>
          ))}
        </div>
      )}

      <ul className="max-h-[38vh] space-y-1 overflow-y-auto pr-1" role="list">
        {jobs.map((j) => (
          <li key={j.game.id} className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-panel/70">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{j.game.title}</div>
              <div className="truncate text-xs text-ink-dim" title={j.mainDest}>
                {j.variant.labels.join(", ")}, {formatBytes(j.size)}
              </div>
              {j.blocked && <p className="text-xs text-destructive">{j.blocked}</p>}
              {j.game.onCard && <p className="text-xs text-btn-b">Already on the card. Copying adds this version too.</p>}
              {j.warnings.map((w) => (
                <p key={w} className="text-xs text-amber">
                  {w}
                </p>
              ))}
            </div>
            <Button size="icon" variant="ghost" className="size-7 opacity-60 group-hover:opacity-100" onClick={() => onRemove(j.game.id)} aria-label={`Remove ${j.game.title}`} disabled={!!progress}>
              <X />
            </Button>
          </li>
        ))}
      </ul>

      <label className="flex items-center gap-2.5 text-sm text-ink">
        <Switch checked={makeCollection} onCheckedChange={setMakeCollection} disabled={!!progress} />
        Put them in a collection
      </label>
      {makeCollection && (
        <div className="space-y-1">
          <Input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} className="bg-shell-2" aria-label="Collection name" disabled={!!progress} />
          {existingNames.some((n) => n.toLowerCase() === collectionName.trim().toLowerCase()) && (
            <p className="text-xs text-btn-b">Adds to your existing collection with this name.</p>
          )}
        </div>
      )}

      {progress ? (
        <div className="space-y-2">
          <Progress value={pct} />
          <div className="flex items-center justify-between gap-3 text-xs text-ink-dim">
            <span className="truncate">
              Game {progress.job + 1} of {progress.jobs}: {progress.current}
            </span>
            <span className="shrink-0">
              {formatBytes(progress.done)} of {formatBytes(progress.total)}
            </span>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => abort.current?.abort()}>
            <Square /> Stop copying
          </Button>
          <p className="text-xs text-ink-dim">Stopping is safe. Run it again later and finished files are skipped.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Button className="press w-full" disabled={!cardWritable || over || !jobs.some((j) => !j.blocked)} onClick={start}>
            <HardDriveDownload /> Copy {jobs.filter((j) => !j.blocked).length} to card
          </Button>
          {!cardWritable && <p className="text-xs text-amber">The card was opened read-only. Open it in Chrome or Edge to copy games.</p>}
          <Button variant="ghost" size="sm" className="w-full text-ink-dim" onClick={onClear}>
            Clear the list
          </Button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const ALL_REGIONS = ["USA", "World", "Europe", "Japan", "Korea", "Asia", "Brazil", "Australia", "France", "Germany", "Spain", "Italy"]

export function SettingsPanel({
  settings,
  onChange,
  dats,
  onAddDat,
  onRemoveDat,
  scan,
  emu,
  onRescan,
}: {
  settings: LibrarySettings
  onChange: (s: LibrarySettings) => void
  dats: DatFile[]
  onAddDat: (d: DatFile) => void
  onRemoveDat: (id: string) => void
  scan: LibraryScan
  emu: EmuInfo[]
  onRescan: () => void
}) {
  const datInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const order = settings.regionOrder
  const rest = ALL_REGIONS.filter((r) => !order.includes(r))
  const move = (i: number, d: number) => {
    const next = [...order]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange({ ...settings, regionOrder: next })
  }
  const mappedChanged = scan.unrecognized.some((u) => settings.folderMap[u.path])

  return (
    <div className="space-y-7 text-sm">
      <section className="space-y-2.5">
        <h3 className="font-semibold text-ink">Preferred regions</h3>
        <p className="text-xs text-ink-dim">When a game has several versions, the first region in this list wins.</p>
        <ol className="space-y-1">
          {order.map((r, i) => (
            <li key={r} className="flex items-center gap-2 rounded-md bg-panel px-2.5 py-1 ring-1 ring-line">
              <span className="w-4 font-pixel text-[10px] text-ink-dim">{i + 1}</span>
              <span className="flex-1">{r}</span>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${r} up`}>
                <ArrowUp />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${r} down`}>
                <ArrowDown />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => onChange({ ...settings, regionOrder: order.filter((x) => x !== r) })} disabled={order.length <= 1} aria-label={`Remove ${r}`}>
                <X />
              </Button>
            </li>
          ))}
        </ol>
        {rest.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rest.map((r) => (
              <Button key={r} size="sm" variant="ghost" className="h-7 text-xs text-ink-dim" onClick={() => onChange({ ...settings, regionOrder: [...order, r] })}>
                + {r}
              </Button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-ink">Versions</h3>
        <label className="flex items-start gap-2.5">
          <Switch checked={settings.preferTranslations} onCheckedChange={(v) => onChange({ ...settings, preferTranslations: v })} />
          <span>Prefer fan translations over Japanese originals</span>
        </label>
        <label className="flex items-start gap-2.5">
          <Switch checked={settings.showExtras} onCheckedChange={(v) => onChange({ ...settings, showExtras: v })} />
          <span>Show games that only exist as betas, demos, prototypes or hacks</span>
        </label>
      </section>

      <section className="space-y-2.5">
        <h3 className="font-semibold text-ink">Checksum lists (DAT files)</h3>
        <p className="text-xs leading-relaxed text-ink-dim">
          Import No-Intro, Redump or arcade DATs (Logiqx XML) to identify games exactly, even when files are renamed. Zipped games are checked
          for free; loose files only when the switch below is on.
        </p>
        <ul className="space-y-1">
          {dats.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-md bg-panel px-2.5 py-1.5 ring-1 ring-line">
              <CircleCheck className="size-3.5 shrink-0 text-lcd" />
              <span className="min-w-0 flex-1 truncate" title={d.fileName}>
                {d.name}
              </span>
              <span className="text-xs text-ink-dim">{d.games.toLocaleString()}</span>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => onRemoveDat(d.id)} aria-label={`Remove ${d.name}`}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <input
          ref={datInput}
          type="file"
          accept=".dat,.xml"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            setBusy(true)
            for (const f of files) {
              try {
                onAddDat(parseDat(await f.text(), f.name))
              } catch (err) {
                toast.error(`${f.name}: ${(err as Error).message}`)
              }
            }
            setBusy(false)
          }}
        />
        <Button size="sm" variant="secondary" className="press" onClick={() => datInput.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <FileUp />} Import DAT files
        </Button>
        <label className="flex items-start gap-2.5">
          <Switch checked={settings.checksumLoose} onCheckedChange={(v) => onChange({ ...settings, checksumLoose: v })} disabled={!dats.length} />
          <span>Also checksum unzipped files up to 64 MB (slower first scan)</span>
        </label>
        {dats.length > 0 && (
          <Button size="sm" variant="ghost" onClick={onRescan}>
            Rescan to apply
          </Button>
        )}
      </section>

      <section className="space-y-2.5">
        <h3 className="font-semibold text-ink">Unrecognized folders</h3>
        {scan.unrecognized.length === 0 ? (
          <p className="text-xs text-ink-dim">Every folder with games was matched to a system.</p>
        ) : (
          <>
            <p className="text-xs text-ink-dim">Tell the tool which system these folders hold, then rescan.</p>
            <ul className="space-y-1.5">
              {scan.unrecognized.map((u) => (
                <li key={u.path} className="flex items-center gap-2 rounded-md bg-panel px-2.5 py-1.5 ring-1 ring-line">
                  <span className="min-w-0 flex-1 truncate" title={u.path}>
                    {u.path} <span className="text-xs text-ink-dim">({u.files})</span>
                  </span>
                  <select
                    className="h-7 max-w-36 rounded-md border border-line bg-shell-2 px-1.5 text-xs text-ink"
                    value={settings.folderMap[u.path] ?? ""}
                    onChange={(e) => {
                      const map = { ...settings.folderMap }
                      if (e.target.value) map[u.path] = e.target.value
                      else delete map[u.path]
                      onChange({ ...settings, folderMap: map })
                    }}
                    aria-label={`System for ${u.path}`}
                  >
                    <option value="">Choose system</option>
                    <option value="ignore">Ignore this folder</option>
                    {emu.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label} ({e.id})
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {mappedChanged && (
              <Button size="sm" className="press" onClick={onRescan}>
                Rescan with these folders
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  )
}
