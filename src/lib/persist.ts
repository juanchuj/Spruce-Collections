import { openDB } from "idb"

/** Remembers the last card folder so it can be reopened with one click. */
const dbp = typeof indexedDB !== "undefined" ? openDB("spruce-collections", 1, { upgrade: (db) => db.createObjectStore("kv") }) : null

export async function rememberHandle(h: FileSystemDirectoryHandle) {
  try {
    await (await dbp)?.put("kv", h, "card")
  } catch {
    /* not critical */
  }
}

export async function recallHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return ((await (await dbp)?.get("kv", "card")) as FileSystemDirectoryHandle | undefined) ?? null
  } catch {
    return null
  }
}

export async function forgetHandle() {
  try {
    await (await dbp)?.delete("kv", "card")
  } catch {
    /* not critical */
  }
}

export async function ensurePermission(h: FileSystemDirectoryHandle) {
  const opts = { mode: "readwrite" as const }
  if ((await h.queryPermission(opts)) === "granted") return true
  return (await h.requestPermission(opts)) === "granted"
}
