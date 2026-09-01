# Cube-face OpenEXR export

Status: **Implemented and verified**

## Goal

Export the existing half-float cubemap bake as six linear HDR OpenEXR files,
without an 8-bit intermediate or a second rendering pipeline. Face order and
names remain `posx`, `negx`, `posy`, `negy`, `posz`, `negz`.

## Implementation

- Read each requested face once from the existing `WebGLCubeRenderTarget` into
  a `Uint16Array`.
- Preserve the raw GL row order for cube-face files. PNG faces write the
  readback without the normal 2D-image flip; EXR faces pre-flip the
  `THREE.DataTexture` input to cancel the `EXRExporter` row reordering. This
  keeps file row zero on the cubemap face's negative-t edge for consumers that
  upload decoded pixels unchanged.
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
  their cubemap file row mappings, confirming identical face orientation.
- Repeated bakes produced byte-identical EXR entries after unzipping.
- Normal, batch, per-layer/composite, and existing equirectangular PNG/HDR/EXR
  exports were exercised through the built application.

## Orientation follow-up

An Atmospace import of a 4096-face EXR export exposed that the original
implementation applied a normal top-down 2D-image flip to every cube face.
That reflects the cubemap across Y: its seams make `posy` and `negy` appear
swapped even though Three.js `CubeCamera` renders the canonical face indices
`+X`, `-X`, `+Y`, `-Y`, `+Z`, `-Z`.

The cube-face PNG and EXR paths now preserve canonical GL face-row orientation;
equirectangular PNG/EXR/HDR exports retain their normal top-down 2D-image
orientation. A directional WebGL2 probe and the original exported face edges
confirmed the distinction.
