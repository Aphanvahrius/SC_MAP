'use strict';
/*
 * System search — a magnifying-glass button at the map's top-left that expands into a
 * text box with native autocomplete (a <datalist> of every system name). Matching
 * options narrow as you type; pick one from the list (flies immediately) or finish
 * typing manually and press Enter to fly the view to that system. Esc / the button
 * closes the box.
 *
 * (System names are unique with no prefix collisions, so an exact full match is always
 * unambiguous — that's why selecting/typing a complete name can navigate on its own.)
 */
(function () {
    const map = SC.map, view = SC.view, layers = SC.layers;

    /* ---- build the control ---- */
    const wrap = document.createElement('div');
    wrap.className = 'sc-search';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-search-btn';
    btn.title = 'Find a system';
    btn.setAttribute('aria-label', 'Find a system');
    btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
        'stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/>' +
        '<line x1="15.5" y1="15.5" x2="21" y2="21"/></svg>';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sc-search-input';
    input.placeholder = 'Find a system…';
    input.setAttribute('list', 'sc-system-list');
    input.autocomplete = 'off';

    const datalist = document.createElement('datalist');
    datalist.id = 'sc-system-list';

    wrap.appendChild(btn);
    wrap.appendChild(input);
    wrap.appendChild(datalist);
    document.getElementById('map').appendChild(wrap);

    /* ---- open / close ---- */
    function open() { wrap.classList.add('open'); input.focus(); input.select(); }
    function close() { wrap.classList.remove('open'); }
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (wrap.classList.contains('open')) close(); else open();
    });

    /* ---- name → feature index (built once the systems load) ---- */
    const index = {};   // lowercased name -> feature

    /* ---- brief pulse highlight on the searched system (expanding, fading ring) ---- */
    const pulseAnchor = document.createElement('div');
    pulseAnchor.className = 'sc-pulse-anchor';
    const pulseRing = document.createElement('div');
    pulseRing.className = 'sc-pulse-ring';
    pulseAnchor.appendChild(pulseRing);
    const pulseOverlay = new ol.Overlay({ element: pulseAnchor, positioning: 'center-center', stopEvent: false });
    map.addOverlay(pulseOverlay);
    pulseRing.addEventListener('animationend', function () {
        pulseOverlay.setPosition(undefined);
        pulseRing.classList.remove('go');
    });
    function pulse(coord) {
        pulseOverlay.setPosition(coord);
        pulseRing.classList.remove('go');
        void pulseRing.offsetWidth;         // force reflow so the animation restarts each time
        pulseRing.classList.add('go');
    }

    function flyTo(f) {
        const coord = f.getGeometry().getCoordinates();
        view.animate(
            { center: coord, zoom: Math.max(view.getZoom(), 13), duration: 600 },
            function (done) { if (done) pulse(coord); }   // pulse once the view has settled
        );
        input.value = f.get('System_Nam');   // normalise to the canonical name
        input.classList.remove('sc-search-miss');
    }
    function exact(q) { return index[q.trim().toLowerCase()] || null; }
    function prefix(q) {
        q = q.trim().toLowerCase();
        if (!q) return null;
        const key = Object.keys(index).find(function (k) { return k.indexOf(q) === 0; });
        return key ? index[key] : null;
    }

    // typing/selecting a complete, exact name flies immediately
    input.addEventListener('input', function () {
        const f = exact(input.value);
        if (f) flyTo(f);
    });
    // Enter = explicit confirm: exact match, else the first prefix match; else flag a miss
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const f = exact(input.value) || prefix(input.value);
            if (f) { flyTo(f); }
            else if (input.value.trim()) {
                input.classList.add('sc-search-miss');
                setTimeout(function () { input.classList.remove('sc-search-miss'); }, 600);
            }
        } else if (e.key === 'Escape') {
            close();
        }
    });

    /* ---- populate the autocomplete list + index once the systems have loaded ---- */
    function populate() {
        const feats = layers.systems.getSource().getFeatures();
        if (!feats.length) return false;
        feats.slice()
            .filter(function (f) { return f.get('System_Nam'); })
            .sort(function (a, b) { return a.get('System_Nam').localeCompare(b.get('System_Nam')); })
            .forEach(function (f) {
                const n = f.get('System_Nam');
                index[n.toLowerCase()] = f;
                const o = document.createElement('option'); o.value = n; datalist.appendChild(o);
            });
        return true;
    }
    if (!populate()) layers.systems.getSource().once('featuresloadend', populate);

    /* ---- size + align the button to the OpenLayers zoom control (pixel-perfect) ---- */
    const CTRL_GAP = 4;   // vertical gap below the control — keep identical in info.js
    function alignToZoom() {
        const z = document.querySelector('.ol-zoom-out') || document.querySelector('.ol-zoom button');
        const mapEl = document.getElementById('map');
        if (!z || !mapEl) return;
        const zr = z.getBoundingClientRect(), mr = mapEl.getBoundingClientRect();
        btn.style.width = zr.width + 'px';
        btn.style.height = zr.height + 'px';
        wrap.style.left = (zr.left - mr.left) + 'px';            // match the zoom buttons' left edge
        wrap.style.top = (zr.bottom - mr.top + CTRL_GAP) + 'px'; // sit CTRL_GAP below the zoom control
    }
    requestAnimationFrame(alignToZoom);
    window.addEventListener('resize', alignToZoom);
    document.addEventListener('fullscreenchange', function () { setTimeout(alignToZoom, 60); });
    map.once('rendercomplete', alignToZoom);
})();
