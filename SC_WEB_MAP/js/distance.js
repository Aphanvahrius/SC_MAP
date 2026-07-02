'use strict';
/*
 * Real-Distances 3-D tool (ported from the Leaflet handleSystemSelection).
 * Pick a "FROM" system; every system is labelled with its straight-line 3-D distance
 * computed from the real X/Y/Z star coordinates (the origin reads "You").
 *
 * The labels live on their own layer with declutter:true — so they stay readable and
 * non-overlapping (more appear as you zoom in), which is the fix for the old
 * "too small / overlapping" problem.
 */
(function () {
    const map = SC.map, layers = SC.layers;
    window.SC_distanceFrom = null;   // { name, X, Y, Z } or null

    function dist3d(feature, from) {
        const dx = from.X - parseFloat(feature.get('X'));
        const dy = from.Y - parseFloat(feature.get('Y'));
        const dz = from.Z - parseFloat(feature.get('Z'));
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const HALO = new ol.style.Stroke({ color: '#ffffff', width: 3 });
    const FILL = new ol.style.Fill({ color: '#101018' });
    const YOU_FILL = new ol.style.Fill({ color: '#13306e' });

    function labelStyle(feature) {
        const from = window.SC_distanceFrom;
        if (!from) return null;
        if (window.SC_passes && !window.SC_passes(feature, 'systems')) return null;   // respect filters
        const you = feature.get('System_Nam') === from.name;
        return new ol.style.Style({
            text: new ol.style.Text({
                text: you ? 'You' : dist3d(feature, from).toFixed(1),
                font: (you ? 'bold 15px' : 'bold 12px') + ' "Helvetica Neue", Arial, sans-serif',
                offsetY: -13,
                fill: you ? YOU_FILL : FILL,
                stroke: HALO
            })
        });
    }

    // dedicated, decluttered label layer sharing the systems' features
    const labelLayer = new ol.layer.Vector({
        source: layers.systems.getSource(),
        style: labelStyle,
        declutter: true,
        zIndex: 360,
        updateWhileAnimating: true,
        updateWhileInteracting: true
    });
    labelLayer.set('id', 'distance-labels');
    map.addLayer(labelLayer);
    SC.layers.distanceLabels = labelLayer;

    /* ---- Real Distances tab UI ---- */
    const tab = document.getElementById('distancesTab');
    tab.innerHTML = '';
    const head = document.createElement('div'); head.className = 'filter-label';
    const title = document.createElement('span'); title.className = 'filter-label-text'; title.textContent = 'FROM';
    head.appendChild(title);
    tab.appendChild(head);
    const hint = document.createElement('div'); hint.className = 'dist-hint';
    hint.textContent = 'straight-line 3-D distance from the chosen system · zoom in for more labels';
    tab.appendChild(hint);

    const select = document.createElement('select'); select.id = 'distance-from'; select.className = 'dist-select';
    const none = document.createElement('option'); none.value = ''; none.textContent = '— none —';
    select.appendChild(none);
    tab.appendChild(select);

    select.addEventListener('change', function () {
        const name = select.value;
        if (!name) {
            window.SC_distanceFrom = null;
        } else {
            const f = layers.systems.getSource().getFeatures().find(function (ft) { return ft.get('System_Nam') === name; });
            window.SC_distanceFrom = f ? { name: name, X: parseFloat(f.get('X')), Y: parseFloat(f.get('Y')), Z: parseFloat(f.get('Z')) } : null;
        }
        labelLayer.changed();
        // names yield to distances (and return when cleared) — refresh the names layer too
        if (layers.systemNames) layers.systemNames.changed();
    });

    function populate() {
        const feats = layers.systems.getSource().getFeatures();
        if (!feats.length) return false;
        feats.map(function (f) { return f.get('System_Nam'); })
            .filter(Boolean)
            .sort()
            .forEach(function (n) {
                const o = document.createElement('option'); o.value = n; o.textContent = n; select.appendChild(o);
            });
        return true;
    }
    if (!populate()) layers.systems.getSource().once('featuresloadend', populate);
})();
