import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { type CardDir, resolveFile } from "@/lib/fs"
import { type Collection, type GameSystem, type Rom, COLLECTIONS_DIR, deviceOrder } from "@/lib/spruce"
import { cn } from "@/lib/utils"
import { SystemSwatch, Thumb } from "./Library"

/** Cover shown for a collection: a pending (unsaved) render, or the PNG already on the card. */
function useCover(root: CardDir, name: string | null, pending: Blob | undefined, epoch: number) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    ;(async () => {
      let blob: Blob | null = pending ?? null
      if (!blob && name) blob = await resolveFile(root, `${COLLECTIONS_DIR}/Imgs/${name}.png`)
      if (!alive) return
      made = blob && blob.size ? URL.createObjectURL(blob) : null
      setUrl(made)
    })()
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [root, name, pending, epoch])
  return url
}

function CoverThumb({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-[5px] bg-panel-2 ring-1 ring-line", className)}>
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-pixel text-[12px] text-ink-dim">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )
}

interface RowProps {
  c: Collection
  root: CardDir
  pending?: Blob
  epoch: number
  active: boolean
  index: number
  count: number
  onSelect: () => void
  onRename: () => void
  onDuplicate: () => void
  onMove: (d: number) => void
  onCover: () => void
  onDelete: () => void
}

function CollectionRow({ c, root, pending, epoch, active, index, count, onSelect, onRename, onDuplicate, onMove, onCover, onDelete }: RowProps) {
  const url = useCover(root, c.originalName, pending, epoch)
  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-3 rounded-md px-2 py-1.5",
          active ? "bg-panel-2 shadow-[inset_3px_0_0_var(--btn-a)]" : "hover:bg-panel/70",
        )}
      >
        <button className="flex min-w-0 flex-1 items-center gap-3 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onSelect}>
          <CoverThumb url={url} name={c.name} className="size-10" />
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-medium", active ? "text-ink" : "text-ink/90")}>{c.name}</span>
            <span className="block text-xs text-ink-dim">
              {c.games.length} {c.games.length === 1 ? "game" : "games"}
              {c.originalName === null && <span className="ml-1.5 text-btn-b">new</span>}
              {c.originalName !== null && c.originalName !== c.name && <span className="ml-1.5 text-amber">renamed</span>}
              {pending && <span className="ml-1.5 text-lcd">new cover</span>}
            </span>
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8 text-ink-dim opacity-70 group-hover:opacity-100" aria-label={`Options for ${c.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCover}>
              <ImagePlus /> Make cover
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowUp /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(1)}>
              <ArrowDown /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

interface Props {
  root: CardDir
  collections: Collection[]
  selected: string | null
  covers: Record<string, Blob>
  coverEpoch: number
  byPath: Map<string, Rom>
  systems: GameSystem[]
  onSelect: (uid: string) => void
  onNew: () => void
  onRename: (c: Collection) => void
  onDuplicate: (c: Collection) => void
  onMove: (uid: string, d: number) => void
  onCover: (c: Collection) => void
  onDelete: (c: Collection) => void
  onRemoveGames: (uid: string, paths: string[]) => void
}

