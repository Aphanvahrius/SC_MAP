'use strict';
/*
 * 3-D star view — Three.js scene, rendering and interaction.
 *
 * Entry points (used by js/view3d-boot.js):
 *   init(host)   — one-time setup inside the #view3d element (lazy, on first switch)
 *   activate()   — start rendering (host just became visible)
 *   deactivate() — stop rendering (user switched back to the 2-D map)
 *
 * Scene: 1 unit = 1 light-year, Sol at the origin, galactic north = +Y.
 * All ~237 systems live in ONE THREE.Points cloud (custom shader: per-star size,
 * colour, visibility and kind — white dwarfs get a tight compact core, neutron
 * stars a spiked, pulsing glint). Labels are HTML overlay divs, picking is
 * screen-space nearest. A selected system can be entered (system3d.js) for the
 * close-up prototype.
 */
import * as THREE from 'three';
import { OrbitControls } from '../../lib/three/OrbitControls.js';
import { loadData, NATION_COLORS, NO_NATION_COLOR, MARKERS, CLASSES, CHARACTER_COLORS, buildGraph, shortestRoute } from './data3d.js';
import { buildPanel, buildSettings, buildInfo, showInfo } from './panel3d.js';
import { createSystemView } from './system3d.js';
import { buildRipple } from './fx3d.js';

/* ------------------------------- tuning knobs -------------------------------- */
const MIN_STAR_PX = 2.5;    // stars never shrink below this — stays visible far out
const MAX_STAR_PX = 64.0;
const PICK_RADIUS_PX = 14;
const LABEL_CAP = 90;

let host, renderer, scene, camera, controls, raf = null, active = false;
let stars = [], lanes = [], journeys = [], starByName = new Map(), points, geom, gridGroup, heightLines = null, markerClouds = {};
let rippleMesh = null, lineMatFx = null, routeLine = null, journeyGroup = null;
let flatPos = null, realPos = null, trans = null, overheadCam = null, savedCam = null;
let labelLayer, labelPool = [], gridLabels = [], hoverLabel, screenPos;
let hovered = null, selected = null, selRing;
let fly = null, systemView = null, rebuildPanel = null;
/* Minimal animation timer (THREE.Clock is deprecated; THREE.Timer isn't vendored). */
const timer = {
    t: 0, _last: 0,
    start: function () { this._last = performance.now(); },
    delta: function () {
        const now = performance.now();
        let d = (now - this._last) / 1000;
        this._last = now;
        if (d > 0.1) d = 0.1;          // clamp tab-switch jumps
        this.t += d;
        return d;
    }
};
const state = {
    colorMode: 'spectral',
    book: 'A1',            // derived: latest book in bookRange (nation borders epoch)
    bookRange: [1, 1],     // two-ended Book slider (indices into BOOKS)
    nations: new Set(Object.keys(NATION_COLORS).concat([null])),
    classes: new Set(Object.keys(CLASSES)),      // spectral-class filter (legend checkboxes)
    markers: { capital: false, core: false, mining: false, industrial: false, nostar: false },
    characters: new Set(),     // journey checkboxes (empty = none shown, like the 2-D map)
    journeyAllBooks: false,    // switch: show selected characters' journeys across ALL books
    fxJourneys: true,          // neon journey lines with A→B travelling pulses
    fxRoute: true,             // neon route line with a from→to travelling pulse
    grid: true,
    heightLines: false,
    fxRipple: false,       // neon "liquid" ripple surface on the reference plane
    fxPulseLines: false,   // droplet pulses travelling down the height lines
    sky: true,             // real Milky Way panorama backdrop (lazy-loaded)
    transition: true,      // animated 2D↔3D morph on view switch
    labelMode: 'book',
    sizeMul: 1,        // star-size multiplier (settings window)
    markerMul: 1,      // marker-size multiplier (settings window)
    sound: false
};

/* ------------------------------ texture helpers ----------------------------- */
function starTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.12, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.30, 'rgba(255,255,255,0.38)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.12)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function glyphTexture(shape, color) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.strokeStyle = color; x.lineWidth = 5; x.lineJoin = 'round';
    x.translate(32, 32);
    x.beginPath();
    if (shape === 'diamond') { x.moveTo(0, -24); x.lineTo(24, 0); x.lineTo(0, 24); x.lineTo(-24, 0); }
    else if (shape === 'triangle') { x.moveTo(0, -24); x.lineTo(22, 16); x.lineTo(-22, 16); }
    else if (shape === 'square') { x.rect(-19, -19, 38, 38); }
    else if (shape === 'circle') { x.arc(0, 0, 21, 0, Math.PI * 2); }
    else { // 5-point star
        for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 10 : 25, a = -Math.PI / 2 + i * Math.PI / 5;
            i ? x.lineTo(r * Math.cos(a), r * Math.sin(a)) : x.moveTo(r * Math.cos(a), r * Math.sin(a));
        }
    }
    x.closePath(); x.stroke();
    return new THREE.CanvasTexture(c);
}
function ringTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 4;
    x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.stroke();
    return new THREE.CanvasTexture(c);
}

/* --------------------------------- the grid --------------------------------- */
function buildGrid(radius) {
    const group = new THREE.Group();
    const mMajor = new THREE.LineBasicMaterial({ color: 0x3a5a95, transparent: true, opacity: 0.40 });
    const mMid   = new THREE.LineBasicMaterial({ color: 0x2e4a7a, transparent: true, opacity: 0.26 });
    const mMinor = new THREE.LineBasicMaterial({ color: 0x263b60, transparent: true, opacity: 0.14 });
    // Denser rings near Sol (most systems sit within a few hundred ly), sparser far out.
    const rings = [];
    for (let r = 100; r <= 1000; r += 100) rings.push(r);
    for (let r = 1500; r <= radius; r += 500) rings.push(r);
    rings.forEach(function (r) {
        const pts = [];
        for (let i = 0; i <= 128; i++) {
            const a = i / 128 * Math.PI * 2;
            pts.push(new THREE.Vector3(r * Math.cos(a), 0, r * Math.sin(a)));
        }
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        group.add(new THREE.Line(g, r % 1000 === 0 ? mMajor : (r % 500 === 0 ? mMid : mMinor)));
    });
    const radial = [];
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        radial.push(new THREE.Vector3(0, 0, 0), new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)));
    }
    const rg = new THREE.BufferGeometry().setFromPoints(radial);
    group.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x263b60, transparent: true, opacity: 0.10 })));
    return group;
}

