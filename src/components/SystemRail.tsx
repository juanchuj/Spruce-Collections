import type { GameSystem } from "@/lib/spruce"
import { cn } from "@/lib/utils"
import { SystemSwatch } from "./Library"

interface Props {
  systems: GameSystem[]
  total: number
  value: string | null
  onChange: (id: string | null) => void
}

export function SystemRail({ systems, total, value, onChange }: Props) {
  const item = (id: string | null, label: string, count: number, sys?: GameSystem) => {
    const on = value === id
    return (
      <button
        key={id ?? "all"}
        onClick={() => onChange(id)}
        aria-pressed={on}
        className={cn(
          "group flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-full",
          on ? "bg-panel-2 text-ink shadow-[inset_3px_0_0_var(--btn-a)]" : "text-ink-dim hover:bg-panel/70 hover:text-ink",
        )}
      >
        {sys ? <SystemSwatch system={sys} /> : <span className="size-2.5 rounded-[2px] bg-btn-a" aria-hidden />}
        <span className="truncate font-medium">{label}</span>
        <span className={cn("ml-auto pl-2 font-pixel text-[11px]", on ? "text-ink" : "text-ink-dim/80")}>{count}</span>
      </button>
    )
  }
  return (
    <nav
      aria-label="Systems"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-line p-2 lg:w-52 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0 lg:p-3"
    >
      {item(null, "All games", total)}
      <div className="hidden px-3 pt-4 pb-1 text-xs text-ink-dim/80 lg:block">Systems</div>
      {systems.map((s) => item(s.id, s.label, s.romCount, s))}
    </nav>
  )
}
