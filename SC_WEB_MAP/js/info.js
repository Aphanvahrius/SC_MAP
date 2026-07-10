'use strict';
/*
 * Info ("i") button — opens the About / help panel.
 *
 * NOTE: the panel's CONTENT is plain HTML in index.html (the #sc-info-overlay block),
 * so it can be edited by hand. To add links, drop more <li><a …></li> items into the
 * <ul class="sc-info-links"> there. This file only creates the button and wires up
 * open/close, plus sizing/alignment to the fullscreen control.
 */
(function () {
    const mapEl = document.getElementById('map');
    const overlay = document.getElementById('sc-info-overlay');
    if (!mapEl || !overlay) return;

    /* ---- button (top-right, aligned under the fullscreen control) ---- */
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-info-btn';
    btn.title = 'About this map';
    btn.setAttribute('aria-label', 'About this map');
    btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/>' +
        '<line x1="12" y1="11" x2="12" y2="16.5"/>' +
        '<circle cx="12" cy="7.4" r="1.1" fill="currentColor" stroke="none"/></svg>';
    mapEl.appendChild(btn);

    /* ---- open / close ---- */
    function open() { overlay.classList.add('open'); }
    function close() { overlay.classList.remove('open'); }
    btn.addEventListener('click', function (e) { e.preventDefault(); open(); });
    const closeBtn = overlay.querySelector('.sc-info-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });  // backdrop click
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    /* ---- size + align the button to the OpenLayers fullscreen control (pixel-perfect) ---- */
    const CTRL_GAP = 4;   // keep identical to search.js so both gaps match exactly
    function alignToFullscreen() {
        const f = document.querySelector('.ol-full-screen button');
        if (!f) return;
        const fr = f.getBoundingClientRect(), mr = mapEl.getBoundingClientRect();
        if (!fr.width || !mr.width) return;   // mid-layout / hidden (3-D mode): keep last position
        btn.style.width = fr.width + 'px';
        btn.style.height = fr.height + 'px';
        btn.style.right = (mr.right - fr.right) + 'px';          // match the fullscreen button's right edge
        btn.style.left = 'auto';
        btn.style.top = (fr.bottom - mr.top + CTRL_GAP) + 'px';  // sit CTRL_GAP below the fullscreen control
    }
    // layout timing is hostile (async OL controls, @media flips) — retry in bursts
    function scheduleAlign() {
        [0, 120, 400].forEach(function (t) { setTimeout(alignToFullscreen, t); });
    }
    requestAnimationFrame(alignToFullscreen);
    window.addEventListener('resize', scheduleAlign);
    document.addEventListener('fullscreenchange', scheduleAlign);
    if (window.SC && SC.map) SC.map.once('rendercomplete', scheduleAlign);
})();
