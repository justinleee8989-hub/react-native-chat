// Draws the chat background doodle tile, assets/images/chat-pattern.png (black strokes on
// transparent, seamless, 1x/2x/3x): node scripts/build-chat-pattern.mjs assets/images
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const out = process.argv[2]
const T = 240
const STROKE = 1.6

let seed = 7
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

const clamp = v => Math.max(0, Math.min(1, v))
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const h = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - ax - dx * h, py - ay - dy * h)
}
const roundBox = (x, y, w, h, r) => {
  const qx = Math.abs(x) - w + r, qy = Math.abs(y) - h + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
const poly = pts => (x, y) => {
  let d = Infinity
  for (let i = 1; i < pts.length; i++)
    d = Math.min(d, segDist(x, y, ...pts[i - 1], ...pts[i]))
  return d - STROKE / 2
}

// Each shape: signed distance in its local frame (pt), and its radius.
const shapes = {
  ring: [(x, y) => Math.abs(Math.hypot(x, y) - 6) - STROKE / 2, 8],
  dot: [(x, y) => Math.hypot(x, y) - 2.2, 3],
  plus: [(x, y) => Math.min(segDist(x, y, -5.5, 0, 5.5, 0), segDist(x, y, 0, -5.5, 0, 5.5)) - STROKE / 2, 7],
  bubble: [(x, y) => Math.min(
    Math.abs(roundBox(x, y + 1.5, 9, 6.5, 4.5)) - STROKE / 2,
    poly([[-4, 5], [-6.5, 10], [0, 5]])(x, y),
  ), 12],
  wave: [poly(Array.from({ length: 21 }, (_, i) => [-9 + i * 0.9, Math.sin(i / 20 * Math.PI * 2) * 3])), 11],
  heart: [poly(Array.from({ length: 41 }, (_, i) => {
    const a = i / 40 * Math.PI * 2
    return [16 * Math.sin(a) ** 3 * 0.42, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.42]
  })), 9],
  spark: [(x, y) => {
    // A four-point star: two thin crossing diamonds.
    const d1 = Math.abs(x) / 6 + Math.abs(y) / 1.6 - 1
    const d2 = Math.abs(x) / 1.6 + Math.abs(y) / 6 - 1
    return Math.min(d1, d2) * 1.4
  }, 7],
}
const kinds = Object.keys(shapes)

const N = 5
const cell = T / N
const items = []
for (let row = 0; row < N; row++) {
  for (let col = 0; col < N; col++) {
    items.push({
      kind: kinds[Math.floor(rand() * kinds.length)],
      x: (col + 0.5) * cell + (rand() - 0.5) * cell * 0.45 + (row % 2) * cell * 0.5,
      y: (row + 0.5) * cell + (rand() - 0.5) * cell * 0.45,
      angle: (rand() - 0.5) * 1.2,
      scale: 0.9 + rand() * 0.35,
    })
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++)
    c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = buf => {
  let c = 0xFFFFFFFF
  for (const b of buf)
    c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const sum = Buffer.alloc(4)
  sum.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, sum])
}

for (const s of [1, 2, 3]) {
  const W = T * s
  const alpha = new Float32Array(W * W)
  for (const item of items) {
    const [sdf, radius] = shapes[item.kind]
    const r = (radius * item.scale + 2) * s
    const cos = Math.cos(item.angle), sin = Math.sin(item.angle)
    for (let py = Math.floor(item.y * s - r); py <= item.y * s + r; py++) {
      for (let px = Math.floor(item.x * s - r); px <= item.x * s + r; px++) {
        const dx = (px + 0.5) / s - item.x, dy = (py + 0.5) / s - item.y
        const lx = (dx * cos + dy * sin) / item.scale, ly = (-dx * sin + dy * cos) / item.scale
        const a = clamp(0.5 - sdf(lx, ly) * item.scale * s)
        const i = ((py % W) + W) % W * W + ((px % W) + W) % W
        alpha[i] = Math.max(alpha[i], a)
      }
    }
  }
  const raw = Buffer.alloc(W * (W * 4 + 1))
  for (let y = 0; y < W; y++) {
    raw[y * (W * 4 + 1)] = 0
    for (let x = 0; x < W; x++)
      raw[y * (W * 4 + 1) + 1 + x * 4 + 3] = Math.round(alpha[y * W + x] * 255)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(W, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(`${out}/chat-pattern${s === 1 ? '' : `@${s}x`}.png`, png)
}
