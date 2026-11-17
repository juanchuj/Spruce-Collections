import { useEffect, useState } from "react"
import { ArrowDown, ArrowDownAZ, ArrowUp, ArrowUpZA, GripVertical, ListOrdered } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Collection } from "@/lib/spruce"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  collections: Collection[]
  onClose: () => void
  onApply: (uids: string[]) => void
}

const byName = (a: Collection, b: Collection) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })

export function ReorderDialog({ open, collections, onClose, onApply }: Props) {
  const [order, setOrder] = useState<Collection[]>([])
  const [dragging, setDragging] = useState<string | null>(null)

  useEffect(() => {
    if (open) setOrder(collections)
  }, [open, collections])

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return
    setOrder((o) => {
      const next = [...o]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const changed = order.some((c, i) => c.uid !== collections[i]?.uid)
  const sorts: { label: string; icon: React.ReactNode; fn: (a: Collection, b: Collection) => number }[] = [
    { label: "A–Z", icon: <ArrowDownAZ />, fn: byName },
    { label: "Z–A", icon: <ArrowUpZA />, fn: (a, b) => byName(b, a) },
    { label: "Most games first", icon: <ListOrdered />, fn: (a, b) => b.games.length - a.games.length || byName(a, b) },
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-pixel text-base">Reorder collections</DialogTitle>
          <DialogDescription>
            Drag collections, or use the arrows (Alt + ↑/↓ on a focused row). The handheld lists them in this order. Games inside a collection
            are always sorted A–Z by file name on the device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {sorts.map((s) => (
            <Button key={s.label} size="sm" variant="secondary" className="press" onClick={() => setOrder((o) => [...o].sort(s.fn))}>
              {s.icon} {s.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setOrder(collections)} disabled={!changed}>
            Undo changes
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
          <ol className="space-y-1.5" aria-label="Collections in order">
            {order.map((c, i) => (
              <li
                key={c.uid}
                draggable
                tabIndex={0}
                onDragStart={(e) => {
                  setDragging(c.uid)
                  e.dataTransfer.effectAllowed = "move"
                }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  e.preventDefault()
                  const from = order.findIndex((x) => x.uid === dragging)
                  if (from >= 0 && from !== i) move(from, i)
                }}
                onKeyDown={(e) => {
                  if (!e.altKey) return
                  if (e.key === "ArrowUp") {
                    e.preventDefault()
                    move(i, i - 1)
                    requestAnimationFrame(() => (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus())
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault()
                    move(i, i + 1)
                    requestAnimationFrame(() => (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus())
                  }
                }}
                className={cn(
                  "flex cursor-grab items-center gap-3 rounded-md bg-panel px-2.5 py-2 ring-1 ring-line outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                  dragging === c.uid && "opacity-50 ring-btn-b",
                )}
              >
                <GripVertical className="size-4 shrink-0 text-ink-dim" aria-hidden />
                <span className="w-6 font-pixel text-[11px] text-ink-dim">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{c.name}</span>
                <span className="text-xs text-ink-dim">{c.games.length}</span>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${c.name} up`}>
                  <ArrowUp />
                </Button>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => move(i, i + 1)} disabled={i === order.length - 1} aria-label={`Move ${c.name} down`}>
                  <ArrowDown />
                </Button>
              </li>
            ))}
          </ol>

          <div className="lcd-bezel h-fit rounded-[16px] p-3" aria-hidden>
            <div className="lcd rounded-md px-3 py-2.5 font-pixel">
              <div className="border-b-2 border-lcd-dark/70 pb-1.5 text-[12px]">Collections</div>
              <ul className="mt-1.5 space-y-1 text-[11px]">
                {order.slice(0, 12).map((c, i) => (
                  <li key={c.uid} className={cn("truncate px-1", i === 0 && "bg-lcd-ink text-lcd")}>
                    {c.name}
                  </li>
                ))}
                {order.length > 12 && <li className="px-1 opacity-60">+{order.length - 12} more</li>}
              </ul>
            </div>
            <p className="mt-2 text-center text-xs text-ink-dim">Preview on the handheld</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="press"
            disabled={!changed}
            onClick={() => {
              onApply(order.map((c) => c.uid))
              onClose()
            }}
          >
            Apply order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
