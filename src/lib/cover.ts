import { loadArt, loadImage } from "./art"
import type { Rom } from "./spruce"

export type CoverLayout = "grid4" | "grid9" | "title"

const SIZE = 480
const PALETTE = ["#ff4f8b", "#33d1e0", "#ffb547", "#9b7bff", "#7fd16b", "#ff7a45"]

async function artFor(rom: Rom | undefined) {
  if (!rom) return null
  const url = await loadArt(rom.art)
  if (!url) return null
  try {
    return await loadImage(url)
  } catch {
    return null
  }
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, rom: Rom | undefined, i: number, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = PALETTE[i % PALETTE.length]
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = "rgba(0,0,0,0.35)"
  ctx.font = `700 ${Math.round(Math.min(w, h) / 3.2)}px Silkscreen, monospace`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const initials = (rom?.name ?? "?")
    .replace(/^the\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  ctx.fillText(initials, x + w / 2, y + h / 2)
}

function label(ctx: CanvasRenderingContext2D, name: string, y: number, h: number) {
  ctx.fillStyle = "rgba(23,19,42,0.86)"
  ctx.fillRect(0, y, SIZE, h)
  ctx.fillStyle = "#efe9ff"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  let size = 34
  ctx.font = `700 ${size}px Silkscreen, monospace`
  while (ctx.measureText(name).width > SIZE - 48 && size > 14) {
    size -= 2
    ctx.font = `700 ${size}px Silkscreen, monospace`
  }
  ctx.fillText(name, 24, y + h / 2 + 1)
}

/** Render a collection cover as a PNG blob. */
export async function renderCover(name: string, roms: Rom[], layout: CoverLayout): Promise<Blob> {
  await document.fonts?.load("700 20px Silkscreen").catch(() => {})
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#17132a"
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Prefer games that actually have box art.
  const withArt = await Promise.all(roms.slice(0, 24).map(async (r) => ({ r, img: await artFor(r) })))
  withArt.sort((a, b) => Number(!!b.img) - Number(!!a.img))

  if (layout === "title") {
    const hero = withArt[0]
    if (hero?.img) drawCover(ctx, hero.img, 0, 0, SIZE, SIZE)
    else drawPlaceholder(ctx, hero?.r, 0, 0, 0, SIZE, SIZE)
    const grad = ctx.createLinearGradient(0, SIZE * 0.45, 0, SIZE)
    grad.addColorStop(0, "rgba(23,19,42,0)")
    grad.addColorStop(1, "rgba(23,19,42,0.92)")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, SIZE, SIZE)
    label(ctx, name, SIZE - 96, 96)
  } else {
    const n = layout === "grid9" ? 3 : 2
    const gap = 6
    const labelH = 76
    const cw = (SIZE - gap * (n + 1)) / n
    const ch = (SIZE - labelH - gap * (n + 1)) / n
    for (let i = 0; i < n * n; i++) {
      const x = gap + (i % n) * (cw + gap)
      const y = gap + Math.floor(i / n) * (ch + gap)
      const item = withArt[i]
      if (item?.img) drawCover(ctx, item.img, x, y, cw, ch)
      else drawPlaceholder(ctx, item?.r, i, x, y, cw, ch)
    }
    label(ctx, name, SIZE - labelH, labelH)
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render cover"))), "image/png"))
}
