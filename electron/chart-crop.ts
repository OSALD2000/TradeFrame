import type { CropRectangle } from './capture-types';

export function validateCrop(value: unknown, width: number, height: number): CropRectangle {
  if (!value || typeof value !== 'object') throw new Error('Invalid capture area');
  const { x, y, width: w, height: h } = value as CropRectangle;
  if (
    ![x, y, w, h].every(Number.isSafeInteger) ||
    x < 0 ||
    y < 0 ||
    w < 1 ||
    h < 1 ||
    x + w > width ||
    y + h > height
  )
    throw new Error('Invalid capture area');
  return { x, y, width: w, height: h };
}

// Interior lines and drawing zones must not split the outer chart bounds.
function projectionBounds(counts: Uint32Array, total: number): [number, number] | null {
  const minimum = Math.max(8, total * 0.2);
  let first = -1,
    last = -1;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] < minimum) continue;
    if (first < 0) first = i;
    last = i;
  }
  return first < 0 ? null : [first, last];
}

// Compare all four native channels symmetrically: RGBA/BGRA ordering does not affect distances.
export function findChartBounds(
  bitmap: Uint8Array,
  width: number,
  height: number,
): CropRectangle | null {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 32 ||
    height < 32 ||
    width * height > 16_000_000 ||
    bitmap.length !== width * height * 4
  )
    return null;
  const colors = new Map<number, { count: number; sums: number[] }>();
  for (let y = Math.floor(height * 0.1); y < height * 0.9; y += 4) {
    for (let x = Math.floor(width * 0.1); x < width * 0.9; x += 4) {
      const i = (y * width + x) * 4;
      const values = [bitmap[i], bitmap[i + 1], bitmap[i + 2], bitmap[i + 3]];
      if (values.every((value) => value === 0)) continue;
      const key = values.reduce((key, value) => (key << 5) | (value >> 3), 0);
      const color = colors.get(key) ?? { count: 0, sums: [0, 0, 0, 0] };
      color.count++;
      for (let c = 0; c < 4; c++) color.sums[c] += values[c];
      colors.set(key, color);
    }
  }
  const candidates = [...colors.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  const matches: { rectangle: CropRectangle; score: number }[] = [];
  for (const candidate of candidates) {
    const color = candidate.sums.map((sum) => sum / candidate.count);
    const rows = new Uint32Array(height),
      columns = new Uint32Array(width);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (
          Math.abs(bitmap[i] - color[0]) <= 6 &&
          Math.abs(bitmap[i + 1] - color[1]) <= 6 &&
          Math.abs(bitmap[i + 2] - color[2]) <= 6 &&
          Math.abs(bitmap[i + 3] - color[3]) <= 6
        ) {
          rows[y]++;
          columns[x]++;
        }
      }
    }
    const row = projectionBounds(rows, width),
      column = projectionBounds(columns, height);
    if (!row || !column) continue;
    const rectangle = {
      x: column[0],
      y: row[0],
      width: column[1] - column[0] + 1,
      height: row[1] - row[0] + 1,
    };
    const area = rectangle.width * rectangle.height;
    if (area < width * height * 0.25 || rectangle.width < 32 || rectangle.height < 32) continue;
    const touchedEdges =
      Number(rectangle.x === 0) +
      Number(rectangle.y === 0) +
      Number(rectangle.x + rectangle.width === width) +
      Number(rectangle.y + rectangle.height === height);
    // shortcut: identical chart/tool backgrounds have no reliable color boundary; use area selection.
    if (touchedEdges >= 3) continue;
    let inside = 0;
    for (let y = rectangle.y; y < rectangle.y + rectangle.height; y++) {
      for (let x = rectangle.x; x < rectangle.x + rectangle.width; x++) {
        const i = (y * width + x) * 4;
        if (color.every((value, c) => Math.abs(bitmap[i + c] - value) <= 6)) inside++;
      }
    }
    if (inside / area >= 0.6) {
      const same = matches.find(
        ({ rectangle: other }) =>
          other.x === rectangle.x &&
          other.y === rectangle.y &&
          other.width === rectangle.width &&
          other.height === rectangle.height,
      );
      if (same) same.score = Math.max(same.score, inside);
      else matches.push({ rectangle, score: inside });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  if (matches[1] && matches[1].score >= matches[0].score * 0.9) return null;
  return matches[0]?.rectangle ?? null;
}
