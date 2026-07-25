/**
 * Minimal ZIP reader/writer - just enough for .xlsx workbooks.
 *
 * Written entries are stored uncompressed (a roster template is a few hundred
 * bytes), while reading inflates through the platform's DecompressionStream, so
 * no third-party archive dependency is needed.
 */

const LOCAL_HEADER_SIG = 0x04034b50
const CENTRAL_HEADER_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50
/** Bit 11 - filenames are UTF-8 rather than CP437. */
const UTF8_FLAG = 0x0800
const METHOD_STORE = 0
const METHOD_DEFLATE = 8

export interface ZipEntry {
  name: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Builds a ZIP archive with every entry stored (no compression). */
export function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const prepared = entries.map((entry) => ({
    nameBytes: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
  }))

  const localSize = prepared.reduce((sum, e) => sum + 30 + e.nameBytes.length + e.data.length, 0)
  const centralSize = prepared.reduce((sum, e) => sum + 46 + e.nameBytes.length, 0)
  const buffer = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(buffer.buffer)

  let offset = 0
  const offsets: number[] = []

  for (const entry of prepared) {
    offsets.push(offset)
    view.setUint32(offset, LOCAL_HEADER_SIG, true)
    view.setUint16(offset + 4, 20, true) // version needed
    view.setUint16(offset + 6, UTF8_FLAG, true)
    view.setUint16(offset + 8, METHOD_STORE, true)
    view.setUint16(offset + 10, 0, true) // mod time
    view.setUint16(offset + 12, 0x21, true) // mod date - 1980-01-01
    view.setUint32(offset + 14, entry.crc, true)
    view.setUint32(offset + 18, entry.data.length, true)
    view.setUint32(offset + 22, entry.data.length, true)
    view.setUint16(offset + 26, entry.nameBytes.length, true)
    view.setUint16(offset + 28, 0, true) // extra length
    offset += 30
    buffer.set(entry.nameBytes, offset)
    offset += entry.nameBytes.length
    buffer.set(entry.data, offset)
    offset += entry.data.length
  }

  const centralStart = offset

  prepared.forEach((entry, index) => {
    view.setUint32(offset, CENTRAL_HEADER_SIG, true)
    view.setUint16(offset + 4, 20, true) // version made by
    view.setUint16(offset + 6, 20, true) // version needed
    view.setUint16(offset + 8, UTF8_FLAG, true)
    view.setUint16(offset + 10, METHOD_STORE, true)
    view.setUint16(offset + 12, 0, true)
    view.setUint16(offset + 14, 0x21, true)
    view.setUint32(offset + 16, entry.crc, true)
    view.setUint32(offset + 20, entry.data.length, true)
    view.setUint32(offset + 24, entry.data.length, true)
    view.setUint16(offset + 28, entry.nameBytes.length, true)
    view.setUint16(offset + 30, 0, true) // extra
    view.setUint16(offset + 32, 0, true) // comment
    view.setUint16(offset + 34, 0, true) // disk number
    view.setUint16(offset + 36, 0, true) // internal attrs
    view.setUint32(offset + 38, 0, true) // external attrs
    view.setUint32(offset + 42, offsets[index], true)
    offset += 46
    buffer.set(entry.nameBytes, offset)
    offset += entry.nameBytes.length
  })

  view.setUint32(offset, EOCD_SIG, true)
  view.setUint16(offset + 4, 0, true)
  view.setUint16(offset + 6, 0, true)
  view.setUint16(offset + 8, prepared.length, true)
  view.setUint16(offset + 10, prepared.length, true)
  view.setUint32(offset + 12, centralSize, true)
  view.setUint32(offset + 16, centralStart, true)
  view.setUint16(offset + 20, 0, true)

  return buffer
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('UNSUPPORTED_BROWSER')
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const inflated = await new Response(stream).arrayBuffer()
  return new Uint8Array(inflated)
}

function findEndOfCentralDirectory(view: DataView): number {
  // The EOCD sits at the tail, followed only by an optional comment (<= 64KB).
  const min = Math.max(0, view.byteLength - 22 - 0xffff)
  for (let i = view.byteLength - 22; i >= min; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i
  }
  return -1
}

/** Reads an archive into a map of entry name to raw bytes. */
export async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEndOfCentralDirectory(view)
  if (eocd < 0) throw new Error('NOT_A_ZIP')

  const count = view.getUint16(eocd + 10, true)
  let pointer = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  const files = new Map<string, Uint8Array>()

  for (let i = 0; i < count; i++) {
    if (view.getUint32(pointer, true) !== CENTRAL_HEADER_SIG) throw new Error('NOT_A_ZIP')

    const method = view.getUint16(pointer + 10, true)
    const compressedSize = view.getUint32(pointer + 20, true)
    const nameLength = view.getUint16(pointer + 28, true)
    const extraLength = view.getUint16(pointer + 30, true)
    const commentLength = view.getUint16(pointer + 32, true)
    const localOffset = view.getUint32(pointer + 42, true)
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength))

    // The local header repeats the name/extra lengths and they may differ from
    // the central copy, so the payload offset is resolved from the local one.
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const raw = bytes.subarray(dataStart, dataStart + compressedSize)

    if (method === METHOD_STORE) {
      files.set(name, raw)
    } else if (method === METHOD_DEFLATE) {
      files.set(name, await inflateRaw(raw))
    } else {
      throw new Error('UNSUPPORTED_COMPRESSION')
    }

    pointer += 46 + nameLength + extraLength + commentLength
  }

  return files
}
