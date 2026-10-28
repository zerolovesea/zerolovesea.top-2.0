# zerolovesea / tidemark — logo motion

## Source and brief

- Source: project `public/favicon.svg`, whose only element embeds a 300 × 300 RGBA PNG. Copied decoded pixels to `source.png`; alpha is fully opaque white. Dominant foreground colours: outline `#444b54`, fill `#d3d8dd`.
- Personality: 轻盈 / 安静 / 灵动. The seated cat is a friendly personal-blog mark. Use the friendly easing family, stretch its duration into the intro band, reduce exaggeration to a 1.5% overshoot and small tail rotation.
- Usage: standalone splash/reveal study, 1,800 ms, then a still final state. Existing website icons and native application launch animation are not replaced in this delivery.
- Staging: tail uncurls first, body silhouette and outline arrive next, front paws follow with overlap, then eyes appear and blink once. No continuous animation after the reveal.

## Geometry decision

Level 3: a few analytic cubic paths, two eye circles, and a centre chest line. A whole-raster trace would add knots to shapes that are already explained by smooth macro curves. Ear tips and foot joins deliberately preserve the source's rounded corners. No bitmap data is embedded in the delivered logo.

Semantic actors: `mark`, `tail` (`tail-fill`, `tail-line`), `body` (`body-fill`, `body-line`), `leg-left`, `leg-right`, `chest`, `face` (`eye-left`, `eye-right`). Drawn strokes carry `pathLength="1"`. Source viewBox is retained so overlay fitting and final-frame alignment share the same coordinates.

## Timeline (shared 1,800 ms clock)

| Time | Pose / action | Principle |
| --- | --- | --- |
| 0–360 | quiet tail lead-in, tiny lower pose | staging, anticipation (20%) |
| 360–1,260 | body rises on a shallow arc, outlines draw, paws overlap | slow in/out, arcs, timing (50%) |
| 1,260–1,800 | body settles first, tail follows, one blink returns to open eyes | follow through, overlap, appeal (30%) |

Tokens: duration `1800ms`; entrance `cubic-bezier(.34,0,.14,1)`; settle `cubic-bezier(.22,1,.36,1)`; gentle action `cubic-bezier(.4,0,.2,1)`; peak scale 1.015. Literal easing values inside keyframes protect computed browser behaviour. All final transforms resolve to identity, opacity to one, dash offsets to zero.

Atomic studies reuse this same vector: hover lift, quiet breathing, tail arc, soft press. Playback is 1× by default; replay, 0.25× slow mode and a live speed slider are provided. Reduced motion resolves immediately to the final vector and disables atomic movement. Atoms remain keyboard-operable.

## QA

Geometry iteration metrics, smoothness inspection and motion proof are appended after the measured runs. Fitting code and parameters are retained in `outputs/fit_work/`. `?t=<ms>`, `?static=1`, `#logo-root`, and `window.__p2mReady` are deterministic capture hooks.

## Measured acceptance

Geometry accepted after **1 fit iteration**. Foreground IoU **0.9815**, source-only 21 px, vector-only 144 px at the 300 px source size. Dark-outline diagnostic IoU 0.90279 (threshold R+G+B < 400); most residuals are subpixel placement and antialiasing along strokes, rather than missing semantic details. The source's rounded tips, feet, tail endpoint and eye placement are retained. No global numeric threshold was used to overrule visual acceptance.

The body-path audit found five segments (three cubic, two straight), no tiny segments, and two tangent discontinuities at the two intentionally pointed ears. These are designed corners rounded by the stroke join, not noisy curve joins. The true vector render at 1,200 px (`outputs/final_zoom.png`) passes the smoothness gate: continuous outer curves and no stair-step geometry. A cyan overlay and the source/fit/final strip are retained.

Actual easing was read at 540 / 720 / 900 ms and numerically matched the designed cubic (tolerance 0.00002 on normalized dash offset). The 10 ms ink sweep over 780–1,500 ms and the terminal 1,700–1,820 ms sweep show no stall-then-pop signature. Negative ink deltas during settling are expected because the mark relaxes in scale and the eyes blink; this is not a monotonically growing single-pen drawing.

The final-frame test is decisive: `?t=1800` versus `?static=1`, same browser / viewport / DPR, **0 different pixels**. The independent bare-vector-versus-animated paint comparison has a mean channel delta of 0.1011 / 255, max 72, 5,363 differing antialiased pixels at DPR 2; transforms and path geometry are identical, with the residue attributable to the SVG animation paint context. Reduced motion renders the original static geometry immediately (all actor transforms `none`, no active animation); its paint delta against animated-final is likewise mean 0.1010 / 255. No end-of-animation raster/layer swap is performed, because that would introduce a last-frame ink-density change.

The generated `outputs/qa_report.json` additionally verifies live rate changes, replay, slow toggle, four interactive vector atoms, reduced-motion controls, no page errors, and no horizontal overflow at 900 px and 390 px viewport widths. All motion settles; the atom studies play only on pointer/focus/click and do not run permanent animation loops.

## Reproduce

Use the skill's Python environment (Pillow / numpy / Playwright) or another environment with those dependencies. No browser library, package, font or network dependency is required by `logo_motion.html` itself.

1. Run `outputs/fit_work/build_geometry.py` from any directory.
2. Run the pixel2motion skill's `animate_svg_showcase.py logo.svg --css motion.css --out logo_motion.html --title 'zerolovesea · cat in motion' --duration-hint 1800` from this folder.
3. Run `outputs/fit_work/package_showcase.py` once against the freshly generated HTML; it applies the Chinese controls, neutral palette, vector atom interactions, keyboard support and 1× default rate.
4. Run `outputs/fit_work/qa_motion.py` for the same-pipeline and interaction self-checks; the bundled skill capture/probe scripts generate the frame and ink reports.
5. Open `logo_motion.html` directly, or run `bun design/logo-motion/serve.ts` from the repository and visit `http://127.0.0.1:4355/logo_motion.html`.

The existing website favicon files and Tidemark native launch animation remain untouched. The showcase is the reviewable deliverable; the exported SVG and CSS are ready for later integration.

The bundled cross-pipeline `--compare-final` check (300 px static PNG versus DPR-2 animation screenshot resampled to that size) reports mean absolute channel delta 0.502 / 255, max 88, and 0.628% pixels with a delta ≥ 25. The overlay and enlarged renders were inspected; residuals follow resampled edges. The same-pipeline exact-zero contract remains the decisive landing check.
