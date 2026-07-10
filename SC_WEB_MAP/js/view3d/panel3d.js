'use strict';
/*
 * DOM UI for the 3-D star view. Pure DOM — no Three.js here.
 *
 *  - buildPanel(sidebar, ctl)  → the 3-D control panel. It lives INSIDE the app's
 *    right sidebar and replaces the 2-D filter tabs while 3-D mode is active
 *    (the swap is a CSS class toggled by js/view3d-boot.js).
 *  - buildSettings(host, ctl)  → gear button (next to the 2D switch) + the
 *    visual-settings window (star/marker size, labels, grid, sound…).
 *  - buildInfo/showInfo        → the star info panel (overlay on the canvas).
 */
import { NATION_COLORS, NO_NATION_COLOR, CLASSES, SPECIALS, MARKERS, BOOKS, CHARACTER_COLORS, friendlyObjectType } from './data3d.js';

function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
}
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }

/* ---------------------------- small control builders ------------------------- */
function block(parent, title) {
    const b = el('div', 'v3d-block');
    if (title) b.appendChild(el('div', 'v3d-block-title', title));
    parent.appendChild(b);
    return b;
}
function radioRow(parent, name, value, label, checked, onChange) {
    const row = el('label', 'v3d-row');
    const r = el('input');
    r.type = 'radio'; r.name = name; r.value = value; r.checked = checked;
    r.addEventListener('change', function () { if (r.checked) onChange(value); });
    row.appendChild(r);
    row.appendChild(el('span', '', label));
    parent.appendChild(row);
    return r;
}
function checkRow(parent, label, checked, onChange, swatchColor) {
    const row = el('label', 'v3d-row');
    const c = el('input');
    c.type = 'checkbox'; c.checked = checked;
    c.addEventListener('change', function () { onChange(c.checked); });
    row.appendChild(c);
    if (swatchColor) {
        const sw = el('span', 'v3d-swatch');
        sw.style.background = swatchColor;
        row.appendChild(sw);
    }
    row.appendChild(el('span', '', label));
    parent.appendChild(row);
    return c;
}
function sliderRow(parent, label, min, max, step, value, format, onChange) {
    const wrap = el('div', 'v3d-sliderwrap');
    const head = el('div', 'v3d-sliderhead');
    head.appendChild(el('span', '', label));
    const val = el('span', 'v3d-sliderval', format(value));
    head.appendChild(val);
    wrap.appendChild(head);
    const s = el('input', 'v3d-slider');
    s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
    s.addEventListener('input', function () {
        const v = parseFloat(s.value);
        val.textContent = format(v);
        onChange(v);
    });
    wrap.appendChild(s);
    parent.appendChild(wrap);
    return s;
}