/* ----------------- droplet-impact ripples on the surface (fx) ---------------- */
/* When both fx are on, each height-line droplet that reaches the plane spawns a
 * small expanding ring at that star's base point. Flat instanced quads whose
 * shader phase matches the line-pulse phase (impact = pulse wrap at aT=1). */
const IMPACT_SIZE = 26;          // quad size in ly (max ripple diameter ~half of it)
let impactMesh = null, impactMat = null;
function makeImpactMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: [
            'attribute float aPhase; varying float vPhase; varying vec2 vUv;',
            'void main() {',
            '  vUv = uv; vPhase = aPhase;',
            '  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform float uTime; varying float vPhase; varying vec2 vUv;',
            'void main() {',
            '  float u = fract(uTime * 0.22 + vPhase);',   // 0 = droplet just landed
            '  if (u > 0.30) discard;',
            '  float k = u / 0.30;',
            '  vec2 p = vUv * 2.0 - 1.0;',
            '  float rad = mix(0.05, 0.9, k);',
            '  float ring = exp(-pow((length(p) - rad) * 12.0, 2.0));',
            '  float a = ring * (1.0 - k) * 0.9;',
            '  gl_FragColor = vec4(vec3(0.30, 0.75, 1.0) * a, a);',
            '}'
        ].join('\n'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
}
function rebuildImpacts() {
    if (impactMesh) { scene.remove(impactMesh); impactMesh.geometry.dispose(); impactMesh = null; }
    if (!(state.grid && state.fxRipple && state.heightLines && state.fxPulseLines)) return;
    const vis = stars.filter(function (s) { return s.visible; });
    if (!vis.length) return;
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const phases = new Float32Array(vis.length);
    if (!impactMat) impactMat = makeImpactMaterial();
    impactMesh = new THREE.InstancedMesh(geo, impactMat, vis.length);
    impactMesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    vis.forEach(function (s, k) {
        // phase must match the star's height-line pulse (same golden-ratio stagger)
        phases[k] = (s.index * 0.6180339887) % 1;
        m.makeScale(IMPACT_SIZE, 1, IMPACT_SIZE);
        m.setPosition(s.pos[0], 0.15, s.pos[2]);
        impactMesh.setMatrixAt(k, m);
    });
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    scene.add(impactMesh);
}

/* -------------------- pulsing height-line material (fx) ---------------------- */
/* Neon lines with droplet-like pulses travelling from each star DOWN to the
 * reference plane (aT: 0 at the star, 1 at the plane; aPhase staggers lines). */
function makeLineFxMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: [
            'attribute float aT; attribute float aPhase;',
            'varying float vT; varying float vPhase;',
            'void main() {',
            '  vT = aT; vPhase = aPhase;',
            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform float uTime;',
            'varying float vT; varying float vPhase;',
            'void main() {',
            '  float base = 0.10;',
            '  float pulsePos = fract(uTime * 0.22 + vPhase);',      // travels star -> plane
            '  float d = vT - pulsePos;',
            '  float pulse = exp(-d * d * 260.0);',
            '  float a = base + pulse * 0.85;',
            '  gl_FragColor = vec4(vec3(0.25, 0.75, 1.0) * a, a);',
            '}'
        ].join('\n'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
}

/* ----------------------- real-sky panorama backdrop -------------------------- */
/* ESO Milky Way panorama (Serge Brunier, CC BY 4.0), equirectangular in GALACTIC
 * coordinates — which is exactly this scene's frame (x = galactic centre,
 * y = north, z = −galactic Y), so only a fixed yaw is needed. The sky is the
 * view from Sol at the present epoch (the map's stars are epoch 3552).
 * If east/west ever look mirrored against real constellations, flip SKY_YAW
 * by adding/removing Math.PI or adjust here. */
const SKY_CONFIG = {
    file: 'data/sky_galactic_6k.jpg',
    yaw: Math.PI,     // compensates the inside-out sphere flip; centre of image = galactic centre = +X
    dim: 0.55,        // brightness multiplier so the data stars stay dominant
    radius: 40000
};
let skyMesh = null, skyLoading = false;
function setSky(on) {
    if (on && !skyMesh && !skyLoading) {
        skyLoading = true;
        new THREE.TextureLoader().load(SKY_CONFIG.file, function (tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
            const geo = new THREE.SphereGeometry(SKY_CONFIG.radius, 64, 32);
            geo.scale(-1, 1, 1);                          // view from inside
            skyMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
                map: tex,
                color: new THREE.Color(SKY_CONFIG.dim, SKY_CONFIG.dim, SKY_CONFIG.dim),
                depthWrite: false
            }));
            skyMesh.rotation.y = SKY_CONFIG.yaw;
            skyMesh.renderOrder = -2;
            skyMesh.visible = state.sky;
            scene.add(skyMesh);
            skyLoading = false;
        }, undefined, function () {
            skyLoading = false;
            console.warn('[ShipCore-3D] sky panorama not found at ' + SKY_CONFIG.file);
        });
    }
    if (skyMesh) skyMesh.visible = on;
}

/* ---------------------------- visibility & colours --------------------------- */
function starVisible(s) {
    return state.nations.has(s.nation[state.book]) && state.classes.has(s.cls);
}
function starColor(s) {
    if (state.colorMode === 'nation') {
        const n = s.nation[state.book];
        return n ? NATION_COLORS[n] : NO_NATION_COLOR;
    }
    return s.color;
}
function markerApplies(m, s) {
    return m.test ? m.test(s) : s.specials.indexOf(m.key) !== -1;
}

