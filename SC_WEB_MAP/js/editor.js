'use strict';
/*
 * planets.json (schema v2) editor — standalone page (editor.html) — AND the
 * read-only System Catalog (catalog.html, which sets window.SC_READONLY before
 * loading this script).
 *
 * Editor mode: loads data/systems.geojson (the authoritative system list) +
 * data/planets.json, lets you edit systems / planets / moons / other-objects
 * (add, delete, reorder, reparent, descriptions, binary configuration), and
 * writes the result back via the File System Access API or as a download.
 *
 * Catalog mode (SC_READONLY): the same data rendered as a browsable catalog —
 * no inputs, plus the systems' astronomical info (object/spectral type, real
 * coordinates, distance) pulled from systems.geojson.
 */
const READONLY = !!window.SC_READONLY;

/* Friendly SIMBAD object-type names (catalog mode) — keep in sync with
 * OBJECT_TYPES in js/view3d/data3d.js. */
const TYPE_NAMES = {
    '*': 'Star', '**': 'Double or multiple star', 'PM*': 'High proper-motion star',
    'SB*': 'Spectroscopic binary', 'BY*': 'BY Draconis variable', 'WD*': 'White dwarf',
    'WD?': 'White dwarf candidate', 'BD*': 'Brown dwarf', 'N*': 'Neutron star',
    'LM*': 'Low-mass star', 'LP*': 'Long-period variable', 'LP?': 'Long-period variable candidate',
    'RG*': 'Red giant', 'Y*O': 'Young stellar object', 'Be*': 'Be star',
    'dS*': 'Delta Scuti variable', 'EB*': 'Eclipsing binary', 'HB*': 'Horizontal-branch star',
    'C*': 'Carbon star', 'Em*': 'Emission-line star', 'Er*': 'Eruptive variable',
    'a2*': 'Alpha² CVn variable', 's*b': 'Blue supergiant'
};

/* Editable fields per object — add/remove entries here to change the forms.
 * [key, label, kind]  kind: 'text' | 'textarea' */
const OBJ_FIELDS = [
    ['name', 'Name', 'text'],
    ['type', 'Type', 'text'],
    ['status', 'Status', 'text'],
    ['first', 'First chapter', 'text'],
    ['order', 'Orbit order', 'text'],   // number; interleaves planets & system objects in the close-up
    ['description', 'Description', 'textarea']
];
const CATALOG_INFO = ['host', 'method', 'year', 'mass_earth', 'radius_earth'];  // read-only summary

let DATA = null;          // planets.json content (incl. _meta)
let SYSTEMS = [];         // all system names (geojson + json-only entries)
let GEO_NAMES = new Set();// names that exist in systems.geojson (shown on the map)
let SYS_PROPS = new Map();// name → systems.geojson properties (catalog mode info)
let current = null;       // selected system name
let dirty = false;
let fsHandle = null;      // File System Access handle ("Save" target)

/* --- persist the save-target handle in IndexedDB so "Save" survives page
 *     reloads (incl. Live Server auto-reloads after each save) --- */
