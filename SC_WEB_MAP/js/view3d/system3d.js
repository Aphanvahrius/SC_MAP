'use strict';
/*
 * System close-up view (v2). Entered from a selected star's info panel
 * ("Enter system view"), exited with the Back button.
 *
 * Data: planets.json schema v2 — planets carry their own moons[] and
 * other_objects[]; the system carries other_objects[] too. Display rule: when
 * the system has BOOK bodies, only those are rendered; catalog exoplanets are
 * then only listed in the info panel (and rendered when no book bodies exist).
 *
 * Binaries: rendered when the system's `binary` field is set in planets.json
 * (editable in editor.html), when the spectral type contains '+', or when the
 * SIMBAD object type marks a multiple ('**', 'SB*', 'EB*'). Two modes:
 *   "close" (default) — the pair orbits its barycentre; planets are circumbinary.
 *   "far"             — planets orbit the primary; the companion sits on a slow,
 *                       distant orbit outside the outermost planet.
 *
 * EVERYTHING SPATIAL IS SCHEMATIC: distances, sizes, speeds are fabricated for
 * readability (the data has no orbital elements); star classes and body lists
 * are real. Scale: arbitrary "system units", NOT light-years.
 */
import * as THREE from 'three';
import { OrbitControls } from '../../lib/three/OrbitControls.js';
import { CLASSES, classify, friendlyObjectType } from './data3d.js';
import { buildRipple } from './fx3d.js';

/* ------------------------------- tuning knobs -------------------------------- */
const STAR_RADII = { O: 3.4, B: 3.0, A: 2.6, F: 2.3, G: 2.0, K: 1.7, M: 1.3, C: 1.9,
                     BD: 0.9, WD: 0.5, NS: 0.3, UNK: 1.8 };
const ORBIT_START_MUL = 8;      // first orbit = star radius × this
const ORBIT_SPACING = 1.6;      // each next orbit × this
const ORBIT_SPEED = 0.055;      // base angular speed (innermost planet)
const PLANET_SCALE = 0.62;      // global body-size damping ("less exaggerated")
const MOON_SPEED = 0.5;

/*
 * INFO-PANEL CONTENT — edit these two lists to change what the panels show.
 * Each row: [label, function(data) -> string|null]; null/'' rows are skipped.
 * `sys` rows get {star, comps, mode}; `obj` rows get the body record from
 * planets.json (name/source/type/status/first/description + catalog fields).
 */
const SYSTEM_PANEL_ROWS = [
    ['Type', function (d) {
        return friendlyObjectType(d.star.props.object_type) +
            (d.star.props.spectral_type ? ' <span class="v3d-dim">(' + d.star.props.spectral_type + ')</span>' : '');
    }],
    ['Stars', function (d) {
        return d.comps.length > 1
            ? d.comps.length + ' (binary, ' + (d.mode === 'far' ? 'distant companion' : 'close pair') + ')'
            : null;
    }],
    ['Distance from Sol', function (d) { return d.star.distSol.toFixed(1) + ' ly'; }],
    ['Planets shown', function (d) { return String(d.shown.length); }],
    ['Catalog exoplanets', function (d) {
        const c = d.star.bodies.catalogPlanets;
        if (!c.length) return null;
        return c.map(function (p) { return p.name; }).join(', ');
    }],
    ['Book mentions', function (d) {
        return d.star.mentions ? d.star.mentions.hits + '× — first: ' + d.star.mentions.first : null;
    }]
];
const OBJECT_PANEL_ROWS = [
    ['Type', function (o) { return o.type || (o.source === 'catalog' ? 'Confirmed exoplanet' : null); }],
    ['Status', function (o) { return o.status; }],
    ['First appears', function (o) { return o.first; }],
    ['Discovery', function (o) {
        return o.source === 'catalog'
            ? [o.method, o.year && Math.round(o.year)].filter(Boolean).join(', ') || null : null;
    }],
    ['Mass', function (o) { return o.mass_earth ? o.mass_earth.toFixed(1) + ' M⊕' : null; }],
    ['Radius', function (o) { return o.radius_earth ? o.radius_earth.toFixed(2) + ' R⊕' : null; }],
    ['Source', function (o) { return o.source === 'catalog' ? 'Exoplanet catalogs' : 'The books'; }]
];

