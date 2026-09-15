# Sonder SAT mascot guidelines

## Source of truth

`mascot-character-sheet.png` is the approved character reference. Production assets may be cleaned, resized, or recolored for theme support, but they must not redesign the character.

Identity details that must remain consistent:

- Rounded cat silhouette with small pointed ears.
- Small, calm eyes and mouth.
- Red scarf with a short hanging end and small white four-lobed mark.
- Soft illustrated shading with a dark outer contour.
- Black coat on light surfaces and white coat on dark surfaces.

## Production states

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

The browser favicon is a logo derivative, not a scaled-down mascot illustration. Use `favicon-tab.svg` for browser tabs. It keeps a smooth cat-head silhouette, a shallow red scarf with a short vertical fold, and a thin muted keyline. The face stays charcoal on both light and dark browser chrome. The 64-unit square canvas includes safe space around every edge; avoid cumulative scale/translation transforms that clip the contour.

Transparent raster exports `favicon-tab-16.png`, `favicon-tab-32.png`, and `favicon-tab-48.png` must be regenerated from this SVG when it changes. The 32px export is the PNG fallback; SVG is declared last as the preferred scalable icon. Review actual-size raster renders on both light and dark surfaces, not only an enlarged SVG.

Use the more detailed `favicon.svg` and `favicon-dark.svg` only through `BrandMark` inside the product. Those in-app marks may switch with the page theme; the browser favicon always remains the optically corrected black cat.
