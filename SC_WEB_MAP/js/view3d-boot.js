'use strict';
/*
 * 3-D star-view bootstrap (classic script — the rest of the app stays non-module).
 * Adds the 2D/3D switch, System Catalog, and the 3-D-mode fullscreen/info buttons,
 * plus the #view3d container; lazy-loads the actual Three.js module
 * (js/view3d/view3d.js) on first activation.
 *
 * BUTTON LAYOUT (both views) also lives here. Every overlay button gets its SIZE
 * from a hidden "probe" styled like an OpenLayers control button, so OL's CSS —
 * including the mobile @media size bump — is the single source of truth. To
 * change button sizing globally, change the `.ol-control button` rules in
 * css/style.css / lib/ol.css; everything follows automatically.
 * Right-side column order in both views: fullscreen, info, 2D/3D switch, catalog
 * (the first two are the OL control + info.js in 2-D, and our twins in 3-D — only
 * the switch changes between views).
 */
(function () {
    const mapCol = document.getElementById('map-col');
    const mapDiv = document.getElementById('map');

    const host = document.createElement('div');
    host.id = 'view3d';
    mapCol.insertBefore(host, mapDiv.nextSibling);

    /* ---- buttons ---- */
    function mkBtn(id, html, title) {
        const b = document.createElement('button');
        b.id = id;
        b.type = 'button';
        b.title = title;
        b.innerHTML = html;
        mapCol.appendChild(b);
        return b;
    }
    const btn = mkBtn('v3d-switch', '3D', 'Switch between the 2-D map and the 3-D star view');
    const cat = mkBtn('v3d-catalog', '☰', 'Open the System Catalog');
    const fsB = mkBtn('v3d-fs', '⤢', 'Toggle full-screen');
    const infoB = mkBtn('v3d-info3d',
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/>' +
        '<line x1="12" y1="11" x2="12" y2="16.5"/>' +
        '<circle cx="12" cy="7.4" r="1.1" fill="currentColor" stroke="none"/></svg>',
        'About this map');

    cat.addEventListener('click', function () { window.open('catalog.html', '_blank'); });
    fsB.addEventListener('click', function () {
        const app = document.getElementById('app');
        if (document.fullscreenElement) document.exitFullscreen();
        else if (app.requestFullscreen) app.requestFullscreen();
    });
    infoB.addEventListener('click', function () {
        const ov = document.getElementById('sc-info-overlay');
        if (ov) ov.classList.add('open');
    });

    /* ---- size probe: an invisible OL-style control button, always measurable ---- */
    const probe = document.createElement('div');
    probe.className = 'ol-control';
    probe.style.cssText = 'visibility:hidden;pointer-events:none;position:absolute;left:-9999px;top:0;';
    const probeBtn = document.createElement('button');
    probeBtn.type = 'button';
    probe.appendChild(probeBtn);
    mapCol.appendChild(probe);

    let mod = null, loading = false, active = false;

    /* ---- unified layout ---- */
    const GAP = 4;
    function probeSize() {
        const r = probeBtn.getBoundingClientRect();
        return { w: r.width || 22, h: r.height || 22 };
    }
    function setBox(b, top, right, s) {
        b.style.width = s.w + 'px';
        b.style.height = s.h + 'px';
        b.style.top = top + 'px';
        b.style.right = right + 'px';
        b.style.left = 'auto';
    }
    function layout() {
        const s = probeSize();
        const colR = mapCol.getBoundingClientRect();
        if (!colR.width) return;
        if (active) {
            // 3-D: full column pinned to the view's top-right corner
            const top0 = host.offsetTop + 8;
            [fsB, infoB, btn, cat].forEach(function (b, i) {
                b.style.display = 'block';
                setBox(b, top0 + i * (s.h + GAP), 10, s);
            });
            const gear = document.querySelector('.v3d-gear');
            if (gear) { gear.style.width = s.w + 'px'; gear.style.height = s.h + 'px'; }
        } else {
            // 2-D: OL fullscreen + info.js provide the first two slots; the switch
            // and catalog take slots 3 and 4 below them
            fsB.style.display = 'none';
            infoB.style.display = 'none';
            btn.style.display = 'block';
            cat.style.display = 'block';
            let r = null, anchorIsInfo = false;
            const infoBtn2d = document.querySelector('.sc-info-btn');
            if (infoBtn2d) {
                const rr = infoBtn2d.getBoundingClientRect();
                if (rr.width) { r = rr; anchorIsInfo = true; }
            }
            if (!r) {
                const fsOl = document.querySelector('.ol-full-screen button');
                if (fsOl) {
                    const rr = fsOl.getBoundingClientRect();
                    if (rr.width) r = rr;
                }
            }
            let right = 9, top = 8 + 2 * (s.h + GAP) + 3;      // fallback before OL renders
            if (r) {
                right = colR.right - r.right;
                top = r.bottom - colR.top + GAP;
                if (!anchorIsInfo) top += s.h + GAP;           // skip the info slot
            }
            setBox(btn, top, right, s);
            setBox(cat, top + s.h + GAP, right, s);
        }
    }
    /* Layout timing is hostile (OL controls render async, @media flips, fullscreen
     * transitions, dev-tools resizes mid-switch) — always run a burst of retries. */
    let layoutTimers = [];
    function scheduleLayout() {
        layoutTimers.forEach(clearTimeout);
        layoutTimers = [0, 120, 400].map(function (t) { return setTimeout(layout, t); });
    }
    window.addEventListener('resize', scheduleLayout);
    document.addEventListener('fullscreenchange', scheduleLayout);
    if (window.SC && SC.map) SC.map.once('rendercomplete', scheduleLayout);
    scheduleLayout();

    /* ---- view switching ---- */
    function setActive(on) {
        active = on;
        mapDiv.style.display = on ? 'none' : '';
        host.classList.toggle('active', on);
        // The right sidebar swaps content: 2-D filter tabs ↔ the 3-D control panel
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('v3d-mode', on);
        btn.textContent = on ? '2D' : '3D';
        if (mod) { on ? mod.activate() : mod.deactivate(); }
        if (!on && window.SC && SC.map) {
            // OL had display:none while we were in 3-D — re-measure on return.
            requestAnimationFrame(function () { SC.map.updateSize(); });
        }
        scheduleLayout();
    }

    btn.addEventListener('click', function () {
        if (active) {
            // let the module play its reverse 2D↔3D morph before switching back
            if (mod && mod.beginExit) {
                btn.disabled = true;
                mod.beginExit(function () { btn.disabled = false; setActive(false); });
            } else {
                setActive(false);
            }
            return;
        }
        if (mod) { setActive(true); return; }
        if (loading) return;
        loading = true;
        btn.textContent = '…';
        import('./view3d/view3d.js')
            .then(function (m) { mod = m; return m.init(host); })
            .then(function () { loading = false; setActive(true); })
            .catch(function (err) {
                loading = false;
                btn.textContent = '3D';
                console.error('[ShipCore-3D] failed to start:', err);
                alert('Could not start the 3D view (see console): ' + err.message);
            });
    });
})();
