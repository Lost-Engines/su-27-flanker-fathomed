# Sources and methods

This site draws on the Su-27 Flanker reverse-engineering work and the C++ reconstruction. The primary reference is a clean Windows **Squadron Commander’s Edition 1.5** installation. Other editions were retained for comparison; the DOS screenshots are from version 1.1.

The main simulator reference, `FSIM.LBB`, has SHA-256 `bb4725ce7e5a9a170a430bb5e9d46b3f7764bd412ec414fe1053957c6446d01a`.

## Research behind the article

The article was checked against the following documents in the local `su-27-flanker-reverse` research tree. The provenance record below includes their paths and hashes.

| Subject | Working source |
| --- | --- |
| Editions and reference choice | `analysis/initial/README.md`, `analysis/initial/executables.md` |
| Shape commands and animation inputs | `analysis/models/README.md`, `analysis/models/parameters.md` |
| Buried car windows and drawing order | `analysis/models/car-windows.md` |
| Terrain coordinates and MAP0 selection | `analysis/maps/README.md` |
| Damaged missions, classification and weather | `analysis/missions/README.md` |
| Retail tracks and replay coverage | `analysis/missions/demo-flights.md` |
| Shared DOS/Windows dialog resources | `analysis/editor/README.md` |
| Cockpit formats, composition and mirrors | `analysis/cockpit/README.md` |
| Aerodynamic coefficients and control laws | `analysis/simulation/aerodynamics.md` |
| Controls missing from the reference card | `analysis/input/key-reference-audit.md` |

The existing [C++ validation notes](https://github.com/Lost-Engines/su-27-flanker-cpp/blob/master/docs/validation.md) describe the reconstruction checks. Useful sections include the [software model renderer](https://github.com/Lost-Engines/su-27-flanker-cpp/blob/master/docs/validation.md#software-model-renderer), [flight routines](https://github.com/Lost-Engines/su-27-flanker-cpp/blob/master/docs/validation.md#flight-routines), [ejection and parachutes](https://github.com/Lost-Engines/su-27-flanker-cpp/blob/master/docs/validation.md#ejection-and-parachutes), [continuous replay](https://github.com/Lost-Engines/su-27-flanker-cpp/blob/master/docs/validation.md#flight-recording-and-continuous-native-replay), [assembled cockpit frames](https://github.com/Lost-Engines/su-27-flanker-cpp/blob/master/docs/validation.md#assembled-cockpit-frames) and [smooth rendering](https://github.com/Lost-Engines/su-27-flanker-cpp/blob/master/docs/validation.md#connected-smooth-rendering).

## What the viewers show

**Models.** All 364 shapes from Squadron Commander’s Edition 1.5 are available in the viewer. The rocking radar dish and three sets of counter-rotating propellers use their earlier DOS animation commands. Night-light dots are enlarged so you can see them on the aircraft. The original positions, colours and beacon timing are preserved.

**Mission map.** Eight supplied scenarios shown over the normal MAP terrain. The map shows initial aircraft routes and unit positions. Briefings retain their original spelling and control instructions.

**Cockpit.** An original game capture and decoded components from 1.5, enlarged with nearest-neighbour sampling. The frame selector steps through the stored artwork. The mirror images are coverage masks; the game fills them with separately rendered reflected scenery.

The diagrams illustrate the rendering pipeline and file-format problems described in the article. Captions identify original-game screenshots and renders from the browser viewer.

## Asset provenance

The site’s JSON, PNG, WebP and SVG assets are checked into its repository. The [import script](https://github.com/Lost-Engines/su-27-flanker-fathomed/blob/master/scripts/import-analysis.py) lists the selection, and the [provenance record](https://github.com/Lost-Engines/su-27-flanker-fathomed/blob/master/content/data-provenance.json) records source paths, hashes and screenshot crops.

The original game artwork and data are from Su-27 Flanker. The decoding, research, browser adaptations and reconstruction are part of the Lost Engines project.
