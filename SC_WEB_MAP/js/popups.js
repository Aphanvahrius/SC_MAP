'use strict';
/*
 * Click-to-open popups, ported from the Leaflet popups.js.
 * Interactive layers: regions, lanes, systems, characters, diplomacy.
 * (Subregions and the special-system overlays are non-interactive, as in the original.)
 */
(function () {
    const map = window.SC.map;

    // --- popup overlay ---
    const container = document.getElementById('popup');
    const content = document.getElementById('popup-content');
    const closer = document.getElementById('popup-closer');
    const overlay = new ol.Overlay({
        element: container,
        stopEvent: true,
        autoPan: { animation: { duration: 200 } }
    });
    map.addOverlay(overlay);
    closer.onclick = function () { overlay.setPosition(undefined); closer.blur(); return false; };

    // --- helpers ---
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    // labeled row (skipped when the value is empty/null). `label` is a trusted hardcoded
    // string and may contain markup (e.g. <br>); only the data `value` is escaped.
    // Optional `cls` adds a class to the <tr>.
    function row(label, value, cls) {
        if (value == null || value === '') return '';
        return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + label +
            '</th><td>' + esc(value) + '</td></tr>';
    }
    // like row(), but `html` is trusted markup the caller has already escaped as needed.
    function rowHtml(label, html) {
        if (!html) return '';
        return '<tr><th scope="row">' + label + '</th><td>' + html + '</td></tr>';
    }
    // full-width tag row (for system-type flags)
    function tag(id, text) { return '<tr><td class="sys-tag" id="' + id + '" colspan="2">' + esc(text) + '</td></tr>'; }

    // --- ruler spoiler mechanism (ported) ---
    const SPOILER_RULERS = ['Celestia Astraea Psi', 'The Pirate King', 'The Council', 'God of the Drakar'];
    function rulerRow(ruler) {
        ruler = ruler || '';
        if (SPOILER_RULERS.indexOf(ruler) !== -1) {
            // Celestia shows a decoy name first; others just show the chip. Reveal swaps in the real ruler.
            const decoy = ruler === 'Celestia Astraea Psi' ? 'Fleet Admiral Wilkes ' : '';
            return '<tr><th scope="row">Ruler</th><td class="ruler-cell" data-real="' + esc(ruler) + '">' +
                decoy + '<span class="spoiler" onclick="scRevealSpoiler(this)">SPOILER</span></td></tr>';
        }
        return row('Ruler', ruler);
    }
    window.scRevealSpoiler = function (span) {
        const td = span.closest('.ruler-cell');
        if (td) td.innerHTML = td.getAttribute('data-real');
    };

    // --- per-layer content builders (keyed by layer id) ---
    const builders = {
        regions: function (f) {
            return row('Region', f.get('Nation')) + rulerRow(f.get('Ruler'));
        },
        lanes: function (f) {
            return row('Region', f.get('Nation')) + row('Lane Status', f.get('Status')) + row('Lane Type', f.get('Type'));
        },
        characters: function (f) {
            return row('Character', f.get('Character')) + row('Book', f.get('Book')) + row('Travel Date', f.get('Date'));
        },
        diplomacy: function (f) {
            const rel = f.get('Relation');
            return row('Nation', f.get('Neighbor')) + row('Relation Status', rel === 'Self' ? 'Our Country' : rel);
        },
        systems: function (f) {
            const special = f.get('Capital') || f.get('Core_Sys') || f.get('Idustr_Sys') ||
                f.get('Mining_Sys') || f.get('Fuel_Depot') || f.get('Mt_Base');
            let h = '';
            if (!special) h += tag('Regular_Sys', 'Regular System');
            if (f.get('Capital'))    h += tag('Capital', 'Capital System');
            if (f.get('Core_Sys'))   h += tag('Core_Sys', 'Core System');
            if (f.get('Idustr_Sys')) h += tag('Idustr_Sys', 'Industrial System');
            if (f.get('Mining_Sys')) h += tag('Mining_Sys', 'Mining System');
            if (f.get('Fuel_Depot')) h += tag('Fuel_Depot', 'Fuel Depot');
            if (f.get('Mt_Base'))    h += tag('Mt_Base', 'Maintenance Base');
            if (f.get('Homeworld'))  h += tag('Homeworld', 'Homeworld of Humanity');
            if (f.get('Unsurv_bod')) h += tag('Unsurv_bod', 'Unsurveyed Bodies');
            const nm = f.get('System_Nam');
            if (nm) h += rowHtml('System Name', '<span class="sys-name-val">' + esc(nm) + '</span>');
            h += row('Star Presence', f.get('Star_Presc') !== '0' ? 'Yes' : 'No');
            h += row('Inhabitable Worlds', f.get('Inhabitabl'));
            h += row('Orbitals / Colonies', f.get('Orbtl_Clny'));
            h += row('Minable Bodies /<br>Rogue Planets', f.get('Notbl_Minb'), 'row-center');
            h += row('Unexplored Lanes', f.get('Unexplored'));
            return h;
        }
    };

    // --- single-click handler: 'singleclick' (not 'click') so it does NOT fire during a
    //     double-click — that keeps double-click free for the diplomacy perspective switch ---
    map.on('singleclick', function (evt) {
        let html = null;
        map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
            const id = layer && layer.get('id');
            if (builders[id]) {
                const inner = builders[id](feature);
                if (inner) { html = '<table class="sc-popup-table">' + inner + '</table>'; return true; }
            }
            return false;
        }, { hitTolerance: 5 });

        if (html) {
            content.innerHTML = html;
            overlay.setPosition(evt.coordinate);
        } else {
            overlay.setPosition(undefined);
        }
    });

})();
