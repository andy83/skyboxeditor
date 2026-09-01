import { unzipSync } from 'fflate';
import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { describe, expect, it } from 'vitest';
import { floatToBytes } from './hdr';
import {
  FACE_NAMES,
  halfFloatToExr,
  packageFaceExrsZip,
  rgbaBottomUpToTopDown,
} from './exporter';

const SIZE = 16; // Three's default EXR ZIP compression stores 16 scanlines per block.

function halfFace(red: number, green: number, blue: number): Uint16Array {
  const out = new Uint16Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    out[i * 4] = THREE.DataUtils.toHalfFloat(red);
    out[i * 4 + 1] = THREE.DataUtils.toHalfFloat(green);
    out[i * 4 + 2] = THREE.DataUtils.toHalfFloat(blue);
    out[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  return out;
}

interface DecodedExr {
  width: number;
  height: number;
  data: Float32Array;
  header: { channels: Array<{ pixelType: number }> };
}

function decodeExr(data: Uint8Array): DecodedExr {
  const buffer = data.slice().buffer as ArrayBuffer;
  return new EXRLoader().setDataType(THREE.FloatType).parse(buffer) as unknown as DecodedExr;
}

describe('cube face EXR export', () => {
  it('packages six Half-Float EXRs with canonical names and dimensions', async () => {
    const faceExrs: Uint8Array[] = [];
    for (let i = 0; i < FACE_NAMES.length; i++) {
      faceExrs.push(await halfFloatToExr(halfFace(i + 1, 0, 0), SIZE, SIZE));
    }

    const zip = unzipSync(new Uint8Array(await packageFaceExrsZip(faceExrs, 'sky').arrayBuffer()));
    expect(Object.keys(zip)).toEqual(FACE_NAMES.map((name) => `sky_${name}.exr`));
    for (const name of FACE_NAMES) {
      const decoded = decodeExr(zip[`sky_${name}.exr`]);
      expect([decoded.width, decoded.height]).toEqual([SIZE, SIZE]);
      expect(decoded.header.channels.every((channel) => channel.pixelType === 1)).toBe(true);
    }
  });

  it('preserves linear HDR values above 1.0', async () => {
    const decoded = decodeExr(await halfFloatToExr(halfFace(4, 2.5, 0.5), SIZE, SIZE));
    const pixels = decoded.data;
    expect(pixels[0]).toBeCloseTo(4);
    expect(pixels[1]).toBeCloseTo(2.5);
    expect(Math.max(...pixels)).toBeGreaterThan(1);
  });

  it('is byte-deterministic for identical half-float input', async () => {
    const face = halfFace(3, 1, 0.25);
    const first = await halfFloatToExr(face, SIZE, SIZE);
    const second = await halfFloatToExr(face, SIZE, SIZE);
    expect(second).toEqual(first);
  });

  it('matches the PNG top-down row orientation without an extra EXR flip', async () => {
    const half = new Uint16Array(2 * SIZE * 4);
    const floats = new Float32Array(half.length);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < 2; x++) {
        const i = (y * 2 + x) * 4;
        const rgba = y < SIZE / 2
          ? [1, x, 0, 1]
          : [0, x, 1, 1];
        for (let c = 0; c < 4; c++) {
          floats[i + c] = rgba[c];
          half[i + c] = THREE.DataUtils.toHalfFloat(rgba[c]);
        }
      }
    }

    const pngTopDown = rgbaBottomUpToTopDown(floatToBytes(floats), 2, SIZE);
    const decoded = decodeExr(await halfFloatToExr(half, 2, SIZE));
    const exrTopDown = rgbaBottomUpToTopDown(
      floatToBytes(decoded.data), 2, SIZE,
    );
    expect(exrTopDown).toEqual(pngTopDown);
  });
});
