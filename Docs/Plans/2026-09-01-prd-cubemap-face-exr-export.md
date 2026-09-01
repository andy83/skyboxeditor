# Cube-face OpenEXR export

Status: **Implemented and verified**

## Goal

Export the existing half-float cubemap bake as six linear HDR OpenEXR files,
without an 8-bit intermediate or a second rendering pipeline. Face order and
names remain `posx`, `negx`, `posy`, `negy`, `posz`, `negz`.

## Implementation

- Read each requested face once from the existing `WebGLCubeRenderTarget` into
  a `Uint16Array`.
- Wrap that bottom-up half-float readback in a `THREE.DataTexture` and let the
  existing Three.js `EXRExporter` perform its normal row reordering and encode
  Half-Float OpenEXR output.
- Encode faces sequentially so EXR-only export never retains six uncompressed
  `Float32Array` faces. Preserve the existing Float32/PNG path when PNG faces
  are also requested.
- Add a distinct Cube faces EXR option to normal, per-layer/composite, and
  batch export. Extend `composite.json` only with an optional face-EXR path
  list; existing fields and version remain compatible.
- Keep the existing equirectangular PNG, Radiance HDR, and OpenEXR paths
  unchanged.

## Verification

- Unit-test six-file packaging, canonical order/names, EXR dimensions,
  preserved values above 1.0, deterministic bytes, and row orientation against
  the PNG row convention.
- Run the existing full test, build, and lint gates.
- Export both PNG and EXR faces from a deterministic HDR scene in Chromium,
  inspect the UI/preview, decode the downloads, and compare face orientation
  and HDR range. Include a 4096-face smoke export where the environment permits.

## Results

- All 135 tests pass; production build and lint pass (apart from the documented
  pre-existing `SpritesTab` fast-refresh warning).
- `deep-field` (`hdrMultiplier` up to 2.4) exported six 4096×4096 Half-Float
  EXRs with decoded values up to 3.95703.
- At 512×512, decoded EXR faces and PNG faces matched pixel-for-pixel after
  their normal file row mappings, confirming identical face orientation.
- Repeated bakes produced byte-identical EXR entries after unzipping.
- Normal, batch, per-layer/composite, and existing equirectangular PNG/HDR/EXR
  exports were exercised through the built application.
