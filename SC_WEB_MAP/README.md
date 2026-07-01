# ShipCore Interactive Map — OpenLayers rebuild

A clean rebuild of the ShipCore map on **OpenLayers 10.9.0**, kept separate from the original
Leaflet version ("leaflet-legacy" branch).

## Run / verify

No build step — it's a static site (vendored OpenLayers). Hosted via Netlify, available under the url: https://shipcore-interactive-map.netlify.app/

## Structure

```
SC_MAP_OpenLayers/
├── index.html         # entry point
├── css/style.css      # layout + space-gradient backdrop
├── js/main.js         # map, view, and layers (being built out)
├── lib/               # vendored OpenLayers 10.9.0 (ol.js + ol.css) — no CDN, no build
└── data/*.geojson     # clean GeoJSON extracted from the Leaflet app
```

## Coordinates

Data is CRS84 (lon/lat). To match the Leaflet arrangement exactly, the view uses **EPSG:3857**
for now. The 2-D map is a *topological* layout (relative positions by hyperlane connectivity). 
The systems' real 3-D `X/Y/Z` attributes are preserved in the data for the distance tool.
