# Sonder Cat v2 generation prompts

Generated using the built-in `image_gen` tool (not the CLI/API fallback). These are the final prompts used for the approved landing assets.

## Black idle pose

Input 1 (edit target): `client/src/assets/brand/mascot/idle-black.png`, the historical full-body idle pose.

Input 2 (identity reference): `client/public/brand/favicon-tab-48.png`, the current head/glasses mark.

Output: `client/src/assets/brand/mascot/idle-glasses-black.webp`.

```text
Use case: style-transfer.
Asset type: Sonder SAT production landing-page mascot, one transparent PNG.
Input image 1 is the existing full-body seated cat to redesign. Input image 2 is the CURRENT approved favicon and the authoritative head silhouette and round-glasses reference.
Create ONE new full-body idle mascot: calm seated black cat with tail curling gently at its left, small triangular ears and a broad softly rounded head closely matching the favicon. Give it the unmistakable LARGE ROUND WHITE OUTLINED GLASSES from the favicon, two clean circular lenses connected by a short arched bridge; no lens highlights or filled white lenses. Small calm white dot eyes sit inside the glasses and a tiny white cat mouth beneath the bridge.
Preserve the red scarf from image 1, with a short hanging end at viewer right and a tiny white four-lobed mark. Simplify the illustration into clean flat editorial artwork, smooth solid charcoal coat, crisp contours, minimal shading and small white curved paw details. Keep friendly squat full-body proportions and the original upright idle pose.
Composition: square canvas, one centered whole character, consistent generous transparent safe space around ears, tail and paws, fill about 78% of canvas height. Genuine transparent alpha background including behind glasses; no checkerboard, panel, floor, cast shadow, text, props, gradients, hair texture, 3D or extra characters. Only one cat. Main palette charcoal black, clean white details and red scarf.
```

## White idle pose

Input (edit target): the approved generated black v2 idle image, preserved in production as `idle-glasses-black.webp`.

Output: `client/src/assets/brand/mascot/idle-glasses-white.webp`.

```text
Use case: precise-object-edit.
Asset type: Sonder SAT dark-theme transparent production mascot.
Edit the referenced approved new idle cat image. Change ONLY the charcoal coat to soft ivory-white, and invert the white glasses, eyes, nose, mouth and curved paw/tail details to charcoal-black. Keep the EXACT same seated pose, outer silhouette, head and body proportions, circular glasses geometry, tail, red scarf, scarf white four-lobed mark, canvas size, position and transparency. Keep the thin dark outer contour so a white coat reads on a dark UI. Preserve the red scarf unchanged. Minimal clean flat illustration, no new highlights, gradients, accessories, text, floor or cast shadow. ONE cat, true transparent alpha background, not checkerboard.
```

## Production normalization

Both generated PNGs were normalized to 640×640 lossless WebP with Sharp. Alpha is retained, without cropping, mirroring, or background compositing. The consumed assets are approximately 149 kB (black) and 159 kB (white). The existing v1 images and favicon were retained; landing and auth use the v2 assets.