/* Recompute buffers + dependent objects after any state change. */
function apply() {
    const col = geom.getAttribute('aColor'), vis = geom.getAttribute('aVis');
    const c = new THREE.Color();
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i], v = starVisible(s);
        s.visible = v;
        vis.array[i] = v ? 1 : 0;
        c.setHex(starColor(s));
        col.array[i * 3] = c.r; col.array[i * 3 + 1] = c.g; col.array[i * 3 + 2] = c.b;
    }
    col.needsUpdate = true; vis.needsUpdate = true;

    // marker glyph clouds (small; rebuilt on change)
    MARKERS.forEach(function (m) {
        const cloud = markerClouds[m.key];
        const pos = [];
        if (state.markers[m.key]) {
            stars.forEach(function (s) {
                if (s.visible && markerApplies(m, s)) pos.push(s.pos[0], s.pos[1], s.pos[2]);
            });
        }
        cloud.geometry.dispose();
        cloud.geometry = new THREE.BufferGeometry();
        cloud.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        cloud.visible = pos.length > 0;
    });

    // height lines from the grid plane up/down to each visible star
    if (heightLines) { scene.remove(heightLines); heightLines.geometry.dispose(); heightLines = null; }
    if (state.heightLines) {
        const pos = [], t = [], phase = [];
        stars.forEach(function (s, i) {
            if (!s.visible) return;
            // aT: 0 at the star end, 1 at the plane — pulses run star -> plane
            pos.push(s.pos[0], s.pos[1], s.pos[2], s.pos[0], 0, s.pos[2]);
            t.push(0, 1);
            const ph = (i * 0.6180339887) % 1;           // golden-ratio stagger
            phase.push(ph, ph);
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
        g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
        if (!lineMatFx) lineMatFx = makeLineFxMaterial();
        heightLines = new THREE.LineSegments(g, state.fxPulseLines ? lineMatFx :
            new THREE.LineBasicMaterial({ color: 0x3a4a7a, transparent: true, opacity: 0.22, depthWrite: false }));
        scene.add(heightLines);
    }

    if (rippleMesh) rippleMesh.visible = state.grid && state.fxRipple;   // fx requires the grid
    rebuildImpacts();
    gridGroup.visible = state.grid;
    gridLabels.forEach(function (l) { l.enabled = state.grid; });

    rebuildJourneys();

    if (selected && !selected.visible) select(null);
    else if (selected) showInfo(selected, ctl);   // e.g. nation row follows the Book switch
    refreshLabelSet();
}

/* Cheap visual-only updates (sliders) — no geometry rebuilds. */
function applyVisual() {
    points.material.uniforms.uSizeMul.value = state.sizeMul;
    MARKERS.forEach(function (m) {
        markerClouds[m.key].material.size = m.size * state.markerMul;
    });
}

/* ----------------------------------- labels ---------------------------------- */
function makeLabelDiv(cls) {
    const d = document.createElement('div');
    d.className = cls;
    d.style.display = 'none';
    labelLayer.appendChild(d);
    return d;
}
let labelSet = [];   // [{star, el}] currently shown named labels

function labelPriority(s) {
    let p = s.size;
    if (s.specials.length) p += 1e3;
    if (s.mentions) p += 1e6 + s.mentions.hits * 10;
    if (s.name === 'SOL') p += 1e9;
    if (s === selected) p += 2e9;
    return p;
}

/* Choose which labels to show (throttled — on camera stop & state changes). */
function refreshLabelSet() {
    let cand;
    if (state.labelMode === 'all') cand = stars.filter(function (s) { return s.visible; });
    else if (state.labelMode === 'book') cand = stars.filter(function (s) { return s.visible && (s.mentions || s.name === 'SOL'); });
    else cand = [];
    if (selected && selected.visible && cand.indexOf(selected) === -1) cand.push(selected);

    cand.sort(function (a, b) { return labelPriority(b) - labelPriority(a); });
    projectAll();

    const taken = {};           // 40x20-px occupancy grid for greedy declutter
    const chosen = [];
    for (const s of cand) {
        if (chosen.length >= LABEL_CAP) break;
        const i = s.index;
        if (screenPos[i * 3 + 2] <= 0) continue;                    // behind camera
        const x = screenPos[i * 3], y = screenPos[i * 3 + 1];
        const w = s.name.length * 6.5 + 8;
        const c0 = Math.floor((x - w / 2) / 40), c1 = Math.floor((x + w / 2) / 40), r = Math.floor(y / 20);
        let free = true;
        for (let cx = c0; cx <= c1; cx++) if (taken[cx + ':' + r]) { free = false; break; }
        if (!free && s !== selected) continue;
        for (let cx = c0; cx <= c1; cx++) taken[cx + ':' + r] = true;
        chosen.push(s);
    }

    while (labelPool.length < chosen.length) labelPool.push(makeLabelDiv('v3d-label'));
    labelSet = chosen.map(function (s, i) {
        const el = labelPool[i];
        el.textContent = s.name;
        el.classList.toggle('v3d-label-sel', s === selected);
        return { star: s, el: el };
    });
    for (let i = chosen.length; i < labelPool.length; i++) labelPool[i].style.display = 'none';
}

let labelTimer = null;
function scheduleLabelRefresh() {
    if (labelTimer) return;
    labelTimer = setTimeout(function () { labelTimer = null; refreshLabelSet(); }, 150);
}

/* Per-frame: reposition the active labels (positions come from projectAll()). */
const _v = new THREE.Vector3();
function projectAll() {
    const w = host.clientWidth, h = host.clientHeight;
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (!s.visible) { screenPos[i * 3 + 2] = -1; continue; }
        _v.set(s.pos[0], s.pos[1], s.pos[2]).project(camera);
        screenPos[i * 3] = (_v.x * 0.5 + 0.5) * w;
        screenPos[i * 3 + 1] = (-_v.y * 0.5 + 0.5) * h;
        screenPos[i * 3 + 2] = (_v.z > -1 && _v.z < 1) ? 1 : -1;
    }
}
function placeLabels() {
    labelSet.forEach(function (it) {
        const i = it.star.index;
        if (screenPos[i * 3 + 2] <= 0) { it.el.style.display = 'none'; return; }
        it.el.style.display = 'block';
        it.el.style.transform = 'translate(-50%,-130%) translate(' + screenPos[i * 3].toFixed(1) + 'px,' + (screenPos[i * 3 + 1] - 6).toFixed(1) + 'px)';
    });
    gridLabels.forEach(function (l) {
        if (!l.enabled) { l.el.style.display = 'none'; return; }
        _v.set(l.x, 0, l.z).project(camera);
        if (_v.z < -1 || _v.z > 1) { l.el.style.display = 'none'; return; }
        l.el.style.display = 'block';
        l.el.style.transform = 'translate(-50%,-50%) translate(' +
            ((_v.x * 0.5 + 0.5) * host.clientWidth).toFixed(1) + 'px,' +
            ((-_v.y * 0.5 + 0.5) * host.clientHeight).toFixed(1) + 'px)';
    });
    if (hovered && hovered.visible && labelSet.every(function (it) { return it.star !== hovered; })) {
        const i = hovered.index;
        hoverLabel.textContent = hovered.name;
        hoverLabel.style.display = screenPos[i * 3 + 2] > 0 ? 'block' : 'none';
        hoverLabel.style.transform = 'translate(-50%,-130%) translate(' + screenPos[i * 3].toFixed(1) + 'px,' + (screenPos[i * 3 + 1] - 6).toFixed(1) + 'px)';
    } else {
        hoverLabel.style.display = 'none';
    }
}

