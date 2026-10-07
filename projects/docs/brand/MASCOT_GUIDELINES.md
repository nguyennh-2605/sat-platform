# Sonder SAT mascot guidelines

## Source of truth

The current favicon, `client/public/brand/favicon-tab.svg`, defines the head silhouette and round glasses for the approved **v2 Sonder Cat** identity. The v2 idle assets in `client/src/assets/brand/mascot/idle-glasses-black.webp` and `idle-glasses-white.webp` are the production pose references. The October 2026 landing redesign adopts this identity first.

`mascot-character-sheet.png` remains the historical v1 reference for existing activity poses. The October 2026 Google-only auth redesign now uses the v2 Sonder Cat idle pose alongside the landing. Activity screens keep their existing v1 assets until their own scoped migration.

Identity details that must remain consistent:

- Broad rounded cat head with small pointed ears, following the favicon silhouette.
- Large circular outline glasses joined by a short arched bridge; white details on the black coat and charcoal details on the white coat.
- Small, calm eyes inside the lenses and a tiny mouth below the bridge.
- Red scarf with a short hanging end and small white four-lobed mark.
- Clean, predominantly flat illustrated treatment with minimal shading and a dark outer contour.
- Black coat on light surfaces and white coat on dark surfaces.

## Production states

The new brand-led idle pose is rendered by `components/brand/SonderCat.tsx`, with automatic black/white theme selection. It is decorative and static; nearby text supplies its meaning. Preserve its entire square canvas and intrinsic aspect ratio. The component eagerly loads the hero pose and lazily loads supporting placements.

The following v1 activity states remain available through `Mascot.tsx`; future v2 activity poses must inherit the same head, glasses, coat, and scarf before they replace these assets.

| State | Meaning | Approved placements |
| --- | --- | --- |
| `idle` | Calm presence and brand identity | Home, authentication, brand-led onboarding |
| `focus` | Active study | Focus Clock and focus-session guidance |
| `success` | Completed study activity | Quiz, flashcard, and session completion |
| `sleeping` | No activity or a gentle rest state | Selected non-error empty states |

Do not use the mascot in the Exam Room while a test is in progress. Do not use it for destructive errors, security warnings, or states where a standard status icon communicates more clearly.

## Theme and accessibility

- Use the black asset on light surfaces and the white asset on dark surfaces.
- Use an explicit tone when the mascot sits on a surface whose tone differs from the page theme.
- Decorative mascot images must be hidden from assistive technology.
- If the mascot communicates information that is not present in nearby text, give the shared component a concise English label.
- All non-essential motion must respect `prefers-reduced-motion`.

## Sizing

- `icon`: compact supporting placement only; do not use full poses as a primary navigation symbol.
- `sm`: Focus Clock and compact empty states.
- `md`: completion states and small illustrations.
- `lg` or `xl`: brand-led Home or authentication surfaces.

Never stretch, crop, mirror, or rotate the mascot. Keep the full transparent canvas and let the shared component control rendered size.

## Asset workflow

The v2 assets were edited with the built-in image-generation tool, visually checked against the favicon, and normalized to 640×640 lossless WebP with a genuine alpha channel. The original generation outputs remain in the tool's generated-images directory; only the optimized production assets are consumed by the application. See [MASCOT_V2_PROMPTS.md](./MASCOT_V2_PROMPTS.md) for the exact generation prompts and input roles.

### Historical v1 workflow

The source character sheet is flattened, so each production pose was reconstructed independently with the built-in image-generation edit workflow, then checked for a genuine alpha channel and normalized to a 640×640 transparent PNG.

Prompt invariants used for every reconstruction:

```text
The supplied SAT mascot character sheet is the authoritative design reference.
Preserve the character identity, silhouette, pose, proportions, facial geometry,
red scarf geometry, colors, line weight, highlights, and soft illustrated style.
Remove only the panel background and unrelated neighboring elements.
Return a genuine transparent alpha channel; never render a checkerboard.
Do not add text, props, accessories, borders, watermarks, or new details.
```

Dark-mode variants use a targeted edit that changes only the coat from black to white, switches facial and body-detail lines to black, and preserves the pose, scarf, props, canvas, and shadow.

## Favicon

The browser favicon is a logo derivative, not a scaled-down full-body mascot illustration. Use `favicon-tab.svg` for browser tabs and the in-app `BrandMark`. The current mark uses a smooth cat-head silhouette and large circular glasses on a rounded square tile. Its charcoal/white palette follows the browser color scheme. The full-body v2 mascot adds the red scarf; the scarf is not part of the current favicon.

Raster exports `favicon-tab-16.png`, `favicon-tab-32.png`, and `favicon-tab-48.png` must be regenerated from this SVG when it changes. The 32px export is the PNG fallback; SVG is declared last as the preferred scalable icon. Review actual-size raster renders on both light and dark surfaces, not only an enlarged SVG. This landing redesign does not change the favicon.

`favicon.svg` and `favicon-dark.svg` are historical marks. `BrandMark` currently consumes `favicon-tab.svg`; keep that same identity on the landing page.
