'use strict';
/*
 * UI shell: tab switching, the Layers tab (toggles + inline legends),
 * fullscreen control, and Leaflet-compatible URL-hash sync (#zoom/lat/lng).
 * Filters (Main/Other) and the Real-Distances tool are added in later steps.
 */
(function () {
    const map = SC.map, view = SC.view, layers = SC.layers;

    /* ---- Tabs ---- */
    document.querySelectorAll('.tablinks').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.tabcontent').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.tablinks').forEach(function (b) { b.classList.remove('active'); });
            document.getElementById(btn.dataset.tab).classList.add('active');
            btn.classList.add('active');
        });
    });

    /* ---- Legend swatch helpers ---- */
    function dot(fill, stroke) { return '<span class="lg-dot" style="background:' + fill + ';border-color:' + (stroke || fill) + '"></span>'; }
    function box(c) { return '<span class="lg-box" style="background:' + c + '"></span>'; }
    function line(c) { return '<span class="lg-line" style="background:' + c + '"></span>'; }
    function glyph(ch, c) { return '<span class="lg-glyph" style="color:' + c + '">' + ch + '</span>'; }
    function lrow(swatch, label) { return '<div>' + swatch + label + '</div>'; }
    function fromMap(obj, swatchFn) { return Object.keys(obj).map(function (k) { return lrow(swatchFn(obj[k]), k); }).join(''); }

    /* ---- Layers tab: grouped toggles with legends ---- */
    const GROUPS = [
        ['Systems & markers', [
            ['systems', 'Systems',
                lrow(dot('rgba(255,251,1,1)', 'rgba(35,35,35,1)'), 'Star System') +
                lrow(dot('rgba(0,0,0,1)', 'rgba(231,200,47,1)'), 'System With No Star')],
            ['systemNames', 'System Names', '<div>Zoom in to reveal more names</div>'],
            ['mining', 'Mining Systems', lrow(glyph('◆', '#ae0900'), 'Mining system')],
            ['industrial', 'Industrial Systems', lrow(glyph('▲', '#ae0900'), 'Industrial system')],
            ['core', 'Core Systems', lrow(glyph('■', '#daa520'), 'Core system')],
            ['capital', 'Capital Systems', lrow(glyph('★', '#daa520'), 'Capital system')]
        ]],
        ['Regions', [
            ['regions', 'Regions', fromMap(NATION_COLORS, box)],
            ['diplomacy', 'Diplomacy', fromMap(RELATION_COLORS, box)]
        ]],
        ['Lines & borders', [
            ['subregions', 'Subregions', lrow(line('rgba(150,150,150,1)'), 'Subdivision borders')],
            ['lanes', 'Lanes',
                lrow(line('rgba(229,229,229,1)'), 'Operational') +
                lrow(line('rgba(60,60,60,1)'), 'In Developement')],
            ['characters', 'Character Journey', fromMap(CHARACTER_COLORS, line)]
        ]],
        ['Background', [
            ['basemap', 'Star-field Basemap', '<div>Nebula / star-field backdrop image</div>']
        ]]
    ];

    const layersTab = document.getElementById('layersTab');
    GROUPS.forEach(function (group) {
        const title = document.createElement('div');
        title.className = 'layerGroupTitle';
        title.textContent = group[0];
        layersTab.appendChild(title);
        group[1].forEach(function (item) {
            const layer = layers[item[0]];
            if (!layer) return;
            const lbl = document.createElement('label');
            lbl.className = 'layerToggle';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = layer.getVisible();
            cb.addEventListener('change', function () { layer.setVisible(cb.checked); });
            const nm = document.createElement('span');
            nm.className = 'lt-name';
            nm.textContent = item[1];
            lbl.appendChild(cb);
            lbl.appendChild(nm);
            layersTab.appendChild(lbl);
            if (item[2]) {
                const lg = document.createElement('div');
                lg.className = 'lt-legend';
                lg.innerHTML = item[2];
                layersTab.appendChild(lg);
            }
        });
    });

    /* ---- Fullscreen control (fullscreen the whole app, not just the map) ---- */
    map.addControl(new ol.control.FullScreen({ source: document.getElementById('app') }));

    /* ---- URL hash sync (Leaflet-compatible #zoom/lat/lng) ---- */
    function applyHash() {
        const m = location.hash.match(/^#(\d+\.?\d*)\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/);
        if (!m) return;
        view.setZoom(parseFloat(m[1]));
        view.setCenter(ol.proj.fromLonLat([parseFloat(m[3]), parseFloat(m[2])]));
    }
    let hashTimer;
    function updateHash() {
        clearTimeout(hashTimer);
        hashTimer = setTimeout(function () {
            const c = ol.proj.toLonLat(view.getCenter());
            const z = Math.round(view.getZoom() * 100) / 100;
            history.replaceState(null, '', '#' + z + '/' + c[1].toFixed(4) + '/' + c[0].toFixed(4));
        }, 200);
    }
    applyHash();
    map.on('moveend', updateHash);
    window.addEventListener('hashchange', applyHash);
})();