export function CollectionsPanel(p: Props) {
  const active = p.collections.find((c) => c.uid === p.selected) ?? null
  const sysById = useMemo(() => new Map(p.systems.map((s) => [s.id, s])), [p.systems])

  const games = useMemo(() => {
    if (!active) return []
    return deviceOrder(active.games).map((g) => {
      const rom = p.byPath.get(g.rom_file_path)
      const knownSystem = sysById.has(g.game_system_name)
      const status: "ok" | "missing" | "system" = !rom ? "missing" : !knownSystem ? "system" : "ok"
      return { entry: g, rom, status }
    })
  }, [active, p.byPath, sysById])
  const broken = games.filter((g) => g.status !== "ok")

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-line bg-shell-2/60 lg:w-[400px] lg:border-t-0 lg:border-l" aria-label="Collections">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <h2 className="font-pixel text-sm text-ink">
          Collections <span className="text-ink-dim">{p.collections.length}</span>
        </h2>
        <Button size="sm" className="press ml-auto" onClick={p.onNew}>
          <Plus /> New collection
        </Button>
      </div>

      {p.collections.length === 0 ? (
        <Empty className="flex-none border-0 py-10">
          <EmptyHeader>
            <EmptyTitle className="font-pixel">No collections yet</EmptyTitle>
            <EmptyDescription>Start one here, or tick games in the library and choose Add to → New collection.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="secondary" className="press" onClick={p.onNew}>
              <Plus /> New collection
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="max-h-[38%] shrink-0 space-y-0.5 overflow-y-auto px-2 pb-2" role="list">
          {p.collections.map((c, i) => (
            <CollectionRow
              key={c.uid}
              c={c}
              root={p.root}
              pending={p.covers[c.uid]}
              epoch={p.coverEpoch}
              active={c.uid === p.selected}
              index={i}
              count={p.collections.length}
              onSelect={() => p.onSelect(c.uid)}
              onRename={() => p.onRename(c)}
              onDuplicate={() => p.onDuplicate(c)}
              onMove={(d) => p.onMove(c.uid, d)}
              onCover={() => p.onCover(c)}
              onDelete={() => p.onDelete(c)}
            />
          ))}
        </ul>
      )}

      {active && (
        <div className="flex h-[70vh] min-h-0 flex-col px-4 pt-2 pb-4 lg:h-auto lg:flex-1">
          <div className="lcd-bezel flex min-h-0 flex-1 flex-col rounded-[18px] p-3">
            <div className="lcd flex min-h-0 flex-1 flex-col rounded-md">
              <div className="flex items-baseline justify-between gap-3 border-b-2 border-lcd-dark/70 px-4 pt-3 pb-2 font-pixel">
                <span className="truncate text-[15px]">{active.name}</span>
                <span className="shrink-0 text-[11px] opacity-70">{active.games.length}</span>
              </div>
              {games.length === 0 ? (
                <div className="grid flex-1 place-items-center px-6 text-center text-sm font-semibold">
                  Empty collection. Use + in the library to add games.
                </div>
              ) : (
                <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                  {games.map(({ entry, rom, status }) => (
                    <li key={entry.rom_file_path} className="group flex items-center gap-2.5 rounded px-2 py-1 hover:bg-lcd-ink/10">
                      {rom ? <Thumb rom={rom} size={28} /> : <TriangleAlert className="size-4 shrink-0" />}
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className={cn("truncate text-[13px] font-semibold", status !== "ok" && "line-through decoration-2")}>
                          {rom?.name ?? entry.rom_file_path.split("/").pop()}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] opacity-75">
                          <SystemSwatch system={sysById.get(entry.game_system_name)} className="size-2" />
                          {status === "missing"
                            ? "Not on this card"
                            : status === "system"
                              ? `Unknown system ${entry.game_system_name}`
                              : (sysById.get(entry.game_system_name)?.label ?? entry.game_system_name)}
                        </div>
                      </div>
                      <button
                        className="rounded p-1 opacity-50 outline-none group-hover:opacity-100 hover:bg-lcd-ink/15 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-lcd-ink"
                        onClick={() => p.onRemoveGames(active.uid, [entry.rom_file_path])}
                        aria-label={`Remove ${rom?.name ?? "game"} from ${active.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="flex items-center justify-between px-1 pt-2.5 text-xs text-ink-dim">
              <span>Shown in the order the handheld uses</span>
              {broken.length > 0 && (
                <button
                  className="font-semibold text-amber hover:underline"
                  onClick={() => p.onRemoveGames(active.uid, broken.map((b) => b.entry.rom_file_path))}
                >
                  Remove {broken.length} missing
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