function idb() {
    return new Promise(function (res, rej) {
        const r = indexedDB.open('sc-planets-editor', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('handles'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
    });
}
async function storeHandle(h) {
    try {
        const db = await idb();
        db.transaction('handles', 'readwrite').objectStore('handles').put(h, 'live');
    } catch (e) { /* non-fatal */ }
}
async function restoreHandle() {
    try {
        const db = await idb();
        return await new Promise(function (res) {
            const rq = db.transaction('handles').objectStore('handles').get('live');
            rq.onsuccess = function () { res(rq.result || null); };
            rq.onerror = function () { res(null); };
        });
    } catch (e) { return null; }
}

const $ = function (s) { return document.querySelector(s); };
function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
}
function markDirty() {
    dirty = true;
    $('#status').textContent = 'unsaved changes';
    $('#status').classList.add('dirty');
}
function markClean(msg) {
    dirty = false;
    $('#status').textContent = msg || 'saved';
    $('#status').classList.remove('dirty');
}

/* --------------------------------- data I/O ---------------------------------- */
function emptyEntry() {
    return { description: '', binary: null, confirmed_planets: 0, planets: [], other_objects: [] };
}
function emptyBody(source) {
    return { name: 'New body', source: source || 'book', type: '', status: '', first: '',
             description: '', moons: [], other_objects: [] };
}
function serialize() {
    if (DATA._meta) DATA._meta.edited = new Date().toISOString();
    return JSON.stringify(DATA, null, 1);
}

async function loadAll() {
    const [geo, pj] = await Promise.all([
        fetch('data/systems.geojson').then(function (r) { return r.json(); }),
        fetch('data/planets.json').then(function (r) { return r.json(); })
    ]);
    SYSTEMS = geo.features.map(function (f) { return f.properties.System_Nam; }).sort();
    GEO_NAMES = new Set(SYSTEMS);
    geo.features.forEach(function (f) { SYS_PROPS.set(f.properties.System_Nam, f.properties); });
    DATA = pj;
    // include planets.json-only systems (e.g. A5 ones not on the map yet)
    Object.keys(DATA).forEach(function (k) {
        if (k !== '_meta' && SYSTEMS.indexOf(k) === -1) SYSTEMS.push(k);
    });
    SYSTEMS.sort();
    if (!READONLY) fsHandle = await restoreHandle();
    renderList();
    markClean('loaded ' + SYSTEMS.length + ' systems' +
        (!READONLY && fsHandle ? ' — save target: ' + fsHandle.name : ''));
}

if (READONLY) {
    // catalog.html has no editing chrome — the blocks below never bind
} else {
$('#fileLoad').addEventListener('change', function () {
    const f = this.files[0];
    if (!f) return;
    f.text().then(function (txt) {
        DATA = JSON.parse(txt);
        renderList();
        if (current) renderDetail();
        markClean('loaded ' + f.name);
    }).catch(function (e) { alert('Could not parse: ' + e.message); });
});
async function writeToHandle(handle) {
    const w = await handle.createWritable();
    await w.write(serialize());
    await w.close();
}
/* Save — writes into the live file. First click: pick data/planets.json (the
 * browser needs one explicit grant); afterwards it saves silently. */
$('#btnSave').addEventListener('click', async function () {
    if (!window.showOpenFilePicker) {
        alert('This browser has no File System Access API.\nUse "Save as…" and replace data/planets.json with the downloaded file.');
        return;
    }
    try {
        if (!fsHandle) {
            const picked = await window.showOpenFilePicker({
                id: 'planets-live',
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
                multiple: false
            });
            fsHandle = picked[0];
            storeHandle(fsHandle);        // remembered across reloads (IndexedDB)
        }
        if ((await fsHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
            fsHandle = null;
            alert('Write permission was not granted.');
            return;
        }
        await writeToHandle(fsHandle);
        markClean('saved to ' + fsHandle.name);
    } catch (e) {
        if (e.name !== 'AbortError') alert('Save failed: ' + e.message);
    }
});
/* Save as… — new file via picker, or a plain download as fallback. */
$('#btnSaveAs').addEventListener('click', async function () {
    if (window.showSaveFilePicker) {
        try {
            const h = await window.showSaveFilePicker({
                suggestedName: 'planets.json',
                types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
            });
            await writeToHandle(h);
            markClean('saved copy to ' + h.name);
        } catch (e) {
            if (e.name !== 'AbortError') alert('Save failed: ' + e.message);
        }
        return;
    }
    const blob = new Blob([serialize()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'planets.json';
    a.click();
    URL.revokeObjectURL(a.href);
    markClean('downloaded — replace data/planets.json with it');
});
window.addEventListener('beforeunload', function (e) { if (dirty) e.preventDefault(); });
}

/* --- add / rename / delete planets.json entries (systems.geojson is untouched;
 *     the user edits that separately in QGIS) --- */
if (!READONLY) $('#btnNewSys').addEventListener('click', function () {
    const name = (prompt('New system name (must match System_Nam in systems.geojson to appear on the map):') || '').trim();
    if (!name) return;
    if (DATA[name]) { alert('An entry for "' + name + '" already exists.'); current = name; renderList(); renderDetail(); return; }
    DATA[name] = emptyEntry();
    if (SYSTEMS.indexOf(name) === -1) { SYSTEMS.push(name); SYSTEMS.sort(); }
    current = name;
    markDirty(); renderList(); renderDetail();
});
function renameSystem(oldName) {
    const hint = GEO_NAMES.has(oldName)
        ? '\nWARNING: "' + oldName + '" exists in systems.geojson — renaming the entry will detach it from the map system unless the geojson is renamed too.'
        : '';
    const name = (prompt('Rename entry to:' + hint, oldName) || '').trim();
    if (!name || name === oldName) return;
    if (DATA[name]) { alert('An entry named "' + name + '" already exists.'); return; }
    DATA[name] = DATA[oldName];
    delete DATA[oldName];
    if (!GEO_NAMES.has(oldName)) SYSTEMS.splice(SYSTEMS.indexOf(oldName), 1);
    if (SYSTEMS.indexOf(name) === -1) { SYSTEMS.push(name); SYSTEMS.sort(); }
    current = name;
    markDirty(); renderList(); renderDetail();
}
function deleteSystem(name) {
    if (!confirm('Delete the whole planets.json entry for "' + name + '" (all planets/moons/objects)?')) return;
    delete DATA[name];
    if (!GEO_NAMES.has(name)) { SYSTEMS.splice(SYSTEMS.indexOf(name), 1); current = null; }
    markDirty(); renderList(); renderDetail();
}

/* -------------------------------- system list -------------------------------- */
function entryBadge(name) {
    const e = DATA[name];
    if (!e) return '';
    const np = e.planets.length, no = (e.other_objects || []).length;
    const nm = e.planets.reduce(function (s, p) { return s + (p.moons || []).length + (p.other_objects || []).length; }, 0);
    if (!np && !no) return '';
    return np + 'p' + (nm ? ' ' + nm + 'm' : '') + (no ? ' ' + no + 'o' : '');
}
function renderList() {
    const q = $('#search').value.trim().toLowerCase();
    const list = $('#sysList');
    list.innerHTML = '';
    SYSTEMS.filter(function (n) { return !q || n.toLowerCase().indexOf(q) !== -1; })
        .forEach(function (n) {
            const it = el('div', 'sys-item' + (n === current ? ' active' : '') + (DATA[n] ? '' : ' nodata'));
            it.appendChild(el('span', '', n));
            it.appendChild(el('span', 'badge', entryBadge(n)));
            it.addEventListener('click', function () { current = n; renderList(); renderDetail(); });
            list.appendChild(it);
        });
}
$('#search').addEventListener('input', renderList);

/* -------------------------------- detail form -------------------------------- */
function bindText(input, obj, key) {
    input.value = obj[key] || '';
    input.addEventListener('input', function () { obj[key] = input.value; markDirty(); });
}
function fieldRows(container, obj) {
    const grid = el('div', 'grid2');
    OBJ_FIELDS.forEach(function (f) {
        const row = el('div', 'frow');
        row.appendChild(el('label', '', f[1]));
        const inp = el(f[2] === 'textarea' ? 'textarea' : 'input');
        if (f[2] !== 'textarea') inp.type = 'text';
        bindText(inp, obj, f[0]);
        if (f[0] === 'name') inp.addEventListener('change', renderDetail);   // refresh headers/selects
        row.appendChild(inp);
        (f[2] === 'textarea' ? container : grid).appendChild(row);
    });
    container.insertBefore(grid, container.querySelector('.frow:last-child'));
    const cat = CATALOG_INFO.filter(function (k) { return obj[k] !== undefined && obj[k] !== null; })
        .map(function (k) { return k + ': ' + obj[k]; }).join(' · ');
    if (cat) container.appendChild(el('div', 'catfields', 'Catalog fields (from the pipeline): ' + cat));
}
function sourceTag(obj) {
    return el('span', 'tag' + (obj.source === 'book' ? ' book' : ''), obj.source || 'book');
}
function delButton(onClick) {
    const b = el('button', 'danger', '✕');
    b.title = 'Delete';
    b.addEventListener('click', function () { if (confirm('Delete this object?')) { onClick(); markDirty(); renderDetail(); renderList(); } });
    return b;
}
/* ↑/↓ buttons to shuffle an item within its parent array (display order). */
function moveButtons(head, arr, i) {
    const up = el('button', 'mv', '↑'); up.title = 'Move up';
    const dn = el('button', 'mv', '↓'); dn.title = 'Move down';
    up.disabled = i === 0;
    dn.disabled = i === arr.length - 1;
    up.addEventListener('click', function () {
        arr.splice(i - 1, 0, arr.splice(i, 1)[0]); markDirty(); renderDetail();
    });
    dn.addEventListener('click', function () {
        arr.splice(i + 1, 0, arr.splice(i, 1)[0]); markDirty(); renderDetail();
    });
    head.appendChild(up); head.appendChild(dn);
}
/* Parent selector for moons/objects: move between planets and (for objects) system level. */
function parentSelect(entry, item, currentParent, isMoon, removeFromParent) {
    const sel = el('select');
    const opts = [];
    if (!isMoon) opts.push(['__system', 'System level']);
    entry.planets.forEach(function (p, i) { opts.push(['p' + i, 'Planet: ' + p.name]); });
    opts.forEach(function (o) {
        const op = el('option', '', o[1]);
        op.value = o[0];
        sel.appendChild(op);
    });
    sel.value = currentParent;
    sel.title = 'Parent (move this object)';
    sel.addEventListener('change', function () {
        removeFromParent();
        if (sel.value === '__system') entry.other_objects.push(item);
        else {
            const p = entry.planets[parseInt(sel.value.slice(1), 10)];
            (isMoon ? p.moons : p.other_objects).push(item);
        }
        markDirty(); renderDetail(); renderList();
    });
    return sel;
}

function childCard(entry, item, kindLabel, isMoon, parentKey, arr, idx) {
    const removeFn = function () { arr.splice(idx, 1); };
    const card = el('div', 'card moon');
    const head = el('div', 'card-head');
    head.appendChild(el('span', 'nm', (isMoon ? '☾ ' : '· ') + (item.name || '?') + ' <span class="tag">' + kindLabel + '</span>'));
    head.appendChild(sourceTag(item));
    head.appendChild(parentSelect(entry, item, parentKey, isMoon, removeFn));
    moveButtons(head, arr, idx);
    head.appendChild(delButton(removeFn));
    card.appendChild(head);
    fieldRows(card, item);
    return card;
}

/* ------------------------- catalog mode (read-only) -------------------------- */
function catBody(b, kindLabel) {
    const flag = function (v) { return v !== undefined && v !== null && v !== '' && v !== '0'; };
    const extra = [];
    if (b.status) extra.push(b.status);
    if (b.first) extra.push(b.first);
    if (b.method) extra.push(b.method + (b.year ? ', ' + Math.round(b.year) : ''));
    let html = '<div class="cat-body"><b>' + b.name + '</b>' +
        (kindLabel ? ' <span class="tag' + (b.source === 'book' ? ' book' : '') + '">' + kindLabel + '</span>' : '') +
        (b.type ? ' — ' + b.type : '') +
        (extra.length ? ' <span class="dim">(' + extra.join(' · ') + ')</span>' : '') +
        (b.description ? '<div class="cat-desc">' + b.description + '</div>' : '') +
        '</div>';
    const kids = (b.moons || []).map(function (m) { return catBody(m, 'moon'); })
        .concat((b.other_objects || []).map(function (o) { return catBody(o, 'object'); }));
    if (kids.length) html += '<div class="cat-kids">' + kids.join('') + '</div>';
    return html;
}
function renderCatalogDetail() {
    const d = $('#detail');
    d.innerHTML = '';
    if (!current) return;
    const entry = DATA[current];
    const p = SYS_PROPS.get(current);
    const flag = function (v) { return v !== undefined && v !== null && v !== '' && v !== '0'; };
    let html = '<h2>' + current + '</h2>';
    if (!GEO_NAMES.has(current)) html += '<div class="hint">Not on the map yet (no systems.geojson entry).</div>';
    if (entry && entry.description) html += '<p class="cat-desc">' + entry.description + '</p>';

    const rows = [];
    function row(k, v) { if (v !== undefined && v !== null && v !== '') rows.push('<tr><th>' + k + '</th><td>' + v + '</td></tr>'); }
    if (p) {
        const ot = (p.object_type || '').trim();
        row('Type', (TYPE_NAMES[ot] || ot || 'Unknown') +
            (p.spectral_type ? ' <span class="dim">(' + p.spectral_type + ')</span>' : ''));
        row('Distance from Sol', Math.sqrt(p.X * p.X + p.Y * p.Y + p.Z * p.Z).toFixed(1) + ' ly');
        row('Coordinates X / Y / Z', p.X.toFixed(2) + ' / ' + p.Y.toFixed(2) + ' / ' + p.Z.toFixed(2) + ' ly');
        row('Star presence', p.Star_Presc === '0' ? 'No star (in the books)' : 'Yes');
        const roles = [];
        if (flag(p.Capital)) roles.push('Capital');
        if (flag(p.Homeworld)) roles.push('Homeworld');
        if (flag(p.Core_Sys)) roles.push('Core');
        if (flag(p.Mining_Sys)) roles.push('Mining');
        if (flag(p.Idustr_Sys)) roles.push('Industrial');
        if (flag(p.Fuel_Depot)) roles.push('Fuel depot');
        if (flag(p.Mt_Base)) roles.push('Military base');
        if (roles.length) row('Roles', '<span class="cat-role">' + roles.join(', ') + '</span>');
        if (flag(p.Inhabitabl)) row('Inhabitable worlds', p.Inhabitabl);
        if (flag(p.Orbtl_Clny)) row('Orbitals / colonies', p.Orbtl_Clny);
        if (p.Unsurv_bod === '1') row('Unsurveyed bodies', 'Yes');
    }
    if (entry) {
        if (entry.binary) {
            row('Binary', (entry.binary.mode === 'far' ? 'distant companion' : 'close pair') +
                (entry.binary.components ? ' — ' + entry.binary.components.filter(Boolean).join(' + ') : ''));
        }
        if (entry.book_mentions) row('Book mentions', entry.book_mentions.hits + '× — first: ' + entry.book_mentions.first);
        if (entry.confirmed_planets) row('Confirmed exoplanets (catalog)', entry.confirmed_planets);
    }
    html += '<table class="cat-table">' + rows.join('') + '</table>';

    if (entry && (entry.planets.length || (entry.other_objects || []).length)) {
        if (entry.planets.length) {
            html += '<h3 class="sect">Planets (' + entry.planets.length + ')</h3>';
            entry.planets.forEach(function (pl) {
                html += catBody(pl, pl.source === 'catalog' ? 'catalog' : 'book');
            });
        }
        if ((entry.other_objects || []).length) {
            html += '<h3 class="sect">System-level objects (' + entry.other_objects.length + ')</h3>';
            entry.other_objects.forEach(function (o) { html += catBody(o, 'object'); });
        }
    } else {
        html += '<div class="hint">No body data recorded for this system yet.</div>';
    }
    d.innerHTML = html;
}

function renderDetail() {
    if (READONLY) { renderCatalogDetail(); return; }
    const d = $('#detail');
    d.innerHTML = '';
    if (!current) return;
    let entry = DATA[current];
    const h2row = el('div', 'frow');
    const h2 = el('h2', '', current);
    h2.style.flex = '1 1 auto';
    h2row.appendChild(h2);
    if (entry) {
        const ren = el('button', 'subtle', 'Rename entry');
        ren.addEventListener('click', function () { renameSystem(current); });
        h2row.appendChild(ren);
        const del = el('button', 'danger', 'Delete entry');
        del.addEventListener('click', function () { deleteSystem(current); });
        h2row.appendChild(del);
    }
    d.appendChild(h2row);
    if (!GEO_NAMES.has(current)) {
        d.appendChild(el('div', 'hint', 'Not in systems.geojson — this entry is data-only until a matching system exists on the map (edit the geojson in QGIS).'));
    }
    if (!entry) {
        const b = el('button', '', 'Create data entry for this system');
        b.addEventListener('click', function () { DATA[current] = emptyEntry(); markDirty(); renderDetail(); renderList(); });
        d.appendChild(b);
        return;
    }

    /* system description */
    d.appendChild(el('h3', 'sect', 'System'));
    const desc = el('textarea');
    desc.placeholder = 'System description (shown in the 3D info panels)…';
    bindText(desc, entry, 'description');
    d.appendChild(desc);
    if (entry.book_mentions) {
        d.appendChild(el('div', 'hint', 'Book mentions: ' + entry.book_mentions.hits + '× — first: ' + entry.book_mentions.first));
    }

    /* binary configuration */
    d.appendChild(el('h3', 'sect', 'Binary configuration'));
    const brow = el('div', 'frow');
    const bcheck = el('input'); bcheck.type = 'checkbox'; bcheck.checked = !!entry.binary;
    brow.appendChild(bcheck);
    brow.appendChild(el('label', '', 'Render as a binary in the close-up view'));
    d.appendChild(brow);
    const bopts = el('div');
    d.appendChild(bopts);
    function renderBinary() {
        bopts.innerHTML = '';
        if (!entry.binary) return;
        const r1 = el('div', 'frow');
        r1.appendChild(el('label', '', 'Mode'));
        const sel = el('select');
        [['close', 'close — stars orbit each other, planets around both'],
         ['far', 'far — planets orbit the primary, companion far out']].forEach(function (o) {
            const op = el('option', '', o[1]); op.value = o[0]; sel.appendChild(op);
        });
        sel.value = entry.binary.mode || 'close';
        sel.addEventListener('change', function () { entry.binary.mode = sel.value; markDirty(); });
        r1.appendChild(sel);
        bopts.appendChild(r1);
        const r2 = el('div', 'frow');
        r2.appendChild(el('label', '', 'Components'));
        const c1 = el('input'); c1.type = 'text'; c1.placeholder = 'primary spectral, e.g. G2V';
        const c2 = el('input'); c2.type = 'text'; c2.placeholder = 'companion, e.g. M4V';
        const comps = entry.binary.components || ['', ''];
        c1.value = comps[0] || ''; c2.value = comps[1] || '';
        function upd() {
            entry.binary.components = (c1.value.trim() || c2.value.trim()) ? [c1.value.trim(), c2.value.trim()] : null;
            if (!entry.binary.components) delete entry.binary.components;
            markDirty();
        }
        c1.addEventListener('input', upd); c2.addEventListener('input', upd);
        r2.appendChild(c1); r2.appendChild(c2);
        bopts.appendChild(r2);
        bopts.appendChild(el('div', 'hint', 'Leave components empty to auto-detect from the spectral type (a "+"), or fill both to override.'));
    }
    bcheck.addEventListener('change', function () {
        entry.binary = bcheck.checked ? { mode: 'close' } : null;
        markDirty(); renderBinary();
    });
    renderBinary();

    /* planets (each with nested moons + objects) */
    d.appendChild(el('h3', 'sect', 'Planets (' + entry.planets.length + ')'));
    entry.planets.forEach(function (p, pi) {
        const card = el('div', 'card');
        const head = el('div', 'card-head');
        head.appendChild(el('span', 'nm', '● ' + (p.name || '?')));
        head.appendChild(sourceTag(p));
        const addMoon = el('button', '', '+ moon');
        addMoon.addEventListener('click', function () {
            p.moons = p.moons || []; p.moons.push(emptyBody('book')); markDirty(); renderDetail(); renderList();
        });
        const addObj = el('button', '', '+ object');
        addObj.addEventListener('click', function () {
            p.other_objects = p.other_objects || []; p.other_objects.push(emptyBody('book')); markDirty(); renderDetail(); renderList();
        });
        head.appendChild(addMoon);
        head.appendChild(addObj);
        moveButtons(head, entry.planets, pi);
        head.appendChild(delButton(function () { entry.planets.splice(pi, 1); }));
        card.appendChild(head);
        fieldRows(card, p);
        d.appendChild(card);
        (p.moons || []).forEach(function (m, mi) {
            d.appendChild(childCard(entry, m, 'moon', true, 'p' + pi, p.moons, mi));
        });
        (p.other_objects || []).forEach(function (o, oi) {
            d.appendChild(childCard(entry, o, 'object', false, 'p' + pi, p.other_objects, oi));
        });
    });
    const addP = el('button', 'addrow', '+ Add planet');
    addP.addEventListener('click', function () { entry.planets.push(emptyBody('book')); markDirty(); renderDetail(); renderList(); });
    d.appendChild(addP);

    /* system-level other objects */
    d.appendChild(el('h3', 'sect', 'System-level objects (' + (entry.other_objects || []).length + ')'));
    d.appendChild(el('div', 'hint', 'Belts, stations, constructs etc. not tied to one planet. Use the parent selector to move an object under a planet.'));
    (entry.other_objects || []).forEach(function (o, oi) {
        d.appendChild(childCard(entry, o, 'object', false, '__system', entry.other_objects, oi));
    });
    const addO = el('button', 'addrow', '+ Add system object');
    addO.addEventListener('click', function () {
        entry.other_objects = entry.other_objects || [];
        entry.other_objects.push(emptyBody('book')); markDirty(); renderDetail(); renderList();
    });
    d.appendChild(addO);
}

loadAll().catch(function (e) {
    $('#status').textContent = 'load failed: ' + e.message;
});
