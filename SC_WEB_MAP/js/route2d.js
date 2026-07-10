'use strict';
/*
 * Route planner for the 2-D map (sidebar → Other tab).
 *
 * Fewest-jumps routing over the hyperlane graph, using the Sys_A/Sys_B system
 * links written into lanes.geojson by catalog_recovery/snap_endpoints.py.
 * Deliberately UNWEIGHTED (lane lengths have no physical meaning), and
 * in-development lanes are always excluded — they don't reach their far system
 * yet, so they can never be part of a route. The result compares lane jumps
 * with the straight-line 3-D distance from the systems' real X/Y/Z (ly).
 *
 * The computed route lives in window.SC_routeState and carries over to the 3-D
 * view (and back — the 3-D module calls SC_route2D.sync() when switching here).
 *
 * (The same BFS exists in the 3-D module — js/view3d/data3d.js. This file is
 * classic-script world, so the small algorithm is duplicated on purpose.)
 */
(function () {
    const map = SC.map, layers = SC.layers;

    /* ---- route highlight layer (drawn over the lanes, under the systems) ---- */
    const routeSource = new ol.source.Vector();
    const routeLayer = new ol.layer.Vector({
        source: routeSource,
        style: [
            new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(10,40,70,0.9)', width: 7 }) }),
            new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(95,224,255,0.95)', width: 4 }) })
        ],
        zIndex: 348
    });
    routeLayer.set('id', 'route');
    map.addLayer(routeLayer);

    /* ---- lazily built graph + lookups (sources load async) ---- */
    let adj = null, sysByName = null, laneByPair = null;
    function ready() {
        if (adj) return true;
        const sysFeats = layers.systems.getSource().getFeatures();
        const laneFeats = layers.lanes.getSource().getFeatures();
        if (!sysFeats.length || !laneFeats.length) return false;
        sysByName = new Map();
        sysFeats.forEach(function (f) { sysByName.set(f.get('System_Nam'), f); });
        adj = new Map();
        laneByPair = new Map();
        laneFeats.forEach(function (f) {
            const a = f.get('Sys_A'), b = f.get('Sys_B');
            if (!a || !b || a === b) return;
            if (f.get('Status') === 'In Developement') return;   // never routable
            if (!adj.has(a)) adj.set(a, []);
            if (!adj.has(b)) adj.set(b, []);
            adj.get(a).push(b);
            adj.get(b).push(a);
            laneByPair.set(a + ' ' + b, f);
            laneByPair.set(b + ' ' + a, f);
        });
        return true;
    }
    function bfs(from, to) {
        if (from === to) return [from];
        if (!adj.has(from) || !adj.has(to)) return null;
        const prev = new Map();
        prev.set(from, null);
        let frontier = [from];
        while (frontier.length) {
            const next = [];
            for (const n of frontier) {
                for (const m of adj.get(n) || []) {
                    if (prev.has(m)) continue;
                    prev.set(m, n);
                    if (m === to) {
                        const path = [to];
                        let cur = n;
                        while (cur) { path.push(cur); cur = prev.get(cur); }
                        return path.reverse();
                    }
                    next.push(m);
                }
            }
            frontier = next;
        }
        return null;
    }

    /* ---- UI (Other tab) ---- */
    const tab = document.getElementById('otherTab');
    const wrap = document.createElement('div');
    wrap.className = 'filter-block';
    wrap.innerHTML =
        '<div class="filter-label"><span class="filter-label-text">ROUTE PLANNER (LANES)</span></div>' +
        '<datalist id="rt2-dl"></datalist>' +
        '<input class="rt2-input" id="rt2-from" list="rt2-dl" placeholder="From system…">' +
        '<input class="rt2-input" id="rt2-to" list="rt2-dl" placeholder="To system…">' +
        '<div class="rt2-btns">' +
        '  <button id="rt2-go" class="rt2-btn">Route</button>' +
        '  <button id="rt2-clear" class="rt2-btn rt2-btn-sub">Clear</button>' +
        '</div>' +
        '<div id="rt2-out" class="rt2-out"></div>' +
        '<div class="filter-note">Fewest jumps through operational lanes; compared with the straight-line 3-D distance. In-development lanes are excluded.</div>';
    tab.appendChild(wrap);

    const out = wrap.querySelector('#rt2-out');
    const inFromEl = wrap.querySelector('#rt2-from');
    const inToEl = wrap.querySelector('#rt2-to');

    /* ---- shared route state (carries over between the 2-D and 3-D views) ----
     * window.SC_routeState = null | { from, to, path:[names], jumps, distLy }   */
    function resultHtml(st) {
        return '<b>' + st.jumps + ' jump' + (st.jumps === 1 ? '' : 's') + '</b> through the lanes · ' +
            '<b>' + st.distLy.toFixed(1) + ' ly</b> straight-line in real space' +
            '<div class="rt2-path">' + st.path.join(' → ') + '</div>';
    }
    function drawFromState() {
        if (!ready()) return;
        routeSource.clear();
        const st = window.SC_routeState;
        if (!st) {                       // route cleared (possibly from the 3-D view)
            out.innerHTML = '';
            inFromEl.value = '';
            inToEl.value = '';
            return;
        }
        inFromEl.value = st.from;
        inToEl.value = st.to;
        out.innerHTML = resultHtml(st);
        // highlight the actual lane geometries (fallback: straight segment)
        for (let i = 0; i < st.path.length - 1; i++) {
            const lane = laneByPair.get(st.path[i] + ' ' + st.path[i + 1]);
            if (lane) {
                routeSource.addFeature(new ol.Feature(lane.getGeometry().clone()));
            } else if (sysByName.has(st.path[i]) && sysByName.has(st.path[i + 1])) {
                routeSource.addFeature(new ol.Feature(new ol.geom.LineString([
                    sysByName.get(st.path[i]).getGeometry().getCoordinates(),
                    sysByName.get(st.path[i + 1]).getGeometry().getCoordinates()
                ])));
            }
        }
    }
    // the 3-D module calls this when switching back to 2-D
    window.SC_route2D = { sync: drawFromState };

    let dlFilled = false;
    function fillDatalist() {
        if (dlFilled || !ready()) return;
        const dl = wrap.querySelector('#rt2-dl');
        Array.from(sysByName.keys()).sort().forEach(function (n) {
            const o = document.createElement('option');
            o.value = n;
            dl.appendChild(o);
        });
        dlFilled = true;
    }
    ['focus', 'click'].forEach(function (ev) {
        inFromEl.addEventListener(ev, fillDatalist);
        inToEl.addEventListener(ev, fillDatalist);
    });

    wrap.querySelector('#rt2-go').addEventListener('click', function () {
        routeSource.clear();
        if (!ready()) { out.innerHTML = '<span class="rt2-err">Map data still loading — try again.</span>'; return; }
        const from = inFromEl.value.trim();
        const to = inToEl.value.trim();
        const fa = sysByName.get(from), fb = sysByName.get(to);
        if (!fa || !fb) { out.innerHTML = '<span class="rt2-err">Pick two valid system names.</span>'; return; }
        const path = bfs(from, to);
        if (!path) { out.innerHTML = '<span class="rt2-err">No lane route between these systems.</span>'; return; }
        // straight-line 3-D distance from the systems' real coordinates
        const dx = fa.get('X') - fb.get('X'), dy = fa.get('Y') - fb.get('Y'), dz = fa.get('Z') - fb.get('Z');
        window.SC_routeState = {
            from: from, to: to, path: path,
            jumps: path.length - 1,
            distLy: Math.sqrt(dx * dx + dy * dy + dz * dz)
        };
        drawFromState();
    });
    wrap.querySelector('#rt2-clear').addEventListener('click', function () {
        window.SC_routeState = null;
        routeSource.clear();
        out.innerHTML = '';
        inFromEl.value = '';
        inToEl.value = '';
    });
})();