/* ------------------------- animated star-surface shader ---------------------- */
const STAR_VERT = [
    'varying vec3 vPos; varying vec3 vNormal;',
    'void main() {',
    '  vPos = normalize(position);',
    '  vNormal = normalize(normalMatrix * normal);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
].join('\n');
const STAR_FRAG = [
    'uniform vec3 uColor; uniform float uTime;',
    'varying vec3 vPos; varying vec3 vNormal;',
    'float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
    'float noise(vec3 p) {',
    '  vec3 i = floor(p), f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),',
    '                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),',
    '             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),',
    '                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);',
    '}',
    'float fbm(vec3 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }',
    '  return v;',
    '}',
    'void main() {',
    '  float n1 = fbm(vPos * 4.0 + vec3(uTime * 0.045, 0.0, uTime * 0.03));',
    '  float n2 = fbm(vPos * 11.0 - vec3(0.0, uTime * 0.09, uTime * 0.055));',
    '  float n = n1 * 0.72 + n2 * 0.28;',
    '  vec3 col = uColor * (0.62 + 0.85 * n);',
    '  col += vec3(1.0, 0.92, 0.75) * pow(n, 3.5) * 0.9;',
    '  float limb = clamp(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);',
    '  col *= 0.45 + 0.55 * pow(limb, 0.6);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
].join('\n');

function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.07)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}

