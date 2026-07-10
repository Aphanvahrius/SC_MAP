'use strict';
/*
 * Data preparation for the 3-D star view (no Three.js dependency — pure data).
 *
 * Loads:
 *   data/systems.geojson — per-system X/Y/Z = heliocentric, galactic-axis Cartesian,
 *                          in LIGHT-YEARS, Sun at (0,0,0), future epoch ~3552
 *                          (the same set the 2-D layout was derived from).
 *   data/regions.geojson — nation territories per book (A1–A4) in the 2-D map's
 *                          abstract lon/lat plane → point-in-polygon gives each
 *                          system its nation per book.
 *   data/planets.json    — confirmed exoplanets + manuscript ("book") bodies +
 *                          book-mention stats, keyed by System_Nam.
 *
 * Scene-axis convention (right-handed, galactic north = up):
 *   scene.x = X (toward galactic centre), scene.y = Z (north), scene.z = -Y.
 */

/* Nation colours — keep in sync with NATION_COLORS in js/styles.js (2-D legend). */
export const NATION_COLORS = {
    'Corporate Systems':            0xfff200,
    'Holy Ertan Republic':          0x0aa33d,
    'Solarian Federation':          0xa001e4,
    'Solar Imperium':               0xe30202,
    'Duchy of Meltisar':            0x00998a,
    'Duchy of Drakar':              0x8a1616,
    'Free Planets Alliance':        0x6cc705,
    'Ghost Sector':                 0x8c8c8c,
    'The Western Frontier Systems': 0x676e7e,
    'Starlight Revolution':         0x0253fb
};
export const NO_NATION_COLOR = 0x555566;   // systems outside every region polygon

/* Star classes: colour + relative size (world units are light-years; the point
 * shader clamps the on-screen size, so these mainly set the relative hierarchy). */
export const CLASSES = {
    O:  { color: 0x92b5ff, size: 30, label: 'O — hot blue' },
    B:  { color: 0xa9c3ff, size: 24, label: 'B — blue-white' },
    A:  { color: 0xcdd9ff, size: 19, label: 'A — white' },
    F:  { color: 0xf6f2ff, size: 16, label: 'F — yellow-white' },
    G:  { color: 0xfff0c9, size: 14, label: 'G — yellow (Sol)' },
    K:  { color: 0xffd9a1, size: 12, label: 'K — orange' },
    M:  { color: 0xffb46b, size: 10, label: 'M — red' },
    C:  { color: 0xff7a4d, size: 11, label: 'C — carbon star' },
    BD: { color: 0xc06a4a, size: 7,  label: 'Brown dwarf' },
    WD: { color: 0xdbe9ff, size: 6,  label: 'White dwarf' },
    NS: { color: 0xb4dcff, size: 5.5, label: 'Neutron star' },
    UNK:{ color: 0xccccdd, size: 9,  label: 'Unclassified' }
};
export const COMPACT = { BD: true, WD: true, NS: true };

/* Human-readable SIMBAD object-type codes (info panel). */
const OBJECT_TYPES = {
    '*': 'Star', '**': 'Double or multiple star', 'PM*': 'High proper-motion star',
    'SB*': 'Spectroscopic binary', 'BY*': 'BY Draconis variable', 'WD*': 'White dwarf',
    'WD?': 'White dwarf candidate', 'BD*': 'Brown dwarf', 'N*': 'Neutron star',
    'LM*': 'Low-mass star', 'LP*': 'Long-period variable', 'LP?': 'Long-period variable candidate',
    'RG*': 'Red giant', 'Y*O': 'Young stellar object', 'Be*': 'Be star',
    'dS*': 'Delta Scuti variable', 'EB*': 'Eclipsing binary', 'HB*': 'Horizontal-branch star',
    'C*': 'Carbon star', 'Em*': 'Emission-line star', 'Er*': 'Eruptive variable',
    'a2*': 'Alpha² CVn variable', 's*b': 'Blue supergiant'
};
export function friendlyObjectType(code) {
    return OBJECT_TYPES[(code || '').trim()] || (code ? code : 'Unknown');
}

/* Spectral classification → CLASSES key. Order matters: compact objects first. */
export function classify(props) {
    const sp = (props.spectral_type || '').trim();
    const ot = (props.object_type || '').trim();
    if (ot === 'N*') return 'NS';
    if (/^WD/.test(ot) || /^D[A-Z]/.test(sp)) return 'WD';
    if (ot === 'BD*' || /^[LTY]\d/.test(sp)) return 'BD';
    if (ot === 'C*' || /^C\d/.test(sp)) return 'C';
    const m = sp.match(/[OBAFGKM]/);          // first main-sequence class letter
    if (m) return m[0];
    return 'UNK';
}

/* Special-system roles carried on the system features themselves.
 * `size` is the marker's on-screen size in px (before the user's marker-size
 * multiplier from the settings window) — ADJUST MARKER SIZES HERE. */
