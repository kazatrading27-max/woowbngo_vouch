// Dependency-free PNG icon generator: emerald rounded square + white bingo ball.
// Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = maskable ? size : size * 0.22; // maskable fills the whole tile
  const cx = size / 2;
  const cy = size / 2;
  const ballR = size * (maskable ? 0.24 : 0.30);
  const ringR = size * (maskable ? 0.34 : 0.42);

  const bgTop = [6, 120, 98]; // emerald-700
  const bgBottom = [4, 60, 48]; // deep emerald

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-square mask
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
      const inside = dx * dx + dy * dy <= radius * radius || maskable;
      if (!inside) {
        rgba[i + 3] = 0;
        continue;
      }
      // vertical gradient background
      const t = y / size;
      let r = bgTop[0] + (bgBottom[0] - bgTop[0]) * t;
      let g = bgTop[1] + (bgBottom[1] - bgTop[1]) * t;
      let b = bgTop[2] + (bgBottom[2] - bgTop[2]) * t;

      const dist = Math.hypot(x - cx, y - cy);
      if (Math.abs(dist - ringR) < size * 0.045) {
        [r, g, b] = [255, 255, 255]; // outer ring
      } else if (dist <= ballR) {
        [r, g, b] = [255, 255, 255]; // ball
        if (dist <= ballR * 0.45) {
          [r, g, b] = [16, 185, 129]; // emerald core
        }
      }
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(join(root, 'public', 'icons'), { recursive: true });
writeFileSync(join(root, 'public', 'icons', 'icon-192.png'), drawIcon(192));
writeFileSync(join(root, 'public', 'icons', 'icon-512.png'), drawIcon(512));
writeFileSync(join(root, 'public', 'icons', 'icon-512-maskable.png'), drawIcon(512, { maskable: true }));
console.log('icons written to public/icons/');
