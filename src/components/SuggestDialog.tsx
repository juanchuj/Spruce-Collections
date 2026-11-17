import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ClipboardPaste, Copy, Download, ExternalLink, Sparkles, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { Collection, GameSystem, Rom } from "@/lib/spruce"
import { validateName } from "@/lib/spruce"
import {
  ASSISTANTS,
  type Assistant,
  type Suggestion,
  buildCatalog,
  buildSuggestPrompt,
  estimateTokens,
  parseSuggestions,
} from "@/lib/suggest"
import { cn } from "@/lib/utils"
import { Segmented, StepTitle } from "./Dialogs"

const COUNTS = [3, 5, 10] as const
const SIZES = [12, 20, 30] as const
const BIG_PROMPT = 120_000 // characters; beyond this, attaching a file is more reliable than pasting

interface Row extends Suggestion {
  key: string
  include: boolean
  editedName: string
}

interface Props {
  open: boolean
  roms: Rom[]
  systems: GameSystem[]
  collections: Collection[]
  onClose: () => void
  onCreate: (items: { name: string; roms: Rom[] }[], makeCovers: boolean) => void
}

export function SuggestDialog({ open, roms, systems, collections, onClose, onCreate }: Props) {
  const [count, setCount] = useState<number>(5)
  const [size, setSize] = useState<number>(20)
  const [assistant, setAssistant] = useState<Assistant>("claude")
  const [focus, setFocus] = useState("")
  const [reply, setReply] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [makeCovers, setMakeCovers] = useState(true)

  const catalog = useMemo(() => buildCatalog(roms), [roms])
  const prompt = useMemo(
    () => buildSuggestPrompt({ count, focus, maxPerCollection: size, roms, systems, existing: collections, catalog }),
    [count, focus, size, roms, systems, collections, catalog],
  )
  const tokens = estimateTokens(prompt)
  const big = prompt.length > BIG_PROMPT

  useEffect(() => {
    if (!open) return
    setReply("")
    setRows([])
    setError(null)
  }, [open])

  // Parse as soon as a reply is pasted or edited.
  useEffect(() => {
    const res = parseSuggestions(reply, catalog)
    setError(res.error ?? null)
    setRows(
      res.suggestions.map((s, i) => ({ ...s, key: `${i}-${s.name}`, include: s.roms.length > 0, editedName: s.name })),
    )
  }, [reply, catalog])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success("Prompt copied", { description: `Paste it into ${ASSISTANTS[assistant].label}, then paste the reply in step 2.` })
    } catch {
      toast.error("Couldn't copy. Use Download instead and attach the file.")
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([prompt], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "spruce-collections-prompt.txt"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const pasteReply = async () => {
    try {
      setReply(await navigator.clipboard.readText())
    } catch {
      toast.error("The browser blocked reading the clipboard. Click in the box and press Ctrl/⌘+V.")
    }
  }

  // Name checks: empty/invalid names block; names matching an existing collection merge into it.
  const checked = rows.map((r) => {
    const others = collections
    const clash = others.find((c) => c.name.toLowerCase() === r.editedName.trim().toLowerCase())
    const err = clash ? null : validateName(r.editedName, others)
    return { ...r, clash, err }
  })
  const dupInBatch = (i: number) =>
    checked.some((o, j) => j < i && o.include && o.editedName.trim().toLowerCase() === checked[i].editedName.trim().toLowerCase())
  const chosen = checked.filter((r) => r.include && r.roms.length)
  const blocked = checked.some((r) => r.include && r.err)

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-pixel text-base">
            <Sparkles className="size-4 text-btn-b" /> Suggest collections with AI
          </DialogTitle>
          <DialogDescription>
            Send your game list to the AI you use, paste its reply back, and create the collections in one go.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: prompt + reply */}
          <div className="min-w-0 space-y-7">
            <section className="space-y-3.5">
              <StepTitle n={1}>Copy the prompt</StepTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-ink-dim">Collections to suggest</Label>
                  <Segmented
                    value={String(count)}
                    options={COUNTS.map((n) => ({ id: String(n), label: String(n) }))}
                    onChange={(v) => setCount(Number(v))}
                    label="Collections to suggest"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-ink-dim">Max games per collection</Label>
                  <Segmented
                    value={String(size)}
                    options={SIZES.map((n) => ({ id: String(n), label: String(n) }))}
                    onChange={(v) => setSize(Number(v))}
                    label="Max games per collection"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suggest-focus" className="text-xs text-ink-dim">
                  Anything in particular? (optional)
                </Label>
                <Input
                  id="suggest-focus"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="Games to play with my kids, short sessions, best RPGs…"
                  className="bg-shell-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-ink-dim">AI to use</Label>
                <Segmented
                  value={assistant}
                  options={(Object.keys(ASSISTANTS) as Assistant[]).map((id) => ({ id, label: ASSISTANTS[id].label }))}
                  onChange={setAssistant}
                  label="AI to use"
                />
              </div>

              <div className="rounded-md bg-shell-2 p-3 ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-dim">
                  <span>
                    <b className="text-ink">{roms.length}</b> games on <b className="text-ink">{systems.length}</b> systems
                  </span>
                  <span>about {tokens.toLocaleString()} tokens</span>
                </div>
                <pre className="mt-2 max-h-28 overflow-hidden text-[11px] leading-relaxed whitespace-pre-wrap text-ink-dim [mask-image:linear-gradient(black_60%,transparent)]">
                  {prompt.slice(0, 900)}
                </pre>
              </div>
              {big && (
                <p className="flex gap-2 text-sm text-amber">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  This prompt is long. Download it and attach the .txt file to the chat instead of pasting it.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="press" onClick={copy}>
                  <Copy /> Copy prompt
                </Button>
                <Button size="sm" variant="secondary" className="press" onClick={download}>
                  <Download /> Download .txt
                </Button>
                <Button size="sm" variant="secondary" className="press" asChild>
                  <a href={ASSISTANTS[assistant].url} target="_blank" rel="noreferrer">
                    <ExternalLink /> Open {ASSISTANTS[assistant].label}
                  </a>
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <StepTitle n={2}>Paste the reply</StepTitle>
                <Button size="sm" variant="ghost" onClick={pasteReply}>
                  <ClipboardPaste /> Paste from clipboard
                </Button>
              </div>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={'Paste the whole reply here, including the ```json block.'}
                className="h-40 resize-y bg-shell-2 font-mono text-xs"
                aria-label="AI reply"
              />
              {error && reply.trim() && <p className="text-sm text-destructive">{error}</p>}
            </section>
          </div>

          {/* Right: review */}
          <section className="flex min-w-0 flex-col gap-3">
            <StepTitle n={3}>Review and create</StepTitle>
            {checked.length === 0 ? (
              <div className="grid min-h-48 flex-1 place-items-center rounded-lg border-2 border-dashed border-line p-6 text-center text-sm text-ink-dim">
                The suggested collections show up here once you paste the reply.
              </div>
            ) : (
              <ul className="max-h-[52vh] space-y-2 overflow-y-auto pr-1" role="list">
                {checked.map((r, i) => (
                  <li
                    key={r.key}
                    className={cn(
                      "rounded-lg p-3 ring-1 transition-colors",
                      r.include ? "bg-panel ring-line" : "bg-transparent opacity-60 ring-line/50",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-2"
                        checked={r.include}
                        disabled={!r.roms.length}
                        onCheckedChange={(v) => update(r.key, { include: v === true })}
                        aria-label={`Include ${r.editedName}`}
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Input
                          value={r.editedName}
                          onChange={(e) => update(r.key, { editedName: e.target.value })}
                          className="h-8 bg-shell-2 font-medium"
                          aria-label="Collection name"
                          aria-invalid={r.include && !!r.err}
                        />
                        {r.description && <p className="text-xs leading-snug text-ink-dim">{r.description}</p>}
                        <p className="text-xs">
                          <span className="font-semibold text-ink">
                            {r.roms.length} {r.roms.length === 1 ? "game" : "games"}
                          </span>
                          {r.unknown.length > 0 && <span className="ml-2 text-amber">{r.unknown.length} not found on the card, skipped</span>}
                          {r.include && r.clash && <span className="ml-2 text-btn-b">adds to your existing {r.clash.name}</span>}
                          {r.include && !r.clash && dupInBatch(i) && <span className="ml-2 text-btn-b">merges with the one above</span>}
                          {r.include && r.err && <span className="ml-2 text-destructive">{r.err}</span>}
                        </p>
                        {r.roms.length > 0 && (
                          <p className="line-clamp-2 text-xs text-ink-dim/80" title={r.roms.map((g) => g.name).join(", ")}>
                            {r.roms.map((g) => g.name).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {checked.length > 0 && (
              <label className="flex items-center gap-2.5 text-sm text-ink">
                <Switch checked={makeCovers} onCheckedChange={setMakeCovers} />
                Make box-art covers for new collections
              </label>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="press"
            disabled={!chosen.length || blocked}
            onClick={() => {
              onCreate(
                chosen.map((r) => ({ name: r.editedName.trim(), roms: r.roms })),
                makeCovers,
              )
              onClose()
            }}
          >
            <Sparkles /> Create {chosen.length || ""} {chosen.length === 1 ? "collection" : "collections"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