/* ------------------------------ picking & camera ----------------------------- */
function pick(px, py) {
    let best = null, bestD = PICK_RADIUS_PX * PICK_RADIUS_PX;
    for (let i = 0; i < stars.length; i++) {
        if (screenPos[i * 3 + 2] <= 0) continue;
        const dx = screenPos[i * 3] - px, dy = screenPos[i * 3 + 1] - py;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = stars[i]; }
    }
    return best;
}

function select(star) {
    selected = star;
    selRing.visible = !!star;
    if (star) selRing.position.set(star.pos[0], star.pos[1], star.pos[2]);
    showInfo(star, ctl);
    refreshLabelSet();
}

function flyTo(star) {
    const target = new THREE.Vector3(star.pos[0], star.pos[1], star.pos[2]);
    const dist = 35;
    const dir = camera.position.clone().sub(controls.target).normalize();
    fly = {
        t: 0,
        fromT: controls.target.clone(), toT: target,
        fromC: camera.position.clone(), toC: target.clone().add(dir.multiplyScalar(dist))
    };
}

/* ------------------------------ route planner -------------------------------- */
/* Fewest-jumps routing over the hyperlane graph (Sys_A/Sys_B links). Deliberately
 * UNWEIGHTED — lane lengths have no physical meaning; the graph edges carry the
 * full lane records so weights can be introduced later.
 * The computed route lives in window.SC_routeState and is shared with the 2-D
 * view (js/route2d.js). With fxRoute (default) the route renders as a neon line
 * with a pulse travelling from → to along the whole path. */
let routeMat = null;
function removeRouteLine() {
    if (routeLine) {
        scene.remove(routeLine);
        routeLine.geometry.dispose();
        if (routeLine.material) routeLine.material.dispose();
        routeLine = null;
        routeMat = null;
    }
}
function clearRoute() {                 // panel "Clear" — also drops the shared state
    removeRouteLine();
    window.SC_routeState = null;
}
function drawRouteFromState() {
    removeRouteLine();
    const st = window.SC_routeState;
    if (!st) return;
    const pts = [];
    st.path.forEach(function (n) {
        const s = starByName.get(n);
        if (s) pts.push(new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]));
    });
    if (pts.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    if (state.fxRoute) {
        // aT = normalized distance along the route (pulse travels from → to)
        let total = 0;
        const cum = [0];
        for (let i = 1; i < pts.length; i++) { total += pts[i].distanceTo(pts[i - 1]); cum.push(total); }
        geo.setAttribute('aT', new THREE.Float32BufferAttribute(
            cum.map(function (c) { return total ? c / total : 0; }), 1));
        routeMat = makeJourneyMaterial(0x5fe0ff, 0);
        routeLine = new THREE.Line(geo, routeMat);
    } else {
        routeLine = new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: 0x5fe0ff, transparent: true, opacity: 0.95, depthTest: false
        }));
    }
    routeLine.renderOrder = 4;
    scene.add(routeLine);
}
function computeRoute(fromName, toName) {
    const a = starByName.get(fromName), b = starByName.get(toName);
    if (!a || !b) return { error: 'Pick two valid system names.' };
    const path = shortestRoute(buildGraph(lanes), a.name, b.name);
    if (!path) return { error: 'No lane route between these systems.' };
    // straight-line real-space distance for the comparison
    const dx = a.pos[0] - b.pos[0], dy = a.pos[1] - b.pos[1], dz = a.pos[2] - b.pos[2];
    const st = {
        from: a.name, to: b.name, path: path,
        jumps: path.length - 1,
        distLy: Math.sqrt(dx * dx + dy * dy + dz * dz)
    };
    window.SC_routeState = st;          // shared with the 2-D route planner
    drawRouteFromState();
    return st;
}

/* ----------------------------- character journeys ----------------------------- */
/* Lines between the systems of each selected character's journey legs. Tied to
 * the Book range unless state.journeyAllBooks is on. Legs whose systems are not
 * in systems.geojson yet are skipped silently and appear once the system exists.
 * With fxJourneys (default): solid neon line + a pulse travelling Sys_A → Sys_B. */
