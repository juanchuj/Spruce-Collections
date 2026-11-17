/**
 * Storage abstraction. The SpruceOS adapter only talks to `CardDir`, so the
 * same scanner works on a real card (File System Access API), on a folder
 * picked read-only (Firefox/Safari), and on the built-in demo card.
 */

export type EntryKind = "file" | "directory"

export interface CardDir {
  readonly name: string
  readonly writable: boolean
  list(): Promise<{ name: string; kind: EntryKind }[]>
  dir(name: string): Promise<CardDir | null>
  file(name: string): Promise<File | null>
  /** Create (or open) a sub-directory. Writable backends only. */
  ensureDir(name: string): Promise<CardDir>
  /** Write a file, replacing it. Writable backends only. */
  write(name: string, data: Blob | string): Promise<void>
  remove(name: string): Promise<void>
}

/** Walk a slash path ("Roms/GB/Imgs") from a root. */
export async function resolveDir(root: CardDir, path: string): Promise<CardDir | null> {
  let cur: CardDir | null = root
  for (const part of path.split("/").filter(Boolean)) {
    if (!cur) return null
    cur = await cur.dir(part)
  }
  return cur
}

export async function resolveFile(root: CardDir, path: string): Promise<File | null> {
  const parts = path.split("/").filter(Boolean)
  const name = parts.pop()
  if (!name) return null
  const dir = await resolveDir(root, parts.join("/"))
  return dir ? dir.file(name) : null
}

export async function readText(root: CardDir, path: string): Promise<string | null> {
  const f = await resolveFile(root, path)
  return f ? f.text() : null
}

/* ------------------------------------------------------------------ */
/* File System Access API backend (Chrome / Edge)                      */
/* ------------------------------------------------------------------ */

export class FsaDir implements CardDir {
  readonly writable = true
  private handle: FileSystemDirectoryHandle
  constructor(handle: FileSystemDirectoryHandle) {
    this.handle = handle
  }

  get name() {
    return this.handle.name
  }

  async list() {
    const out: { name: string; kind: EntryKind }[] = []
    for await (const [name, h] of this.handle.entries()) out.push({ name, kind: h.kind })
    return out
  }

  async dir(name: string) {
    try {
      return new FsaDir(await this.handle.getDirectoryHandle(name))
    } catch {
      return null
    }
  }

  async file(name: string) {
    try {
      const fh = await this.handle.getFileHandle(name)
      return await fh.getFile()
    } catch {
      return null
    }
  }

  async ensureDir(name: string) {
    return new FsaDir(await this.handle.getDirectoryHandle(name, { create: true }))
  }

  async write(name: string, data: Blob | string) {
    const fh = await this.handle.getFileHandle(name, { create: true })
    // createWritable writes to a swap file; the real file is only replaced on close().
    const w = await fh.createWritable()
    await w.write(data)
    await w.close()
  }

  async remove(name: string) {
    await this.handle.removeEntry(name)
  }
}

/* ------------------------------------------------------------------ */
/* In-memory backend: demo card and read-only folder uploads           */
/* ------------------------------------------------------------------ */

type MemNode = { kind: "file"; file: File } | { kind: "directory"; children: Map<string, MemNode> }

export class MemDir implements CardDir {
  readonly name: string
  readonly writable: boolean
  private node: Extract<MemNode, { kind: "directory" }>
  constructor(name: string, node: Extract<MemNode, { kind: "directory" }>, writable: boolean) {
    this.name = name
    this.node = node
    this.writable = writable
  }

  static empty(name: string, writable: boolean) {
    return new MemDir(name, { kind: "directory", children: new Map() }, writable)
  }

  /** Build from <input webkitdirectory>. Paths are "picked-folder/a/b.ext". */
  static fromFileList(files: FileList | File[]): MemDir {
    const list = Array.from(files)
    const first = list[0]?.webkitRelativePath.split("/")[0] ?? "card"
    const root = MemDir.empty(first, false)
    for (const f of list) {
      const parts = f.webkitRelativePath.split("/").slice(1)
      root.put(parts.join("/"), f)
    }
    return root
  }

  /** Insert a file at a slash path, creating folders. Used to build the demo card. */
  put(path: string, file: File) {
    const parts = path.split("/").filter(Boolean)
    const name = parts.pop()!
    let cur = this.node
    for (const p of parts) {
      let next = cur.children.get(p)
      if (!next || next.kind !== "directory") {
        next = { kind: "directory", children: new Map() }
        cur.children.set(p, next)
      }
      cur = next
    }
    cur.children.set(name, { kind: "file", file })
  }

  async list() {
    return [...this.node.children].map(([name, n]) => ({ name, kind: n.kind }))
  }

  async dir(name: string) {
    const n = this.node.children.get(name)
    return n && n.kind === "directory" ? new MemDir(name, n, this.writable) : null
  }

  async file(name: string) {
    const n = this.node.children.get(name)
    return n && n.kind === "file" ? n.file : null
  }

  async ensureDir(name: string) {
    this.assertWritable()
    let n = this.node.children.get(name)
    if (!n || n.kind !== "directory") {
      n = { kind: "directory", children: new Map() }
      this.node.children.set(name, n)
    }
    return new MemDir(name, n, this.writable)
  }

  async write(name: string, data: Blob | string) {
    this.assertWritable()
    this.node.children.set(name, { kind: "file", file: new File([data], name) })
  }

  async remove(name: string) {
    this.assertWritable()
    this.node.children.delete(name)
  }

  private assertWritable() {
    if (!this.writable) throw new Error("This card was opened read-only.")
  }
}

export const supportsFsAccess = () => typeof window !== "undefined" && "showDirectoryPicker" in window
