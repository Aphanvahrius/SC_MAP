# ShipCore Interactive Map — OpenLayers rebuild

A clean rebuild of the ShipCore map on **OpenLayers 10.9.0**, kept separate from the original
Leaflet version (`SC_MAP-main` / `SC_MAP_GitHub_clone`). Strategy is **faithful-first**: reproduce
the current behavior, then layer in improvements.

## Run / verify

No build step — it's a static site (vendored OpenLayers). Serve this folder with **Live Server**
(or any static server) and open `index.html`.

## Structure

```
SC_MAP_OpenLayers/
├── index.html         # entry point
├── css/style.css      # layout + space-gradient backdrop
├── js/main.js         # map, view, and layers (being built out)
├── lib/               # vendored OpenLayers 10.9.0 (ol.js + ol.css) — no CDN, no build
└── data/*.geojson     # clean GeoJSON extracted from the Leaflet app
                       #   (Sectors & Routes dropped; Lanes = the simplified 83 KB version)
```

## Coordinates

Data is CRS84 (lon/lat). To match the Leaflet arrangement exactly, the view uses **EPSG:3857**
for now. The 2-D map is a *topological* layout (relative positions by hyperlane connectivity), so
switching to a clean Cartesian projection is an improve-later option. The systems' real 3-D
`X/Y/Z` attributes are preserved in the data for the distance tool.

## Status

**Skeleton (current):** Regions + Lanes + Systems render with the faithful Web-Mercator view and
zoom range (10–15).

**Next (faithful port):**
- Full styling — nation radial gradients, lane casing, shape-coded special systems, diplomacy/
  character colors.
- Popups (with the spoiler mechanism), the search, fullscreen, and URL-hash controls.
- The sidebar UI — Main / Other / Real-Distances / **Layers** tabs (checkbox toggles + legends).
- The cross-layer filter engine and the 3-D Real-Distances tool.
- Decluttered labels (OpenLayers `declutter`).

**Improve-later (post-parity):** derive special-system overlays from `Systems`; model Diplomacy as
relationships over `Regions`; schema normalization; responsive layout; checkbox filters; info/about
overlay; `basemap_1` toggle (via `ol/source/GeoTIFF`); optional Vite build.
