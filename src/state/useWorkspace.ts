import { useCallback, useMemo, useRef, useState } from "react"
import type { CardDir } from "@/lib/fs"
import {
  type Collection,
  type CollectionEntry,
  type Rom,
  type ScanResult,
  newUid,
  serializeCollections,
} from "@/lib/spruce"

export type CardMode = "card" | "readonly" | "demo"

export interface Session {
  root: CardDir
  mode: CardMode
  scan: ScanResult
  snapshot: string | null
  warnings: string[]
}

export interface Diff {
  created: string[]
  deleted: string[]
  renamed: { from: string; to: string }[]
  changed: { name: string; added: number; removed: number }[]
  reordered: boolean
  covers: string[]
  total: number
}

const HISTORY = 60

export function useWorkspace() {
  const [session, setSession] = useState<Session | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [baseline, setBaseline] = useState<Collection[]>([])
  const [covers, setCovers] = useState<Record<string, Blob>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const past = useRef<Collection[][]>([])
  const future = useRef<Collection[][]>([])
  const live = useRef<Collection[]>([])

  const open = useCallback((s: Session, loaded: Collection[]) => {
    live.current = loaded
    setSession(s)
    setCollections(loaded)
    setBaseline(loaded)
    setCovers({})
    setSelected(loaded[0]?.uid ?? null)
    past.current = []
    future.current = []
  }, [])

  const close = useCallback(() => {
    live.current = []
    setSession(null)
    setCollections([])
    setBaseline([])
    setCovers({})
    setSelected(null)
  }, [])

  /** Every edit goes through here so it can be undone. `live` is the source of truth between renders. */
  const commit = useCallback((fn: (prev: Collection[]) => Collection[]) => {
    const prev = live.current
    const next = fn(prev)
    if (next === prev) return
    past.current = [...past.current.slice(-HISTORY + 1), prev]
    future.current = []
    live.current = next
    setCollections(next)
  }, [])

  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return false
    future.current.push(live.current)
    live.current = prev
    setCollections(prev)
    return true
  }, [])

  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return false
    past.current.push(live.current)
    live.current = next
    setCollections(next)
    return true
  }, [])

  const actions = useMemo(
    () => ({
      create(name: string, roms: Rom[] = []) {
        const uid = newUid()
        commit((prev) => [
          ...prev,
          { uid, name: name.trim(), originalName: null, games: roms.map((r) => ({ rom_file_path: r.path, game_system_name: r.systemId })) },
        ])
        setSelected(uid)
        return uid
      },
      /**
       * Create several collections in one undo step. A name that matches an existing
       * collection (case-insensitive) adds its games to that collection instead.
       */
      createMany(items: { name: string; roms: Rom[] }[]) {
        const result: { uid: string; name: string; merged: boolean; roms: Rom[] }[] = []
        commit((prev) => {
          const next = prev.map((c) => ({ ...c, games: [...c.games] }))
          for (const item of items) {
            const name = item.name.trim()
            const entries = item.roms.map((r) => ({ rom_file_path: r.path, game_system_name: r.systemId }))
            const hit = next.find((c) => c.name.toLowerCase() === name.toLowerCase())
            if (hit) {
              const have = new Set(hit.games.map((g) => g.rom_file_path))
              hit.games.push(...entries.filter((e) => !have.has(e.rom_file_path) && have.add(e.rom_file_path)))
              result.push({ uid: hit.uid, name: hit.name, merged: true, roms: item.roms })
            } else {
              const uid = newUid()
              next.push({ uid, name, originalName: null, games: entries })
              result.push({ uid, name, merged: false, roms: item.roms })
            }
          }
          return next
        })
        if (result[0]) setSelected(result[0].uid)
        return result
      },
      rename(uid: string, name: string) {
        commit((prev) => prev.map((c) => (c.uid === uid ? { ...c, name: name.trim() } : c)))
      },
      remove(uid: string) {
        commit((prev) => prev.filter((c) => c.uid !== uid))
        setCovers(({ [uid]: _, ...rest }) => rest)
        setSelected((s) => (s === uid ? null : s))
      },
      duplicate(uid: string, name: string) {
        const nu = newUid()
        commit((prev) => {
          const src = prev.find((c) => c.uid === uid)
          if (!src) return prev
          const i = prev.indexOf(src)
          const copy: Collection = { uid: nu, name, originalName: null, games: [...src.games] }
          return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
        })
        setSelected(nu)
      },
      move(uid: string, delta: number) {
        commit((prev) => {
          const i = prev.findIndex((c) => c.uid === uid)
          const j = i + delta
          if (i < 0 || j < 0 || j >= prev.length) return prev
          const next = [...prev]
          ;[next[i], next[j]] = [next[j], next[i]]
          return next
        })
      },
      /** Put collections in this exact order (one undo step). */
      reorder(uids: string[]) {
        commit((prev) => {
          const byUid = new Map(prev.map((c) => [c.uid, c]))
          const next = uids.map((u) => byUid.get(u)).filter((c): c is Collection => !!c)
          for (const c of prev) if (!uids.includes(c.uid)) next.push(c)
          return next.every((c, i) => c === prev[i]) ? prev : next
        })
      },
      addGames(uid: string, roms: Rom[]) {
        const target = live.current.find((c) => c.uid === uid)
        if (!target) return 0
        const have = new Set(target.games.map((g) => g.rom_file_path))
        const fresh: CollectionEntry[] = roms
          .filter((r, i, a) => !have.has(r.path) && a.findIndex((x) => x.path === r.path) === i)
          .map((r) => ({ rom_file_path: r.path, game_system_name: r.systemId }))
        if (fresh.length) commit((prev) => prev.map((c) => (c.uid === uid ? { ...c, games: [...c.games, ...fresh] } : c)))
        return fresh.length
      },
      removeGames(uid: string, paths: string[]) {
        const drop = new Set(paths)
        commit((prev) => prev.map((c) => (c.uid === uid ? { ...c, games: c.games.filter((g) => !drop.has(g.rom_file_path)) } : c)))
      },
      setCover(uid: string, blob: Blob | null) {
        setCovers(({ [uid]: _, ...rest }) => (blob ? { ...rest, [uid]: blob } : rest))
      },
    }),
    [commit],
  )

  /** Swap in a fresh card scan (after copying games) without touching collections or history. */
  const updateScan = useCallback((scan: ScanResult) => {
    setSession((s) => (s ? { ...s, scan } : s))
  }, [])

  const markSaved = useCallback((snapshot: string) => {
    const saved = live.current.map((c) => ({ ...c, originalName: c.name }))
    live.current = saved
    setCollections(saved)
    setBaseline(saved)
    setCovers({})
    setSession((s) => (s ? { ...s, snapshot } : s))
  }, [])

  const diff: Diff = useMemo(() => {
    const base = new Map(baseline.map((c) => [c.uid, c]))
    const cur = new Set(collections.map((c) => c.uid))
    const d: Diff = { created: [], deleted: [], renamed: [], changed: [], reordered: false, covers: [], total: 0 }
    for (const b of baseline) if (!cur.has(b.uid)) d.deleted.push(b.name)
    for (const c of collections) {
      const b = base.get(c.uid)
      if (!b) {
        d.created.push(c.name)
        continue
      }
      if (b.name !== c.name) d.renamed.push({ from: b.name, to: c.name })
      const bp = new Set(b.games.map((g) => g.rom_file_path))
      const cp = new Set(c.games.map((g) => g.rom_file_path))
      const added = [...cp].filter((p) => !bp.has(p)).length
      const removed = [...bp].filter((p) => !cp.has(p)).length
      if (added || removed) d.changed.push({ name: c.name, added, removed })
    }
    const kept = collections.filter((c) => base.has(c.uid)).map((c) => c.uid)
    const baseKept = baseline.filter((c) => cur.has(c.uid)).map((c) => c.uid)
    d.reordered = kept.join() !== baseKept.join()
    d.covers = collections.filter((c) => covers[c.uid]).map((c) => c.name)
    d.total = d.created.length + d.deleted.length + d.renamed.length + d.changed.length + d.covers.length + (d.reordered ? 1 : 0)
    // Guard: identical serialization means nothing to write even if uids moved around.
    if (!d.covers.length && serializeCollections(collections) === serializeCollections(baseline)) d.total = 0
    return d
  }, [baseline, collections, covers])

  return {
    session,
    collections,
    covers,
    selected,
    setSelected,
    open,
    close,
    actions,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    diff,
    markSaved,
    updateScan,
  }
}

export type Workspace = ReturnType<typeof useWorkspace>
