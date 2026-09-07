import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function inspectRgbaPng(data) {
  assert.ok(data.subarray(0, 8).equals(SIGNATURE), "asset must be a PNG");
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const bitDepth = data[24];
  const colorType = data[25];
  assert.equal(bitDepth, 8, "icon must use 8-bit channels");
  assert.equal(colorType, 6, "icon must be RGBA");

  const idat = [];
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") idat.push(data.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const previous = Buffer.alloc(stride);
  let transparentPixelFound = false;
  let cursor = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const current = Buffer.alloc(stride);
    for (let column = 0; column < stride; column += 1) {
      const value = raw[cursor + column];
      const left = column >= 4 ? current[column - 4] : 0;
      const up = previous[column];
      const upperLeft = column >= 4 ? previous[column - 4] : 0;
      if (filter === 0) current[column] = value;
      else if (filter === 1) current[column] = (value + left) & 255;
      else if (filter === 2) current[column] = (value + up) & 255;
      else if (filter === 3) current[column] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const estimate = left + up - upperLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upperLeft);
        current[column] = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft)) & 255;
      } else throw new Error(`Unsupported PNG filter ${String(filter)}`);
    }
    for (let alpha = 3; alpha < stride; alpha += 4) {
      if (current[alpha] < 255) transparentPixelFound = true;
    }
    current.copy(previous);
    cursor += stride;
  }
  return { width, height, transparentPixelFound };
}

for (const size of [16, 32, 48, 128]) {
  test(`official icon${size}.png is exact-size RGBA with transparency`, async () => {
    const data = await readFile(new URL(`../../icons/icon${size}.png`, import.meta.url));
    assert.deepEqual(inspectRgbaPng(data), { width: size, height: size, transparentPixelFound: true });
  });
}
