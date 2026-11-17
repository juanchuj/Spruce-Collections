import { useRef } from "react"
import { FolderOpen, Gamepad2, HardDrive, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Brand } from "@/components/Brand"
import type { ScanProgress } from "@/lib/spruce"
import { supportsFsAccess } from "@/lib/fs"

export type LcdState =
  | { kind: "idle" }
  | { kind: "scanning"; progress: ScanProgress | null }
  | { kind: "error"; message: string }

interface Props {
  lcd: LcdState
  rememberedName: string | null
  onOpen: () => void
  onReconnect: () => void
  onDemo: () => void
  onFolder: (files: FileList) => void
}

function Lcd({ state }: { state: LcdState }) {
  const pct =
    state.kind === "scanning" && state.progress ? Math.round((state.progress.done / Math.max(1, state.progress.total)) * 100) : 0
  const blocks = 16
  const filled = Math.round((pct / 100) * blocks)
  return (
    <div className="lcd-bezel rounded-[22px] p-5 pb-4 sm:p-7 sm:pb-5">
      <div className="lcd flex aspect-[4/3] flex-col justify-between rounded-md p-5 font-pixel sm:p-6" role="status" aria-live="polite">
        <div className="flex items-center justify-between text-[11px] opacity-70">
          <span>spruceOS</span>
          <span>{state.kind === "scanning" ? "READ" : "SD"}</span>
        </div>

        {state.kind === "idle" && (
          <div className="space-y-2">
            <div className="text-[28px] leading-none sm:text-[34px]">Collections</div>
            <div className="caret text-sm">&gt; insert sd card</div>
          </div>
        )}

        {state.kind === "scanning" && (
          <div className="space-y-3">
            <div className="text-lg leading-none">Reading card</div>
            <div className="truncate text-sm">{state.progress?.system ?? "Looking for systems"}</div>
            <div className="flex gap-[3px]" aria-hidden>
              {Array.from({ length: blocks }, (_, i) => (
                <span key={i} className={i < filled ? "h-3 flex-1 bg-lcd-ink" : "h-3 flex-1 bg-lcd-ink/15"} />
              ))}
            </div>
            <div className="text-xs opacity-80">{state.progress ? `${state.progress.roms} games found` : "…"}</div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="space-y-2">
            <div className="text-lg leading-none">Card not ready</div>
            <p className="font-sans text-sm font-semibold leading-snug">{state.message}</p>
          </div>
        )}

        <div className="text-[10px] opacity-60">{state.kind === "scanning" ? `${pct}%` : "v0.2.0"}</div>
      </div>
      <div className="mt-4 flex items-center justify-between px-1">
        <div className="relative size-6" aria-hidden>
          <span className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-[2px] bg-shell" />
          <span className="absolute inset-y-0 left-1/2 w-2 -translate-x-1/2 rounded-[2px] bg-shell" />
        </div>
        <div className="flex gap-2" aria-hidden>
          <span className="size-3 rounded-full bg-btn-b shadow-[0_2px_0_rgb(0_0_0/0.4)]" />
          <span className="size-3 rounded-full bg-btn-a shadow-[0_2px_0_rgb(0_0_0/0.4)]" />
        </div>
      </div>
    </div>
  )
}

export function ConnectScreen({ lcd, rememberedName, onOpen, onReconnect, onDemo, onFolder }: Props) {
  const folderInput = useRef<HTMLInputElement>(null)
  const fsa = supportsFsAccess()
  const busy = lcd.kind === "scanning"

  return (
    <div className="flex min-h-full flex-col">
      <header className="px-6 pt-6 sm:px-10">
        <Brand />
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-16">
        <section className="max-w-xl">
          <h1 className="font-pixel text-[34px] leading-[1.1] text-ink sm:text-[44px]">Build collections for your handheld</h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-dim">
            Open your spruceOS SD card, pick from every game on it, and save collections straight back to the card.
            Everything runs in this tab; nothing is uploaded.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {fsa ? (
              <>
                <Button size="lg" className="press h-12 px-6 text-base" onClick={onOpen} disabled={busy}>
                  <HardDrive /> Open SD card
                </Button>
                {rememberedName && (
                  <Button size="lg" variant="secondary" className="press h-12 px-5 text-base" onClick={onReconnect} disabled={busy}>
                    <RotateCcw /> Reopen {rememberedName}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button size="lg" className="press h-12 px-6 text-base" onClick={() => folderInput.current?.click()} disabled={busy}>
                  <FolderOpen /> Open card folder
                </Button>
                <input
                  ref={folderInput}
                  type="file"
                  className="hidden"
                  // @ts-expect-error non-standard but supported everywhere
                  webkitdirectory=""
                  multiple
                  onChange={(e) => e.target.files?.length && onFolder(e.target.files)}
                />
              </>
            )}
            <Button size="lg" variant="ghost" className="h-12 px-5 text-base text-btn-b hover:text-btn-b" onClick={onDemo} disabled={busy}>
              <Gamepad2 /> Try the demo card
            </Button>
          </div>

          {!fsa && (
            <p className="mt-4 max-w-[52ch] text-sm text-amber">
              This browser can read the card but not write to it. You'll download collections.json and copy it to the card's
              Collections folder yourself. Use Chrome or Edge to save directly.
            </p>
          )}

          <ul className="mt-12 grid max-w-xl gap-4 text-sm leading-relaxed text-ink-dim sm:grid-cols-3">
            <li className="border-l-2 border-btn-a pl-3">
              <span className="block font-semibold text-ink">Handheld off</span>
              Use a card reader. The device rewrites its collections while it runs.
            </li>
            <li className="border-l-2 border-btn-b pl-3">
              <span className="block font-semibold text-ink">Card root</span>
              Pick the top of the card, the folder that holds Roms and Emu.
            </li>
            <li className="border-l-2 border-amber pl-3">
              <span className="block font-semibold text-ink">Backups</span>
              Each save keeps the previous collections.json next to it.
            </li>
          </ul>
        </section>

        <div className="mx-auto w-full max-w-[460px]">
          <Lcd state={lcd} />
        </div>
      </main>

      <footer className="px-6 pb-6 text-xs text-ink-dim/70 sm:px-10">
        Unofficial companion for spruceOS. Writes the same collections.json format PyUI uses (spruceOS 4.4).
      </footer>
    </div>
  )
}
