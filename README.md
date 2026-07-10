# ShipCore Interactive Map — V3 (OpenLayers + 3D)

A fan-made companion star-map for *ShipCore*, the sci-fi web-serial/novel series by
**Erios909** ([Royal Road](https://www.royalroad.com/fiction/41463/shipcore)). It charts the
setting's nations, star systems, hyperlanes, shifting diplomacy, character journeys, and the
planets/moons of each system — in both a 2-D map and a real-space 3-D star view.

Live: **shipcore-interactive-map.netlify.app** · Source: **github.com/Aphanvahrius/SC_MAP**

Built on **OpenLayers 10.9** (2-D) and **Three.js 0.185** (3-D). **Static site, no build step,
all libraries vendored** — it runs from any static host or by opening `index.html` through a
local server.

---

## Quick start

No bundler, no npm. Serve this folder statically and open `index.html`:

- **VS Code Live Server** (the usual dev workflow) → `http://127.0.0.1:5500/index.html`
- or any static server (`python -m http.server`, etc.)

Opening `index.html` from `file://` will *not* work — the app fetches GeoJSON/JSON, which
browsers block over `file://`. Use a server.

---

## The three views + the editor

| Page | What it is |
|---|---|
| **`index.html`** | The app. Opens on the **2-D map**; the **3D** button (top-right) switches to the **3-D star view**; the **☰** button opens the catalog. |
| **`catalog.html`** | **System Catalog** — a read-only, browsable list of every system with its astronomy (type/spectral class, distance, X/Y/Z, roles) and its planets/moons/objects. Same code as the editor with `window.SC_READONLY`. |
| **`editor.html`** | **planets.json editor** — a local editing GUI for the planet/moon/object data. Allows to add/remove/move objects and edit their descriptive information. Not part of the public site; writes to disk via the File System Access API. |

---

## Feature overview

### 2-D map (OpenLayers)
- Layers: regions (nation territories with radial-gradient fills), hyperlanes, star systems
  (star / no-star markers), diplomacy, subregions, character journeys, and special-system
  overlays (mining ◆ / industrial ▲ / core ■ / capital ★).
- Sidebar tabs: **Main** (region, book range, character, star-presence filters + Reset-all),
  **Other** (orbitals/inhabitable sliders, lane type/status, **route planner**),
  **Real Distances** (true 3-D distance from a chosen system to all others), **Layers**
  (toggles with inline legends).
- Book **range slider (A1–A5)** — view the map at any span of the story.
- Diplomacy "perspective" model: double-click a nation to see everyone's relationship to it.
- System search, feature popups (with spoiler chips), fullscreen, URL-hash deep links,
  optional raster/star-field COG backdrop, and a responsive mobile drawer.

### 3-D star view (Three.js)
- All ~237 systems positioned by their **real X/Y/Z** (heliocentric galactic light-years,
  Sun at origin), one shader-driven point cloud that stays crisp from close-up to far zoom.
- **Color by spectral type or nation**, with the legend doubling as a per-class / per-nation
  filter; white dwarfs and neutron stars are visually distinct (compact core / pulsing glint).
- **⚙ visual settings**: star & marker size, label modes, reference grid, height lines, neon
  "ripple" plane + travelling-droplet effects, real Milky-Way sky backdrop, ambient sound.
- **Animated 2D↔3D transition**: stars fly between the flat map layout and their real
  positions on entry/exit (toggleable).
- Hover/click a star → info panel (type, distance, nation, roles, planets, book mentions);
  search-to-fly; character journeys as neon pulsing arcs; the lane **route planner**.
- **System close-up**: "Enter system view" renders a schematic of one system — animated star
  surface(s) (binaries split into components), planets/moons/objects on orbits, asteroid
  belts as real rock rings, procedural planet textures, per-body click info, double-click to
  fly-to-and-follow, and an in-system body search.

### Navigation (lane routing)
- In **both** views: pick two systems → **fewest-jumps route** through the hyperlane graph,
  drawn on the map/star-field, with a **jumps vs. straight-line-ly** comparison. Unweighted
  by design (lane length isn't physical); in-development lanes are excluded.

### Catalog & data authoring
- **System Catalog** (`catalog.html`) — read-only public browser of the enriched data.
- **Editor** (`editor.html`) — local GUI to build `planets.json`: nested planets → moons →
  objects, reorder/reparent, binary config, descriptions, add/rename/delete systems; saves
  in place via the File System Access API.

---

## File & directory structure

```
SC_MAP_OpenLayers/
├── index.html            # 2-D app; loads the 2-D scripts + lazily the 3-D module
├── catalog.html          # read-only System Catalog (uses js/editor.js + css/editor.css)
├── editor.html           # local planets.json editor (uses js/editor.js + css/editor.css)
├── css/
│   ├── style.css         # all map/3-D/UI styling
│   └── editor.css        # shared styling for the editor + catalog pages
├── js/                   # 2-D app (classic scripts) + the editor
│   ├── main.js           # OL map, view, layer manifest
│   ├── styles.js         # per-layer OL styles (nation gradients, markers, labels…)
│   ├── ui.js             # sidebar tabs, Layers toggles, fullscreen, URL hash, SC_layerToggles
│   ├── filters.js        # cross-layer filters, Book range slider, Reset-all, SC_filters API
│   ├── route2d.js        # 2-D lane route planner (shares SC_routeState with the 3-D view)
│   ├── distance.js       # Real-Distances tool (3-D distance labels from X/Y/Z)
│   ├── diplomacy.js      # diplomacy perspective switching
│   ├── popups.js         # feature popups + spoiler chips
│   ├── search.js         # 2-D system search control
│   ├── basemap.js        # optional COG raster backdrop (off by default)
│   ├── info.js           # the “i” About panel + button
│   ├── responsive.js     # mobile filter drawer
│   ├── view3d-boot.js    # 3D/2D + catalog + fullscreen/info buttons; lazy-loads the 3-D module
│   ├── editor.js         # editor GUI + read-only catalog renderer (SC_READONLY)
│   └── view3d/           # the 3-D module (ES modules, import-map resolves "three")
│       ├── view3d.js     # scene, star shader, grid/fx, route, journeys, morph, sound, ctl
│       ├── data3d.js     # data loaders, spectral classification, nation lookup, lane graph
│       ├── panel3d.js    # 3-D sidebar panel, ⚙ settings window, star info panel
│       ├── system3d.js   # system close-up (star surfaces, orbits, belts, in-system search)
│       └── fx3d.js       # shared neon "ripple" surface builder
├── lib/                  # vendored, no CDN: ol.js/ol.css, geotiff.js, nouislider, wNumb,
│   └── three/            #   and Three.js 0.185 (module+core+OrbitControls+LICENSE)
└── data/                 # GeoJSON layers + planets.json + sky image + audio
```

## Data files

- **`systems.geojson`** — one feature per system: `System_Nam`, real **X/Y/Z** (galactic
  heliocentric ly, epoch ~3552), `object_type`, `spectral_type`, `Star_Presc` (0 = no-star),
  and the special-system / attribute flags. The 2-D geometry is an abstract lon/lat layout,
  **not** real geography.
- **`regions.geojson`** (nations, per book A1–A4), **`lanes.geojson`** (hyperlanes; carry
  `Sys_A`/`Sys_B` system links for routing), **`characters.geojson`** (journey legs, also with
  `Sys_A`/`Sys_B`), plus `diplomacy`, `subregions`, `mining`/`industrial`/`core`/`capital`.
- **`planets.json`** — **schema v2**: per system a `description`, optional `binary` config,
  `book_mentions`, and a `planets[]` array where each planet may nest `moons[]` and
  `other_objects[]`, plus system-level `other_objects[]`. Edited via `editor.html`. (Full
  schema in `3D_VIEW_HANDOFF.md`.)
- **`sky_galactic_6k.jpg`** — ESO Milky-Way panorama (Serge Brunier, CC BY 4.0) for the 3-D
  sky backdrop. **`basemap.cog.tif`** — optional 2-D raster backdrop.
- **`audio/`** — ambient tracks + `playlist.json`; drop audio files here and they loop in the
  3-D view (see `audio/README.txt`).

## Coordinates, in one paragraph

Two coordinate systems coexist. The **2-D map** geometry is CRS84 lon/lat with tiny values near
the origin, drawn in an EPSG:3857 view — a relative topological layout, not geography. The
**3-D view** uses each system's real **X/Y/Z**: heliocentric, galactic-axis Cartesian, in
light-years, Sun at (0,0,0), propagated to epoch ~3552 (the shifted positions the 2-D map was
derived from). The 3-D scene is galactic-aligned, which is why the real-sky panorama drops in
with only a fixed rotation.

---

## Deploying (Netlify)

The site continously auto-deploys from GitHub (Netlify serves the repo's `SC_WEB_MAP/` folder).

---

## Future directions

- **Routing**: per-lane weights (edges already carry the lane records) → distance/time-aware
  routes; optionally per-book routing if lanes gain a Book field.
- **Remote data editing** on the live site (author-editable catalog): needs a small
  server-side component — Decap CMS or a Netlify Function that commits to GitHub. Full
  options in `future_prompts/REMOTE_EDITING_OPTIONS.md`.
- **System close-up polish**: camera fly-in from the star field, distinct WD/NS close-up looks, a pause-orbits button.

---