let journeyMats = [];
function makeJourneyMaterial(colorHex, phase) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(colorHex) },
            uPhase: { value: phase }
        },
        vertexShader: [
            'attribute float aT; varying float vT;',
            'void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
        ].join('\n'),
        fragmentShader: [
            'uniform float uTime; uniform vec3 uColor; uniform float uPhase;',
            'varying float vT;',
            'void main() {',
            '  float base = 0.45;',                                  // solid neon body
            '  float p = fract(uTime * 0.25 + uPhase);',             // pulse: A (vT=0) → B (vT=1)
            '  float d = vT - p;',
            '  float pulse = exp(-d * d * 300.0);',
            '  float a = base + pulse * 0.9;',
            '  gl_FragColor = vec4(uColor * a * 1.35, a);',
            '}'
        ].join('\n'),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });
}
function rebuildJourneys() {
    if (journeyGroup) {
        scene.remove(journeyGroup);
        journeyGroup.traverse(function (o) {
            if (o.geometry) o.geometry.dispose();
            if (o.material && o.material.isShaderMaterial) o.material.dispose();
        });
        journeyGroup = null;
    }
    journeyMats = [];
    if (!state.characters.size) return;
    journeyGroup = new THREE.Group();
    const chIndex = {};
    Object.keys(CHARACTER_COLORS).forEach(function (c, i) { chIndex[c] = i; });
    let legIdx = 0;
    journeys.forEach(function (j) {
        if (!state.characters.has(j.character)) return;
        if (!state.journeyAllBooks) {
            const bi = parseInt(String(j.book || '').replace(/^A/i, ''), 10);
            if (isNaN(bi) || bi < state.bookRange[0] || bi > state.bookRange[1]) return;
        }
        const a = starByName.get(j.a), b = starByName.get(j.b);
        if (!a || !b) return;
        // straight lines (like the route), tiny vertical stagger per character so
        // identical legs of different characters don't fully overlap
        const lift = (chIndex[j.character] || 0) * 0.35;
        const va = new THREE.Vector3(a.pos[0], a.pos[1] + lift, a.pos[2]);
        const vb = new THREE.Vector3(b.pos[0], b.pos[1] + lift, b.pos[2]);
        const geo = new THREE.BufferGeometry().setFromPoints([va, vb]);
        let mat;
        if (state.fxJourneys) {
            geo.setAttribute('aT', new THREE.Float32BufferAttribute([0, 1], 1));  // 0 = Sys_A, 1 = Sys_B
            mat = makeJourneyMaterial(CHARACTER_COLORS[j.character] || 0xffffff,
                (legIdx * 0.6180339887) % 1);
            journeyMats.push(mat);
        } else {
            mat = new THREE.LineBasicMaterial({
                color: CHARACTER_COLORS[j.character] || 0xffffff,
                transparent: true, opacity: 0.85, depthTest: false
            });
        }
        const line = new THREE.Line(geo, mat);
        line.renderOrder = 3;
        journeyGroup.add(line);
        legIdx += 1;
    });
    scene.add(journeyGroup);
}

/* --------------------------- 2D ↔ 3D morph transition ------------------------- */
/* On entering 3-D the stars start laid out flat exactly like the 2-D map (top-down
 * camera) and fly to their real XYZ; leaving plays it in reverse before the view
 * switches back. Toggleable in ⚙ settings (state.transition). */
const TRANS_SECONDS = 1.7;
function buildFlatLayout(frameRadius) {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    stars.forEach(function (s) {
        minX = Math.min(minX, s.map[0]); maxX = Math.max(maxX, s.map[0]);
        minY = Math.min(minY, s.map[1]); maxY = Math.max(maxY, s.map[1]);
    });
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const span = Math.max(maxX - minX, maxY - minY);
    const S = (frameRadius * 2.4) / span;
    flatPos = new Float32Array(stars.length * 3);
    stars.forEach(function (s, i) {
        flatPos[i * 3] = (s.map[0] - cx) * S;          // map east  → +X
        flatPos[i * 3 + 1] = 0;
        flatPos[i * 3 + 2] = -(s.map[1] - cy) * S;     // map north → −Z (screen-up, top-down)
    });
    overheadCam = {
        pos: new THREE.Vector3(0, frameRadius * 2.4, frameRadius * 0.03),
        target: new THREE.Vector3(0, 0, 0)
    };
}
function setTransOverlays(off) {
    if (off) MARKERS.forEach(function (m) { markerClouds[m.key].visible = false; });
    if (heightLines) heightLines.visible = !off;
    if (impactMesh) impactMesh.visible = !off;
    if (rippleMesh) rippleMesh.visible = off ? false : (state.grid && state.fxRipple);
    gridGroup.visible = off ? false : state.grid;
    selRing.visible = off ? false : !!selected;
    if (routeLine) routeLine.visible = !off;
    if (journeyGroup) journeyGroup.visible = !off;
    labelLayer.style.display = off ? 'none' : '';
}
function startTrans(dir, done) {
    if (!state.transition || !flatPos) { if (done) done(); return; }
    if (trans) {                                     // interrupt: reverse from where we are
        trans = { t: 1 - trans.t, dir: dir, done: done };
        return;
    }
    if (dir === 1) savedCam = { pos: camera.position.clone(), target: controls.target.clone() };
    trans = { t: 0, dir: dir, done: done };
    controls.enabled = false;
    setTransOverlays(true);
}
function endTrans() {
    const done = trans.done;
    trans = null;
    const p = geom.getAttribute('position');
    p.array.set(realPos);
    p.needsUpdate = true;
    camera.position.copy(savedCam.pos);
    controls.target.copy(savedCam.target);
    controls.enabled = true;
    setTransOverlays(false);
    apply();
    scheduleLabelRefresh();
    if (done) done();
}
/* Reverse animation before the boot script switches back to the 2-D map. */
export function beginExit(done) {
    if (!active || !state.transition || systemView.active) { done(); return; }
    startTrans(-1, done);
}

/* ------------------------------- ambient sound ------------------------------- */
/* Ambient sources, in priority order:
 *   1. ALL audio files in  data/audio/  (played one after another, looping the
 *      list). Discovered from the dev server's directory listing, or — on static
 *      hosts without listings — from an optional data/audio/playlist.json
 *      (["a.mp3", "b.ogg"]). See data/audio/README.txt.
 *   2. Legacy single files data/ambient.mp3 / data/ambient.ogg.
 *   3. Procedural WebAudio drone (brown-noise rumble + faint shimmer).
 * All variants fade in/out. */
