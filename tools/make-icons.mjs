// Generates the placeholder PNG icons from simple shapes (no dependencies).
// Run: node tools/make-icons.mjs   (writes to icons/)
// Replace the art here, or drop in your own PNGs with the same names, when the final look is chosen.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [0x1b, 0x1f, 0x2a];
const GROUND = [0x56, 0x60, 0x80];
const PLAYER = [0xff, 0xb3, 0x47];
const EYE = [0x1b, 0x1f, 0x2a];
const POST = [0xe0, 0x5a, 0x6d];

// Draw the icon at size x size. Everything important stays inside the central
// 80% "safe zone" so the same art works as a maskable icon.
function draw(size) {
  const px = new Uint8Array(size * size * 4);
  const rect = (x, y, w, h, c) => {
    for (let j = Math.round(y); j < Math.round(y + h); j++) {
      for (let i = Math.round(x); i < Math.round(x + w); i++) {
        if (i < 0 || j < 0 || i >= size || j >= size) continue;
        const o = (j * size + i) * 4;
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      }
    }
  };
  const u = size / 100;
  rect(0, 0, size, size, BG);
  rect(22 * u, 68 * u, 56 * u, 3 * u, GROUND);       // ground line
  rect(28 * u, 36 * u, 24 * u, 32 * u, PLAYER);      // runner
  rect(44 * u, 42 * u, 4.5 * u, 4.5 * u, EYE);       // eye
  rect(62 * u, 52 * u, 10 * u, 16 * u, POST);        // obstacle post
  return px;
}

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const raw = draw(size);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(raw.buffer, y * size * 4, size * 4).copy(rows, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = {
  'icon-192.png': 192,
  'icon-512.png': 512,
  'icon-maskable-512.png': 512,
  'apple-touch-icon.png': 180,
  'favicon-32.png': 32,
};
for (const [name, size] of Object.entries(files)) {
  writeFileSync(join(outDir, name), png(size));
  console.log(`wrote icons/${name}`);
}
