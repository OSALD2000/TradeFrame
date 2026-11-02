const { deflateSync } = require('node:zlib');
const { validateCrop } = require('../../dist-electron/chart-crop.js');
const images = new Map();
function chunk(type, data) {
  const content = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of content) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, content, checksum]);
}
function image(width, height, pixel) {
  const bitmap = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) bitmap.set(pixel(x, y), (y * width + x) * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    bitmap.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const url = 'data:image/png;base64,' + png.toString('base64');
  const result = {
    bitmap,
    png,
    isEmpty: () => false,
    getScaleFactors: () => [1],
    getSize: () => ({ width, height }),
    toBitmap: () => bitmap,
    toDataURL: () => url,
    crop: (rectangle) => {
      const bounds = validateCrop(rectangle, width, height);
      return image(bounds.width, bounds.height, (x, y) => {
        const i = ((y + bounds.y) * width + x + bounds.x) * 4;
        return bitmap.subarray(i, i + 4);
      });
    },
  };
  images.set(url, result);
  return result;
}
const nativeImage = {
  createFromDataURL: (url) => {
    if (!images.has(url)) throw new Error('Unknown synthetic image');
    return images.get(url);
  },
  createFromBuffer: (bytes) =>
    nativeImage.createFromDataURL('data:image/png;base64,' + bytes.toString('base64')),
};
module.exports = { image, nativeImage };