const AMBIENT_DIR = 'data/audio/';
const AMBIENT_EXT = /\.(mp3|ogg|wav|m4a|flac|opus)$/i;
const AMBIENT_FILES = ['data/ambient.mp3', 'data/ambient.ogg'];
const AMBIENT_FILE_VOLUME = 0.4;
let audio = null;

async function ambientPlaylist() {
    // 1) directory listing (works under VS Code Live Server)
    try {
        const r = await fetch(AMBIENT_DIR);
        if (r.ok && (r.headers.get('content-type') || '').indexOf('html') !== -1) {
            const html = await r.text();
            const urls = [];
            const re = /href="([^"?]+)"/gi;
            let m;
            while ((m = re.exec(html))) {
                const name = decodeURIComponent(m[1]).split('/').pop();
                if (AMBIENT_EXT.test(name)) urls.push(AMBIENT_DIR + encodeURIComponent(name));
            }
            if (urls.length) return urls;
        }
    } catch (e) { /* fall through */ }
    // 2) optional manifest (needed on static hosts like Netlify)
    try {
        const r = await fetch(AMBIENT_DIR + 'playlist.json');
        if (r.ok) {
            const list = await r.json();
            if (Array.isArray(list) && list.length) {
                return list.map(function (n) { return AMBIENT_DIR + encodeURIComponent(n); });
            }
        }
    } catch (e) { /* fall through */ }
    // 3) legacy single files
    return AMBIENT_FILES.slice();
}

function fadeAudioEl(el, to, ms, then) {
    const from = el.volume, t0 = performance.now();
    (function step() {
        const k = Math.min(1, (performance.now() - t0) / ms);
        el.volume = from + (to - from) * k;
        if (k < 1) requestAnimationFrame(step); else if (then) then();
    })();
}
/* Plays the playlist sequentially (wrap-around); tracks that fail to load are
 * dropped; when nothing is playable, falls back via onFail. */
function startFileAmbient(urls, onFail) {
    const el = new Audio();
    el.volume = 0;
    let idx = 0;
    const list = urls.slice();
    function playCurrent() {
        if (!audio || audio.el !== el) return;
        if (!list.length) { audio = null; onFail(); return; }
        el.src = list[idx % list.length];
        el.load();
    }
    el.addEventListener('error', function () {
        if (!audio || audio.el !== el) return;
        list.splice(idx % list.length, 1);       // drop the broken track
        playCurrent();
    });
    el.addEventListener('canplay', function () {
        if (!audio || audio.el !== el || !el.paused) return;
        el.play().then(function () { fadeAudioEl(el, AMBIENT_FILE_VOLUME, 2000); })
            .catch(function () { audio = null; onFail(); });
    });
    el.addEventListener('ended', function () {   // next track, looping the list
        if (!audio || audio.el !== el) return;
        idx += 1;
        playCurrent();
    });
    audio = { kind: 'file', el: el };
    playCurrent();
}
function startProceduralAmbient() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        const len = ctx.sampleRate * 4;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {                    // brown noise
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            d[i] = last * 3.5;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 0.4;
        const lfo = ctx.createOscillator();                 // slow filter drift
        lfo.frequency.value = 0.045;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 55;
        lfo.connect(lfoGain); lfoGain.connect(lp.frequency);

        const shimmer = ctx.createBiquadFilter();           // faint airy layer
        shimmer.type = 'bandpass'; shimmer.frequency.value = 2400; shimmer.Q.value = 1.2;
        const shGain = ctx.createGain(); shGain.gain.value = 0.012;

        src.connect(lp); lp.connect(master);
        src.connect(shimmer); shimmer.connect(shGain); shGain.connect(master);
        src.start(); lfo.start();
        master.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 2.5);
        audio = { kind: 'proc', ctx: ctx, master: master };
}

function setSound(on) {
    if (on && !audio) {
        audio = { kind: 'pending' };
        ambientPlaylist().then(function (urls) {
            if (!audio || audio.kind !== 'pending') return;   // toggled off meanwhile
            audio = null;
            startFileAmbient(urls, startProceduralAmbient);
        });
    } else if (!on && audio) {
        const a = audio; audio = null;
        if (a.kind === 'file') {
            fadeAudioEl(a.el, 0, 1200, function () { a.el.pause(); a.el.src = ''; });
        } else if (a.kind === 'proc') {
            a.master.gain.linearRampToValueAtTime(0, a.ctx.currentTime + 1.2);
            setTimeout(function () { a.ctx.close(); }, 1500);
        }
    }
}

/* --------------------------------- system view ------------------------------- */
function enterSystem(star) {
    if (systemView.active) return;
    controls.enabled = false;
    labelLayer.style.display = 'none';
    showInfo(null, ctl);
    systemView.open(star);
}
function onSystemExit() {
    controls.enabled = true;
    labelLayer.style.display = '';
    if (selected) showInfo(selected, ctl);
    resize();
    scheduleLabelRefresh();
}

/* ----------------------------------- init ------------------------------------ */
let ctl;   // controller shared with the DOM panel

