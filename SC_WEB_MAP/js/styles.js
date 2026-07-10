'use strict';
/*
 * Per-layer style functions, ported from the Leaflet `layer-styles.js`.
 * Styles are CACHED (built once per distinct value and reused across features and
 * renders) — sharing style instances is the recommended OpenLayers practice and keeps
 * panning/zooming and hit-detection fast.
 */

const NATION_COLORS = {
    'Corporate Systems':            'rgba(255,242,0,1)',
    'Holy Ertan Republic':          'rgba(10,163,61,1)',
    'Solarian Federation':          'rgba(160,1,228,1)',
    'Solar Imperium':               'rgba(227,2,2,1)',
    'Duchy of Meltisar':            'rgba(0,153,138,1)',
    'Duchy of Drakar':              'rgba(100,2,2,1)',
    'Free Planets Alliance':        'rgba(108,199,5,1)',
    'Ghost Sector':                 'rgba(140,140,140,1)',
    'The Western Frontier Systems': 'rgba(103,110,126,1)',
    'Starlight Revolution':         'rgba(2,83,251,1)'
};
const RELATION_COLORS = {
    'Self':     'rgba(19,101,201,1)',
    'Friendly': 'rgba(51,160,44,1)',
    'Amicable': 'rgba(168,211,37,1)',
    'Neutral':  'rgba(157,157,157,1)',
    'Reserved': 'rgba(255,127,0,1)',
    'Hostile':  'rgba(210,43,48,1)',
    'At War':   'rgba(128,0,0,1)'
};
const CHARACTER_COLORS = {
    'Abbey': 'rgba(1,175,255,1)',
    'Alex':  'rgba(10,70,130,1)',
    'Elis':  'rgba(210,43,48,1)',
    'Thea':  'rgba(251,255,0,1)',
    'Tia':   'rgba(238,238,238,1)'
};

const S = ol.style;
const DARK = 'rgba(35,35,35,1)';

// --- Regions: radial-gradient fill per nation (ported from gradient-definitions.js) ---
// The Leaflet build used SVG objectBoundingBox radialGradients. OpenLayers can't put a
// radial gradient on a polygon fill directly, so each region's Style uses a `renderer`
// that paints an equivalent canvas radial gradient sized to the feature's pixel bbox
// (centre offset + stops copied verbatim from the original definitions).
const NATION_GRADIENTS = {
    'Corporate Systems':            { cx: 0.50, cy: 0.50, r: 0.60, stops: [[0, '#ffff0a'], [0.4, '#fff200'], [0.7, '#f4db01'], [1, '#e0b406']] },
    'Holy Ertan Republic':          { cx: 0.50, cy: 0.50, r: 0.60, stops: [[0, '#00b339'], [0.4, '#0aa33d'], [0.7, '#0f8a3c'], [1, '#126d38']] },
    'Solarian Federation':          { cx: 0.70, cy: 0.50, r: 0.50, stops: [[0, '#a600ff'], [0.4, '#a001e4'], [0.7, '#8902bb'], [1, '#790396']] },
    'Solar Imperium':               { cx: 0.60, cy: 0.50, r: 0.50, stops: [[0, '#ff0000'], [0.4, '#e30202'], [0.7, '#c90303'], [1, '#910303']] },
    'Starlight Revolution':         { cx: 0.50, cy: 0.50, r: 0.60, stops: [[0, '#005eff'], [0.4, '#0253fb'], [0.7, '#0348f8'], [1, '#0627f9']] },
    'Duchy of Meltisar':            { cx: 0.50, cy: 0.50, r: 0.60, stops: [[0, '#00b3a1'], [0.4, '#00998a'], [0.7, '#008073'], [1, '#006b5e']] },
    'Duchy of Drakar':              { cx: 0.35, cy: 0.50, r: 0.60, stops: [[0, '#7e0202'], [0.4, '#640202'], [0.7, '#4a0303'], [1, '#300303']] },
    'Free Planets Alliance':        { cx: 0.50, cy: 0.50, r: 0.60, stops: [[0, '#7bf906'], [0.4, '#6cc705'], [0.7, '#68b003'], [1, '#547c03']] },
    'The Western Frontier Systems': { cx: 0.50, cy: 0.50, r: 0.60, stops: [[0, '#737d8c'], [0.4, '#676e7e'], [0.7, '#5b6071'], [1, '#4f4f64']] },
    'Ghost Sector':                 { cx: 0.60, cy: 0.50, r: 0.40, stops: [[0, '#999999'], [0.4, '#8c8c8c'], [0.7, '#808080'], [1, '#737373']] }
};

// Normalise Polygon ([ring,…]) and MultiPolygon ([[ring,…],…]) pixel coords to a flat ring list.
function _ringsOf(coords) {
    if (typeof coords[0][0][0] === 'number') return coords;                 // Polygon
    const out = [];
    coords.forEach(function (poly) { poly.forEach(function (ring) { out.push(ring); }); });  // MultiPolygon
    return out;
}

