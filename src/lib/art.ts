import { useEffect, useState } from "react"
import { type CardDir, resolveFile } from "./fs"

/**
 * Box art loader: resolves the first existing candidate, caches object URLs,
 * and limits concurrent card reads so scrolling a big list stays smooth.
 */
const cache = new Map<string, Promise<string | null>>()
let active = 0
const queue: (() => void)[] = []
const MAX = 6

function slot<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      active++
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--
          queue.shift()?.()
        })
    }
    if (active < MAX) run()
    else queue.push(run)
  })
}

let currentRoot: CardDir | null = null
export function setArtRoot(root: CardDir | null) {
  if (root !== currentRoot) {
    for (const p of cache.values()) p.then((u) => u && URL.revokeObjectURL(u))
    cache.clear()
    currentRoot = root
  }
}

export function loadArt(candidates: string[]): Promise<string | null> {
  const key = candidates.join("|")
  let p = cache.get(key)
  if (!p) {
    const root = currentRoot
    p = root
      ? slot(async () => {
          for (const c of candidates) {
            const f = await resolveFile(root, c)
            if (f && f.size > 0) return URL.createObjectURL(f)
          }
          return null
        })
      : Promise.resolve(null)
    cache.set(key, p)
  }
  return p
}

export function useArt(candidates: string[] | undefined) {
  const key = candidates?.join("|") ?? ""
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (candidates?.length) loadArt(candidates).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return url
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