export async function init(hostEl) {
    host = hostEl;
    const data = await loadData();
    stars = data.stars;
    lanes = data.lanes;
    journeys = data.journeys;
    stars.forEach(function (s, i) { s.index = i; s.visible = true; starByName.set(s.name, s); });
    screenPos = new Float32Array(stars.length * 3);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x05060d, 1);
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.5, 60000);
    const r = Math.max(500, data.radius);
    const fr = Math.max(200, data.frameRadius);        // frame the settled cluster, not the outliers
    camera.position.set(fr * 0.45, fr * 0.7, fr * 1.3);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = r * 4;

    // --- star cloud (single Points object, custom shader) ---
    geom = new THREE.BufferGeometry();
    const pos = new Float32Array(stars.length * 3);
    const col = new Float32Array(stars.length * 3);
    const size = new Float32Array(stars.length);
    const vis = new Float32Array(stars.length);
    const kind = new Float32Array(stars.length);
    stars.forEach(function (s, i) {
        pos.set(s.pos, i * 3);
        size[i] = s.size;
        vis[i] = 1;
        kind[i] = s.kind;                      // 0 star · 1 white dwarf · 2 neutron star
    });
    realPos = pos.slice();                      // pristine XYZ for the 2D↔3D morph
    buildFlatLayout(fr);
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geom.setAttribute('aVis', new THREE.BufferAttribute(vis, 1));
    geom.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTex: { value: starTexture() },
            uScale: { value: 600 },
            uSizeMul: { value: state.sizeMul },
            uTime: { value: 0 }
        },
        vertexShader: [
            'attribute vec3 aColor; attribute float aSize; attribute float aVis; attribute float aKind;',
            'varying vec3 vColor; varying float vVis; varying float vSize; varying float vKind;',
            'uniform float uScale; uniform float uSizeMul;',
            'void main() {',
            '  vColor = aColor; vVis = aVis; vKind = aKind;',
            '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
            '  float s = clamp(aSize * uSizeMul * uScale / length(mv.xyz), ' + MIN_STAR_PX.toFixed(1) + ', ' + MAX_STAR_PX.toFixed(1) + ');',
            '  vSize = s;',
            '  gl_PointSize = aVis < 0.5 ? 0.0 : s;',
            '  gl_Position = projectionMatrix * mv;',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform sampler2D uTex; uniform float uTime;',
            'varying vec3 vColor; varying float vVis; varying float vSize; varying float vKind;',
            'void main() {',
            '  if (vVis < 0.5) discard;',
            '  float a = texture2D(uTex, gl_PointCoord).a;',
            '  vec2 p = gl_PointCoord * 2.0 - 1.0;',
            '  if (vKind > 1.5) {',                                       // neutron star
            '    float core = pow(a, 3.0) * 2.4;',                        // tiny intense core
            '    float sx = pow(max(0.0, 1.0 - abs(p.y) * 7.0), 2.0);',   // diffraction spikes
            '    float sy = pow(max(0.0, 1.0 - abs(p.x) * 7.0), 2.0);',
            '    float fall = max(0.0, 1.0 - length(p));',
            '    a = core + (sx + sy) * fall * 0.55;',
            '    a *= 0.72 + 0.28 * sin(uTime * 3.2);',                   // pulse
            '  } else if (vKind > 0.5) {',                                // white dwarf
            '    a = pow(a, 2.6) * 1.9;',                                 // tight compact core, no halo
            '  } else {',
            // small-point brightness boost so distant stars stay visible dots
            '    a *= mix(2.0, 1.0, smoothstep(2.0, 10.0, vSize));',
            '  }',
            // At/near the px floor the glow texture alone goes dim, so points "lock"
            // into a solid bright dot of fixed pixel size (colour preserved).
            '  float hardDot = smoothstep(0.95, 0.35, length(p)) * (1.0 - smoothstep(3.5, 8.0, vSize));',
            '  a = max(a, hardDot);',
            '  a = min(a, 1.0);',
            '  if (a < 0.02) discard;',
            '  gl_FragColor = vec4(vColor * a + vec3(pow(a, 3.0)) * 0.55, a);',
            '}'
        ].join('\n'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    scene.add(points);

    // --- reference grid (galactic plane through Sol) + ripple surface (fx) ---
    gridGroup = buildGrid(3000);
    scene.add(gridGroup);
    rippleMesh = buildRipple(3000);
    rippleMesh.visible = false;
    scene.add(rippleMesh);

    // --- marker glyph overlays (constant screen size, drawn on top) ---
    MARKERS.forEach(function (m) {
        const material = new THREE.PointsMaterial({
            map: glyphTexture(m.glyph, m.color),
            size: m.size * state.markerMul,
            sizeAttenuation: false,
            transparent: true,
            depthWrite: false,
            depthTest: false
        });
        const cloud = new THREE.Points(new THREE.BufferGeometry(), material);
        cloud.frustumCulled = false;
        cloud.renderOrder = 2;
        markerClouds[m.key] = cloud;
        scene.add(cloud);
    });

    // --- selection ring (screen-constant sprite) ---
    selRing = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringTexture(), transparent: true, depthWrite: false, depthTest: false
    }));
    selRing.visible = false;
    selRing.renderOrder = 3;
    scene.add(selRing);

    // --- HTML overlays: labels + panels ---
    labelLayer = document.createElement('div');
    labelLayer.className = 'v3d-labels';
    host.appendChild(labelLayer);
    hoverLabel = makeLabelDiv('v3d-label v3d-label-hover');
    [100, 300, 500, 1000, 1500, 2000, 2500, 3000].forEach(function (lr) {
        const el = makeLabelDiv('v3d-grid-label');
        el.textContent = lr + ' ly';
        el.style.display = 'none';
        gridLabels.push({ x: lr, z: 0, el: el, enabled: true });
    });

    ctl = {
        stars: stars,
        state: state,
        apply: apply,
        applyVisual: applyVisual,
        select: select,
        flyTo: flyTo,
        enterSystem: enterSystem,
        setSound: setSound,
        setSky: setSky,
        computeRoute: computeRoute,
        clearRoute: clearRoute,
        redrawRoute: drawRouteFromState,
        getSelected: function () { return selected; },
        // close-up state + in-system search (systemView is created just below;
        // these closures read it lazily, so they're valid by the time they run)
        inSystem: function () { return !!(systemView && systemView.active); },
        searchSystemBodies: function () {
            return (systemView && systemView.active && systemView.searchBodies) ? systemView.searchBodies() : [];
        },
        focusSystemBody: function (item) { if (systemView && systemView.focusBody) systemView.focusBody(item); }
    };
    const sidebarEl = document.getElementById('sidebar') || host;
    let panelEl = buildPanel(sidebarEl, ctl);
    // Panel widgets are rebuilt wholesale after programmatic state changes
    // (filter sync from the 2-D view, global reset) — cheap and always consistent.
    rebuildPanel = function () {
        panelEl.remove();
        panelEl = buildPanel(sidebarEl, ctl);
    };
    buildSettings(host, ctl);
    buildInfo(host, ctl);

    /* Reset every 3-D filter to defaults (part of the global "Reset all filters"). */
    window.SC_reset3D = function () {
        state.colorMode = 'spectral';
        state.classes = new Set(Object.keys(CLASSES));
        state.nations = new Set(Object.keys(NATION_COLORS).concat([null]));
        state.characters = new Set();
        state.journeyAllBooks = false;
        state.bookRange = [1, 1];
        state.book = 'A1';
        Object.keys(state.markers).forEach(function (k) { state.markers[k] = false; });
        clearRoute();
        rebuildPanel();
        apply();
    };
    systemView = createSystemView(renderer, host, onSystemExit, state);

    // --- events ---
    let downX = 0, downY = 0;
    renderer.domElement.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; });
    renderer.domElement.addEventListener('pointerup', function (e) {
        if (systemView.active) return;
        if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return;
        const rect = renderer.domElement.getBoundingClientRect();
        select(pick(e.clientX - rect.left, e.clientY - rect.top));
    });
    renderer.domElement.addEventListener('dblclick', function (e) {
        if (systemView.active) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const s = pick(e.clientX - rect.left, e.clientY - rect.top);
        if (s) { select(s); flyTo(s); }
    });
    renderer.domElement.addEventListener('pointermove', function (e) {
        if (systemView.active) { hovered = null; return; }
        const rect = renderer.domElement.getBoundingClientRect();
        hovered = pick(e.clientX - rect.left, e.clientY - rect.top);
        renderer.domElement.style.cursor = hovered ? 'pointer' : '';
    });
    controls.addEventListener('change', scheduleLabelRefresh);

    new ResizeObserver(resize).observe(host);

    apply();
    if (state.sky) setSky(true);                // backdrop is on by default
    console.log('[ShipCore-3D] initialised:', stars.length, 'systems');
}

