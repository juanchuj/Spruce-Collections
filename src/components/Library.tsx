import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, ListPlus, Plus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useArt } from "@/lib/art"
import type { Collection, GameSystem, Rom } from "@/lib/spruce"
import { cn } from "@/lib/utils"

const ROW = 60

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

export function SystemSwatch({ system, className }: { system?: GameSystem; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-[2px]", className)}
      style={{ background: system?.themeColor ?? "var(--ink-dim)" }}
      aria-hidden
    />
  )
}

export const Thumb = memo(function Thumb({ rom, size = 40 }: { rom?: Rom; size?: number }) {
  const url = useArt(rom?.art)
  const initials = (rom?.name ?? "?").replace(/^the\s+/i, "").slice(0, 2).toUpperCase()
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-[4px] bg-panel-2 font-pixel text-[11px] text-ink-dim ring-1 ring-line"
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" loading="lazy" /> : initials}
    </div>
  )
})

interface Props {
  roms: Rom[]
  systems: GameSystem[]
  systemFilter: string | null
  collections: Collection[]
  active: Collection | null
  onToggleInActive: (rom: Rom) => void
  onAddTo: (uid: string, roms: Rom[]) => void
  onNewFrom: (roms: Rom[]) => void
}

export function Library({ roms, systems, systemFilter, collections, active, onToggleInActive, onAddTo, onNewFrom }: Props) {
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)
  const scroller = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const sysById = useMemo(() => new Map(systems.map((s) => [s.id, s])), [systems])

  const membership = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of collections) for (const g of c.games) m.set(g.rom_file_path, (m.get(g.rom_file_path) ?? 0) + 1)
    return m
  }, [collections])
  const inActive = useMemo(() => new Set(active?.games.map((g) => g.rom_file_path)), [active])

  const filtered = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean)
    return roms.filter((r) => {
      if (systemFilter && r.systemId !== systemFilter) return false
      if (!terms.length) return true
      const hay = normalize(`${r.name} ${r.fileName} ${sysById.get(r.systemId)?.label ?? ""}`)
      return terms.every((t) => hay.includes(t))
    })
  }, [roms, query, systemFilter, sysById])

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [systemFilter, query])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName)) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const pickedRoms = useMemo(() => roms.filter((r) => picked.has(r.path)), [roms, picked])
  const allVisiblePicked = filtered.length > 0 && filtered.every((r) => picked.has(r.path))

  const togglePick = useCallback((path: string) => {
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(path)) n.delete(path)
      else n.add(path)
      return n
    })
  }, [])

  const start = Math.max(0, Math.floor(scrollTop / ROW) - 6)
  const end = Math.min(filtered.length, Math.ceil((scrollTop + height) / ROW) + 6)
  const title = systemFilter ? (sysById.get(systemFilter)?.label ?? systemFilter) : "All games"

  return (
    <section className="flex h-[70vh] min-h-0 min-w-0 shrink-0 flex-col lg:h-auto lg:flex-1 lg:shrink" aria-label="Game library">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <h2 className="font-pixel text-sm text-ink">
          {title} <span className="text-ink-dim">{filtered.length}</span>
        </h2>
        <div className="relative ml-auto w-full max-w-sm sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-dim" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search games"
            className="h-9 bg-shell-2 pr-9 pl-9"
            aria-label="Search games"
          />
          {query ? (
            <button
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-dim hover:text-ink"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
          )}
        </div>
      </div>

      {/* Selection bar */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-line px-5 text-sm transition-[height,opacity] duration-150",
          picked.size ? "h-12 opacity-100" : "h-9 opacity-100",
        )}
      >
        <Checkbox
          checked={allVisiblePicked ? true : picked.size ? "indeterminate" : false}
          onCheckedChange={() =>
            setPicked((p) => {
              if (allVisiblePicked) {
                const n = new Set(p)
                filtered.forEach((r) => n.delete(r.path))
                return n
              }
              const n = new Set(p)
              filtered.forEach((r) => n.add(r.path))
              return n
            })
          }
          aria-label="Select all shown games"
        />
        {picked.size === 0 ? (
          <span className="text-ink-dim">
            {active ? (
              <>
                Click <Plus className="inline size-3.5 align-[-2px]" /> to add a game to <b className="text-ink">{active.name}</b>, or tick
                several.
              </>
            ) : (
              "Tick games to start a collection."
            )}
          </span>
        ) : (
          <>
            <span className="font-semibold text-ink">{picked.size} selected</span>
            <div className="ml-auto flex items-center gap-2">
              {active && (
                <Button
                  size="sm"
                  className="press"
                  onClick={() => {
                    onAddTo(active.uid, pickedRoms)
                    setPicked(new Set())
                  }}
                >
                  <Plus /> Add to {active.name.length > 18 ? active.name.slice(0, 17) + "…" : active.name}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" className="press">
                    <ListPlus /> Add to…
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem
                    onSelect={() => {
                      onNewFrom(pickedRoms)
                      setPicked(new Set())
                    }}
                  >
                    <Plus /> New collection
                  </DropdownMenuItem>
                  {collections.length > 0 && <DropdownMenuSeparator />}
                  {collections.length > 0 && <DropdownMenuLabel className="text-ink-dim">Existing</DropdownMenuLabel>}
                  {collections.map((c) => (
                    <DropdownMenuItem
                      key={c.uid}
                      onSelect={() => {
                        onAddTo(c.uid, pickedRoms)
                        setPicked(new Set())
                      }}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="ml-auto text-xs text-ink-dim">{c.games.length}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
                Clear
              </Button>
            </div>
          </>
        )}
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto" onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        {filtered.length === 0 ? (
          <Empty className="h-full border-0">
            <EmptyHeader>
              <EmptyTitle className="font-pixel">No games match</EmptyTitle>
              <EmptyDescription>
                {query ? "Try fewer words, or search by file name." : "This system has no games on the card."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul style={{ height: filtered.length * ROW }} className="relative" role="list">
            {filtered.slice(start, end).map((rom, i) => {
              const idx = start + i
              const sys = sysById.get(rom.systemId)
              const isPicked = picked.has(rom.path)
              const isIn = inActive.has(rom.path)
              const count = membership.get(rom.path) ?? 0
              return (
                <li
                  key={rom.path}
                  className={cn(
                    "absolute inset-x-0 flex items-center gap-3 border-b border-line/50 px-5 hover:bg-panel/60",
                    isPicked && "bg-btn-b/8 hover:bg-btn-b/12",
                  )}
                  style={{ top: idx * ROW, height: ROW }}
                >
                  <Checkbox checked={isPicked} onCheckedChange={() => togglePick(rom.path)} aria-label={`Select ${rom.name}`} />
                  <Thumb rom={rom} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink" title={rom.name}>
                      {rom.name}
                    </div>
                    <div className="flex items-center gap-1.5 truncate text-xs text-ink-dim" title={rom.cardPath}>
                      <SystemSwatch system={sys} />
                      <span className="shrink-0">{sys?.label ?? rom.systemId}</span>
                      <span className="truncate opacity-70">{rom.fileName}</span>
                    </div>
                  </div>
                  {count > 0 && (
                    <span className="hidden shrink-0 text-xs text-ink-dim sm:inline" title={`In ${count} collection${count > 1 ? "s" : ""}`}>
                      in {count}
                    </span>
                  )}
                  {active && (
                    <Button
                      size="icon"
                      variant={isIn ? "default" : "outline"}
                      className={cn("size-8 shrink-0", isIn && "bg-lcd text-lcd-ink hover:bg-lcd/85")}
                      onClick={() => onToggleInActive(rom)}
                      aria-label={isIn ? `Remove ${rom.name} from ${active.name}` : `Add ${rom.name} to ${active.name}`}
                      title={isIn ? `In ${active.name}. Click to remove` : `Add to ${active.name}`}
                    >
                      {isIn ? <Check /> : <Plus />}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
