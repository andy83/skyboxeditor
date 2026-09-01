/**
 * Export packaging: raw RGBA readbacks -> PNG blobs -> downloads.
 * Face order matches GL cubemap faces: +X -X +Y -Y +Z -Z.
 * Engine-specific orientation/naming profiles land with M3; these names are
 * the common posx/negx convention most importers accept.
 */
import { zipSync } from 'fflate';
import * as THREE from 'three';
import { EXRExporter } from 'three/addons/exporters/EXRExporter.js';
import { floatToBytes } from './hdr';

export const FACE_NAMES = ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'] as const;

/** Float RGBA (GL bottom-up rows) -> clamped LDR PNG blob, top-down. */
export function floatToPngBlob(data: Float32Array, width: number, height: number): Promise<Blob> {
  return rgbaToPngBlob(floatToBytes(data), width, height);
}

/** GL bottom-up RGBA rows -> top-down rows used by image files. */
export function rgbaBottomUpToTopDown(data: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width * 4;
    out.set(data.subarray(src, src + width * 4), y * width * 4);
  }
  return out;
}

/** RGBA bytes (GL bottom-up rows) -> PNG blob, flipped to top-down. */
export async function rgbaToPngBlob(data: Uint8Array, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);

  img.data.set(rgbaBottomUpToTopDown(data, width, height));
  // force full alpha — alpha channel is render state, not image content
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;

  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

/** Half-float RGBA (GL bottom-up rows) -> linear Half-Float OpenEXR. */
export async function halfFloatToExr(data: Uint16Array, width: number, height: number): Promise<Uint8Array> {
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  try {
    // EXRExporter performs the same bottom-up -> top-down row mapping as the
    // PNG path, so the raw GL readback must not be flipped here.
    return await new EXRExporter().parse(texture, { type: THREE.HalfFloatType });
  } finally {
    texture.dispose();
  }
}

export async function packageFacesZip(faces: Float32Array[], size: number, baseName: string): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < 6; i++) {
    const blob = await floatToPngBlob(faces[i], size, size);
    entries[`${baseName}_${FACE_NAMES[i]}.png`] = new Uint8Array(await blob.arrayBuffer());
  }
  const zipped = zipSync(entries, { level: 0 }); // PNGs are already compressed
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

export function packageFaceExrsZip(faceExrs: Uint8Array[], baseName: string): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < 6; i++) {
    entries[`${baseName}_${FACE_NAMES[i]}.exr`] = faceExrs[i];
  }
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