function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    points.material.uniforms.uScale.value = h / (2 * Math.tan(camera.fov * Math.PI / 360));
    if (systemView) systemView.resize(w, h);
    scheduleLabelRefresh();
}

/* --------------------------------- render loop ------------------------------- */
function frame() {
    raf = requestAnimationFrame(frame);
    const dt = timer.delta();
    const t = timer.t;

    if (systemView.active) {                    // close-up mode owns the frame
        systemView.render(t, dt);
        return;
    }

    points.material.uniforms.uTime.value = t;   // neutron-star pulse
    if (rippleMesh.visible) rippleMesh.material.uniforms.uTime.value = t;
    if (lineMatFx) lineMatFx.uniforms.uTime.value = t;
    if (impactMat) impactMat.uniforms.uTime.value = t;
    for (let jm = 0; jm < journeyMats.length; jm++) journeyMats[jm].uniforms.uTime.value = t;
    if (routeMat) routeMat.uniforms.uTime.value = t;

    // 2D↔3D morph: stars fly between the flat map layout and their real XYZ
    if (trans) {
        trans.t = Math.min(1, trans.t + dt / TRANS_SECONDS);
        const raw = trans.dir === 1 ? trans.t : 1 - trans.t;   // 0 = flat/map, 1 = real 3D
        const k = raw * raw * (3 - 2 * raw);                   // smoothstep
        const p = geom.getAttribute('position');
        for (let i = 0; i < p.array.length; i++) {
            p.array[i] = flatPos[i] + (realPos[i] - flatPos[i]) * k;
        }
        p.needsUpdate = true;
        camera.position.lerpVectors(overheadCam.pos, savedCam.pos, k);
        controls.target.lerpVectors(overheadCam.target, savedCam.target, k);
        camera.lookAt(controls.target);
        renderer.render(scene, camera);
        if (trans.t >= 1) endTrans();
        return;
    }
    if (fly) {
        fly.t = Math.min(1, fly.t + 1 / 55);
        const k = 1 - Math.pow(1 - fly.t, 3);      // ease-out cubic
        controls.target.lerpVectors(fly.fromT, fly.toT, k);
        camera.position.lerpVectors(fly.fromC, fly.toC, k);
        if (fly.t >= 1) { fly = null; scheduleLabelRefresh(); }
    }
    controls.update();
    if (selected) {   // keep the selection ring screen-constant
        const d = camera.position.distanceTo(selRing.position);
        const s = d * 38 / points.material.uniforms.uScale.value;
        selRing.scale.set(s, s, 1);
    }
    projectAll();
    placeLabels();
    renderer.render(scene, camera);
}

const SYNCED_MARKERS = ['capital', 'core', 'mining', 'industrial'];   // 2-D layer ↔ 3-D marker
export function activate() {
    if (active) return;
    active = true;
    // pull the shared state (Book range, characters, special-system layers) from the 2-D view
    if (window.SC_filters) {
        const br = window.SC_filters.getBookRange();
        state.bookRange = br;
        state.book = 'A' + br[1];
        state.characters = new Set(window.SC_filters.getCharacters());
    }
    if (window.SC_layerToggles) {
        SYNCED_MARKERS.forEach(function (k) { state.markers[k] = window.SC_layerToggles.get(k); });
    }
    rebuildPanel();
    apply();
    drawRouteFromState();                       // route carried over from the 2-D planner
    timer.start();
    resize();
    if (!systemView.active) startTrans(1);      // fly from the map layout into 3-D
    frame();
}
export function deactivate() {
    if (!active) return;
    active = false;
    // push the shared state back to the 2-D view
    if (window.SC_filters) {
        window.SC_filters.setBookRange(state.bookRange[0], state.bookRange[1]);
        window.SC_filters.setCharacters(Array.from(state.characters));
    }
    if (window.SC_layerToggles) {
        SYNCED_MARKERS.forEach(function (k) { window.SC_layerToggles.set(k, state.markers[k]); });
    }
    if (window.SC_route2D) window.SC_route2D.sync();
    cancelAnimationFrame(raf);
    raf = null;
}