export const SPECIALS = [
    { key: 'capital',    prop: 'Capital',    label: 'Capital',    glyph: 'star',     color: '#daa520', size: 20 },
    { key: 'core',       prop: 'Core_Sys',   label: 'Core',       glyph: 'square',   color: '#daa520', size: 15 },
    { key: 'mining',     prop: 'Mining_Sys', label: 'Mining',     glyph: 'diamond',  color: '#ae0900', size: 15 },
    { key: 'industrial', prop: 'Idustr_Sys', label: 'Industrial', glyph: 'triangle', color: '#ae0900', size: 15 }
];
/* Marker overlays = the role markers + a no-star marker (gold ring, matching the
 * 2-D "System With No Star" legend). Not a role — only a map marker. */
export const MARKERS = SPECIALS.concat([
    { key: 'nostar', label: 'No-star systems', glyph: 'circle', color: '#e7c82f', size: 14,
      test: function (s) { return s.noStar; } }
]);

/* A5 is included even though region/journey data for it is still sparse;
 * nation borders fall back to the latest book that has regions (A4). */
export const BOOKS = ['A1', 'A2', 'A3', 'A4', 'A5'];

/* Character-journey colours — keep in sync with CHARACTER_COLORS in js/styles.js. */
export const CHARACTER_COLORS = {
    'Abbey': 0x01afff,
    'Alex':  0x3d7dd2,   // brightened vs the 2-D map so it reads on the dark 3-D bg
    'Elis':  0xd22b30,
    'Thea':  0xfbff00,
    'Tia':   0xeeeeee
};

/* ---------------- point-in-polygon (ray casting, GeoJSON rings) --------------- */
function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}
function pointInPolygon(x, y, coords) {           // Polygon: [outer, hole, hole…]
    if (!pointInRing(x, y, coords[0])) return false;
    for (let i = 1; i < coords.length; i++) if (pointInRing(x, y, coords[i])) return false;
    return true;
}
function pointInGeometry(x, y, geom) {
    if (geom.type === 'Polygon') return pointInPolygon(x, y, geom.coordinates);
    if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) if (pointInPolygon(x, y, poly)) return true;
    }
    return false;
}

/* --------------------------------- loading ----------------------------------- */
async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
    return r.json();
}

/*
 * Bodies data — planets.json **schema v2** (edit with editor.html):
 *
 *   { "_meta": {version: 2, ...},
 *     "<System_Nam>": {
 *        description: "",                     // free text, shown in info panels
 *        binary: null | { mode: "close"|"far", components: ["G2V","K1V"]? },
 *        confirmed_planets: n,                // catalog count
 *        book_mentions?: { hits, first },
 *        planets: [ { name, source: "book"|"catalog", type, status, first, description,
 *                     method?, year?, host?, mass_earth?, radius_earth?, sources?,
 *                     moons: [ {name, source, type, status, first, description} ],
 *                     other_objects: [ same ] } ],
 *        other_objects: [ same ]              // system-level (belts, stations, constructs)
 *     } }
 *
 * If systems.geojson gains `confirmed_planets` / `book_planets` count fields,
 * those take precedence for the counts shown in the info panel.
 */
function normaliseBodies(props, e) {
    e = e || {};
    const planets = (e.planets || []).map(function (p) {
        return Object.assign({ moons: [], other_objects: [], source: 'book' }, p);
    });
    const bookPlanets = planets.filter(function (p) { return p.source === 'book'; });
    const num = function (v) { const n = parseInt(v, 10); return isNaN(n) ? null : n; };
    return {
        confirmedCount: num(props.confirmed_planets) !== null ? num(props.confirmed_planets)
                        : (e.confirmed_planets || 0),
        bookCount: num(props.book_planets) !== null ? num(props.book_planets) : bookPlanets.length,
        planets: planets,
        bookPlanets: bookPlanets,
        catalogPlanets: planets.filter(function (p) { return p.source === 'catalog'; }),
        systemObjects: e.other_objects || [],
        description: e.description || '',
        binary: e.binary || null
    };
}

/*
 * Returns { stars, radius, frameRadius } where each star record is:
 * { name, props, cls, kind (0 star / 1 WD / 2 NS), color, size, pos:[sx,sy,sz],
 *   distSol, nation:{A1..A4}, bodies, mentions, specials:[keys], noStar }
 */
