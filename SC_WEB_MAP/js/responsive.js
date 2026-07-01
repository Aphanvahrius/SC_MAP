'use strict';
/*
 * Responsive / mobile behaviour. On narrow screens (see the @media block in style.css)
 * the filter sidebar becomes an off-canvas drawer opened by a floating "Filters" button;
 * a dimming backdrop and an in-drawer close button dismiss it. Also keeps the OpenLayers
 * map correctly sized across window resizes and device rotations.
 */
(function () {
    const app = document.getElementById('app');
    const sidebar = document.getElementById('sidebar');
    const map = window.SC && SC.map;
    if (!app || !sidebar) return;

    /* floating "Filters" toggle (only visible on mobile via CSS) */
    const fab = document.createElement('button');
    fab.id = 'sc-filters-toggle';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Show filters');
    fab.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/>' +
        '<line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>' +
        '<circle cx="10" cy="7" r="2.3" fill="currentColor" stroke="none"/>' +
        '<circle cx="16" cy="12" r="2.3" fill="currentColor" stroke="none"/>' +
        '<circle cx="8" cy="17" r="2.3" fill="currentColor" stroke="none"/></svg>' +
        '<span>Filters</span>';
    app.appendChild(fab);

    /* dimming backdrop behind the open drawer */
    const backdrop = document.createElement('div');
    backdrop.id = 'sc-mobile-backdrop';
    app.appendChild(backdrop);

    /* close button inside the drawer (only visible on mobile via CSS) */
    const closeBtn = document.createElement('button');
    closeBtn.id = 'sc-sidebar-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close filters');
    closeBtn.innerHTML = '&times;';
    sidebar.appendChild(closeBtn);

    function closeDrawer() { app.classList.remove('sidebar-open'); }
    fab.addEventListener('click', function () { app.classList.toggle('sidebar-open'); });
    backdrop.addEventListener('click', closeDrawer);
    closeBtn.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    /* keep the map sized on viewport changes / rotation */
    if (map) {
        let rt;
        window.addEventListener('resize', function () {
            clearTimeout(rt);
            rt = setTimeout(function () { map.updateSize(); }, 120);
        });
        window.addEventListener('orientationchange', function () {
            setTimeout(function () { map.updateSize(); }, 200);
        });
    }
})();
