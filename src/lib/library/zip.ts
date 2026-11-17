/**
 * Reads a zip's central directory from the end of the file — no unzipping.
 * Gives the names, CRC32s and sizes of the files inside, which is enough to
 * detect the system and to identify the game against a DAT.
 */
export interface ZipEntry {
  name: string
  crc: string // 8 lowercase hex digits
  size: number
}

export async function readZipIndex(file: Blob): Promise<ZipEntry[] | null> {
  const tailSize = Math.min(file.size, 65_557 + 22)
  if (tailSize < 22) return null
  const tail = new DataView(await file.slice(file.size - tailSize).arrayBuffer())
  // End of central directory record: signature 0x06054b50, searched backwards (a comment may follow it).
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null
  const count = tail.getUint16(eocd + 10, true)
  const cdSize = tail.getUint32(eocd + 12, true)
  const cdOffset = tail.getUint32(eocd + 16, true)
  if (cdOffset === 0xffffffff || cdSize > 8_000_000) return null // zip64 or absurd: skip
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer())
  const dec = new TextDecoder()
  const out: ZipEntry[] = []
  let p = 0
  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break
    const crc = cd.getUint32(p + 16, true)
    const size = cd.getUint32(p + 24, true)
    const nameLen = cd.getUint16(p + 28, true)
    const extraLen = cd.getUint16(p + 30, true)
    const commentLen = cd.getUint16(p + 32, true)
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen))
    if (!name.endsWith("/")) out.push({ name: name.split("/").pop()!, crc: crc.toString(16).padStart(8, "0"), size })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

let table: Uint32Array | null = null
function crcTable() {
  if (table) return table
  table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
}

/** CRC32 of a whole file, streamed. */
export async function crc32(file: Blob): Promise<string> {
  const t = crcTable()
  let c = 0xffffffff
  const reader = file.stream().getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    for (let i = 0; i < value.length; i++) c = t[(c ^ value[i]) & 0xff] ^ (c >>> 8)
  }
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0")
}

/** Minimal "stored" zip writer — used only to build the demo library. */
export function makeZip(entries: { name: string; data: Uint8Array }[]): Blob {
  const t = crcTable()
  const enc = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    let c = 0xffffffff
    for (const b of e.data) c = t[(c ^ b) & 0xff] ^ (c >>> 8)
    const crc = (c ^ 0xffffffff) >>> 0
    const name = enc.encode(e.name)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 10, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, e.data.length, true)
    local.setUint32(22, e.data.length, true)
    local.setUint16(26, name.length, true)
    parts.push(local.buffer, name as BlobPart, e.data as BlobPart)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 10, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, e.data.length, true)
    cd.setUint32(24, e.data.length, true)
    cd.setUint16(28, name.length, true)
    cd.setUint32(42, offset, true)
    const cdBytes = new Uint8Array(46 + name.length)
    cdBytes.set(new Uint8Array(cd.buffer), 0)
    cdBytes.set(name, 46)
    central.push(cdBytes)
    offset += 30 + name.length + e.data.length
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...(central as BlobPart[]), end.buffer])
}
