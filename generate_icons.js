import fs from 'fs';
import zlib from 'zlib';

// Minimal PNG generator without external dependencies
function createPNG(width, height, colorR, colorG, colorB) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data (Filter byte 0 + RGBA for each pixel)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData.writeUInt8(0, rowOffset); // Filter type 0
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      
      // Draw a rounded box with an inner shopping bag / receipt design
      const dx = Math.abs(x - width / 2);
      const dy = Math.abs(y - height / 2);
      const radius = width * 0.44;
      const isInsideCard = Math.hypot(dx, dy) < radius;
      
      if (isInsideCard) {
        // Emerald gradient background
        const grad = Math.floor(20 * (y / height));
        rawData.writeUInt8(Math.max(16, colorR - grad), pixelOffset);
        rawData.writeUInt8(Math.min(200, colorG + grad), pixelOffset + 1);
        rawData.writeUInt8(Math.max(110, colorB - grad), pixelOffset + 2);
        rawData.writeUInt8(255, pixelOffset + 3);

        // Shopping bag / icon silhouette in center (white)
        const bagX = Math.abs(x - width / 2);
        const bagY = y - height * 0.52;
        const inBag = bagX < width * 0.22 && bagY > -height * 0.16 && bagY < height * 0.22;
        const inHandle = Math.abs(Math.hypot(x - width / 2, y - height * 0.36) - width * 0.11) < width * 0.025 && y < height * 0.40;
        
        if (inBag || inHandle) {
          rawData.writeUInt8(255, pixelOffset);
          rawData.writeUInt8(255, pixelOffset + 1);
          rawData.writeUInt8(255, pixelOffset + 2);
          rawData.writeUInt8(255, pixelOffset + 3);
        }
      } else {
        // Transparent outside
        rawData.writeUInt8(0, pixelOffset);
        rawData.writeUInt8(0, pixelOffset + 1);
        rawData.writeUInt8(0, pixelOffset + 2);
        rawData.writeUInt8(0, pixelOffset + 3);
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crcData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

fs.mkdirSync('./public', { recursive: true });
fs.writeFileSync('./public/pwa-192x192.png', createPNG(192, 192, 16, 185, 129));
fs.writeFileSync('./public/pwa-512x512.png', createPNG(512, 512, 16, 185, 129));
fs.writeFileSync('./public/pwa-maskable-512x512.png', createPNG(512, 512, 16, 185, 129));
fs.writeFileSync('./public/apple-touch-icon.png', createPNG(180, 180, 16, 185, 129));
console.log('PWA icons created successfully');
