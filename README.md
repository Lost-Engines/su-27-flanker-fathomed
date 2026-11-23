# Su-27 Flanker Fathomed

An illustrated account of reverse engineering Su-27 Flanker, with the complete model library, mission maps and cockpit components.

[Read the writeup and explore the exhibits](https://lost-engines.github.io/su-27-flanker-fathomed/).

## Working on the site

Requires Node.js 22 or newer (CI uses 24).

```sh
npm ci
npm run build
npm run check
npm run preview
```

Open `http://127.0.0.1:4173/su-27-flanker-fathomed/`. The preview also serves at the root; tests use the project prefix used on GitHub Pages.

`src/home.html` lists the exhibits and links to the investigation at `story/`. `content/story.md` is the article. The build stages only `public/data`, `public/images` and the named browser modules in `src`. It does not use an installed game or the adjacent research tree. The Sources page identifies the working research documents and links to the existing C++ validation notes. Full research documents are not copied into this repository.

For interactive checks, run `npm run check:browser`. Set `CHROMIUM_PATH` if Chromium is not `/usr/bin/chromium`; `SCREENSHOT_DIR` optionally saves review screenshots to a work directory. The checks exercise model browsing, animation, attachments, all eight missions, the cockpit component collections and responsive layouts. They are run locally; ordinary CI builds and checks the small static artifact without installing a browser.

## Refreshing the viewers

`npm run import` imports the model catalogue and selected map and cockpit data from `../su-27-flanker-reverse`. It requires Python 3 and Pillow. An alternate research path may be supplied to `python3 scripts/import-analysis.py /path/to/research`.

The importer records source hashes in `content/data-provenance.json`. It imports decoded JSON and selected preview images, never installation directories, executables, archives or raw missions. The renderer, motion controls, catalogue browser and parameter definitions are shared with the analysis viewer. This site supplies the page layout and shorter control labels. Rebuild after an import and run both checks before committing changes.

To refresh model illustrations after a build:

```sh
CAPTURE_DIR=/path/to/work/fathomed-captures node scripts/capture-models.mjs
python3 scripts/compose-models.py /path/to/work/fathomed-captures
node scripts/capture-overview.mjs
npm run build
```

Captures come from the working browser renderer. The composition places three captures side by side; it does not alter their pixels. Original-game screenshots and explanatory diagrams are labelled in the article.

## Publication

The Pages workflow follows the other Lost Engines overview repos: pushes to `master` build, check and deploy `dist`; pull requests build and check only. Pages must use **GitHub Actions** as its publishing source.
