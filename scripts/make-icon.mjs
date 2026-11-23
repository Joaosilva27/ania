import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Tiny deterministic PNG writer so the app ships a real icon instead of a
 * missing asset. Draws the cream/charcoal/sage bowl mark used in the app.
 */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const cream = [250, 248, 242];
  const charcoal = [36, 39, 32];
  const sage = [140, 191, 116];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      let color = cream;

      // Round background (adaptive icons get a square canvas).
      const cornerRadius = size * 0.22;
      const inCorner =
        (x < cornerRadius && y < cornerRadius && Math.hypot(x - cornerRadius, y - cornerRadius) > cornerRadius) ||
        (x > size - cornerRadius && y < cornerRadius && Math.hypot(x - (size - cornerRadius), y - cornerRadius) > cornerRadius) ||
        (x < cornerRadius && y > size - cornerRadius && Math.hypot(x - cornerRadius, y - (size - cornerRadius)) > cornerRadius) ||
        (x > size - cornerRadius && y > size - cornerRadius && Math.hypot(x - (size - cornerRadius), y - (size - cornerRadius)) > cornerRadius);

      if (inCorner) {
        pixels[index + 3] = 0;
        continue;
      }

      const distance = Math.hypot(x - cx, y - cy);
      if (distance < size * 0.34) color = charcoal;

      // Bowl: lower half circle in sage sitting inside the charcoal disc.
      const bowl = Math.hypot(x - cx, y - (cy - size * 0.02)) < size * 0.2 && y > cy - size * 0.05;
      if (bowl) color = sage;

      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = 255;
    }
  }
  return encodePng(size, size, pixels);
}

async function main() {
  const dir = path.join(process.cwd(), 'assets');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'icon.png'), drawIcon(1024));
  await fs.writeFile(path.join(dir, 'adaptive-icon.png'), drawIcon(1024));
  await fs.writeFile(path.join(dir, 'splash.png'), drawIcon(512));
  console.log('icons written');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
