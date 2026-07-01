'use strict';
/*
 * ShipCore Interactive Map — OpenLayers rebuild (faithful-first port).
 * Map + view + the ten data layers. Styling lives in styles.js.
 *
 * Coordinates: data is CRS84 (lon/lat); the view uses EPSG:3857 to reproduce the
 * Leaflet arrangement exactly. The systems' real 3-D X/Y/Z stay in the data.
 */

const view = new ol.View({
    center: ol.proj.fromLonLat([0.36, 0.35]),   // Leaflet setView([lat 0.3, lng 0.6])
    zoom: 10.5,
    minZoom: 10,
    maxZoom: 15
});

const map = new ol.Map({ target: 'map', view: view });

const GEOJSON = new ol.format.GeoJSON();

function makeLayer(id, file, styleFn, zIndex, visible) {
    const layer = new ol.layer.Vector({
        source: new ol.source.Vector({ url: 'data/' + file, format: GEOJSON }),
        // Wrap the cached style with the active-filters check (defined in filters.js).
        // Returning null hides a feature — no source rebuild needed.
        style: function (feature, resolution) {
            if (window.SC_passes && !window.SC_passes(feature, id)) return null;
            return styleFn(feature, resolution);
        },
        zIndex: zIndex,
        visible: visible === true
    });
    layer.set('id', id);
    return layer;
}

/*
 * Layer manifest — id, data file, style, z-index (back→front, from the Leaflet
 * `order` map), and whether it's visible on load.
 * Default view = Regions + Lanes + Systems (Diplomacy & Characters preset but hidden).
 */
const LAYERS = {
    regions:    makeLayer('regions',    'regions.geojson',    styleRegions,    300, true),
    diplomacy:  makeLayer('diplomacy',  'diplomacy.geojson',  styleDiplomacy,  315, false),
    subregions: makeLayer('subregions', 'subregions.geojson', styleSubregions, 317, false),
    lanes:      makeLayer('lanes',      'lanes.geojson',      styleLanes,      320, true),
    characters: makeLayer('characters', 'characters.geojson', styleCharacters, 340, false),
    systems:    makeLayer('systems',    'systems.geojson',    styleSystems,    350, true),
    mining:     makeLayer('mining',     'mining.geojson',     styleMining,     351, false),
    industrial: makeLayer('industrial', 'industrial.geojson', styleIndustrial, 352, false),
    core:       makeLayer('core',       'core.geojson',       styleCore,       353, false),
    capital:    makeLayer('capital',    'capital.geojson',    styleCapital,    354, false)
};

Object.keys(LAYERS).forEach(function (id) { map.addLayer(LAYERS[id]); });

// System-name label layer — decluttered, sharing the systems' features (no second fetch).
// Toggled via "System Names" in the Layers tab (hidden by default). It yields to the
// distance tool and respects the active filters (see styleSystemName in styles.js).
const systemNamesLayer = new ol.layer.Vector({
    source: LAYERS.systems.getSource(),
    style: styleSystemName,
    declutter: true,
    zIndex: 355,
    visible: false
});
systemNamesLayer.set('id', 'systemNames');
map.addLayer(systemNamesLayer);
LAYERS.systemNames = systemNamesLayer;

// Expose for later modules (popups, filters, distance tool, UI) and debugging.
window.SC = { map: map, view: view, layers: LAYERS };

// Ensure the map adopts its flex-computed size once layout settles, so the first
// render (and the lazy GeoJSON load) happens reliably on page load.
requestAnimationFrame(function () { map.updateSize(); });
window.addEventListener('load', function () { map.updateSize(); });

console.log('[ShipCore-OL] layers added:', Object.keys(LAYERS).join(', '));
