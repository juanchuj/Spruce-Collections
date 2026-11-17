import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Copy, Download, ExternalLink, HardDriveDownload, ImageIcon, ImageUp, LayoutGrid, Grid3x3, Loader2, Upload } from "lucide-react"
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
import { type CoverLayout, type FitMode, renderCover, renderUploaded } from "@/lib/cover"
import { type PromptStyle, STYLE_LABELS, buildCoverPrompt } from "@/lib/prompt"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { Collection, GameSystem, Rom } from "@/lib/spruce"
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

const GEMINI_URL = "https://gemini.google.com/app"

function useBlobUrl(blob: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  return url
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { id: T; label: string; icon?: React.ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <Button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          variant={value === o.id ? "secondary" : "ghost"}
          size="sm"
          className={cn(value === o.id && "ring-2 ring-btn-b")}
          onClick={() => onChange(o.id)}
        >
          {o.icon} {o.label}
        </Button>
      ))}
    </div>
  )
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
      <span className="grid size-5 place-items-center rounded-[4px] bg-btn-a font-pixel text-[10px] text-primary-foreground">{n}</span>
      {children}
    </h3>
  )
}

export function CoverDialog({
  target,
  roms,
  systems,
  onClose,
  onUse,
}: {
  target: Collection | null
  roms: Rom[]
  systems: GameSystem[]
  onClose: () => void
  onUse: (blob: Blob) => void
}) {
  const [tab, setTab] = useState<"boxart" | "image">("boxart")

  // Box-art collage
  const [layout, setLayout] = useState<CoverLayout>("grid4")
  const [collage, setCollage] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)

  // Own image
  const [style, setStyle] = useState<PromptStyle>("pixel")
  const [promptTitle, setPromptTitle] = useState(true)
  const [prompt, setPrompt] = useState("")
  const [source, setSource] = useState<File | null>(null)
  const [fit, setFit] = useState<FitMode>("fill")
  const [stamp, setStamp] = useState(false)
  const [uploaded, setUploaded] = useState<Blob | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!target) return
    setTab("boxart")
    setSource(null)
    setUploaded(null)
    setStamp(false)
  }, [target])

  useEffect(() => {
    if (!target) return
    let alive = true
    setBusy(true)
    renderCover(target.name, roms, layout)
      .then((b) => alive && setCollage(b))
      .finally(() => alive && setBusy(false))
    return () => {
      alive = false
    }
  }, [target, roms, layout])

  useEffect(() => {
    if (target) setPrompt(buildCoverPrompt({ name: target.name, roms, systems, style, withTitle: promptTitle }))
  }, [target, roms, systems, style, promptTitle])

  useEffect(() => {
    if (!target || !source) return
    let alive = true
    renderUploaded(source, { fit, title: stamp, name: target.name })
      .then((b) => alive && setUploaded(b))
      .catch(() => {
        if (!alive) return
        setSource(null)
        toast.error("That file isn't an image the browser can open. Try PNG, JPG or WebP.")
      })
    return () => {
      alive = false
    }
  }, [target, source, fit, stamp])

  const takeFile = useCallback((f: File | undefined | null) => {
    if (!f) return
    if (!f.type.startsWith("image/")) {
      toast.error("Choose an image file: PNG, JPG or WebP.")
      return
    }
    setSource(f)
    setTab("image")
  }, [])

  // Paste an image straight from the clipboard (e.g. copied from Gemini).
  useEffect(() => {
    if (!target) return
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"))
      if (item) {
        e.preventDefault()
        takeFile(item.getAsFile())
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [target, takeFile])

  const collageUrl = useBlobUrl(collage)
  const uploadedUrl = useBlobUrl(uploaded)
  const result = tab === "boxart" ? collage : uploaded
  const previewUrl = tab === "boxart" ? collageUrl : uploadedUrl

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success("Prompt copied", { description: "Paste it into Gemini, then bring the image back here." })
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.")
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-pixel text-base">Cover for {target?.name}</DialogTitle>
          <DialogDescription>Saved as Collections/Imgs/{target?.name}.png when you save to the card.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="min-w-0">
            <TabsList className="w-full">
              <TabsTrigger value="boxart">
                <LayoutGrid /> From box art
              </TabsTrigger>
              <TabsTrigger value="image">
                <ImageUp /> Your image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="boxart" className="space-y-3 pt-3">
              <p className="text-sm text-ink-dim">A collage of the games' box art with the collection name.</p>
              <Segmented value={layout} options={LAYOUTS} onChange={setLayout} label="Cover layout" />
              {roms.length === 0 && <p className="text-sm text-amber">This collection has no games yet, so the cover uses placeholders.</p>}
            </TabsContent>

            <TabsContent value="image" className="space-y-6 pt-3">
              <section className="space-y-3">
                <StepTitle n={1}>Generate an image with Nano Banana</StepTitle>
                <Segmented
                  value={style}
                  options={(Object.keys(STYLE_LABELS) as PromptStyle[]).map((id) => ({ id, label: STYLE_LABELS[id] }))}
                  onChange={setStyle}
                  label="Art style"
                />
                <label className="flex items-center gap-2.5 text-sm text-ink">
                  <Switch checked={promptTitle} onCheckedChange={setPromptTitle} />
                  Ask for the collection name in the artwork
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="h-44 resize-y bg-shell-2 text-[13px] leading-relaxed"
                  aria-label="Prompt for Nano Banana"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="press" onClick={copyPrompt}>
                    <Copy /> Copy prompt
                  </Button>
                  <Button size="sm" variant="secondary" className="press" asChild>
                    <a href={GEMINI_URL} target="_blank" rel="noreferrer">
                      <ExternalLink /> Open Gemini
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-ink-dim">
                  In Gemini, choose image creation (Nano Banana), paste the prompt and download the result. You can edit the prompt
                  here first.
                </p>
              </section>

              <section className="space-y-3">
                <StepTitle n={2}>Add the image</StepTitle>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    takeFile(e.dataTransfer.files[0])
                  }}
                  className={cn(
                    "flex w-full flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    dragging ? "border-btn-b bg-btn-b/10" : "border-line hover:border-ink-dim hover:bg-panel/60",
                  )}
                >
                  <Upload className="size-5 text-btn-b" />
                  <span className="font-semibold text-ink">{source ? source.name : "Drop an image, click to choose, or paste it"}</span>
                  <span className="text-xs text-ink-dim">Any image works: PNG, JPG or WebP. It's resized to a square PNG.</span>
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    takeFile(e.target.files?.[0])
                    e.target.value = ""
                  }}
                />
                {source && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <Segmented
                      value={fit}
                      options={[
                        { id: "fill" as FitMode, label: "Crop to square" },
                        { id: "fit" as FitMode, label: "Show whole image" },
                      ]}
                      onChange={setFit}
                      label="How the image fits"
                    />
                    <label className="flex items-center gap-2.5 text-sm text-ink">
                      <Switch checked={stamp} onCheckedChange={setStamp} />
                      Add name bar
                    </label>
                  </div>
                )}
              </section>
            </TabsContent>
          </Tabs>

          <div className="space-y-2 md:pt-12">
            <div className="relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-lg bg-shell ring-1 ring-line">
              {previewUrl ? (
                <img src={previewUrl} alt="Cover preview" className="size-full" />
              ) : (
                <div className="grid size-full place-items-center px-6 text-center text-sm text-ink-dim">
                  Your image shows up here.
                </div>
              )}
              {tab === "boxart" && busy && (
                <div className="absolute inset-0 grid place-items-center bg-shell/50">
                  <Loader2 className="size-6 animate-spin text-ink-dim" />
                </div>
              )}
            </div>
            <p className="text-center text-xs text-ink-dim">Preview at 480 × 480</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="press"
            disabled={!result || (tab === "boxart" && busy)}
            onClick={() => {
              if (result) onUse(result)
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
