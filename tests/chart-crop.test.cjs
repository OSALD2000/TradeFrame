const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findChartBounds, validateCrop } = require('../dist-electron/chart-crop.js');
const { image } = require('./helpers/capture-image.cjs');
const bounds = { x: 25, y: 35, width: 320, height: 230 };

for (const background of [
  [255, 255, 255, 255],
  [19, 23, 34, 255],
  [61, 79, 98, 255],
]) {
  test(`adaptive chart detection excludes asymmetric bars with background ${background}`, () => {
    const fixture = image(400, 300, (x, y) => {
      if (x < 25 || x >= 345 || y < 35 || y >= 265) return [40, 40, 40, 255];
      if (y >= 150 && y < 156) return [200, 40, 40, 255];
      if (x % 37 === 0 || y % 53 === 0) return [110, 110, 110, 255];
      return background;
    });
    assert.deepEqual(findChartBounds(fixture.bitmap, 400, 300), bounds);
    const swapped = Buffer.from(fixture.bitmap);
    for (let i = 0; i < swapped.length; i += 4)
      [swapped[i], swapped[i + 2]] = [swapped[i + 2], swapped[i]];
    assert.deepEqual(findChartBounds(swapped, 400, 300), bounds);
  });
}

test('unclear uniform images, transparent images and small regions stay whole', () => {
  for (const color of [
    [19, 23, 34, 255],
    [255, 255, 255, 255],
    [0, 0, 0, 0],
  ]) {
    const fixture = image(400, 300, () => color);
    assert.equal(findChartBounds(fixture.bitmap, 400, 300), null);
  }
  const small = image(400, 300, (x, y) =>
    x >= 125 && x < 275 && y >= 100 && y < 200 ? [255, 255, 255, 255] : [20, 20, 20, 255],
  );
  assert.equal(findChartBounds(small.bitmap, 400, 300), null);
  assert.equal(findChartBounds(new Uint8Array(4), 400, 300), null);
  assert.equal(findChartBounds(new Uint8Array(), Infinity, 300), null);
});

test('separated panes preserve the content in both panes instead of selecting only one', () => {
  const fixture = image(400, 300, (x, y) =>
    x >= 25 && x < 345 && ((y >= 20 && y < 130) || (y >= 170 && y < 280))
      ? [240, 240, 240, 255]
      : [20, 20, 20, 255],
  );
  assert.deepEqual(findChartBounds(fixture.bitmap, 400, 300), {
    x: 25,
    y: 20,
    width: 320,
    height: 260,
  });
});

test('manual areas can be tiny but must be finite integer rectangles inside the image', () => {
  assert.deepEqual(validateCrop({ x: 399, y: 299, width: 1, height: 1 }, 400, 300), {
    x: 399,
    y: 299,
    width: 1,
    height: 1,
  });
  for (const value of [
    null,
    {},
    'crop',
    { x: -1, y: 0, width: 20, height: 20 },
    { x: 0, y: 0, width: 0, height: 20 },
    { x: 0.1, y: 0, width: 20, height: 20 },
    { x: 390, y: 0, width: 20, height: 20 },
    { x: 0, y: 0, width: Infinity, height: 20 },
    { x: 0, y: 0, width: 20, height: NaN },
  ])
    assert.throws(() => validateCrop(value, 400, 300), /Invalid capture area/);
});

test('large drawing zones must not make detection crop away a substantial chart segment', () => {
  const fixture = image(400, 300, (x, y) => {
    if (x < 25 || x >= 345 || y < 35 || y >= 265) return [40, 40, 40, 255];
    if (y >= 100 && y < 145) return [140, 60, 90, 255];
    return [19, 23, 34, 255];
  });
  assert.deepEqual(findChartBounds(fixture.bitmap, 400, 300), bounds);
});

test('a narrow chart is selected instead of the larger surrounding side panel', () => {
  const bounds = { x: 30, y: 40, width: 350, height: 420 };
  const fixture = image(800, 500, (x, y) =>
    x >= 30 && x < 380 && y >= 40 && y < 460 ? [19, 23, 34, 255] : [40, 40, 40, 255],
  );
  assert.deepEqual(findChartBounds(fixture.bitmap, 800, 500), bounds);
});

test('a drawing zone spanning the chart must preserve chart content above and below it', () => {
  const bounds = { x: 30, y: 40, width: 700, height: 420 };
  const fixture = image(800, 500, (x, y) => {
    if (x < 30 || x >= 730 || y < 40 || y >= 460) return [40, 40, 40, 255];
    if (y >= 130 && y < 230) return [80, 45, 55, 255];
    return [19, 23, 34, 255];
  });
  assert.deepEqual(findChartBounds(fixture.bitmap, 800, 500), bounds);
});

test('a full-width trendline near the top must not delete the smaller chart segment above it', () => {
  const fixture = image(400, 300, (x, y) => {
    if (x < 25 || x >= 345 || y < 35 || y >= 265) return [40, 40, 40, 255];
    if (y >= 55 && y < 70) return [180, 60, 70, 255];
    return [19, 23, 34, 255];
  });
  assert.deepEqual(findChartBounds(fixture.bitmap, 400, 300), bounds);
});
