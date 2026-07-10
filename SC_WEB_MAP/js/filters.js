'use strict';
/*
 * Filter engine (ported from the Leaflet filterFunc).
 * Filtering is done through the layers' style functions: a filtered-out feature gets a
 * null style (hidden) — no source rebuild, so it stays fast even with the cached styles.
 *
 * Multi-value filters are checkbox groups (the planned improvement over the native
 * <select multiple>); numeric ranges use noUiSlider. A filter only affects layers that
 * actually carry its property — except Nation, which deliberately skips Diplomacy
 * (that layer shows relations, not ownership).
 */
(function () {
    const layers = SC.layers;

    // ---- filter state ----
    const F = {
        Nation: new Set(), Book: new Set(), Character: new Set(),
        Star_Presc: new Set(), Unsurv_bod: new Set(), New_Lane: new Set(),
        Type: new Set(), Status: new Set(),
        Orbtl_Clny: null,   // [min, max] when active
        Inhabitabl: null
    };

    // ---- predicate consulted by every layer's style function (see main.js) ----
    window.SC_passes = function (feature, layerId) {
        function setOk(key, skipLayer) {
            const set = F[key];
            if (!set.size) return true;
            if (skipLayer && layerId === skipLayer) return true;
            const v = feature.get(key);
            if (v === undefined) return true;          // this layer doesn't have the field
            return set.has(v);
        }
        function rangeOk(key) {
            const r = F[key];
            if (!r) return true;
            const v = feature.get(key);
            if (v === undefined) return true;
            let n = parseInt(v, 10); if (isNaN(n)) n = 0;
            return n >= r[0] && n <= r[1];
        }
        // Diplomacy: show only the chosen viewpoint nation's relations (perspective set by double-click)
        if (layerId === 'diplomacy' && feature.get('Nation') !== window.SC_diplomacyPerspective) return false;
        if (!setOk('Nation', 'diplomacy')) return false;   // the Nation multi-select skips Diplomacy
        if (!setOk('Book')) return false;
        // Character: with nothing selected, hide ALL character features (not show all)
        {
            const ch = feature.get('Character');
            if (ch !== undefined && (!F.Character.size || !F.Character.has(ch))) return false;
        }
        if (!setOk('Star_Presc')) return false;
        if (!setOk('Unsurv_bod')) return false;
        if (!setOk('New_Lane')) return false;
        if (!setOk('Type')) return false;
        if (!setOk('Status')) return false;
        if (!rangeOk('Orbtl_Clny')) return false;
        if (!rangeOk('Inhabitabl')) return false;
        return true;
    };

    // ---- re-render filterable layers (debounced for rapid slider drags) ----
    // Includes the two label layers (systemNames, distanceLabels) so their labels also
    // honour the active filters live; both are created by the time refresh() first runs.
    const FILTERABLE = ['regions', 'diplomacy', 'lanes', 'characters', 'systems', 'mining',
        'industrial', 'core', 'capital', 'systemNames', 'distanceLabels'];
    let timer;
    function refresh() {
        clearTimeout(timer);
        timer = setTimeout(function () {
            FILTERABLE.forEach(function (id) { if (layers[id]) layers[id].changed(); });
        }, 60);
    }

    // ---- UI builders ----
    // Per-filter API registry (programmatic set/reset — used by the 3-D view sync
    // and the global "Reset all filters" button).
    const FILTER_API = {};

    function clearBtn(onClick) {
        const b = document.createElement('button'); b.className = 'filter-clear'; b.textContent = 'clear';
        b.addEventListener('click', onClick); return b;
    }

    function checkboxFilter(container, label, stateKey, options, defaults, requireOne) {
        defaults = defaults || [];
        defaults.forEach(function (v) { F[stateKey].add(v); });   // seed default selection
        const wrap = document.createElement('div'); wrap.className = 'filter-block';
        const head = document.createElement('div'); head.className = 'filter-label';
        const title = document.createElement('span'); title.className = 'filter-label-text'; title.textContent = label;
        head.appendChild(title);
        wrap.appendChild(head);
        const boxes = [];
        options.forEach(function (opt) {
            const row = document.createElement('label'); row.className = 'filter-check';
            const cb = document.createElement('input'); cb.type = 'checkbox';
            cb.checked = defaults.indexOf(opt.value) !== -1;
            cb.addEventListener('change', function () {
                if (cb.checked) {
                    F[stateKey].add(opt.value);
                } else {
                    // requireOne: never allow unchecking the last remaining box
                    if (requireOne && F[stateKey].size <= 1) { cb.checked = true; return; }
                    F[stateKey].delete(opt.value);
                }
                refresh();
            });
            boxes.push({ cb: cb, value: opt.value });
            const span = document.createElement('span'); span.textContent = opt.label || opt.value;
            row.appendChild(cb); row.appendChild(span); wrap.appendChild(row);
        });
        function setValues(vals) {
            F[stateKey] = new Set(vals);
            boxes.forEach(function (b) { b.cb.checked = vals.indexOf(b.value) !== -1; });
            refresh();
        }
        FILTER_API[stateKey] = { set: setValues, reset: function () { setValues(defaults.slice()); } };
        head.appendChild(clearBtn(FILTER_API[stateKey].reset));
        container.appendChild(wrap);
    }

    /* Two-ended book range (A1…A5) — replaces the old checkbox Book filter. */
    const BOOK_LIST = ['A1', 'A2', 'A3', 'A4', 'A5'];
    function bookRangeFilter(container) {
        const wrap = document.createElement('div'); wrap.className = 'filter-block';
        const head = document.createElement('div'); head.className = 'filter-label';
        const title = document.createElement('span'); title.className = 'filter-label-text';
        title.innerHTML = 'BOOK <span class="filter-val"></span>';
        head.appendChild(title);
        wrap.appendChild(head);
        const sl = document.createElement('div'); sl.className = 'filter-slider'; wrap.appendChild(sl);
        container.appendChild(wrap);
        noUiSlider.create(sl, {
            start: [1, 1], connect: true, step: 1,
            range: { min: 1, max: BOOK_LIST.length }, format: wNumb({ decimals: 0 })
        });
        const valEl = head.querySelector('.filter-val');
        sl.noUiSlider.on('update', function (values) {
            const lo = parseInt(values[0], 10), hi = parseInt(values[1], 10);
            valEl.textContent = lo === hi ? BOOK_LIST[lo - 1] : BOOK_LIST[lo - 1] + ' – ' + BOOK_LIST[hi - 1];
            F.Book = new Set(BOOK_LIST.slice(lo - 1, hi));
            refresh();
        });
        FILTER_API.Book = {
            set: function (lo, hi) { sl.noUiSlider.set([lo, hi]); },
            get: function () {
                const v = sl.noUiSlider.get();
                return [parseInt(v[0], 10), parseInt(v[1], 10)];
            },
            reset: function () { sl.noUiSlider.set([1, 1]); }
        };
        head.appendChild(clearBtn(FILTER_API.Book.reset));
    }

    function sliderFilter(container, label, stateKey, min, max, note) {
        // (reset registration happens at the bottom of this function)
        const wrap = document.createElement('div'); wrap.className = 'filter-block';
        const head = document.createElement('div'); head.className = 'filter-label';
        const title = document.createElement('span'); title.className = 'filter-label-text';
        title.innerHTML = label + ' <span class="filter-val"></span>';
        head.appendChild(title);
        wrap.appendChild(head);
        const sl = document.createElement('div'); sl.className = 'filter-slider'; wrap.appendChild(sl);
        if (note) { const n = document.createElement('div'); n.className = 'filter-note'; n.textContent = note; wrap.appendChild(n); }
        container.appendChild(wrap);
        noUiSlider.create(sl, {
            start: [min, max], connect: true, step: 1,
            range: { min: min, max: max }, format: wNumb({ decimals: 0 })
        });
        const valEl = head.querySelector('.filter-val');
        sl.noUiSlider.on('update', function (values) {
            const lo = parseInt(values[0], 10), hi = parseInt(values[1], 10);
            valEl.textContent = lo + ' – ' + hi;
            F[stateKey] = (lo <= min && hi >= max) ? null : [lo, hi];
            refresh();
        });
        FILTER_API[stateKey] = { reset: function () { sl.noUiSlider.set([min, max]); } };
        head.appendChild(clearBtn(FILTER_API[stateKey].reset));
    }

    // ---- Main tab ----
    const mainTab = document.getElementById('mainTab'); mainTab.innerHTML = '';
    checkboxFilter(mainTab, 'REGION', 'Nation', [
        { value: 'Corporate Systems' }, { value: 'Duchy of Drakar' }, { value: 'Duchy of Meltisar' },
        { value: 'Free Planets Alliance' }, { value: 'Ghost Sector' }, { value: 'Holy Ertan Republic' },
        { value: 'Solar Imperium' }, { value: 'Solarian Federation' }, { value: 'Starlight Revolution' },
        { value: 'The Western Frontier Systems' }
    ]);
    bookRangeFilter(mainTab);
    checkboxFilter(mainTab, 'CHARACTER', 'Character', [{ value: 'Abbey' }, { value: 'Alex' }, { value: 'Elis' }, { value: 'Thea' }, { value: 'Tia' }]);
    checkboxFilter(mainTab, 'STAR PRESENCE IN SYSTEM', 'Star_Presc', [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]);

    // ---- Other tab ----
    const otherTab = document.getElementById('otherTab'); otherTab.innerHTML = '';
    sliderFilter(otherTab, 'ORBITALS / COLONIES', 'Orbtl_Clny', 0, 258,
        'Number of orbitals and/or colonies on uninhabitable bodies.');
    sliderFilter(otherTab, 'INHABITABLE WORLDS', 'Inhabitabl', 0, 4);
    checkboxFilter(otherTab, 'SYSTEMS WITH UNSURVEYED BODIES', 'Unsurv_bod', [{ value: '1', label: 'Show' }]);
    checkboxFilter(otherTab, 'SYSTEMS RESEARCHING A NEW STARLINE', 'New_Lane', [{ value: '1', label: 'Show' }]);
    checkboxFilter(otherTab, 'STARLANE TYPE', 'Type', [{ value: 'International' }, { value: 'National' }]);
    checkboxFilter(otherTab, 'STARLANE STATUS', 'Status', [{ value: 'In Developement', label: 'In Development' }, { value: 'Operational' }]);

    // ---- cross-view filter API (used by the 3-D module + Reset-all buttons) ----
    window.SC_filters = {
        getBookRange: function () { return FILTER_API.Book.get(); },
        setBookRange: function (lo, hi) { FILTER_API.Book.set(lo, hi); },
        getCharacters: function () { return Array.from(F.Character); },
        setCharacters: function (arr) { FILTER_API.Character.set(arr); },
        /* Reset EVERY filter in this (2-D) view to its default. */
        reset2D: function () {
            Object.keys(FILTER_API).forEach(function (k) { FILTER_API[k].reset(); });
        }
    };
    /* Global reset across both views (the 3-D module registers SC_reset3D). */
    window.SC_resetAllFilters = function () {
        window.SC_filters.reset2D();
        if (window.SC_reset3D) window.SC_reset3D();
    };

    // "Reset all filters" button at the bottom of the Main tab
    const resetBtn = document.createElement('button');
    resetBtn.className = 'sc-resetall';
    resetBtn.textContent = 'Reset all filters';
    resetBtn.title = 'Resets every filter in both the 2D and 3D views to its default';
    resetBtn.addEventListener('click', window.SC_resetAllFilters);
    mainTab.appendChild(resetBtn);
})();
