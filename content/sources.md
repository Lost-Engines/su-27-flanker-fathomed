# Sources and scope

This site draws on the Su-27 Flanker reverse-engineering work and the C++ reconstruction. The primary reference is a clean Windows **Squadron Commander’s Edition 1.5** installation. Other editions were retained for comparison; the DOS screenshots are from version 1.1.

The main simulator reference, `FSIM.LBB`, has SHA-256 `bb4725ce7e5a9a170a430bb5e9d46b3f7764bd412ec414fe1053957c6446d01a`.

## Research behind the article

The article was checked against the following documents in the local `su-27-flanker-reverse` research tree. These are source identifiers, not files distributed with this site. Their hashes are recorded in the asset provenance record below.

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

Counts in the article describe specific test sets, not an assertion that every possible mission or hardware combination has been tested.

## What the viewers show

**Models.** Eighteen selected shapes, with the additional shapes required for their attachments. The browser uses WebGL 2 and the recovered transform commands. Lighting and depth handling are adapted for inspection; this is not an emulation of the original framebuffer. Controls are a curated subset of identified model inputs. Some combinations are useful for inspection even though gameplay would not set them together.

**Mission map.** Eight supplied scenarios shown over the normal MAP terrain. The camera, route colours and selection interface belong to this site. Routes describe the starting mission plan; the page does not run aircraft AI, play recordings, or reproduce the DOS editor. The original mission briefings retain their spelling and period control instructions.

**Cockpit.** An original game capture and decoded components from 1.5, enlarged with nearest-neighbour sampling. Frame selection exposes stored artwork, not live instrument values. The mirror images are coverage masks; the game fills them with separately rendered reflected scenery.

The article’s diagrams are explanatory drawings. The original-game screenshots are labelled as such; model illustrations come from the browser exhibit. No generated game scene is presented as an original capture.

## Asset provenance

The site is built from a checked-in, explicitly selected set of JSON, PNG, WebP and SVG assets. Normal builds do not access an installation or the research directory. The [import script](https://github.com/Lost-Engines/su-27-flanker-fathomed/blob/master/scripts/import-analysis.py) lists the selection, and the [provenance record](https://github.com/Lost-Engines/su-27-flanker-fathomed/blob/master/content/data-provenance.json) records source paths, hashes and screenshot crops. Installers, executables, original archives and raw mission files are not part of the Pages artifact.

The original game artwork and data are from Su-27 Flanker. The decoding, research, browser adaptations and reconstruction are part of the Lost Engines project.
