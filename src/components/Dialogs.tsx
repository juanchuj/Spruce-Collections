import { useEffect, useMemo, useState } from "react"
import { Download, HardDriveDownload, LayoutGrid, Grid3x3, Loader2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { type CoverLayout, renderCover } from "@/lib/cover"
import type { Collection, Rom } from "@/lib/spruce"
import { validateName } from "@/lib/spruce"
import type { Diff } from "@/state/useWorkspace"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */

export interface NameRequest {
  title: string
  action: string
  initial: string
  selfUid?: string
  hint?: string
  onSubmit: (name: string) => void
}

export function NameDialog({ req, collections, onClose }: { req: NameRequest | null; collections: Collection[]; onClose: () => void }) {
  const [value, setValue] = useState("")
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (req) {
      setValue(req.initial)
      setTouched(false)
    }
  }, [req])
  const error = req ? validateName(value, collections, req.selfUid) : null

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (!error && req) {
              req.onSubmit(value.trim())
              onClose()
            }
          }}
          className="grid gap-5"
        >
          <DialogHeader>
            <DialogTitle className="font-pixel text-base">{req?.title}</DialogTitle>
            {req?.hint && <DialogDescription>{req.hint}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setTouched(true)
              }}
              placeholder="Zelda Saga"
              aria-invalid={touched && !!error}
              maxLength={80}
            />
            <p className={cn("min-h-5 text-sm", touched && error ? "text-destructive" : "text-ink-dim")}>
              {touched && error ? error : "Shown in the Collections menu on the handheld."}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="press" disabled={touched && !!error}>
              {req?.action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */

const LAYOUTS: { id: CoverLayout; label: string; icon: React.ReactNode }[] = [
  { id: "grid4", label: "4 games", icon: <LayoutGrid /> },
  { id: "grid9", label: "9 games", icon: <Grid3x3 /> },
  { id: "title", label: "Title card", icon: <ImageIcon /> },
]

export function CoverDialog({
  target,
  roms,
  onClose,
  onUse,
}: {
  target: Collection | null
  roms: Rom[]
  onClose: () => void
  onUse: (blob: Blob) => void
}) {
  const [layout, setLayout] = useState<CoverLayout>("grid4")
  const [blob, setBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  useEffect(() => {
    if (!target) return
    let alive = true
    setBusy(true)
    renderCover(target.name, roms, layout)
      .then((b) => alive && setBlob(b))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [target, roms, layout])

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-pixel text-base">Cover for {target?.name}</DialogTitle>
          <DialogDescription>
            Built from the games' box art. Saved as Collections/Imgs/{target?.name}.png when you save to the card.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2" role="radiogroup" aria-label="Cover layout">
          {LAYOUTS.map((l) => (
            <Button
              key={l.id}
              role="radio"
              aria-checked={layout === l.id}
              variant={layout === l.id ? "secondary" : "ghost"}
              size="sm"
              className={cn(layout === l.id && "ring-2 ring-btn-b")}
              onClick={() => setLayout(l.id)}
            >
              {l.icon} {l.label}
            </Button>
          ))}
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-lg bg-shell ring-1 ring-line">
          {url && <img src={url} alt="Cover preview" className="size-full" />}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-shell/50">
              <Loader2 className="size-6 animate-spin text-ink-dim" />
            </div>
          )}
        </div>
        {roms.length === 0 && <p className="text-sm text-amber">This collection has no games yet, so the cover uses placeholders.</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="press"
            disabled={!blob || busy}
            onClick={() => {
              if (blob) onUse(blob)
              onClose()
            }}
          >
            Use this cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */

export function SaveDialog({
  open,
  diff,
  readOnly,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean
  diff: Diff
  readOnly: boolean
  saving: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const lines: { tone: string; text: string }[] = [
    ...diff.created.map((n) => ({ tone: "text-btn-b", text: `Create ${n}` })),
    ...diff.renamed.map((r) => ({ tone: "text-amber", text: `Rename ${r.from} to ${r.to}` })),
    ...diff.changed.map((c) => ({
      tone: "text-ink",
      text: `${c.name}: ${[c.added && `+${c.added}`, c.removed && `−${c.removed}`].filter(Boolean).join(", ")} games`,
    })),
    ...diff.covers.map((n) => ({ tone: "text-lcd", text: `New cover for ${n}` })),
    ...(diff.reordered ? [{ tone: "text-ink-dim", text: "Collections reordered" }] : []),
    ...diff.deleted.map((n) => ({ tone: "text-destructive", text: `Delete ${n}` })),
  ]
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-pixel text-base">{readOnly ? "Download collections" : "Save to card"}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? "This browser can't write to the card. Download the file and copy it into the card's Collections folder, replacing the old one."
              : "Writes Collections/collections.json. The current file is kept as a dated backup next to it."}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-md bg-shell-2 p-3 text-sm ring-1 ring-line">
          {lines.length ? (
            lines.map((l, i) => (
              <li key={i} className={l.tone}>
                {l.text}
              </li>
            ))
          ) : (
            <li className="text-ink-dim">No changes since the last save.</li>
          )}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="press" onClick={onConfirm} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : readOnly ? <Download /> : <HardDriveDownload />}
            {readOnly ? "Download" : saving ? "Saving" : "Save to card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */

export function ConflictDialog({
  open,
  onCancel,
  onOverwrite,
  onReload,
}: {
  open: boolean
  onCancel: () => void
  onOverwrite: () => void
  onReload: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-pixel text-base">The card changed</AlertDialogTitle>
          <AlertDialogDescription>
            collections.json on the card is different from when you opened it. The handheld or another tab probably wrote to it.
            Overwrite keeps your edits and backs up the card's version. Reload discards your edits.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="secondary" onClick={onReload}>
            Reload from card
          </Button>
          <AlertDialogAction onClick={onOverwrite}>Overwrite</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