function gradientRenderer(def) {
    return function (coords, state) {
        const ctx = state.context;
        const rings = _ringsOf(coords);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];
            for (let j = 0; j < ring.length; j++) {
                const x = ring[j][0], y = ring[j][1];
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
        const w = maxX - minX, h = maxY - minY;
        if (!(w > 0) || !(h > 0)) return;
        ctx.beginPath();
        rings.forEach(function (ring) {
            ring.forEach(function (p, k) { return k === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); });
            ctx.closePath();
        });
        const cx = minX + def.cx * w, cy = minY + def.cy * h;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, def.r * Math.max(w, h));
        def.stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
        ctx.fillStyle = grad;
        ctx.fill('evenodd');
        ctx.lineWidth = 2;
        ctx.strokeStyle = DARK;
        ctx.stroke();
    };
}

const _regionCache = {};
function styleRegions(feature) {
    const n = feature.get('Nation');
    if (_regionCache[n]) return _regionCache[n];
    const def = NATION_GRADIENTS[n];
    if (def) return (_regionCache[n] = new S.Style({ renderer: gradientRenderer(def) }));
    return (_regionCache[n] = new S.Style({                          // fallback: flat fill
        fill: new S.Fill({ color: NATION_COLORS[n] || 'rgba(119,119,119,1)' }),
        stroke: new S.Stroke({ color: DARK, width: 2 })
    }));
}

// --- Lanes: cached casing (outer+inner) per status ---
const _laneCache = {};
function styleLanes(feature) {
    const s = feature.get('Status');
    if (!_laneCache[s]) {
        const inDev = s === 'In Developement';
        const outer = inDev ? 'rgba(35,35,35,1)' : 'rgba(229,229,229,1)';
        const inner = inDev ? 'rgba(238,238,238,1)' : 'rgba(35,35,35,1)';
        _laneCache[s] = [
            new S.Style({ stroke: new S.Stroke({ color: outer, width: 3 }) }),
            new S.Style({ stroke: new S.Stroke({ color: inner, width: 2 }) })
        ];
    }
    return _laneCache[s];
}

// --- Systems: two cached styles (star / starless) ---
const _sysStar = new S.Style({
    image: new S.Circle({ radius: 8, fill: new S.Fill({ color: 'rgba(255,251,1,1)' }), stroke: new S.Stroke({ color: DARK, width: 2 }) })
});
const _sysNoStar = new S.Style({
    image: new S.Circle({ radius: 8, fill: new S.Fill({ color: 'rgba(0,0,0,1)' }), stroke: new S.Stroke({ color: 'rgba(231,200,47,1)', width: 2 }) })
});
function styleSystems(feature) {
    return feature.get('Star_Presc') !== '0' ? _sysStar : _sysNoStar;
}

// --- Character journeys: cached black-cased colored line per character ---
const _charCache = {};
function styleCharacters(feature) {
    const c = feature.get('Character');
    if (!_charCache[c]) {
        const col = CHARACTER_COLORS[c] || 'rgba(238,238,238,1)';
        _charCache[c] = [
            new S.Style({ stroke: new S.Stroke({ color: 'rgba(0,0,0,1)', width: 8 }) }),
            new S.Style({ stroke: new S.Stroke({ color: col, width: 6 }) })
        ];
    }
    return _charCache[c];
}

// --- Diplomacy: one cached fill per relation ---
const _dipCache = {};
function styleDiplomacy(feature) {
    const r = feature.get('Relation');
    return _dipCache[r] || (_dipCache[r] = new S.Style({
        fill: new S.Fill({ color: RELATION_COLORS[r] || 'rgba(0,0,0,0)' }),
        stroke: new S.Stroke({ color: DARK, width: 1 })
    }));
}

// --- Subregions: single shared outline style ---
const _subStyle = new S.Style({ stroke: new S.Stroke({ color: 'rgba(20,20,20,0.6)', width: 1 }) });
function styleSubregions() { return _subStyle; }

// --- Shape-coded special systems (built once each) ---
function shapeStyle(points, radius, angle, fillColor, radius2) {
    const cfg = {
        points: points, radius: radius, angle: angle,
        fill: new S.Fill({ color: fillColor }),
        stroke: new S.Stroke({ color: DARK, width: 2 })
    };
    if (radius2 !== undefined) cfg.radius2 = radius2;
    return new S.Style({ image: new S.RegularShape(cfg) });
}
const _miningStyle     = shapeStyle(4, 8, 0, 'rgba(174,9,0,1)');            // diamond
const _industrialStyle = shapeStyle(3, 9, 0, 'rgba(174,9,0,1)');            // triangle
const _coreStyle       = shapeStyle(4, 8, Math.PI / 4, 'rgba(218,165,32,1)'); // square
const _capitalStyle    = shapeStyle(5, 16, 0, 'rgba(218,165,32,1)', 7);     // 5-point star
function styleMining()     { return _miningStyle; }
function styleIndustrial() { return _industrialStyle; }
function styleCore()       { return _coreStyle; }
function styleCapital()    { return _capitalStyle; }

// --- System-name labels (toggled via "System Names"; yields to the distance tool) ---
const _nameHalo = new S.Stroke({ color: '#ffffff', width: 3 });
const _nameFill = new S.Fill({ color: '#101018' });
function styleSystemName(feature) {
    if (window.SC_distanceFrom) return null;                                    // distance labels take over
    if (window.SC_passes && !window.SC_passes(feature, 'systems')) return null;  // respect the active filters
    const name = feature.get('System_Nam');
    if (!name) return null;
    return new S.Style({
        text: new S.Text({
            text: name,
            font: 'bold 11px "Helvetica Neue", Arial, sans-serif',
            offsetY: -13,
            fill: _nameFill,
            stroke: _nameHalo
        })
    });
}
