'use strict';
/*
 * Optional raster basemap — a star-field / nebula backdrop, OFF by default and toggled
 * from the Layers tab. It sits beneath every vector layer (zIndex 50) so the nations,
 * lanes and systems float on top of it.
 *
 * It is served as ONE JPEG-compressed Cloud-Optimized GeoTIFF: data/basemap.cog.tif
 * (~6 MB, EPSG:3857, internally tiled with overviews). OpenLayers' GeoTIFF source streams
 * only the tiles / overview levels it needs via HTTP range requests, so it stays sharp
 * when zoomed in without ever loading the whole 179-megapixel image. Because it's ~6 MB it
 * lives directly in the repo — no external hosting and no Git-LFS required.
 *
 * Regenerate from the source raster (needs GDAL / rio-cogeo) with:
 *   rio warp basemap_1.tif bm3857.tif --dst-crs EPSG:3857 --res 26 --resampling cubic
 *   rio cogeo create bm3857.tif basemap.cog.tif --cog-profile jpeg --overview-resampling average
 * (--res sets metres/pixel; lower = sharper + bigger. Native is ~20.4.)
 */
(function () {
    const map = SC.map;

    const source = new ol.source.GeoTIFF({
        sources: [{ url: 'data/basemap.cog.tif' }],
        convertToRGB: true,   // JPEG COG stores YCbCr — hand geotiff.js RGB
        interpolate: true,
        // the backdrop drives nothing about the view; keep OL from auto-fitting to it
        wrapX: false
    });

    const layer = new ol.layer.WebGLTile({
        source: source,
        // Map the COG's 3 (normalised 0-1) bands to RGB — the default WebGLTile style
        // renders a single band, which would show the backdrop as near-black.
        style: { color: ['array', ['band', 1], ['band', 2], ['band', 3], 1] },
        zIndex: 50,
        visible: false
    });
    layer.set('id', 'basemap');
    map.addLayer(layer);
    SC.layers.basemap = layer;

    // The COG loads asynchronously; make sure the map paints once it's ready (e.g. right
    // after the user first toggles the layer on, while the source is still fetching).
    source.on('change', function () { if (source.getState() === 'ready') map.render(); });
})();