/* --------------------- procedural planet textures (canvas) ------------------- */
function mulberry(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
function planetTexture(kind, seed) {
    const rnd = mulberry(seed);
    const w = 256, h = 128;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (kind === 'giant') {
        const hue = 20 + rnd() * 40 + (rnd() < 0.3 ? 160 : 0);
        let y = 0;
        while (y < h) {
            const bh = 4 + rnd() * 14;
            const l = 38 + rnd() * 30;
            x.fillStyle = 'hsl(' + (hue + rnd() * 18 - 9) + ',' + (28 + rnd() * 25) + '%,' + l + '%)';
            x.fillRect(0, y, w, bh + 1);
            y += bh;
        }
        x.globalAlpha = 0.25;
        for (let i = 0; i < 3; i++) x.drawImage(c, 0, 1 - i, w, h, 0, 0, w, h);
        x.globalAlpha = 1;
    } else {
        const icy = kind === 'ice';
        const gray = kind === 'construct';
        const base = icy ? [188, 205, 220] : gray ? [128, 128, 136]
            : [120 + rnd() * 40, 95 + rnd() * 35, 70 + rnd() * 30];
        const img = x.createImageData(w, h);
        const gs = 16, g = [];
        for (let i = 0; i < gs * gs; i++) g.push(rnd());
        function at(a, b) { return g[((a % gs) + gs) % gs + (((b % gs) + gs) % gs) * gs]; }
        function val(u, v) {
            const gu = u * gs, gv = v * gs;
            const iu = Math.floor(gu), iv = Math.floor(gv);
            const s = function (t) { return t * t * (3 - 2 * t); };
            const fu = s(gu - iu), fv = s(gv - iv);
            return at(iu, iv) * (1 - fu) * (1 - fv) + at(iu + 1, iv) * fu * (1 - fv) +
                   at(iu, iv + 1) * (1 - fu) * fv + at(iu + 1, iv + 1) * fu * fv;
        }
        for (let py = 0; py < h; py++) {
            for (let px = 0; px < w; px++) {
                const n = val(px / w, py / h) * 0.6 + val(px / w * 3, py / h * 3) * 0.4;
                const k = 0.55 + n * 0.9;
                const o = (py * w + px) * 4;
                img.data[o] = Math.min(255, base[0] * k);
                img.data[o + 1] = Math.min(255, base[1] * k);
                img.data[o + 2] = Math.min(255, base[2] * k);
                img.data[o + 3] = 255;
            }
        }
        x.putImageData(img, 0, 0);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/* Guess a schematic body kind + relative size from the available fields. */
function bodyKind(b) {
    const t = ((b.type || '') + '').toLowerCase();
    if (t.indexOf('belt') !== -1) return 'belt';               // rendered as a real ring of rocks
    if (b.radius_earth > 5 || b.mass_earth > 40 || t.indexOf('gas giant') !== -1) return 'giant';
    if (t.indexOf('construct') !== -1 || t.indexOf('facility') !== -1 ||
        t.indexOf('asteroid') !== -1 || t.indexOf('station') !== -1) return 'construct';
    if (t.indexOf('ice') !== -1 || t.indexOf('icy') !== -1) return 'ice';
    return 'rock';
}
function bodySize(b, kind) {
    const t = ((b.type || '') + '').toLowerCase();
    if (kind === 'giant') return 0.95;
    if (kind === 'construct') return 0.16;
    if (t.indexOf('moon') !== -1 || t.indexOf('moonlet') !== -1) return 0.22;
    return 0.45;
}

/* ---------------------------------- the view --------------------------------- */
export function createSystemView(renderer, host, onExit, fxState) {
    const view = { active: false };
    let scene, camera, controls, starMats = [], orbiters = [], moonOrbiters = [], binaries = [], belts = [], beacons = null;
    let overlay, labelWrap, labels = [], infoPanel, curStar, curInfo, ripple = null;
    let pickables = [];                        // [{mesh, obj|null (null = the star/system)}]
    let fly = null, followObj = null;          // double-click zoom + follow-the-body
    const raycaster = new THREE.Raycaster();
    const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Vector2();
    const _prevFollow = new THREE.Vector3();

    /* --------------------------- overlay + info panel -------------------------- */
    function buildOverlay(star) {
        overlay = document.createElement('div');
        overlay.className = 'v3d-sys-overlay';
        overlay.innerHTML =
            '<button class="v3d-sys-back">← Back to star field</button>' +
            '<div class="v3d-sys-title">' + star.name + ' — system view</div>' +
            '<div class="v3d-sys-note">Schematic: orbital distances, sizes and surfaces are ' +
            'illustrative, not to scale. Star classes and body lists are from the data. ' +
            'Click a body for details.</div>';
        host.appendChild(overlay);
        overlay.querySelector('.v3d-sys-back').addEventListener('click', close);
        labelWrap = document.createElement('div');
        labelWrap.className = 'v3d-labels';
        host.appendChild(labelWrap);
        infoPanel = document.createElement('div');
        infoPanel.className = 'v3d-info v3d-sysinfo';
        host.appendChild(infoPanel);
        infoPanel.addEventListener('click', function (ev) {
            if (ev.target.classList.contains('v3d-sys-toSystem')) showSystemInfo();
        });
    }
    function rowsHtml(rows, data) {
        return '<table class="v3d-info-table">' + rows.map(function (r) {
            const v = r[1](data);
            return (v === null || v === undefined || v === '') ? ''
                : '<tr><th>' + r[0] + '</th><td>' + v + '</td></tr>';
        }).join('') + '</table>';
    }
    function showSystemInfo() {
        infoPanel.innerHTML =
            '<h3>' + curStar.name + '</h3>' +
            (curStar.bodies.description ? '<p class="v3d-desc">' + curStar.bodies.description + '</p>' : '') +
            rowsHtml(SYSTEM_PANEL_ROWS, curInfo);
    }
    function showObjectInfo(obj, kindLabel) {
        infoPanel.innerHTML =
            '<h3>' + obj.name + ' <span class="v3d-dim">· ' + kindLabel + '</span></h3>' +
            (obj.description ? '<p class="v3d-desc">' + obj.description + '</p>' : '') +
            rowsHtml(OBJECT_PANEL_ROWS, obj) +
            '<button class="v3d-sys-toSystem v3d-focus">← System info</button>';
    }
    /* near/nearMax: optional declutter — the label only shows while the camera is
     * within nearMax units of `near` (used for moons/objects around planets). */
    function addLabel(text, obj, cls, near, nearMax) {
        const el = document.createElement('div');
        el.className = 'v3d-label ' + (cls || '');
        el.textContent = text;
        labelWrap.appendChild(el);
        labels.push({ el: el, obj: obj, near: near || null, nearMax: nearMax || 0 });
    }

    /* --------------------------------- builders -------------------------------- */
    function makeStar(cls, radius) {
        const color = new THREE.Color(CLASSES[cls] ? CLASSES[cls].color : 0xffddaa);
        const mat = new THREE.ShaderMaterial({
            uniforms: { uColor: { value: color }, uTime: { value: 0 } },
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG
        });
        starMats.push(mat);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
        mesh.userData.size = radius;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture(), color: color, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        glow.scale.set(radius * 5.2, radius * 5.2, 1);
        mesh.add(glow);
        const light = new THREE.PointLight(color, 1500, 0, 1.4);   // gentler falloff → outer planets lit
        mesh.add(light);
        return mesh;
    }
    function orbitRing(radius, center, opacity) {
        const pts = [];
        for (let k = 0; k <= 96; k++) {
            const t = k / 96 * Math.PI * 2;
            pts.push(new THREE.Vector3(radius * Math.cos(t), 0, radius * Math.sin(t)));
        }
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: 0x2c3c66, transparent: true, opacity: opacity || 0.45 }));
        (center || scene).add(line);
        return line;
    }
    function makeBody(b, i, sizeMul) {
        const kind = bodyKind(b);
        const size = bodySize(b, kind) * sizeMul * PLANET_SCALE;
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(size, 32, 20),
            new THREE.MeshStandardMaterial({
                map: planetTexture(kind, i * 1013 + (b.name || '').length * 7),
                roughness: 0.95, metalness: 0
            })
        );
        mesh.userData.size = size;
        return mesh;
    }

    /* An asteroid belt: a ring of scattered rock-points + an invisible torus as
     * the click target + a label anchor sitting on the ring. */
    function makeBelt(radius, spread, count) {
        const group = new THREE.Group();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = radius + (Math.random() - 0.5) * spread;
            pos[i * 3] = r * Math.cos(ang);
            pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.35;
            pos[i * 3 + 2] = r * Math.sin(ang);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        group.add(new THREE.Points(g, new THREE.PointsMaterial({
            color: 0xa8a396, size: Math.max(0.12, spread * 0.12),
            sizeAttenuation: true, transparent: true, opacity: 0.9
        })));
        const proxy = new THREE.Mesh(
            new THREE.TorusGeometry(radius, Math.max(spread * 0.7, 0.4), 8, 48),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        proxy.rotation.x = Math.PI / 2;
        proxy.userData.size = radius * 0.5;        // double-click zoom distance basis
        group.add(proxy);
        const anchor = new THREE.Object3D();
        anchor.position.set(radius, 0, 0);
        group.add(anchor);
        return { group: group, proxy: proxy, anchor: anchor, spin: 0.008 + Math.random() * 0.006 };
    }
    function addBeltAt(container, obj, radius, spread, count, kindLabel) {
        const belt = makeBelt(radius, spread, count);
        (container || scene).add(belt.group);
        belts.push(belt);
        addLabel(obj.name, belt.anchor, 'v3d-label-moon');
        // noFallback: the proxy's centre is the star, so screen-space pick fallback
        // would wrongly grab belts — raycast (the torus) only
        pickables.push({ mesh: belt.proxy, obj: obj, kindLabel: kindLabel || 'asteroid belt', noFallback: true });
        return belt;
    }

    /* Determine binary components + mode from json / spectral / object type. */
    function binaryConfig(star) {
        const b = star.bodies.binary;
        const sp = (star.props.spectral_type || '').trim();
        const ot = (star.props.object_type || '').trim();
        let parts = null;
        if (b && b.components && b.components.length > 1) parts = b.components;
        else if (sp.indexOf('+') !== -1) parts = sp.split('+');
        else if (ot === '**' || ot === 'SB*' || ot === 'EB*') parts = [sp || 'G2V', sp || 'G2V'];
        if (!parts) return null;
        return {
            mode: (b && b.mode) || 'close',
            comps: parts.map(function (part) {
                return { label: part.trim(), cls: classify({ spectral_type: part.trim(), object_type: '' }) };
            })
        };
    }

    /* ----------------------------------- open ---------------------------------- */
    function open(star) {
        curStar = star;
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x03040a);
        camera = new THREE.PerspectiveCamera(50, host.clientWidth / Math.max(1, host.clientHeight), 0.05, 6000);
        scene.add(new THREE.AmbientLight(0x46506a, 0.9));   // fill so far bodies stay readable
        starMats = []; orbiters = []; moonOrbiters = []; binaries = []; belts = []; labels = []; pickables = [];
        buildOverlay(star);

        // --- star(s) ---
        const bin = binaryConfig(star);
        const sp = (star.props.spectral_type || '').trim();
        let maxStarR, orbitCenterR = 0, primary;
        if (bin && bin.mode === 'close') {
            const rA = STAR_RADII[bin.comps[0].cls] || 1.8, rB = STAR_RADII[bin.comps[1].cls] || 1.8;
            const sep = (rA + rB) * 2.6;
            const a = makeStar(bin.comps[0].cls, rA), b2 = makeStar(bin.comps[1].cls, rB);
            scene.add(a); scene.add(b2);
            binaries.push({ mesh: a, r: sep * rB / (rA + rB), speed: 0.06, phase: 0 });
            binaries.push({ mesh: b2, r: sep * rA / (rA + rB), speed: 0.06, phase: Math.PI });
            addLabel(star.name + ' A (' + bin.comps[0].label + ')', a);
            addLabel(star.name + ' B (' + bin.comps[1].label + ')', b2);
            pickables.push({ mesh: a, obj: null }, { mesh: b2, obj: null });
            maxStarR = Math.max(rA, rB);
            orbitCenterR = sep;
            primary = null;                       // planets orbit the barycentre (origin)
        } else {
            const cls = bin ? bin.comps[0].cls : classify(star.props);
            const r = STAR_RADII[cls] || 1.8;
            primary = makeStar(cls, r);
            scene.add(primary);
            addLabel(star.name + (sp ? ' (' + sp + ')' : ''), primary);
            pickables.push({ mesh: primary, obj: null });
            maxStarR = r;
        }

        // --- bodies: book bodies take priority; otherwise catalog planets ---
        const B = star.bodies;
        const hasBook = B.bookPlanets.length > 0 || B.systemObjects.length > 0;
        const shown = hasBook ? B.bookPlanets : B.catalogPlanets;
        const sysObjs = hasBook ? B.systemObjects : [];

        /* Planets and system-level objects share ONE ordered orbit sequence, so a
         * belt (or station…) can sit between two planets. Position comes from the
         * optional numeric `order` field on any body (editable in editor.html);
         * bodies without it keep data order, planets before system objects. */
        let a = Math.max(maxStarR * ORBIT_START_MUL, orbitCenterR * 2.2);
        const sizeMul = 0.8 + maxStarR * 0.25;
        const items = shown.map(function (p, i) { return { b: p, sys: false, i: i }; })
            .concat(sysObjs.map(function (o, i) { return { b: o, sys: true, i: i }; }));
        items.forEach(function (it, idx) {
            const o = parseFloat(it.b.order);
            it.explicit = !isNaN(o);
            it.k = it.explicit ? o : 1000 + idx;
        });
        items.sort(function (x, y) { return x.k - y.k; });

        items.forEach(function (it, idx) {
            const p = it.b, i = it.i;
            // bodies with the SAME explicit `order` value share one orbit radius
            // (e.g. a dwarf planet inside an asteroid belt) — `a` only advances
            // after the last body of the group
            const shareNext = idx < items.length - 1 && it.explicit &&
                items[idx + 1].explicit && items[idx + 1].k === it.k;
            const adv = function (factor) { if (!shareNext) a *= factor; };
            if (bodyKind(p) === 'belt') {          // belts render as rings, not spheres
                addBeltAt(null, p, a, a * 0.07, 500);
                adv(it.sys ? 1.3 : ORBIT_SPACING);
                return;
            }
            if (it.sys) {                          // system-level object: smaller, fainter
                const mesh = makeBody(p, i * 97 + 3, sizeMul * 0.6);
                scene.add(mesh);
                orbitRing(a, null, 0.25);
                orbiters.push({
                    mesh: mesh, r: a,
                    speed: ORBIT_SPEED * 0.5 / Math.sqrt(Math.pow(a / (maxStarR * ORBIT_START_MUL), 3)),
                    phase: (i * 2.1) % (Math.PI * 2),
                    spin: 0.2, kind: 'construct'
                });
                addLabel(p.name, mesh, 'v3d-label-moon');
                pickables.push({ mesh: mesh, obj: p, kindLabel: 'system object' });
                adv(1.3);
                return;
            }
            const mesh = makeBody(p, i, sizeMul);
            scene.add(mesh);
            orbitRing(a);
            orbiters.push({
                mesh: mesh, r: a,
                speed: ORBIT_SPEED / Math.sqrt(Math.pow(a / (maxStarR * ORBIT_START_MUL), 3)),
                phase: (i * 2.399) % (Math.PI * 2),
                spin: 0.12 + (i % 3) * 0.08, kind: bodyKind(p)
            });
            addLabel(p.name, mesh, p.source === 'book' ? 'v3d-label-book' : '');
            pickables.push({ mesh: mesh, obj: p, kindLabel: p.source === 'catalog' ? 'exoplanet' : 'planet' });

            // moons + planet-level objects orbit their planet — same ordering rules
            // as the main sequence: optional numeric `order`, and kids sharing an
            // explicit order value share one orbit radius (e.g. a ring + a moon)
            const kids = (p.moons || []).map(function (m) { return { o: m, kind: 'moon' }; })
                .concat((p.other_objects || []).map(function (m) { return { o: m, kind: 'object' }; }));
            kids.forEach(function (kid, j) {
                const oo = parseFloat(kid.o.order);
                kid.explicit = !isNaN(oo);
                kid.k = kid.explicit ? oo : 1000 + j;
            });
            kids.sort(function (x, y) { return x.k - y.k; });
            const pSize = mesh.userData.size;
            let mr = pSize * 2.6;
            kids.forEach(function (kid, j) {
                const kidShareNext = j < kids.length - 1 && kid.explicit &&
                    kids[j + 1].explicit && kids[j + 1].k === kid.k;
                if (bodyKind(kid.o) === 'belt') {  // belt / ring around its planet
                    addBeltAt(mesh, kid.o, mr, pSize * 0.5, 220);
                } else {
                    const mm = makeBody(kid.o, i * 31 + j + 7, sizeMul * 0.42);
                    scene.add(mm);
                    moonOrbiters.push({
                        mesh: mm, parent: mesh, r: mr,
                        speed: MOON_SPEED / (1 + j * 0.5),
                        phase: (j * 2.399) % (Math.PI * 2),
                        spin: 0.3
                    });
                    // moon labels only show when the camera is near their planet (declutter)
                    addLabel(kid.o.name, mm, 'v3d-label-moon', mesh, Math.max(8, pSize * 30));
                    pickables.push({ mesh: mm, obj: kid.o, kindLabel: kid.kind === 'moon' ? 'moon' : 'orbital object' });
                }
                if (!kidShareNext) mr += pSize * 1.5;
            });
            adv(ORBIT_SPACING);
        });

        // fixed-px beacon dots so planets/objects (not moons) stay visible far out;
        // when the camera is close, the planet mesh occludes its own beacon
        const BEACON_COLORS = { giant: [0.85, 0.73, 0.54], ice: [0.81, 0.88, 0.93],
                                rock: [0.72, 0.60, 0.48], construct: [0.62, 0.62, 0.66] };
        if (orbiters.length) {
            const bp = new Float32Array(orbiters.length * 3);
            const bc = new Float32Array(orbiters.length * 3);
            orbiters.forEach(function (o, k) {
                const c = BEACON_COLORS[o.kind] || BEACON_COLORS.rock;
                bc[k * 3] = c[0]; bc[k * 3 + 1] = c[1]; bc[k * 3 + 2] = c[2];
            });
            const bg = new THREE.BufferGeometry();
            bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
            bg.setAttribute('color', new THREE.BufferAttribute(bc, 3));
            beacons = new THREE.Points(bg, new THREE.PointsMaterial({
                size: 5, sizeAttenuation: false, vertexColors: true,
                transparent: true, opacity: 0.95, depthWrite: false
            }));
            beacons.frustumCulled = false;
            scene.add(beacons);
        }

        // "far" binary companion outside everything
        if (bin && bin.mode === 'far') {
            const rB = STAR_RADII[bin.comps[1].cls] || 1.8;
            const comp = makeStar(bin.comps[1].cls, rB);
            scene.add(comp);
            const cr = Math.max(a * 1.5, maxStarR * ORBIT_START_MUL * 3);
            orbitRing(cr, null, 0.2);
            binaries.push({ mesh: comp, r: cr, speed: 0.012, phase: 1.1 });
            addLabel(star.name + ' B (' + bin.comps[1].label + ')', comp);
            pickables.push({ mesh: comp, obj: null });
            a = cr;
        }

        // optional orientation surface — same shader & toggles as the star-field
        // reference plane (grid + ripple fx in the ⚙ settings)
        const rippleR = Math.max(a * 1.25, maxStarR * ORBIT_START_MUL * 2);
        // keep the wavelength tied to the inner-orbit scale so crests are visible
        // near the star even when the outermost orbits are far out
        ripple = buildRipple(rippleR, Math.max(14, rippleR / (maxStarR * ORBIT_START_MUL * 0.9)));
        ripple.position.y = -0.05;
        ripple.visible = false;
        scene.add(ripple);

        const startDist = Math.max(maxStarR * ORBIT_START_MUL * 2.2, maxStarR * 9);
        camera.position.set(0, startDist * 0.5, startDist);
        camera.far = Math.max(6000, a * 12);           // big systems must never clip out
        camera.updateProjectionMatrix();
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 0.3;                    // allow zooming close to small moons
        controls.maxDistance = Math.max(a * 3, 60);

        curInfo = { star: star, comps: bin ? bin.comps : [1], mode: bin ? bin.mode : null, shown: shown };
        showSystemInfo();

        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('dblclick', onDblClick);
        fly = null; followObj = null;
        view.active = true;
    }

    /* -------------------------- picking (click / dblclick) ---------------------- */
    let downX = 0, downY = 0;
    function pickAt(cx, cy) {
        const rect = renderer.domElement.getBoundingClientRect();
        _m.set(((cx - rect.left) / rect.width) * 2 - 1,
               -((cy - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(_m, camera);
        const hits = raycaster.intersectObjects(pickables.map(function (p) { return p.mesh; }), false);
        if (hits.length) {
            return pickables.find(function (p) { return p.mesh === hits[0].object; }) || null;
        }
        // screen-space fallback: expands the effective hitbox of small/far bodies
        let best = null, bd = 18 * 18;
        const px = cx - rect.left, py = cy - rect.top;
        pickables.forEach(function (p) {
            if (p.noFallback) return;
            p.mesh.getWorldPosition(_v);
            _v.project(camera);
            if (_v.z < -1 || _v.z > 1) return;
            const dx = (_v.x * 0.5 + 0.5) * rect.width - px;
            const dy = (-_v.y * 0.5 + 0.5) * rect.height - py;
            const d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = p; }
        });
        return best;
    }
    function onPointerDown(e) { downX = e.clientX; downY = e.clientY; }
    function onPointerUp(e) {
        if (!view.active) return;
        if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return;
        const hit = pickAt(e.clientX, e.clientY);
        if (!hit) return;
        if (hit.obj) showObjectInfo(hit.obj, hit.kindLabel || 'body');
        else showSystemInfo();
    }
    /* Fly to a body, centre the view on it and FOLLOW it while it orbits (the
     * camera keeps its offset relative to the moving body). Shared by double-click
     * and the in-system search. */
    function focusHit(hit) {
        if (!hit || !controls) return;
        const size = hit.mesh.userData.size ||
            (hit.mesh.geometry && hit.mesh.geometry.parameters && hit.mesh.geometry.parameters.radius) || 1;
        followObj = null;                                  // pause following during the flight
        fly = {
            t: 0,
            mesh: hit.mesh,
            dist: Math.max(size * 6, 0.8),
            fromT: controls.target.clone(),
            fromC: camera.position.clone(),
            dir: camera.position.clone().sub(controls.target).normalize()
        };
        if (hit.obj) showObjectInfo(hit.obj, hit.kindLabel || 'body');
        else showSystemInfo();
    }
    function onDblClick(e) {
        if (!view.active) return;
        focusHit(pickAt(e.clientX, e.clientY));
    }

    /* In-system search support (used by the sidebar search while in close-up mode).
     * Names come from the body records (planets.json) plus the star itself. */
    view.searchBodies = function () {
        const seen = {}, out = [];
        pickables.forEach(function (p) {
            const name = p.obj ? p.obj.name : (curStar ? curStar.name : 'Star');
            if (!name || seen[name]) return;               // dedupe binary star / belt anchors
            seen[name] = 1;
            out.push({ name: name, entry: p });
        });
        return out;
    };
    view.focusBody = function (item) { if (item) focusHit(item.entry); };

    function close() {
        view.active = false;
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('dblclick', onDblClick);
        fly = null; followObj = null; ripple = null;
        if (controls) controls.dispose();
        if (overlay) { overlay.remove(); overlay = null; }
        if (labelWrap) { labelWrap.remove(); labelWrap = null; }
        if (infoPanel) { infoPanel.remove(); infoPanel = null; }
        scene = camera = controls = null;
        starMats = []; orbiters = []; moonOrbiters = []; binaries = []; belts = []; beacons = null; labels = []; pickables = [];
        if (onExit) onExit();
    }

    /* ---------------------------------- render --------------------------------- */
    function render(t, dt) {
        if (!view.active) return;
        starMats.forEach(function (m) { m.uniforms.uTime.value = t; });
        binaries.forEach(function (b) {
            const ang = b.phase + t * b.speed;
            b.mesh.position.set(b.r * Math.cos(ang), 0, b.r * Math.sin(ang));
        });
        orbiters.forEach(function (o, k) {
            const ang = o.phase + t * o.speed;
            o.mesh.position.set(o.r * Math.cos(ang), 0, o.r * Math.sin(ang));
            o.mesh.rotation.y += o.spin * dt;
            if (beacons) {
                beacons.geometry.attributes.position.setXYZ(k,
                    o.mesh.position.x, o.mesh.position.y, o.mesh.position.z);
            }
        });
        if (beacons) beacons.geometry.attributes.position.needsUpdate = true;
        // negative: matches the orbiters' direction (x=cos, z=sin with increasing
        // angle is a NEGATIVE rotation about +Y in three.js's right-handed frame)
        belts.forEach(function (b) { b.group.rotation.y -= b.spin * dt; });
        moonOrbiters.forEach(function (o) {
            const ang = o.phase + t * o.speed;
            o.mesh.position.set(
                o.parent.position.x + o.r * Math.cos(ang),
                o.parent.position.y,
                o.parent.position.z + o.r * Math.sin(ang));
            o.mesh.rotation.y += o.spin * dt;
        });

        // orientation surface follows the star-field toggles live
        if (ripple) {
            ripple.visible = fxState && fxState.grid && fxState.fxRipple;
            if (ripple.visible) ripple.material.uniforms.uTime.value = t;
        }

        // double-click flight (target tracks the moving body), then follow it
        if (fly) {
            fly.t = Math.min(1, fly.t + dt / 0.8);
            const k = 1 - Math.pow(1 - fly.t, 3);
            fly.mesh.getWorldPosition(_f);
            controls.target.lerpVectors(fly.fromT, _f, k);
            camera.position.lerpVectors(fly.fromC, _f.clone().add(fly.dir.clone().multiplyScalar(fly.dist)), k);
            if (fly.t >= 1) {
                followObj = fly.mesh;
                followObj.getWorldPosition(_prevFollow);
                fly = null;
            }
        } else if (followObj) {
            followObj.getWorldPosition(_f);
            _f.sub(_prevFollow);                       // how far the body moved this frame
            controls.target.add(_f);
            camera.position.add(_f);
            followObj.getWorldPosition(_prevFollow);
        }

        controls.update();
        renderer.render(scene, camera);
        const w = host.clientWidth, h = host.clientHeight;
        labels.forEach(function (l) {
            if (l.near) {                              // declutter: moon labels near their planet only
                l.near.getWorldPosition(_v);
                if (camera.position.distanceTo(_v) > l.nearMax) { l.el.style.display = 'none'; return; }
            }
            l.obj.getWorldPosition(_v);
            _v.project(camera);
            if (_v.z < -1 || _v.z > 1) { l.el.style.display = 'none'; return; }
            l.el.style.display = 'block';
            l.el.style.transform = 'translate(-50%,-160%) translate(' +
                ((_v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-_v.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
        });
    }

    function resize(w, h) {
        if (!camera) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    view.open = open;
    view.close = close;
    view.render = render;
    view.resize = resize;
    return view;
}
