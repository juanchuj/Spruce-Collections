import { cn } from "@/lib/utils"

/** A tiny pixel cartridge drawn on an 8×9 grid. */
export function CartIcon({ className }: { className?: string }) {
  const rows = [
    "11111100",
    "12222210",
    "12333210",
    "12333210",
    "12222210",
    "12222210",
    "11111111",
    "14141411",
    "11111111",
  ]
  const fill: Record<string, string> = { "1": "var(--btn-a)", "2": "#ffd0e0", "3": "var(--lcd)", "4": "var(--amber)" }
  return (
    <svg viewBox="0 0 8 9" className={cn("pixelated", className)} shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) =>
        [...r].map((c, x) => (c === "0" ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill[c]} />)),
      )}
    </svg>
  )
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <CartIcon className="size-7" />
      <span className="font-pixel text-[15px] leading-none tracking-tight text-ink">
        Spruce Collections
      </span>
    </div>
  )
}
