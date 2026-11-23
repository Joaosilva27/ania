import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Tiny deterministic PNG writer so the app ships a real icon instead of a
 * missing asset. Draws the blush/rose heart mark used in the app.
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
  const blush = [255, 246, 243];
  const rose = [198, 63, 110];
  const petal = [255, 255, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      let color = blush;

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
      if (distance < size * 0.36) color = rose;

      // Heart mark inside the rose disc.
      const nx = (x - cx) / (size * 0.19);
      const ny = -(y - (cy + size * 0.035)) / (size * 0.19);
      const heart = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * Math.pow(ny, 3);
      if (distance < size * 0.36 && heart <= 0) color = petal;

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
