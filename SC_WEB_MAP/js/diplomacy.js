'use strict';
/*
 * Diplomacy perspective.
 * The Diplomacy layer shows relations from ONE viewpoint nation at a time (its own
 * territory is "Self" in blue, neighbours coloured by their relation to it). The Book
 * filter still selects the time slice. The viewpoint is chosen by DOUBLE-CLICKING a
 * nation's territory (switches to that nation's perspective); a single click still
 * opens the normal popup. (Replaces the old reliance on the multi-select Region filter,
 * which can't express a single perspective.)
 */
(function () {
    const map = SC.map, view = SC.view, layers = SC.layers;

    // default viewpoint (the protagonist's nation); change here if desired
    window.SC_diplomacyPerspective = 'The Western Frontier Systems';

    const indicator = document.getElementById('diplomacy-indicator');
    function updateIndicator() {
        if (layers.diplomacy.getVisible()) {
            indicator.style.display = 'block';
            indicator.innerHTML = 'Diplomacy — viewpoint: <b>' + window.SC_diplomacyPerspective + '</b>' +
                '<br><span>double-click a nation to switch perspective</span>';
        } else {
            indicator.style.display = 'none';
        }
    }
    layers.diplomacy.on('change:visible', updateIndicator);
    updateIndicator();

    function setPerspective(nation) {
        if (!nation || nation === window.SC_diplomacyPerspective) return;
        window.SC_diplomacyPerspective = nation;
        layers.diplomacy.changed();   // re-render with the new viewpoint
        updateIndicator();
    }
    window.SC_setDiplomacyPerspective = setPerspective;

    // Replace the default double-click-zoom: over the Diplomacy layer it switches
    // perspective instead; everywhere else it still zooms in.
    map.getInteractions().getArray().slice().forEach(function (i) {
        if (i instanceof ol.interaction.DoubleClickZoom) map.removeInteraction(i);
    });

    map.on('dblclick', function (evt) {
        let dip = null;
        if (layers.diplomacy.getVisible()) {
            map.forEachFeatureAtPixel(evt.pixel, function (f, layer) {
                if (layer && layer.get('id') === 'diplomacy') { dip = f; return true; }
                return false;
            }, { hitTolerance: 3 });
        }
        if (dip) {
            setPerspective(dip.get('Neighbor'));   // Neighbor == the clicked territory's nation
            const ov = map.getOverlays().getArray()[0];
            if (ov) ov.setPosition(undefined);     // dismiss any popup the clicks opened
        } else {
            view.animate({ zoom: Math.min((view.getZoom() || 10) + 1, view.getMaxZoom()), center: evt.coordinate, duration: 250 });
        }
    });
})();