/* ------------------------- control panel (in the sidebar) -------------------- */
export function buildPanel(sidebar, ctl) {
    const panel = el('div', 'v3d-panel');
    sidebar.appendChild(panel);

    panel.appendChild(el('div', 'maptitle sidebar-title v3d-panel-title', '3D Star View'));
    const body = el('div', 'v3d-panel-body');
    panel.appendChild(body);

    /* ---- search ---- */
    const searchWrap = el('div', 'v3d-block');
    const input = el('input', 'v3d-search');
    input.type = 'text';
    input.placeholder = 'Search system…';
    const sugg = el('div', 'v3d-suggestions');
    searchWrap.appendChild(input);
    searchWrap.appendChild(sugg);
    body.appendChild(searchWrap);

    const inSystem = function () { return ctl.inSystem && ctl.inSystem(); };

    function goToStar(star) {
        input.value = star.name;
        sugg.innerHTML = ''; sugg.style.display = 'none';
        ctl.select(star);
        ctl.flyTo(star);
    }
    function goToBody(item) {
        input.value = item.name;
        sugg.innerHTML = ''; sugg.style.display = 'none';
        ctl.focusSystemBody(item);
    }
    function showMessage(txt) {
        sugg.innerHTML = '<div class="v3d-sugg-msg">' + txt + '</div>';
        sugg.style.display = 'block';
    }
    input.addEventListener('input', function () {
        const q = input.value.trim().toLowerCase();
        sugg.innerHTML = '';
        if (!q) { sugg.style.display = 'none'; return; }
        if (inSystem()) {
            // search the bodies of the system being viewed (no star search here)
            const hits = ctl.searchSystemBodies()
                .filter(function (b) { return b.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
            hits.forEach(function (b) {
                const it = el('div', 'v3d-sugg-item', b.name);
                it.addEventListener('mousedown', function (ev) { ev.preventDefault(); goToBody(b); });
                sugg.appendChild(it);
            });
            sugg.style.display = hits.length ? 'block' : 'none';
            return;
        }
        const hits = ctl.stars.filter(function (s) { return s.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
        hits.forEach(function (s) {
            const it = el('div', 'v3d-sugg-item', s.name);
            it.addEventListener('mousedown', function (ev) { ev.preventDefault(); goToStar(s); });
            sugg.appendChild(it);
        });
        sugg.style.display = hits.length ? 'block' : 'none';
    });
    input.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter') return;
        const q = input.value.trim().toLowerCase();
        if (!q) return;
        if (inSystem()) {
            const bodies = ctl.searchSystemBodies();
            const b = bodies.find(function (x) { return x.name.toLowerCase() === q; }) ||
                      bodies.find(function (x) { return x.name.toLowerCase().indexOf(q) !== -1; });
            if (b) goToBody(b);
            else showMessage('No such object in this system.');
            return;
        }
        const s = ctl.stars.find(function (s) { return s.name.toLowerCase() === q; }) ||
                  ctl.stars.find(function (s) { return s.name.toLowerCase().indexOf(q) !== -1; });
        if (s) goToStar(s);
    });
    input.addEventListener('focus', function () {
        input.placeholder = inSystem() ? 'Search bodies in this system…' : 'Search system…';
    });
    input.addEventListener('blur', function () { setTimeout(function () { sugg.style.display = 'none'; }, 150); });

    /* ---- color mode + integrated legend-filter ----
     * The legend rows double as filters: the checkbox next to each color chip
     * controls whether stars of that spectral class / nation are displayed.
     * Both filters stay active regardless of which color mode is shown. */
    const bColor = block(body, 'Color by');
    const inline1 = el('div', 'v3d-inline'); bColor.appendChild(inline1);
    radioRow(inline1, 'v3d-color', 'spectral', 'Spectral type', ctl.state.colorMode === 'spectral', setColor);
    radioRow(inline1, 'v3d-color', 'nation', 'Nation', ctl.state.colorMode === 'nation', setColor);

    const legend = el('div', 'v3d-legend');
    bColor.appendChild(legend);
    function filterRow(label, color, set, key) {
        checkRow(legend, label, set.has(key), function (on) {
            on ? set.add(key) : set.delete(key);
            ctl.apply();
        }, color);
    }
    function renderLegend() {
        legend.innerHTML = '';
        if (ctl.state.colorMode === 'spectral') {
            ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'C', 'BD', 'WD', 'NS', 'UNK'].forEach(function (k) {
                filterRow(CLASSES[k].label, hex(CLASSES[k].color), ctl.state.classes, k);
            });
        } else {
            Object.keys(NATION_COLORS).forEach(function (n) {
                filterRow(n, hex(NATION_COLORS[n]), ctl.state.nations, n);
            });
            filterRow('No nation / independent', hex(NO_NATION_COLOR), ctl.state.nations, null);
        }
    }
    function setColor(mode) { ctl.state.colorMode = mode; renderLegend(); ctl.apply(); }
    renderLegend();

    /* ---- book range (two-ended slider, mirrors the 2-D Book filter) ---- */
    const bBook = block(body, 'Book range');
    const bookHead = el('div', 'v3d-sliderhead');
    bookHead.appendChild(el('span', '', 'Books'));
    const bookVal = el('span', 'v3d-sliderval');
    bookHead.appendChild(bookVal);
    bBook.appendChild(bookHead);
    const bookSl = el('div', 'v3d-nouislider');
    bBook.appendChild(bookSl);
    noUiSlider.create(bookSl, {
        start: ctl.state.bookRange.slice(), connect: true, step: 1,
        range: { min: 1, max: BOOKS.length }, format: wNumb({ decimals: 0 })
    });
    bookSl.noUiSlider.on('update', function (values) {
        const lo = parseInt(values[0], 10), hi = parseInt(values[1], 10);
        bookVal.textContent = lo === hi ? BOOKS[lo - 1] : BOOKS[lo - 1] + ' – ' + BOOKS[hi - 1];
        ctl.state.bookRange = [lo, hi];
        ctl.state.book = BOOKS[hi - 1];      // nation borders use the latest book in range
        renderLegend();
        ctl.apply();
    });
    bBook.appendChild(el('div', 'v3d-note',
        'Nation colors use the latest book in the range.'));

    /* ---- character journeys ---- */
    const bChar = block(body, 'Character journeys');
    Object.keys(CHARACTER_COLORS).forEach(function (c) {
        checkRow(bChar, c, ctl.state.characters.has(c), function (on) {
            on ? ctl.state.characters.add(c) : ctl.state.characters.delete(c);
            ctl.apply();
        }, hex(CHARACTER_COLORS[c]));
    });
    checkRow(bChar, 'Show across all books', ctl.state.journeyAllBooks, function (on) {
        ctl.state.journeyAllBooks = on;
        ctl.apply();
    });
    bChar.appendChild(el('div', 'v3d-note',
        'Journeys follow the Book selector above unless "all books" is on.'));

    /* ---- route planner (fewest lane jumps + straight-line comparison) ---- */
    const bRoute = block(body, 'Route planner');
    const dl = el('datalist');
    dl.id = 'v3d-sysdl';
    ctl.stars.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
        .forEach(function (s) {
            const o = el('option'); o.value = s.name; dl.appendChild(o);
        });
    bRoute.appendChild(dl);
    function routeInput(ph) {
        const i = el('input', 'v3d-search');
        i.type = 'text'; i.placeholder = ph; i.setAttribute('list', 'v3d-sysdl');
        i.style.marginBottom = '4px';
        bRoute.appendChild(i);
        return i;
    }
    const inFrom = routeInput('From system…');
    const inTo = routeInput('To system…');
    const btnRow = el('div', 'v3d-inline');
    const goBtn = el('button', 'v3d-routebtn', 'Route');
    const clrBtn = el('button', 'v3d-routebtn v3d-routebtn-sub', 'Clear');
    btnRow.appendChild(goBtn); btnRow.appendChild(clrBtn);
    bRoute.appendChild(btnRow);
    const routeOut = el('div', 'v3d-routeout');
    bRoute.appendChild(routeOut);
    function routeResultHtml(r) {
        return '<b>' + r.jumps + ' jump' + (r.jumps === 1 ? '' : 's') + '</b> through the lanes · ' +
            '<b>' + r.distLy.toFixed(1) + ' ly</b> straight-line in real space' +
            '<div class="v3d-routepath">' + r.path.join(' → ') + '</div>';
    }
    goBtn.addEventListener('click', function () {
        const r = ctl.computeRoute(inFrom.value.trim(), inTo.value.trim());
        if (r.error) { routeOut.innerHTML = '<span class="v3d-routeerr">' + r.error + '</span>'; return; }
        routeOut.innerHTML = routeResultHtml(r);
    });
    clrBtn.addEventListener('click', function () {
        ctl.clearRoute();
        routeOut.innerHTML = '';
        inFrom.value = ''; inTo.value = '';
    });
    // restore a route carried over from the other view / a previous visit
    if (window.SC_routeState) {
        inFrom.value = window.SC_routeState.from;
        inTo.value = window.SC_routeState.to;
        routeOut.innerHTML = routeResultHtml(window.SC_routeState);
    }

    /* ---- marker overlays (roles + no-star) ---- */
    const bSpec = block(body, 'System markers');
    MARKERS.forEach(function (m) {
        checkRow(bSpec, m.label + (m.test ? '' : ' systems'), ctl.state.markers[m.key], function (on) {
            ctl.state.markers[m.key] = on; ctl.apply();
        }, m.color);
    });

    /* ---- global reset ---- */
    const resetBtn = el('button', 'v3d-routebtn', 'Reset all filters');
    resetBtn.title = 'Resets every filter in both the 2D and 3D views to its default';
    resetBtn.style.marginTop = '8px';
    resetBtn.addEventListener('click', function () {
        if (window.SC_resetAllFilters) window.SC_resetAllFilters();
        else if (window.SC_reset3D) window.SC_reset3D();
    });
    body.appendChild(resetBtn);

    body.appendChild(el('div', 'v3d-note',
        'Drag to orbit · right-drag to pan · scroll to zoom · click a star for details · ' +
        'double-click to fly to it. Visual options are behind the ⚙ button on the map.'));

    return panel;
}

/* ----------------------- settings window (gear button) ----------------------- */
export function buildSettings(host, ctl) {
    const btn = el('button', 'v3d-gear');
    btn.type = 'button';
    btn.title = 'Visual settings';
    btn.textContent = '⚙';
    host.appendChild(btn);

    const win = el('div', 'v3d-settings');
    win.style.display = 'none';
    host.appendChild(win);
    win.appendChild(el('div', 'v3d-settings-head', 'Visual settings'));
    const body = el('div', 'v3d-settings-body');
    win.appendChild(body);

    btn.addEventListener('click', function () {
        const open = win.style.display === 'none';
        win.style.display = open ? 'block' : 'none';
        btn.classList.toggle('on', open);
    });

    const bStars = block(body, 'Stars');
    sliderRow(bStars, 'Star size', 0.1, 3, 0.05, ctl.state.sizeMul,
        function (v) { return '×' + v.toFixed(2); },
        function (v) { ctl.state.sizeMul = v; ctl.applyVisual(); });
    bStars.appendChild(el('div', 'v3d-note',
        'Note: even at the minimum, stars render enormously oversized — at this scale ' +
        '(1 unit = 1 light-year) a true-to-scale Sun would be ~10⁻⁷ units across, far ' +
        'below a single pixel.'));

    const bMarkers = block(body, 'Markers');
    sliderRow(bMarkers, 'Marker size', 0.4, 2.5, 0.05, ctl.state.markerMul,
        function (v) { return '×' + v.toFixed(2); },
        function (v) { ctl.state.markerMul = v; ctl.applyVisual(); });

    const bLab = block(body, 'Labels');
    const inline = el('div', 'v3d-inline'); bLab.appendChild(inline);
    [['off', 'Off'], ['book', 'Book systems'], ['all', 'All']].forEach(function (o) {
        radioRow(inline, 'v3d-labels', o[0], o[1], ctl.state.labelMode === o[0], function (v) {
            ctl.state.labelMode = v; ctl.apply();
        });
    });

    /* Scene — the fx options live under their parent toggles and are only
     * available while the parent (grid / height lines) is enabled. */
    const bScene = block(body, 'Scene');
    let cbRipple, cbPulse;
    function syncFx() {
        if (!ctl.state.grid && ctl.state.fxRipple) { ctl.state.fxRipple = false; cbRipple.checked = false; }
        cbRipple.disabled = !ctl.state.grid;
        cbRipple.parentElement.classList.toggle('v3d-disabled', !ctl.state.grid);
        if (!ctl.state.heightLines && ctl.state.fxPulseLines) { ctl.state.fxPulseLines = false; cbPulse.checked = false; }
        cbPulse.disabled = !ctl.state.heightLines;
        cbPulse.parentElement.classList.toggle('v3d-disabled', !ctl.state.heightLines);
    }
    checkRow(bScene, 'Reference grid (ly)', ctl.state.grid, function (on) {
        ctl.state.grid = on; syncFx(); ctl.apply();
    });
    cbRipple = checkRow(bScene, 'Ripple surface (fx)', ctl.state.fxRipple, function (on) {
        ctl.state.fxRipple = on; ctl.apply();
    });
    cbRipple.parentElement.classList.add('v3d-subrow');
    checkRow(bScene, 'Height lines to grid', ctl.state.heightLines, function (on) {
        ctl.state.heightLines = on; syncFx(); ctl.apply();
    });
    cbPulse = checkRow(bScene, 'Pulsing droplets (fx)', ctl.state.fxPulseLines, function (on) {
        ctl.state.fxPulseLines = on; ctl.apply();
    });
    cbPulse.parentElement.classList.add('v3d-subrow');
    checkRow(bScene, 'Neon journey pulses (fx)', ctl.state.fxJourneys, function (on) {
        ctl.state.fxJourneys = on; ctl.apply();
    });
    checkRow(bScene, 'Neon route pulse (fx)', ctl.state.fxRoute, function (on) {
        ctl.state.fxRoute = on; ctl.redrawRoute();
    });
    checkRow(bScene, 'Real sky backdrop', ctl.state.sky, function (on) {
        ctl.state.sky = on; ctl.setSky(on);
    });
    checkRow(bScene, '2D↔3D transition animation', ctl.state.transition, function (on) {
        ctl.state.transition = on;
    });
    bScene.appendChild(el('div', 'v3d-note',
        'The sky is the real Milky Way panorama in galactic orientation, as seen from Sol ' +
        '(ESO / Serge Brunier, CC BY 4.0).'));
    syncFx();

    const bSound = block(body, 'Sound');
    checkRow(bSound, 'Ambient space sound', ctl.state.sound, function (on) {
        ctl.state.sound = on; ctl.setSound(on);
    });
    bSound.appendChild(el('div', 'v3d-note'));

    return { button: btn, window: win };
}

/* -------------------------------- info panel -------------------------------- */
let infoEl = null;

export function buildInfo(host, ctl) {
    infoEl = el('div', 'v3d-info');
    infoEl.style.display = 'none';
    host.appendChild(infoEl);
    infoEl.addEventListener('click', function (ev) {
        if (ev.target.classList.contains('v3d-info-close')) { ctl.select(null); }
        if (ev.target.classList.contains('v3d-focus')) {
            const s = ctl.getSelected();
            if (s) ctl.flyTo(s);
        }
        if (ev.target.classList.contains('v3d-enter')) {
            const s = ctl.getSelected();
            if (s) ctl.enterSystem(s);
        }
    });
    return infoEl;
}

function fmtBody(x) {
    // status / first-chapter details are shown in the system view's object popup,
    // not in this overview list
    const extra = x.source === 'catalog'
        ? [x.method, x.year && Math.round(x.year)].filter(Boolean).join(', ')
        : '';
    let li = '<li><b>' + x.name + '</b>' + (x.type ? ' — ' + x.type : '') +
        (extra ? ' <span class="v3d-dim">(' + extra + ')</span>' : '');
    const kids = (x.moons || []).concat(x.other_objects || []);
    if (kids.length) li += '<ul>' + kids.map(fmtBody).join('') + '</ul>';
    return li + '</li>';
}
function bodyList(title, items) {
    if (!items || !items.length) return '';
    return '<h4>' + title + ' (' + items.length + ')</h4><ul>' + items.map(fmtBody).join('') + '</ul>';
}

export function showInfo(star, ctl) {
    if (!infoEl) return;
    if (!star) { infoEl.style.display = 'none'; return; }
    const p = star.props;
    const nation = star.nation[ctl.state.book];
    const rows = [];
    function row(k, v) { if (v !== undefined && v !== null && v !== '') rows.push('<tr><th>' + k + '</th><td>' + v + '</td></tr>'); }

    row('Type', friendlyObjectType(p.object_type) + (p.spectral_type ? ' <span class="v3d-dim">(' + p.spectral_type + ')</span>' : ''));
    row('Distance from Sol', star.distSol.toFixed(1) + ' ly');
    row('Nation (' + ctl.state.book + ')', nation
        ? '<span class="v3d-swatch" style="background:' + hex(NATION_COLORS[nation]) + '"></span>' + nation
        : '<span class="v3d-dim">none / independent</span>');
    if (star.specials.length) {
        row('Roles', star.specials.map(function (k) {
            const s = SPECIALS.find(function (x) { return x.key === k; });
            return '<span style="color:' + s.color + '">' + s.label + '</span>';
        }).join(', '));
    }
    if (p.Homeworld) row('Homeworld', p.Homeworld);
    if (p.Inhabitabl) row('Inhabitable worlds', p.Inhabitabl);
    if (p.Orbtl_Clny) row('Orbitals / colonies', p.Orbtl_Clny);
    if (p.Unsurv_bod === '1') row('Unsurveyed bodies', 'Yes');
    if (p.New_Lane === '1') row('Researching new starline', 'Yes');
    if (star.noStar) row('Star presence', 'No star (in the books)');
    if (star.mentions) row('Book mentions', star.mentions.hits + '× — first: ' + star.mentions.first);

    // Bodies (planets.json v2: planets carry their moons/other objects)
    const b = star.bodies;
    let bodiesHtml =
        bodyList('Planets in the books', b.bookPlanets) +
        bodyList('Confirmed exoplanets', b.catalogPlanets) +
        bodyList('Other objects', b.systemObjects);

    infoEl.innerHTML =
        '<button class="v3d-info-close" title="Close">&times;</button>' +
        '<h3>' + star.name + '</h3>' +
        (b.description ? '<p class="v3d-desc">' + b.description + '</p>' : '') +
        '<table class="v3d-info-table">' + rows.join('') + '</table>' +
        '<button class="v3d-focus">Fly to system</button>' +
        '<button class="v3d-enter">Enter system view</button>' +
        bodiesHtml;
    infoEl.style.display = 'block';
}