export async function loadData() {
    const opt = function (url) { return fetchJSON(url).catch(function () { return {}; }); };
    const [systems, regions, planets, lanesGeo, charsGeo] = await Promise.all([
        fetchJSON('data/systems.geojson'),
        fetchJSON('data/regions.geojson'),
        opt('data/planets.json'),
        opt('data/lanes.geojson'),
        opt('data/characters.geojson')
    ]);

    // Hyperlanes as system↔system links (Sys_A/Sys_B written by
    // catalog_recovery/snap_endpoints.py). Unweighted on purpose: lane length has
    // no physical meaning; per-lane weights can be added to these records later.
    const lanes = (lanesGeo.features || []).map(function (f) {
        const p = f.properties;
        return { a: p.Sys_A, b: p.Sys_B, status: p.Status, type: p.Type, nation: p.Nation };
    }).filter(function (l) { return l.a && l.b && l.a !== l.b; });

    // Character-journey legs (system↔system links from snap_endpoints.py / QGIS).
    // Legs whose systems are missing from systems.geojson are kept — they simply
    // don't render until the system exists.
    const journeys = (charsGeo.features || []).map(function (f) {
        const p = f.properties;
        return { character: p.Character, book: p.Book, date: p.Date, a: p.Sys_A, b: p.Sys_B };
    }).filter(function (j) { return j.character && j.a && j.b; });

    // Group region features by book for the per-book nation lookup.
    const regionsByBook = {};
    BOOKS.forEach(function (b) { regionsByBook[b] = []; });
    regions.features.forEach(function (f) {
        const b = f.properties.Book;
        if (regionsByBook[b]) regionsByBook[b].push(f);
    });

    const stars = systems.features.map(function (f) {
        const p = f.properties;
        const cls = classify(p);
        const def = CLASSES[cls];
        const name = p.System_Nam;
        const X = p.X, Y = p.Y, Z = p.Z;
        const distSol = Math.sqrt(X * X + Y * Y + Z * Z);

        // 2-D map position (used for nation lookup and the 2D↔3D morph animation)
        const mx = f.geometry.coordinates[0], my = f.geometry.coordinates[1];
        const nation = {};
        BOOKS.forEach(function (b) {
            nation[b] = null;
            // books without region data (A5 today) fall back to the last drawn borders
            const feats = regionsByBook[b].length ? regionsByBook[b] : regionsByBook.A4;
            for (const rf of feats) {
                if (pointInGeometry(mx, my, rf.geometry)) { nation[b] = rf.properties.Nation; break; }
            }
        });

        const specials = SPECIALS.filter(function (s) {
            const v = p[s.prop];
            return v !== null && v !== undefined && v !== '' && v !== '0' && v !== 0;
        }).map(function (s) { return s.key; });

        const pl = planets[name] || null;
        return {
            name: name,
            props: p,
            cls: cls,
            kind: cls === 'WD' ? 1 : (cls === 'NS' ? 2 : 0),
            color: def.color,
            size: name === 'SOL' ? 20 : def.size,
            pos: [X, Z, -Y],                       // scene axes: x=X, y=Z(up), z=-Y
            map: [mx, my],                         // 2-D map plane coordinates
            distSol: distSol,
            nation: nation,
            bodies: normaliseBodies(p, pl),
            mentions: (pl && pl.book_mentions) || null,
            specials: specials,
            noStar: p.Star_Presc === '0'
        };
    });

    // Radii: max for controls limits, 90th percentile for the initial framing
    // (a handful of far outliers would otherwise shrink the settled cluster to a dot).
    const sorted = stars.map(function (s) { return s.distSol; }).sort(function (a, b) { return a - b; });
    return {
        stars: stars,
        lanes: lanes,
        journeys: journeys,
        radius: sorted[sorted.length - 1],
        frameRadius: sorted[Math.floor(sorted.length * 0.9)]
    };
}

/* --------------------------- hyperlane route graph ---------------------------- */
/* Unweighted adjacency (fewest-jumps routing). Edge records keep the full lane
 * so per-lane weights/filters can be added later without changing the shape.
 * In-development lanes are ALWAYS excluded — by definition they don't reach the
 * far system yet, so they can never be part of a route. */
export function buildGraph(lanes) {
    const adj = new Map();
    lanes.forEach(function (l) {
        if (l.status === 'In Developement') return;
        if (!adj.has(l.a)) adj.set(l.a, []);
        if (!adj.has(l.b)) adj.set(l.b, []);
        adj.get(l.a).push({ to: l.b, lane: l });
        adj.get(l.b).push({ to: l.a, lane: l });
    });
    return adj;
}

/* BFS shortest route by jump count. Returns an array of system names
 * (from → … → to) or null when unreachable. */
export function shortestRoute(adj, from, to) {
    if (from === to) return [from];
    if (!adj.has(from) || !adj.has(to)) return null;
    const prev = new Map();
    prev.set(from, null);
    let frontier = [from];
    while (frontier.length) {
        const next = [];
        for (const n of frontier) {
            for (const e of adj.get(n) || []) {
                if (prev.has(e.to)) continue;
                prev.set(e.to, n);
                if (e.to === to) {
                    const path = [to];
                    let cur = n;
                    while (cur) { path.push(cur); cur = prev.get(cur); }
                    return path.reverse();
                }
                next.push(e.to);
            }
        }
        frontier = next;
    }
    return null;
}
