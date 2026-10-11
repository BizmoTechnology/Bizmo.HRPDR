/**
 * Bizmo Universal Theme · three.js
 *
 * Sahne, ışık ve malzeme ön ayarları + marka grafik dilinin (düğüm · akson · sinyal) 3B karşılığı.
 * Bağımlılık yok: THREE ad alanını parametre olarak verirsiniz (three r150+).
 *
 *   import * as THREE from "three";
 *   import { bizmoScene, bizmoLights, bizmoMaterials, axonPath, BIZMO_3D } from "@bizmo/theme/three";
 *   const mode = "dark";
 *   bizmoScene(THREE, scene, renderer, mode);
 *   bizmoLights(THREE, mode).forEach((l) => scene.add(l));
 *   const m = bizmoMaterials(THREE, mode);
 *   scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 16), m.node));
 *
 * Kurallar (DESIGN.md §12):
 *  - Tek merkez; ağ kadrajın dışına taşar (asla kapanmaz); düğüm yoğunluğu alanın %20'sini geçmez
 *  - Aksonlar yalnız 0°, 45°, 90° kırılır (axonPath); eğri kullanılmaz
 *  - Aynı karede en fazla 3 sinyal; sinyal tek yöne akar
 *  - Yeşil yalnız sinyal ve "canlı" düğümde; veri/bağlantı mavi-gri; zemin lacivert (koyu) veya serin bulut grisi (açık)
 *  - prefers-reduced-motion: sinyaller durur, kamera sabit; WebGL yoksa SVG/2B yedek gösterilir
 */
export const BIZMO_3D = {
    light: {
        background: 0xedf2f7,
        fog: 0xf3f6fa,
        node: 0xffffff,
        nodeEdge: 0x18232f,
        nodeLive: 0x6db92c,
        axon: 0x8f9aa6,
        axonActive: 0x0094c9,
        signal: 0x4e8c1e,
        ground: 0xe6ecf2,
        gridLine: 0xd2dae4,
        label: "#18232f",
        hemiSky: 0xffffff,
        hemiGround: 0xd3dce6,
        key: 0xffffff,
        exposure: 1.12,
        floorDot: 0x9aa8b8,
        shadowOpacity: 0.1,
        glow: 0x6db92c,
    },
    dark: {
        background: 0x0b131b,
        fog: 0x0d151d,
        node: 0x22313f,
        nodeEdge: 0xa8b5c2,
        nodeLive: 0x6db92c,
        axon: 0x3a4b5c,
        axonActive: 0x33b9e8,
        signal: 0x6db92c,
        ground: 0x0f1a24,
        gridLine: 0x223342,
        label: "#eef3f8",
        hemiSky: 0x9fb3c8,
        hemiGround: 0x0d151d,
        key: 0xdfe8f2,
        exposure: 1.05,
        floorDot: 0x33475a,
        shadowOpacity: 0.42,
        glow: 0x8ed14f,
    },
};
/** Kategori renkleri (veri katmanları, makine grupları) — charts.ts ile aynı sıra */
export const BIZMO_3D_SERIES = {
    light: [0x0a8fc4, 0xe8743b, 0x16a087, 0xd99a00, 0xd1508a, 0x7a6be0],
    dark: [0x1f97cc, 0xd9662c, 0x14937b, 0xb88000, 0xd55181, 0x8f84e8],
};
/** Durum renkleri (makine/sensör: çalışıyor · uyarı · arıza · bilgi) — her zaman etiketle */
export const BIZMO_3D_STATUS = {
    light: { ok: 0x3f8f1a, warning: 0xb86e00, fault: 0xd6453d, info: 0x0094c9, idle: 0x7c8791 },
    dark: { ok: 0x8ed14f, warning: 0xf0ac55, fault: 0xf0787c, info: 0x33b9e8, idle: 0x5d6b78 },
};
/**
 * Sahne zemini, sis, ton eşleme ve renk uzayı.
 * transparent: true → arka plan ve sis çizilmez; tuvalin arkasındaki CSS zemini (.bz-scene) görünür.
 * Önerilen budur: tema değişince zemin CSS'ten kendiliğinden gelir. Renderer { alpha: true } ile oluşturulmalı.
 */
export function bizmoScene(THREE, scene, renderer, mode, opts = {}) {
    const p = BIZMO_3D[mode];
    scene.background = opts.transparent ? null : new THREE.Color(p.background);
    scene.fog = opts.transparent ? null : new THREE.Fog(p.fog, 18, 60);
    if (renderer) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Neutral (r162+) beyazı ve marka renklerini korur; yoksa ACES
        renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = p.exposure;
        renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    }
    return scene;
}
/** Yumuşak, gölgesi sakin ışık düzeni: gökyüzü/zemin + tek anahtar ışık (+ koyuda arka kenar ışığı) */
export function bizmoLights(THREE, mode) {
    const p = BIZMO_3D[mode];
    const hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, mode === "dark" ? 0.9 : 1.55);
    const key = new THREE.DirectionalLight(p.key, mode === "dark" ? 1.4 : 1.6);
    key.position.set(6, 10, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
    // Gölge kamerası tüm ağı kapsar (varsayılan ±5 birim, kenardaki düğümlerin gölgesini keser)
    Object.assign(key.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 0.5, far: 80 });
    const lights = [hemi, key];
    if (mode === "dark") {
        const rim = new THREE.DirectionalLight(0x33b9e8, 0.35);
        rim.position.set(-8, 4, -6);
        lights.push(rim);
    }
    return lights;
}
/** Malzemeler: mat, düşük parlaklık; parlak/metalik efekt yok (marka: gösteriş yok, sakin) */
export function bizmoMaterials(THREE, mode) {
    const p = BIZMO_3D[mode];
    return {
        node: new THREE.MeshStandardMaterial({ color: p.node, roughness: 0.55, metalness: 0.05 }),
        nodeLive: new THREE.MeshStandardMaterial({ color: p.nodeLive, emissive: p.nodeLive, emissiveIntensity: mode === "dark" ? 0.45 : 0.15, roughness: 0.4 }),
        nodeEdge: new THREE.LineBasicMaterial({ color: p.nodeEdge, transparent: true, opacity: mode === "dark" ? 0.5 : 0.35 }),
        axon: new THREE.LineBasicMaterial({ color: p.axon, transparent: true, opacity: mode === "dark" ? 0.8 : 0.7 }),
        axonActive: new THREE.LineBasicMaterial({ color: p.axonActive }),
        // Tüp aksonlar (bizmoAxonTube) için mesh malzemeleri
        axonTube: new THREE.MeshBasicMaterial({ color: p.axon, transparent: true, opacity: mode === "dark" ? 0.85 : 0.7 }),
        axonTubeActive: new THREE.MeshBasicMaterial({ color: p.axonActive }),
        axonTubeDim: new THREE.MeshBasicMaterial({ color: p.axon, transparent: true, opacity: mode === "dark" ? 0.3 : 0.25 }),
        signal: new THREE.MeshBasicMaterial({ color: p.signal }),
        surface: new THREE.MeshStandardMaterial({ color: p.ground, roughness: 0.92, metalness: 0 }),
        glass: new THREE.MeshPhysicalMaterial({
            color: mode === "dark" ? 0x15212c : 0xffffff,
            roughness: 0.25,
            transmission: 0.6,
            thickness: 0.4,
            transparent: true,
            opacity: mode === "dark" ? 0.55 : 0.7,
        }),
        series: BIZMO_3D_SERIES[mode].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })),
    };
}
/** Düğüm kenar çizgisi: koyu temada hacmi okutur, açık temada ince lacivert kontur. mesh.add(bizmoEdges(THREE, mesh.geometry, m.nodeEdge)) */
export function bizmoEdges(THREE, geometry, material, thresholdAngle = 30) {
    return new THREE.LineSegments(new THREE.EdgesGeometry(geometry, thresholdAngle), material);
}
/** Zemin ızgarası (dijital ikiz, yerleşim planı): ince, sisle kaybolan */
export function bizmoGrid(THREE, mode, size = 40, divisions = 40) {
    const p = BIZMO_3D[mode];
    const g = new THREE.GridHelper(size, divisions, p.gridLine, p.gridLine);
    g.material.transparent = true;
    g.material.opacity = mode === "dark" ? 0.6 : 0.8;
    return g;
}
/**
 * Akson yolu: iki nokta arasında yalnız 0°/45°/90° kırılan çizgi (XZ düzleminde).
 * Önce eksen boyunca, sonra 45° çapraz, sonra yine eksen — "okunabilir sinyal yolu".
 */
export function axonPath(a, b) {
    const [ax, ay, az] = a;
    const [bx, , bz] = b;
    const dx = bx - ax;
    const dz = bz - az;
    const diag = Math.min(Math.abs(dx), Math.abs(dz));
    const sx = Math.sign(dx);
    const sz = Math.sign(dz);
    const straightX = Math.abs(dx) - diag;
    const straightZ = Math.abs(dz) - diag;
    const p1 = [ax + (sx * straightX) / 2, ay, az + (sz * straightZ) / 2];
    const p2 = [p1[0] + sx * diag, ay, p1[2] + sz * diag];
    return [a, p1, p2, [bx, ay, bz]];
}
/** Sinyal: yol boyunca tek yönde akan nokta. t ∈ [0,1) her karede artırılır */
export function pointOnPath(path, t) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
        const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
        seg.push(d);
        total += d;
    }
    let dist = (((t % 1) + 1) % 1) * total;
    for (let i = 0; i < seg.length; i++) {
        if (dist <= seg[i] || i === seg.length - 1) {
            const k = seg[i] ? dist / seg[i] : 0;
            const p = path[i];
            const q = path[i + 1];
            return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
        }
        dist -= seg[i];
    }
    return path[path.length - 1];
}
/** Hareket tercihi: azaltılmış harekette sinyaller durur, kamera otomatik dönmez */
export const prefersReducedMotion = () => typeof matchMedia !== "undefined" &&
    (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced");
/** Sayfa temasını izler: data-theme / .dark / işletim sistemi değişince callback(mode) */
export function watchMode(cb) {
    const read = () => {
        const r = document.documentElement;
        if (r.dataset.theme === "dark" || r.classList.contains("dark"))
            return "dark";
        if (r.dataset.theme === "light")
            return "light";
        return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };
    // Yalnız mod gerçekten değişince çağırır: <html> sınıfına dokunan başka kod (çerçeve, eklenti) sahneyi yeniden kurdurmasın
    let current = null;
    const on = () => {
        const m = read();
        if (m === current)
            return;
        current = m;
        cb(m);
    };
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", on);
    on();
    return () => {
        mo.disconnect();
        mq.removeEventListener("change", on);
    };
}
// ───────────────────────── Şık sahne yapı taşları ─────────────────────────
const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;
const reduced = () => prefersReducedMotion();
/**
 * Zemin: yalnız gölgeyi gösteren saydam düzlem + kenarlara doğru solan nokta ızgara (planlama kâğıdı hissi).
 * Tema değişince setMode(mode) çağrılır.
 */
export function bizmoFloor(THREE, mode, opts = {}) {
    const size = opts.size ?? 60;
    const spacing = opts.spacing ?? 1;
    const group = new THREE.Group();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity: BIZMO_3D[mode].shadowOpacity }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.receiveShadow = true;
    // Saydam düzlemler aynı yükseklikte: sıralama kameraya göre değişip titremesin diye sabit (önce noktalar, sonra gölge)
    shadow.renderOrder = -1;
    group.add(shadow);
    const canvas = document.createElement("canvas");
    const px = 1024;
    canvas.width = canvas.height = px;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const dots = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    dots.rotation.x = -Math.PI / 2;
    dots.position.y = 0.002;
    dots.renderOrder = -2;
    group.add(dots);
    const draw = (m) => {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, px, px);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = hex(BIZMO_3D[m].floorDot);
        const step = (px / size) * spacing;
        const r = Math.max(1, step * 0.07);
        for (let y = step / 2; y < px; y += step)
            for (let x = step / 2; x < px; x += step) {
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        // Kenarlara doğru sol: ağ kadrajın dışına taşar ama zemin bir "kutu" gibi bitmez
        ctx.globalCompositeOperation = "destination-in";
        const g = ctx.createRadialGradient(px / 2, px / 2, px * 0.05, px / 2, px / 2, px * 0.5);
        g.addColorStop(0, "rgba(0,0,0,0.9)");
        g.addColorStop(0.55, "rgba(0,0,0,0.45)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, px, px);
        texture.needsUpdate = true;
        shadow.material.opacity = BIZMO_3D[m].shadowOpacity;
    };
    draw(mode);
    return { group, setMode: draw };
}
/** Düğüm: yuvarlak disk (puck). Uygulama, makine, birim. Kenar çizgisi için bizmoEdges ekleyin */
export function bizmoPuck(THREE, material, opts = {}) {
    const r = opts.radius ?? 0.62;
    const h = opts.height ?? 0.26;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 72), material);
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}
/** Durum halkası: yalnız uyarı ve arızada çizilir (sakin sahne: "çalışıyor" halka almaz) */
export function bizmoStatusRing(THREE, color, radius = 0.8) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.032, 12, 96), new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    return ring;
}
/** Akson tüpü: 0°/45°/90° yolu kalınlığı olan çizgi olarak (1px WebGL çizgisinden daha okunur) */
export function bizmoAxonTube(THREE, path, material, radius = 0.026) {
    const curve = new THREE.CurvePath();
    for (let i = 1; i < path.length; i++) {
        const a = new THREE.Vector3(...path[i - 1]);
        const b = new THREE.Vector3(...path[i]);
        if (a.distanceTo(b) > 1e-4)
            curve.add(new THREE.LineCurve3(a, b));
    }
    const length = curve.getLength();
    return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.round(length * 6)), radius, 8, false), material);
}
/** Yumuşak parıltı dokusu (sinyal başı, canlı düğüm halesi) */
export function bizmoGlowTexture(THREE, color) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    const col = hex(color);
    g.addColorStop(0, col + "ff");
    g.addColorStop(0.25, col + "aa");
    g.addColorStop(1, col + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
/**
 * Sinyal: parlak baş + sönümlenen kuyruk. Yol boyunca tek yönde akar.
 *   const s = bizmoSignal(THREE, mode); scene.add(s.group); her karede s.set(path, t)
 */
export function bizmoSignal(THREE, mode, opts = {}) {
    const size = opts.size ?? 0.1;
    const count = opts.trail ?? 7;
    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(size, 16, 10);
    const parts = [];
    for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: BIZMO_3D[mode].signal, transparent: true, opacity: i === 0 ? 1 : 0.55 * (1 - i / count) }));
        m.scale.setScalar(i === 0 ? 1 : 0.85 - (i / count) * 0.5);
        group.add(m);
        parts.push(m);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: bizmoGlowTexture(THREE, BIZMO_3D[mode].glow), transparent: true, depthWrite: false, opacity: mode === "dark" ? 0.9 : 0.55 }));
    glow.scale.setScalar(size * 9);
    group.add(glow);
    return {
        group,
        set(path, t, gap = 0.012, lift = 0.12) {
            parts.forEach((p, i) => {
                const [x, , z] = pointOnPath(path, Math.max(0, t - i * gap));
                p.position.set(x, lift, z);
                p.visible = t - i * gap >= 0;
            });
            glow.position.copy(parts[0].position);
        },
        setMode(m) {
            parts.forEach((p) => p.material.color.set(BIZMO_3D[m].signal));
            glow.material.map?.dispose();
            glow.material.map = bizmoGlowTexture(THREE, BIZMO_3D[m].glow);
            glow.material.opacity = m === "dark" ? 0.9 : 0.55;
        },
    };
}
/** Canlı düğüm halesi: genişleyip sönen halka (azaltılmış harekette sabit) */
export function bizmoPulse(THREE, mode, radius = 1.2) {
    const mat = new THREE.MeshBasicMaterial({ color: BIZMO_3D[mode].nodeLive, transparent: true, opacity: 0.35, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.06, 96), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    return {
        mesh: ring,
        update(time) {
            if (reduced()) {
                ring.scale.setScalar(1.15);
                mat.opacity = 0.25;
                return;
            }
            const k = (time % 2.4) / 2.4;
            ring.scale.setScalar(1 + k * 0.9);
            mat.opacity = 0.4 * (1 - k);
        },
        setMode(m) { mat.color.set(BIZMO_3D[m].nodeLive); },
    };
}
/** OrbitControls ayarı: yumuşak sönüm, zemin altına inmez, sınırlı yakınlaştırma. Sınıfı parametre olarak verin */
export function bizmoOrbit(OrbitControls, camera, dom, opts = {}) {
    const c = new OrbitControls(camera, dom);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.minDistance = opts.minDistance ?? 8;
    c.maxDistance = opts.maxDistance ?? 36;
    c.minPolarAngle = 0.25;
    c.maxPolarAngle = 1.22;
    c.rotateSpeed = 0.6;
    c.zoomSpeed = 0.8;
    c.autoRotate = (opts.autoRotate ?? true) && !reduced();
    c.autoRotateSpeed = 0.35;
    return c;
}
const focusRuns = new WeakMap();
const focusWatched = new WeakSet();
/**
 * Kamerayı bir noktaya yumuşakça odaklar (kontrol hedefi ile birlikte). Azaltılmış harekette anında.
 * Aynı kontrolde yeni odaklama öncekini durdurur; kullanıcı sürüklemeye başlarsa odaklama bırakılır
 * (iki animasyon ya da animasyon + el aynı kamerayı çekiştirip titretmez).
 */
export function bizmoFocus(camera, controls, target, opts = {}) {
    const run = {};
    focusRuns.set(controls, run);
    if (!focusWatched.has(controls)) {
        focusWatched.add(controls);
        controls.addEventListener?.("start", () => focusRuns.delete(controls));
    }
    const from = { t: controls.target.clone(), p: camera.position.clone() };
    const dir = camera.position.clone().sub(controls.target).normalize();
    const dist = opts.distance ?? camera.position.distanceTo(controls.target);
    const toT = controls.target.clone().set(...target);
    // position verilirse kamera tam o noktaya gider (koridor içi, üstten plan gibi hazır görünümler)
    const toP = opts.position ? camera.position.clone().set(...opts.position) : toT.clone().add(dir.multiplyScalar(dist));
    const ms = reduced() ? 0 : opts.duration ?? 650;
    return new Promise((resolve) => {
        const start = performance.now();
        const step = (now) => {
            if (focusRuns.get(controls) !== run)
                return resolve();
            const k = ms ? Math.min(1, (now - start) / ms) : 1;
            const e = 1 - Math.pow(1 - k, 3);
            controls.target.lerpVectors(from.t, toT, e);
            camera.position.lerpVectors(from.p, toP, e);
            controls.update();
            if (k < 1)
                requestAnimationFrame(step);
            else {
                focusRuns.delete(controls);
                resolve();
            }
        };
        requestAnimationFrame(step);
    });
}
/**
 * Kamera takibi (hareketli nesne: gantry, forklift, AGV). Döngüde controls.update()'ten SONRA, her karede çağrılır.
 *   const fol = bizmoFollow(THREE, camera, controls);
 *   fol.start("chase", [3, 3, 1.5]);        dıştan: hedef nesneye yumuşakça kayar, kamera aynı farkla taşınır;
 *                                           kullanıcı nesnenin etrafında döndürüp yakınlaştırabilir (fark verilmezse mevcut açı korunur)
 *   fol.start("mount");                     araç üstü: kamera eye → look noktalarına bağlı, sürükleme kapalı
 *   fol.update(dt, anchor, { eye, look });  anchor / eye / look: dünya koordinatı (THREE.Vector3)
 *   fol.stop();                             sürükleme ve görüş açısı (fov) eski hâline döner
 * opts.mountFov: araç üstü kamerada görüş açısı (varsayılan 62°; yakın raf ve kollar birlikte görünür)
 * Başlarken süren bizmoFocus durur. Azaltılmış harekette yumuşatma yoktur (kamera anında yerinde).
 */
export function bizmoFollow(THREE, camera, controls, opts = {}) {
    const baseFov = camera.fov;
    const mountFov = opts.mountFov ?? 62;
    // Araç üstü kamerada geniş açı: yakındaki raf ve kollar birlikte görünür; çıkınca eski açıya döner
    const fovTo = (to, a) => {
        if (Math.abs(camera.fov - to) < 0.05)
            return;
        camera.fov += (to - camera.fov) * a;
        camera.updateProjectionMatrix();
    };
    let on = false;
    let mode = "chase";
    let want = null;
    const d = new THREE.Vector3();
    const off = new THREE.Vector3();
    return {
        get active() {
            return on;
        },
        get mode() {
            return mode;
        },
        start(m = "chase", offset) {
            on = true;
            mode = m;
            focusRuns.delete(controls);
            controls.enabled = m === "chase";
            want = offset ? new THREE.Vector3(...offset) : null;
        },
        stop() {
            if (!on)
                return;
            on = false;
            want = null;
            controls.enabled = true;
            fovTo(baseFov, 1);
        },
        update(dt, anchor, mount) {
            if (!on)
                return;
            const snap = reduced();
            if (mode === "mount") {
                if (!mount)
                    return;
                const a = snap ? 1 : 1 - Math.exp(-dt * 9);
                fovTo(mountFov, a);
                camera.position.lerp(mount.eye, a);
                controls.target.lerp(mount.look, a);
                camera.lookAt(controls.target);
                return;
            }
            // Hedef ve kamera aynı farkla kayar: kullanıcının döndürdüğü açı ve uzaklık korunur
            const a = snap ? 1 : 1 - Math.exp(-dt * 6);
            fovTo(baseFov, a);
            d.copy(anchor).sub(controls.target).multiplyScalar(a);
            controls.target.add(d);
            camera.position.add(d);
            if (want) {
                off.copy(camera.position).sub(controls.target).lerp(want, a);
                camera.position.copy(controls.target).add(off);
                if (off.distanceToSquared(want) < 1e-4)
                    want = null;
            }
            camera.lookAt(controls.target);
        },
    };
}
/** 3B noktayı ekrana yansıtıp HTML etiketi taşır; kameranın arkasındaysa gizler. Her karede çağrılır */
export function bizmoProjectLabel(camera, position, el, width, height) {
    const v = position.clone().project(camera);
    const visible = v.z < 1 && v.z > -1;
    el.style.visibility = visible ? "visible" : "hidden";
    if (visible)
        el.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px) translate(-50%, -100%)`;
    return visible;
}
/** Üzerine gelme ve seçim: işaretçi + ışın. Boşluğa tıklamak seçimi kaldırır (null) */
export function bizmoPicker(THREE, camera, dom, getTargets, on) {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt = null;
    const pick = (e) => {
        const r = dom.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        return ray.intersectObjects(getTargets(), false)[0] ?? null;
    };
    // İkinci argüman tam kesişim: InstancedMesh'te hit.instanceId hangi örneğin seçildiğini verir
    const move = (e) => {
        const hit = pick(e);
        dom.style.cursor = hit ? "pointer" : "grab";
        on.hover?.(hit ? hit.object : null, hit);
    };
    const down = (e) => { downAt = [e.clientX, e.clientY]; };
    // Sürükleme (döndürme) seçim sayılmaz
    const up = (e) => {
        if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) {
            const hit = pick(e);
            on.select?.(hit ? hit.object : null, hit);
        }
        downAt = null;
    };
    const leave = () => on.hover?.(null);
    dom.addEventListener("pointermove", move);
    dom.addEventListener("pointerdown", down);
    dom.addEventListener("pointerup", up);
    dom.addEventListener("pointerleave", leave);
    return () => {
        dom.removeEventListener("pointermove", move);
        dom.removeEventListener("pointerdown", down);
        dom.removeEventListener("pointerup", up);
        dom.removeEventListener("pointerleave", leave);
    };
}
/**
 * Sahnenin bir kısmını kaplayan panel varken ağı kalan alanda ortalar (etiket yansıtması da doğru kalır).
 *   bizmoViewInset(camera, W, H, { left: panel.offsetWidth + 12 })
 */
export function bizmoViewInset(camera, width, height, inset = {}) {
    const dx = ((inset.left ?? 0) - (inset.right ?? 0)) / 2;
    const dy = (inset.bottom ?? 0) / 2;
    if (!dx && !dy)
        camera.clearViewOffset();
    else
        camera.setViewOffset(width, height, -dx, dy, width, height);
    camera.updateProjectionMatrix();
}
/**
 * Tezgâh (CNC, torna, pres): gövde + cam kapı + kontrol paneli + dönen iş mili + durum lambası + ton şeridi.
 *   const m = bizmoMachine(THREE, mode, mats, { hue: 0x7f8fa6 }); scene.add(m.group); m.setStatus("fault"); her karede m.update(dt, rpm)
 */
export function bizmoMachine(THREE, mode, mats, opts = {}) {
    const w = opts.w ?? 1.8, h = opts.h ?? 1.25, d = opts.d ?? 1.3;
    const group = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, 0.1, d + 0.24), mats.surface);
    plinth.position.y = 0.05;
    plinth.receiveShadow = true;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.node);
    body.position.y = 0.1 + h / 2;
    body.castShadow = body.receiveShadow = true;
    body.add(bizmoEdges(THREE, body.geometry, mats.nodeEdge));
    const glassMat = new THREE.MeshStandardMaterial({ color: mode === "dark" ? 0x0b131b : 0x2a3642, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.88 });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.52, h * 0.5), glassMat);
    glass.position.set(-w * 0.12, 0.1 + h * 0.55, d / 2 + 0.002);
    const panelMat = new THREE.MeshStandardMaterial({ color: mode === "dark" ? 0x33475a : 0x18232f, roughness: 0.5 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, h * 0.36, 0.06), panelMat);
    panel.position.set(w * 0.33, 0.1 + h * 0.6, d / 2 + 0.03);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.002, 0.07, d + 0.002), new THREE.MeshBasicMaterial({ color: opts.hue ?? BIZMO_3D[mode].nodeLive }));
    stripe.position.y = 0.1 + h - 0.12;
    // İş mili: üstte dönen disk + işaret (dönüş görünsün)
    const spindle = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 32), panelMat);
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.06), new THREE.MeshBasicMaterial({ color: opts.hue ?? BIZMO_3D[mode].nodeLive }));
    notch.position.x = 0.12;
    spindle.add(disc, notch);
    spindle.position.set(-w * 0.18, 0.1 + h + 0.05, 0);
    // Durum lambası: ince direk + küre
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), panelMat);
    pole.position.set(w * 0.36, 0.1 + h + 0.21, -d * 0.3);
    const beaconMat = new THREE.MeshBasicMaterial({ color: BIZMO_3D_STATUS[mode].ok });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), beaconMat);
    beacon.position.set(w * 0.36, 0.1 + h + 0.48, -d * 0.3);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: bizmoGlowTexture(THREE, BIZMO_3D_STATUS[mode].ok), transparent: true, depthWrite: false, opacity: 0.8 }));
    halo.scale.setScalar(0.75);
    halo.position.copy(beacon.position);
    group.add(plinth, body, glass, panel, stripe, spindle, pole, beacon, halo);
    let status = "ok";
    let blink = 0;
    const colorOf = (s) => BIZMO_3D_STATUS[mode][s === "fault" ? "fault" : s === "warning" ? "warning" : s === "idle" ? "idle" : "ok"];
    return {
        group,
        pickable: body,
        setStatus(s) {
            status = s;
            beaconMat.color.set(colorOf(s));
            halo.material.map?.dispose();
            halo.material.map = bizmoGlowTexture(THREE, colorOf(s));
            halo.visible = s !== "idle";
        },
        /** rpm: dakikadaki devir (0 = duruyor). Arızada lamba yumuşakça nabız atar, hiç sönmez (çakar değil; azaltılmış harekette sabit) */
        update(dt, rpm) {
            spindle.rotation.y += (rpm / 60) * Math.PI * 2 * dt * 0.08;
            beacon.visible = true;
            halo.visible = status !== "idle";
            if (status === "fault" && !prefersReducedMotion()) {
                blink += dt;
                const k = 0.5 + 0.5 * Math.sin(blink * 4.2); // ~0,7 Hz
                halo.material.opacity = 0.35 + 0.55 * k;
                halo.scale.setScalar(0.62 + 0.3 * k);
            }
            else {
                halo.material.opacity = 0.8;
                halo.scale.setScalar(0.75);
            }
        },
        dispose() { glassMat.dispose(); panelMat.dispose(); beaconMat.dispose(); },
    };
}
/** Bant / yol üzerinde akan parçalar (üretim hattı, depo). speed 0 → durur */
export function bizmoFlow(THREE, path, opts = {}) {
    const count = opts.count ?? 8;
    const size = opts.size ?? 0.22;
    const mat = new THREE.MeshStandardMaterial({ color: opts.color ?? 0x8f9aa6, roughness: 0.6 });
    const geo = new THREE.BoxGeometry(size, size * 0.7, size);
    const group = new THREE.Group();
    const items = Array.from({ length: count }, (_, i) => {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        group.add(m);
        return { m, t: i / count };
    });
    const lift = opts.lift ?? 0.2;
    const place = () => items.forEach((it) => { const [x, , z] = pointOnPath(path, it.t); it.m.position.set(x, lift, z); });
    place();
    return {
        group,
        material: mat,
        /** speed: yol uzunluğu başına döngü/sn; dönüş: bu karede yolun sonuna ulaşan parça sayısı */
        update(dt, speed) {
            let arrived = 0;
            if (speed > 0 && !prefersReducedMotion())
                items.forEach((it) => { it.t += dt * speed; if (it.t >= 1) {
                    it.t -= 1;
                    arrived++;
                } });
            place();
            return arrived;
        },
    };
}
/** Araç (sevkiyat haritası): kabin + dorse; yol boyunca yön alır. Uyarıda turuncu lamba */
export function bizmoTruck(THREE, mode, mats, opts = {}) {
    const group = new THREE.Group();
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.42), mats.node);
    trailer.position.set(-0.18, 0.31, 0);
    trailer.castShadow = true;
    trailer.add(bizmoEdges(THREE, trailer.geometry, mats.nodeEdge));
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.4), new THREE.MeshStandardMaterial({ color: opts.hue ?? 0xec7246, roughness: 0.5 }));
    cab.position.set(0.48, 0.27, 0);
    cab.castShadow = true;
    const wheelMat = new THREE.MeshStandardMaterial({ color: mode === "dark" ? 0x0b131b : 0x18232f, roughness: 0.8 });
    for (const [x, z] of [[-0.45, 0.2], [-0.45, -0.2], [0.1, 0.2], [0.1, -0.2], [0.5, 0.2], [0.5, -0.2]]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14), wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.09, z);
        group.add(w);
    }
    const warn = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: BIZMO_3D_STATUS[mode].warning }));
    warn.position.set(0.48, 0.5, 0);
    warn.visible = false;
    group.add(trailer, cab, warn);
    return {
        group,
        pickable: trailer,
        pickables: [trailer, cab],
        setWarning(on) { warn.visible = on; },
        /** Yol üzerinde t konumuna taşır ve gidiş yönüne çevirir */
        place(path, t) {
            const [x, , z] = pointOnPath(path, t);
            const [x2, , z2] = pointOnPath(path, Math.min(0.999, t + 0.004));
            group.position.set(x, 0.02, z);
            if (Math.hypot(x2 - x, z2 - z) > 1e-4)
                group.rotation.y = Math.atan2(-(z2 - z), x2 - x);
        },
    };
}
const RACK_BLUE = 0x1f5fa6;
const BEAM_ORANGE = 0xe8661c;
const WOOD = 0xc49a6c;
function canvasTexture(THREE, w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}
/**
 * Depo binası ve zemini (palet ve kasa deposu ortak): beton zemin + derzler, sarı koridor şeritleri, rampa önü
 * hazırlık alanları, yaya yolu, alçak kesitli duvarlar, kolonlar, rampa kapıları + tır dorseleri, raf sonu koruyucu ve blok tabelaları.
 */
function warehouseSite(THREE, mode, o) {
    const { rowZ, depth, aisle, lengthX, offX, docks, rackTop, steel } = o;
    const signSize = o.signSize ?? 1.1, guardH = o.guardH ?? 0.6;
    const scheme = { blocks: o.blocks };
    const nB = o.blocks.length, dark = mode === "dark", group = new THREE.Group();
    const facing = (b) => (b % 2 === 0 ? 1 : -1);
    const aisleZ = (b) => rowZ[b] + facing(b) * (depth / 2 + aisle / 2);
    const W = lengthX + 22, D = o.totalZ + 14; // bina
    const cx = offX + lengthX / 2 + 3;
    // Zemin: beton plaka derzleri, sarı koridor şeritleri, sevkiyat alanı, yaya yolu
    const pxPerM = 40;
    const floorTex = canvasTexture(THREE, Math.round(W * pxPerM), Math.round(D * pxPerM), (c) => {
        const cw = W * pxPerM, ch = D * pxPerM;
        const X = (x) => (x - (cx - W / 2)) * pxPerM, Zm = (zz) => (zz + D / 2) * pxPerM;
        c.fillStyle = dark ? "#3a4148" : "#c9cdd1";
        c.fillRect(0, 0, cw, ch);
        // Beton dokusu
        for (let i = 0; i < cw * ch / 900; i++) {
            c.fillStyle = `rgba(${dark ? "255,255,255" : "0,0,0"},${Math.random() * 0.035})`;
            c.fillRect(Math.random() * cw, Math.random() * ch, 2 + Math.random() * 3, 2 + Math.random() * 3);
        }
        c.strokeStyle = dark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.12)";
        c.lineWidth = 2;
        for (let x = 0; x < cw; x += 6 * pxPerM) {
            c.beginPath();
            c.moveTo(x, 0);
            c.lineTo(x, ch);
            c.stroke();
        }
        for (let y = 0; y < ch; y += 6 * pxPerM) {
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(cw, y);
            c.stroke();
        }
        // Sarı koridor kenar şeritleri
        c.fillStyle = "#f2c230";
        for (let b = 0; b < nB; b += 2) {
            const za = aisleZ(b);
            for (const e of [-aisle / 2 + 0.12, aisle / 2 - 0.12])
                c.fillRect(X(offX - 0.6), Zm(za + e) - 4, (lengthX + 1.2) * pxPerM, 8);
        }
        // Sevkiyat (rampa önü) alanı: sarı çerçeveli hazırlık şeritleri
        c.strokeStyle = "#f2c230";
        c.lineWidth = 7;
        const sx0 = offX + lengthX + 2.2, sx1 = cx + W / 2 - 3.5;
        for (let k = 0; k < docks; k++) {
            const dz = -D / 2 + 3 + ((D - 6) / docks) * (k + 0.5);
            c.strokeRect(X(sx0), Zm(dz - 1.5), (sx1 - sx0) * pxPerM, 3 * pxPerM);
        }
        // Yaya yolu (yeşil, zebra)
        c.fillStyle = "rgba(76,160,90,0.85)";
        c.fillRect(X(offX - 3.2), Zm(-D / 2 + 1), 1.4 * pxPerM, (D - 2) * pxPerM);
        c.fillStyle = "rgba(255,255,255,0.8)";
        for (let y = Zm(-D / 2 + 1); y < Zm(D / 2 - 1); y += 0.9 * pxPerM)
            c.fillRect(X(offX - 3.2) + 6, y, 1.4 * pxPerM - 12, 0.3 * pxPerM);
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, 0);
    floor.receiveShadow = true;
    group.add(floor);
    // Bina kabuğu: alçak kesitli duvarlar (içerisi görünsün), yapı kolonları, rampa kapıları
    const wallMat = new THREE.MeshStandardMaterial({ color: dark ? 0x2a3440 : 0xdfe4ea, roughness: 0.9 });
    const wallH = 1.4;
    for (const [w, d, x, zz] of [[W, 0.25, cx, -D / 2], [W, 0.25, cx, D / 2], [0.25, D, cx - W / 2, 0]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
        m.position.set(x, wallH / 2, zz);
        m.receiveShadow = true;
        group.add(m);
    }
    // Rampa duvarı (+x): kapı boşlukları + kapı kasaları + seksiyonel kapılar (yarı açık)
    const doorMat = new THREE.MeshStandardMaterial({ color: dark ? 0x5b6b7b : 0xb9c3cd, roughness: 0.6, metalness: 0.3 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
    const dockX = cx + W / 2;
    for (let k = 0; k < docks; k++) {
        const dz = -D / 2 + 3 + ((D - 6) / docks) * (k + 0.5);
        for (const e of [-1.6, 1.6]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.25), frameMat);
            post.position.set(dockX, 1.7, dz + e);
            group.add(post);
        }
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 3), doorMat);
        door.position.set(dockX, 2.8, dz);
        group.add(door);
        // Dışarıda tır dorsesi
        const trailer = new THREE.Mesh(new THREE.BoxGeometry(8, 2.7, 2.5), new THREE.MeshStandardMaterial({ color: dark ? 0x7d8a97 : 0xeef1f4, roughness: 0.7 }));
        trailer.position.set(dockX + 4.4, 1.35 + 0.9, dz);
        trailer.castShadow = true;
        group.add(trailer);
    }
    const colMat = new THREE.MeshStandardMaterial({ color: dark ? 0x56606a : 0x9aa4ae, roughness: 0.7 });
    for (let x = cx - W / 2 + 6; x < cx + W / 2 - 2; x += 12)
        for (const zz of [-D / 2 + 0.4, D / 2 - 0.4]) {
            const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), colMat);
            col.position.set(x, 4.5, zz);
            col.castShadow = true;
            group.add(col);
        }
    // Raf sonu koruyucular (sarı-siyah) ve blok tabelaları (koridor başında, iki uçta)
    const guardTex = canvasTexture(THREE, 64, 64, (c) => {
        c.fillStyle = "#f2c230";
        c.fillRect(0, 0, 64, 64);
        c.fillStyle = "#18232f";
        for (let k = -64; k < 64; k += 22) {
            c.beginPath();
            c.moveTo(k, 64);
            c.lineTo(k + 11, 64);
            c.lineTo(k + 75, 0);
            c.lineTo(k + 64, 0);
            c.fill();
        }
    });
    const guardMat = new THREE.MeshStandardMaterial({ map: guardTex, roughness: 0.6 });
    const signs = [];
    for (let b = 0; b < nB; b++)
        for (const end of [0, 1]) {
            const x = offX + (end ? lengthX + 0.35 : -0.35);
            const g = new THREE.Mesh(new THREE.BoxGeometry(0.3, guardH, depth + 0.1), guardMat);
            g.position.set(x, guardH / 2, rowZ[b]);
            g.castShadow = true;
            group.add(g);
            const signTex = canvasTexture(THREE, 256, 256, (c) => {
                c.fillStyle = "#18232f";
                c.fillRect(0, 0, 256, 256);
                c.fillStyle = "#ffffff";
                c.font = "800 190px Manrope, Inter, system-ui, sans-serif";
                c.textAlign = "center";
                c.textBaseline = "middle";
                c.fillText(scheme.blocks[b], 128, 140);
            });
            const sign = new THREE.Mesh(new THREE.BoxGeometry(0.06, signSize, signSize), [new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 }), steel, steel, steel, steel]);
            sign.position.set(offX + (end ? lengthX + 0.05 : -0.05), rackTop + signSize * 0.6, rowZ[b]);
            group.add(sign);
            if (end === 1)
                signs.push({ block: scheme.blocks[b], position: [x, rackTop + signSize * 1.3, rowZ[b]] });
        }
    return { group, signs, W, D, cx, dockX, dockZ: (k) => -D / 2 + 3 + ((D - 6) / docks) * (k + 0.5) };
}
/**
 * Gerçekçi depo: seçmeli palet rafı (mavi dikme, turuncu kiriş), EUR palet + yük, sırt sırta sıralar ve koridorlar,
 * beton zemin + sarı şeritler, raf sonu blok tabelaları, koruyucular, rampa kapıları. Gözler InstancedMesh ile çizilir
 * (binlerce göz tek çizim çağrısı); seçim için görünmez "hit" kutuları (hit.instanceId = göz indeksi).
 *   const wh = bizmoWarehouse(THREE, mode, loc, { docks: 4 }); scene.add(wh.group);
 *   wh.setSlot(i, { filled: true, height: 1.1, color: 0xc9a77c }); wh.commit(); wh.select(i);
 */
export function bizmoWarehouse(THREE, mode, scheme, opts = {}) {
    const bayW = opts.bayWidth ?? 2.8, depth = opts.depth ?? 1.1, levelH = opts.levelHeight ?? 1.5;
    const aisle = opts.aisle ?? 3.4, flue = opts.flue ?? 0.25, docks = opts.docks ?? 4;
    const nB = scheme.blocks.length, nL = scheme.levels.length, nP = scheme.positions, bays = scheme.bays;
    const upW = 0.09, beamH = 0.12, palletH = 0.144;
    const dark = mode === "dark";
    const group = new THREE.Group();
    // Sıralar: A | koridor | B ‖ C | koridor | D ‖ E | koridor | F  (çift sıralar koridora +z, tekler −z yönünde bakar)
    const rowZ = [];
    let z = 0;
    for (let i = 0; i < nB; i++) {
        rowZ.push(z + depth / 2);
        z += depth + (i < nB - 1 ? (i % 2 === 0 ? aisle : flue) : 0);
    }
    const lengthX = bays * bayW;
    const offX = -lengthX / 2 - 4; // raf uçları ile rampalar arasında sevkiyat alanı (+x)
    const offZ = -z / 2;
    for (let i = 0; i < nB; i++)
        rowZ[i] += offZ;
    const facing = (b) => (b % 2 === 0 ? 1 : -1);
    const aisleZ = (b) => rowZ[b] + facing(b) * (depth / 2 + aisle / 2);
    const rackTop = (nL - 1) * levelH + 1.75;
    // Malzemeler
    const steel = new THREE.MeshStandardMaterial({ color: RACK_BLUE, roughness: 0.45, metalness: 0.55 });
    const beamMat = new THREE.MeshStandardMaterial({ color: BEAM_ORANGE, roughness: 0.5, metalness: 0.35 });
    const palletTex = canvasTexture(THREE, 128, 64, (c) => {
        c.fillStyle = "#c49a6c";
        c.fillRect(0, 0, 128, 64);
        c.fillStyle = "rgba(60,35,10,0.55)";
        for (const x of [0, 58, 116])
            c.fillRect(x, 22, 12, 42);
        c.fillStyle = "rgba(90,55,20,0.35)";
        for (let y = 0; y < 22; y += 7)
            c.fillRect(0, y, 128, 2);
    });
    const palletMat = new THREE.MeshStandardMaterial({ color: WOOD, map: palletTex, roughness: 0.9 });
    const loadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.02 });
    const site = warehouseSite(THREE, mode, { blocks: scheme.blocks, rowZ, depth, aisle, lengthX, offX, totalZ: z, docks, rackTop, steel });
    group.add(site.group);
    const { W, D, cx, dockX, signs } = site;
    // Raf yapısı: dikmeler, çaprazlar, kirişler (InstancedMesh)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const place = (mesh, i, x, y, zz, sx = 1, sy = 1, sz = 1) => {
        m4.compose(v.set(x, y, zz), q.identity(), sc.set(sx, sy, sz));
        mesh.setMatrixAt(i, m4);
    };
    const uprights = new THREE.InstancedMesh(new THREE.BoxGeometry(upW, rackTop, upW), steel, nB * (bays + 1) * 2);
    const braces = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, depth - upW), steel, nB * (bays + 1) * 5);
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(bayW - upW, beamH, 0.05), beamMat, nB * bays * (nL - 1) * 2);
    let ui = 0, bi = 0, ki = 0;
    for (let b = 0; b < nB; b++) {
        for (let f = 0; f <= bays; f++) {
            const x = offX + f * bayW;
            for (const s of [-1, 1])
                place(uprights, ui++, x, rackTop / 2, rowZ[b] + s * (depth / 2 - upW / 2));
            for (let k = 0; k < 5; k++)
                place(braces, bi++, x, 0.3 + k * (rackTop - 0.6) / 4, rowZ[b]);
        }
        for (let bay = 0; bay < bays; bay++)
            for (let l = 1; l < nL; l++)
                for (const s of [-1, 1])
                    place(beams, ki++, offX + (bay + 0.5) * bayW, l * levelH - beamH / 2, rowZ[b] + s * (depth / 2 - 0.03));
    }
    for (const m of [uprights, braces, beams]) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.instanceMatrix.needsUpdate = true;
        group.add(m);
    }
    // Gözler: palet + yük + görünmez seçim kutusu (+ boş göz için yarı saydam "hayalet" kutu)
    const N = scheme.total;
    const pallets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, palletH, 1.2), palletMat, N);
    const loads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), loadMat, N);
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false });
    const ghosts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), ghostMat, N);
    const hit = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }), N);
    const posW = (bayW - upW) / nP;
    const slotX = (i) => { const p = scheme.at(i); return offX + (p.bay - 1) * bayW + upW / 2 + (p.pos - 0.5) * posW; };
    const slotBase = (i) => { const l = scheme.levels.indexOf(scheme.at(i).level); return l * levelH; };
    const slotZ = (i) => rowZ[scheme.blocks.indexOf(scheme.at(i).block)];
    const state = Array.from({ length: N }, () => ({ filled: false, height: 1, color: 0xc9a77c, ghost: null }));
    const col = new THREE.Color();
    for (let i = 0; i < N; i++)
        place(hit, i, slotX(i), slotBase(i) + (levelH - 0.2) / 2, slotZ(i), posW - 0.06, levelH - 0.2, depth);
    hit.instanceMatrix.needsUpdate = true;
    pallets.castShadow = loads.castShadow = true;
    pallets.receiveShadow = loads.receiveShadow = true;
    ghosts.renderOrder = 2;
    group.add(pallets, loads, ghosts, hit);
    // Seçim ve üzerine gelme: kontur kutusu + zeminden göze ince ışık sütunu (nötr: seçim durum değildir)
    const markColor = dark ? 0xeef3f8 : 0x18232f;
    const outline = (color, opacity) => {
        const g = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
        g.visible = false;
        group.add(g);
        return g;
    };
    const selBox = outline(markColor, 1), hovBox = outline(markColor, 0.55);
    const selFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x33b9e8, transparent: true, opacity: 0.18, depthWrite: false }));
    selFill.visible = false;
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), new THREE.MeshBasicMaterial({ color: 0x33b9e8, transparent: true, opacity: 0.85 }));
    beacon.visible = false;
    group.add(selFill, beacon);
    const fit = (obj, i, pad = 0.04) => {
        obj.position.set(slotX(i), slotBase(i) + (levelH - 0.2) / 2 + 0.02, slotZ(i));
        obj.scale.set(posW - 0.04 + pad, levelH - 0.2 + pad, depth + pad);
    };
    const api = {
        group,
        /** Seçim için: intersectObject(hit) → instanceId = göz indeksi */
        hit,
        signs,
        bounds: { minX: cx - W / 2, maxX: cx + W / 2, minZ: -D / 2, maxZ: D / 2, rackTop },
        rowZ,
        aisleZ,
        rack: { startX: offX, endX: offX + lengthX, bayWidth: bayW, levelHeight: levelH, depth },
        dockZ: (k) => -D / 2 + 3 + ((D - 6) / docks) * (k + 0.5),
        dockX,
        /** Göz merkezi (yükün ortası) */
        slotCenter(i) {
            return [slotX(i), slotBase(i) + palletH + state[i].height / 2, slotZ(i)];
        },
        /** Forkliftin göz önünde durduğu nokta (koridor ekseni) ve kat yüksekliği */
        slotFront(i) {
            const b = scheme.blocks.indexOf(scheme.at(i).block);
            return { x: slotX(i), z: aisleZ(b), facing: facing(b), lift: slotBase(i) + (slotBase(i) ? 0 : 0.05) };
        },
        setSlot(i, s) {
            Object.assign(state[i], s);
        },
        /** setSlot değişikliklerini çizime aktarır (toplu güncellemeden sonra bir kez) */
        commit() {
            for (let i = 0; i < N; i++) {
                const s = state[i], base = slotBase(i) + (slotBase(i) ? 0 : 0.002);
                if (s.filled) {
                    place(pallets, i, slotX(i), base + palletH / 2, slotZ(i));
                    place(loads, i, slotX(i), base + palletH + s.height / 2, slotZ(i), 0.78, s.height, 1.16);
                    loads.setColorAt(i, col.set(s.color));
                }
                else {
                    place(pallets, i, 0, -50, 0, 0, 0, 0);
                    place(loads, i, 0, -50, 0, 0, 0, 0);
                    loads.setColorAt(i, col.set(0x000000));
                }
                if (s.ghost != null && !s.filled) {
                    place(ghosts, i, slotX(i), base + 0.6, slotZ(i), posW - 0.12, 1.1, depth - 0.1);
                    ghosts.setColorAt(i, col.set(s.ghost));
                }
                else {
                    place(ghosts, i, 0, -50, 0, 0, 0, 0);
                    ghosts.setColorAt(i, col.set(0x000000));
                }
            }
            for (const m of [pallets, loads, ghosts]) {
                m.instanceMatrix.needsUpdate = true;
                if (m.instanceColor)
                    m.instanceColor.needsUpdate = true;
            }
        },
        select(i) {
            const on = i != null && i >= 0;
            selBox.visible = selFill.visible = beacon.visible = on;
            if (!on)
                return;
            fit(selBox, i, 0.08);
            fit(selFill, i, 0.02);
            const top = slotBase(i) + levelH;
            beacon.position.set(slotX(i), (top + rackTop + 2.4) / 2, slotZ(i));
            beacon.scale.y = Math.max(0.1, rackTop + 2.4 - top);
        },
        hover(i) {
            hovBox.visible = i != null && i >= 0;
            if (hovBox.visible)
                fit(hovBox, i, 0.05);
        },
        /** Seçili göz kutusu yumuşak nabız (her karede; azaltılmış harekette sabit) */
        update(now) {
            if (selFill.visible)
                selFill.material.opacity = reduced() ? 0.18 : 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(now / 320));
        },
    };
    return api;
}
/**
 * Forklift (ileri uzanır tip): sarı gövde, karşı ağırlık, koruma kafesi, iki kademeli direk, çatal + yük, döner lamba.
 *   const f = bizmoForklift(THREE, mode); f.setLift(3); f.setLoad(0xc9a77c); f.group.position / rotation.y
 */
export function bizmoForklift(THREE, mode, opts = {}) {
    const group = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: opts.color ?? 0xf0a71c, roughness: 0.45, metalness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: mode === "dark" ? 0x1b242d : 0x2b333b, roughness: 0.6, metalness: 0.4 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x8c96a0, roughness: 0.35, metalness: 0.7 });
    const add = (geo, mat, x, y, z) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        group.add(m);
        return m;
    };
    add(new THREE.BoxGeometry(1.25, 0.75, 1.0), body, -0.15, 0.55, 0);
    add(new THREE.BoxGeometry(0.45, 0.8, 1.0), darkMat, -0.65, 0.6, 0); // karşı ağırlık
    add(new THREE.BoxGeometry(0.4, 0.5, 0.45), darkMat, -0.05, 1.12, 0); // koltuk
    for (const [x, z] of [[0.25, 0.42], [0.25, -0.42], [-0.6, 0.42], [-0.6, -0.42]])
        add(new THREE.BoxGeometry(0.05, 1.3, 0.05), darkMat, x, 1.55, z);
    add(new THREE.BoxGeometry(0.95, 0.05, 0.92), darkMat, -0.17, 2.2, 0); // koruma tavanı
    for (const [x, z] of [[0.3, 0.38], [0.3, -0.38], [-0.55, 0.38], [-0.55, -0.38]]) {
        const w = add(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 18), darkMat, x, 0.2, z);
        w.rotation.x = Math.PI / 2;
    }
    const lamp = add(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12), new THREE.MeshBasicMaterial({ color: 0xff9a1f }), -0.5, 2.3, 0);
    // Direk: dış (sabit) + iç (uzanan) + çatal taşıyıcı
    const mastOuter = new THREE.Group();
    for (const z of [0.3, -0.3]) {
        const u = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.08), steelMat);
        u.position.set(0, 1.15, z);
        u.castShadow = true;
        mastOuter.add(u);
    }
    mastOuter.position.x = 0.62;
    group.add(mastOuter);
    const mastInner = new THREE.Group();
    for (const z of [0.22, -0.22]) {
        const u = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.3, 0.07), steelMat);
        u.position.set(0, 1.15, z);
        u.castShadow = true;
        mastInner.add(u);
    }
    mastInner.position.x = 0.67;
    group.add(mastInner);
    const carriage = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.8), darkMat);
    plate.position.set(0, 0.25, 0);
    carriage.add(plate);
    for (const z of [0.2, -0.2]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.1), steelMat);
        f.position.set(0.55, 0.02, z);
        f.castShadow = true;
        carriage.add(f);
    }
    const load = new THREE.Group();
    const pal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.144, 0.8), new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.9 }));
    pal.position.set(0.62, 0.11, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.16, 1, 0.78), new THREE.MeshStandardMaterial({ color: 0xc9a77c, roughness: 0.82 }));
    pal.castShadow = box.castShadow = true;
    load.add(pal, box);
    load.visible = false;
    carriage.add(load);
    carriage.position.x = 0.72;
    group.add(carriage);
    let t = 0;
    return {
        group,
        /** Çatal yüksekliği (m); 1,5 m üstünde iç direk uzanır */
        setLift(h) {
            carriage.position.y = 0.05 + h;
            mastInner.position.y = Math.max(0, h - 1.4);
        },
        /** Çataldaki yük: renk ve yükseklik, null = boş */
        setLoad(color, height = 1) {
            load.visible = color != null;
            if (color != null) {
                box.material.color.set(color);
                box.scale.y = height;
                box.position.set(0.62, 0.183 + height / 2, 0);
            }
        },
        /** Hareket ederken döner lamba yumuşak nabız (azaltılmış harekette sabit) */
        update(dt, moving) {
            t += dt;
            lamp.material.color.setHex(moving && !reduced() && Math.sin(t * 9) > 0 ? 0xffc04d : 0xff9a1f);
        },
    };
}
/**
 * Euro kasa ebatları ve istasyondaki yerleşim. x: koridora paralel genişlik, d: derinlik (ön → arka), h: yükseklik (m).
 * Bir istasyona arkalı önlü 2 büyük kasa sığar; orta kasadan 4 (derinlikte), küçükten 8 (2 yan yana × 4 derinlikte).
 */
export const BIZMO_BINS = {
    L: { label: "Büyük", dims: "600×400×320", x: 0.4, d: 0.6, h: 0.32, across: 1, deep: 2 },
    M: { label: "Orta", dims: "400×300×220", x: 0.4, d: 0.3, h: 0.22, across: 1, deep: 4 },
    S: { label: "Küçük", dims: "300×200×120", x: 0.2, d: 0.3, h: 0.12, across: 2, deep: 4 },
};
export const binCapacity = (s) => BIZMO_BINS[s].across * BIZMO_BINS[s].deep;
/** Kasa içindeki yer: 0 = ön (koridor tarafı) sol; across 2 ise sol / sağ, sonra bir arkaya */
export const binSlotName = (s, slot) => {
    const b = BIZMO_BINS[s];
    const row = Math.floor(slot / b.across), side = slot % b.across;
    const depthName = b.deep === 2 ? (row === 0 ? "Ön" : "Arka") : `${row + 1}. sıra${row === 0 ? " (ön)" : row === b.deep - 1 ? " (arka)" : ""}`;
    return b.across === 2 ? `${depthName} · ${side ? "sağ" : "sol"}` : depthName;
};
function mergeBoxes(THREE, boxes) {
    const pos = [], nor = [], uv = [], idx = [];
    for (const [sx, sy, sz, px, py, pz] of boxes) {
        const g = new THREE.BoxGeometry(sx, sy, sz);
        g.translate(px, py, pz);
        const off = pos.length / 3;
        pos.push(...g.attributes.position.array);
        nor.push(...g.attributes.normal.array);
        uv.push(...g.attributes.uv.array);
        for (const k of g.index.array)
            idx.push(k + off);
        g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
}
/** Açık üstlü, kaburgalı Euro kasa (orijin alt orta). x genişlik, d derinlik, h yükseklik */
function crateGeometry(THREE, x, d, h) {
    const t = 0.012, rib = 0.008, lip = 0.03;
    const boxes = [
        [x, t, d, 0, t / 2, 0], // taban
        [x, h, t, 0, h / 2, d / 2 - t / 2], [x, h, t, 0, h / 2, -d / 2 + t / 2], // ön / arka duvar
        [t, h, d - 2 * t, x / 2 - t / 2, h / 2, 0], [t, h, d - 2 * t, -x / 2 + t / 2, h / 2, 0], // yan duvarlar
        // Üst kenar (dışa taşan dudak)
        [x + 2 * rib, lip, rib, 0, h - lip / 2, d / 2 + rib / 2], [x + 2 * rib, lip, rib, 0, h - lip / 2, -d / 2 - rib / 2],
        [rib, lip, d, x / 2 + rib / 2, h - lip / 2, 0], [rib, lip, d, -x / 2 - rib / 2, h - lip / 2, 0],
        // Dikey kaburgalar (uzun kenarlarda 3, kısa kenarlarda 1)
        ...[-0.32, 0, 0.32].flatMap((f) => [[rib, h * 0.85, rib * 1.6, x / 2 + rib / 2, h * 0.42, f * d], [rib, h * 0.85, rib * 1.6, -x / 2 - rib / 2, h * 0.42, f * d]]),
        [rib * 1.6, h * 0.85, rib, 0, h * 0.42, d / 2 + rib / 2], [rib * 1.6, h * 0.85, rib, 0, h * 0.42, -d / 2 - rib / 2],
        // Alt yatay bant
        [x + 2 * rib, 0.02, rib, 0, 0.03, d / 2 + rib / 2], [x + 2 * rib, 0.02, rib, 0, 0.03, -d / 2 - rib / 2],
    ];
    return mergeBoxes(THREE, boxes);
}
/**
 * Kasa deposu: galvaniz raf (dikme + katlar), istasyon barkod etiketleri, plastik Euro kasalar (3 ebat), kasa içi malzeme.
 * Göz adresi palet deposuyla aynı (A-3-D-2); her göz bir istasyondur, kasalar istasyonda önden arkaya dizilir.
 *   const bs = bizmoBinStore(THREE, mode, loc); bs.setSlot(i, { crates: [{ size: "L", slot: 0, color: 0x2463b8, fill: 0.8, content: 0x8a949e }] }); bs.commit();
 */
export function bizmoBinStore(THREE, mode, scheme, opts = {}) {
    const posW = opts.positionWidth ?? 0.46, depth = opts.depth ?? 1.26, levelH = opts.levelHeight ?? 0.42;
    const aisle = opts.aisle ?? 1.7, flue = opts.flue ?? 0.1, docks = opts.docks ?? 2;
    const nB = scheme.blocks.length, nL = scheme.levels.length, nP = scheme.positions, bays = scheme.bays;
    const upW = 0.05, y0 = 0.1, deckH = 0.025;
    const bayW = nP * posW + upW;
    const group = new THREE.Group();
    const rowZ = [];
    let z = 0;
    for (let i = 0; i < nB; i++) {
        rowZ.push(z + depth / 2);
        z += depth + (i < nB - 1 ? (i % 2 === 0 ? aisle : flue) : 0);
    }
    const lengthX = bays * bayW, offX = -lengthX / 2 - 4, offZ = -z / 2;
    for (let i = 0; i < nB; i++)
        rowZ[i] += offZ;
    const facing = (b) => (b % 2 === 0 ? 1 : -1);
    const aisleZ = (b) => rowZ[b] + facing(b) * (depth / 2 + aisle / 2);
    const rackTop = y0 + (nL - 1) * levelH + levelH + 0.05;
    const galv = new THREE.MeshStandardMaterial({ color: 0xb7bec5, roughness: 0.4, metalness: 0.75 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8f99a3, roughness: 0.55, metalness: 0.6 });
    const site = warehouseSite(THREE, mode, { blocks: scheme.blocks, rowZ, depth, aisle, lengthX, offX, totalZ: z, docks, rackTop, steel: galv, signSize: 0.6, guardH: 0.3 });
    group.add(site.group);
    const { W, D, cx } = site;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const place = (mesh, i, x, y, zz, sx = 1, sy = 1, sz = 1) => {
        m4.compose(v.set(x, y, zz), q.identity(), sc.set(sx, sy, sz));
        mesh.setMatrixAt(i, m4);
    };
    // Raf: dikmeler, katlar (zemin dahil), ön kenar etiket yeri
    const uprights = new THREE.InstancedMesh(new THREE.BoxGeometry(upW, rackTop, upW), galv, nB * (bays + 1) * 2);
    const decks = new THREE.InstancedMesh(new THREE.BoxGeometry(bayW - upW, deckH, depth), deckMat, nB * bays * nL);
    const labelTex = canvasTexture(THREE, 256, 64, (c) => {
        c.fillStyle = "#ffffff";
        c.fillRect(0, 0, 256, 64);
        c.fillStyle = "#f2c230";
        c.fillRect(0, 0, 18, 64);
        c.fillStyle = "#18232f";
        for (let x = 30; x < 150; x += 3 + Math.round(Math.random() * 3))
            c.fillRect(x, 10, 1 + Math.round(Math.random() * 2), 44);
        c.font = "700 26px Inter, system-ui, sans-serif";
        c.fillText("▮▮-▮-▮", 160, 42);
    });
    const N = scheme.total;
    const labels = new THREE.InstancedMesh(new THREE.PlaneGeometry(posW - 0.08, 0.045), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.6 }), N);
    let ui = 0, di = 0;
    const slotXof = (bay, pos) => offX + (bay - 1) * bayW + upW / 2 + (pos - 0.5) * posW;
    for (let b = 0; b < nB; b++) {
        for (let f = 0; f <= bays; f++)
            for (const s of [-1, 1])
                place(uprights, ui++, offX + f * bayW, rackTop / 2, rowZ[b] + s * (depth / 2 - upW / 2));
        for (let bay = 0; bay < bays; bay++)
            for (let l = 0; l < nL; l++)
                place(decks, di++, offX + (bay + 0.5) * bayW, y0 + l * levelH - deckH / 2, rowZ[b]);
    }
    const lab = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
        const p = scheme.at(i), b = scheme.blocks.indexOf(p.block), l = scheme.levels.indexOf(p.level);
        lab.position.set(slotXof(p.bay, p.pos), y0 + l * levelH - deckH - 0.012, rowZ[b] + facing(b) * (depth / 2 + 0.002));
        lab.rotation.set(0, facing(b) > 0 ? 0 : Math.PI, 0);
        lab.updateMatrix();
        labels.setMatrixAt(i, lab.matrix);
    }
    for (const m of [uprights, decks, labels]) {
        m.castShadow = m !== labels;
        m.receiveShadow = true;
        m.instanceMatrix.needsUpdate = true;
        group.add(m);
    }
    // Kasalar (ebat başına bir InstancedMesh) + içerik + boş istasyon hayaleti + seçim kutuları
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.02 });
    const partsTex = canvasTexture(THREE, 128, 128, (c) => {
        c.fillStyle = "#9aa3ac";
        c.fillRect(0, 0, 128, 128);
        for (let k = 0; k < 140; k++) {
            const g = 120 + Math.round(Math.random() * 110);
            c.fillStyle = `rgb(${g},${g},${g})`;
            c.beginPath();
            c.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 5, 0, Math.PI * 2);
            c.fill();
        }
    });
    const crates = { L: null, M: null, S: null };
    for (const k of ["L", "M", "S"]) {
        const b = BIZMO_BINS[k];
        crates[k] = new THREE.InstancedMesh(crateGeometry(THREE, b.x, b.d, b.h), crateMat, N * binCapacity(k));
        crates[k].count = 0;
        crates[k].castShadow = crates[k].receiveShadow = true;
        group.add(crates[k]);
    }
    const contents = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, map: partsTex, roughness: 0.7, metalness: 0.3 }), N * 8);
    contents.count = 0;
    const ghosts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false }), N);
    ghosts.count = 0;
    ghosts.renderOrder = 2;
    const hit = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }), N);
    const slotX = (i) => { const p = scheme.at(i); return slotXof(p.bay, p.pos); };
    const slotBase = (i) => y0 + scheme.levels.indexOf(scheme.at(i).level) * levelH;
    const rowOf = (i) => scheme.blocks.indexOf(scheme.at(i).block);
    for (let i = 0; i < N; i++)
        place(hit, i, slotX(i), slotBase(i) + (levelH - 0.06) / 2, rowZ[rowOf(i)], posW - 0.03, levelH - 0.06, depth);
    hit.instanceMatrix.needsUpdate = true;
    group.add(contents, ghosts, hit);
    const state = Array.from({ length: N }, () => ({ crates: [], ghost: null }));
    const col = new THREE.Color();
    /** Kasanın istasyondaki konumu (alt orta) */
    const cratePos = (i, c) => {
        const b = BIZMO_BINS[c.size], r = rowOf(i);
        const row = Math.floor(c.slot / b.across), side = c.slot % b.across;
        const x = slotX(i) + (b.across === 2 ? (side - 0.5) * (b.x + 0.012) : 0);
        const zz = rowZ[r] + facing(r) * (depth / 2 - 0.025 - (row + 0.5) * (b.d + 0.008));
        return [x, slotBase(i), zz];
    };
    const markColor = mode === "dark" ? 0xeef3f8 : 0x18232f;
    const outline = (opacity) => {
        const g = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: markColor, transparent: true, opacity }));
        g.visible = false;
        group.add(g);
        return g;
    };
    const selBox = outline(1), hovBox = outline(0.55);
    const selFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x33b9e8, transparent: true, opacity: 0.16, depthWrite: false }));
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 8), new THREE.MeshBasicMaterial({ color: 0x33b9e8, transparent: true, opacity: 0.85 }));
    selFill.visible = beacon.visible = false;
    group.add(selFill, beacon);
    const fit = (obj, i, pad = 0.03) => {
        obj.position.set(slotX(i), slotBase(i) + (levelH - 0.06) / 2, rowZ[rowOf(i)]);
        obj.scale.set(posW - 0.03 + pad, levelH - 0.06 + pad, depth + pad);
    };
    return {
        group,
        hit,
        signs: site.signs,
        bounds: { minX: cx - W / 2, maxX: cx + W / 2, minZ: -D / 2, maxZ: D / 2, rackTop },
        rowZ,
        aisleZ,
        rack: { startX: offX, endX: offX + lengthX, bayWidth: bayW, levelHeight: levelH, depth },
        dockZ: site.dockZ,
        dockX: site.dockX,
        capacity: { L: binCapacity("L"), M: binCapacity("M"), S: binCapacity("S") },
        slotCenter(i) {
            return [slotX(i), slotBase(i) + 0.2, rowZ[rowOf(i)]];
        },
        slotFront(i) {
            const r = rowOf(i);
            return { x: slotX(i), z: aisleZ(r), facing: facing(r), lift: slotBase(i) };
        },
        setSlot(i, s) {
            Object.assign(state[i], s);
        },
        commit() {
            const n = { L: 0, M: 0, S: 0 };
            let cn = 0, gn = 0;
            for (let i = 0; i < N; i++) {
                for (const c of state[i].crates) {
                    const b = BIZMO_BINS[c.size], [x, y, zz] = cratePos(i, c), m = crates[c.size];
                    place(m, n[c.size], x, y, zz);
                    m.setColorAt(n[c.size]++, col.set(c.color));
                    if (c.fill > 0.02) {
                        const fh = Math.max(0.01, c.fill * (b.h - 0.035));
                        place(contents, cn, x, y + 0.012 + fh / 2, zz, b.x - 0.03, fh, b.d - 0.03);
                        contents.setColorAt(cn++, col.set(c.content));
                    }
                }
                if (state[i].ghost != null && !state[i].crates.length) {
                    place(ghosts, gn, slotX(i), slotBase(i) + 0.17, rowZ[rowOf(i)], posW - 0.08, 0.3, depth - 0.08);
                    ghosts.setColorAt(gn++, col.set(state[i].ghost));
                }
            }
            for (const k of ["L", "M", "S"]) {
                crates[k].count = n[k];
                crates[k].instanceMatrix.needsUpdate = true;
                if (crates[k].instanceColor)
                    crates[k].instanceColor.needsUpdate = true;
            }
            contents.count = cn;
            ghosts.count = gn;
            for (const m of [contents, ghosts]) {
                m.instanceMatrix.needsUpdate = true;
                if (m.instanceColor)
                    m.instanceColor.needsUpdate = true;
            }
        },
        select(i) {
            const on = i != null && i >= 0;
            selBox.visible = selFill.visible = beacon.visible = on;
            if (!on)
                return;
            fit(selBox, i, 0.05);
            fit(selFill, i, 0.01);
            const top = slotBase(i) + levelH;
            beacon.position.set(slotX(i), (top + rackTop + 1.2) / 2, rowZ[rowOf(i)]);
            beacon.scale.y = Math.max(0.1, rackTop + 1.2 - top);
        },
        hover(i) {
            hovBox.visible = i != null && i >= 0;
            if (hovBox.visible)
                fit(hovBox, i, 0.03);
        },
        update(now) {
            if (selFill.visible)
                selFill.material.opacity = reduced() ? 0.16 : 0.1 + 0.1 * (0.5 + 0.5 * Math.sin(now / 320));
        },
    };
}
/**
 * Toplama arabası (otonom mobil robot, AMR): alçak gövde + ışık şeridi, direk, iki rafta kasa, ekran, lamba.
 *   const c = bizmoPickCart(THREE, mode); c.setLoad([0x2463b8, 0x6b7178]); c.group.position / rotation.y
 */
export function bizmoPickCart(THREE, mode) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: mode === "dark" ? 0x26303a : 0x2b333b, roughness: 0.5, metalness: 0.3 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xb7bec5, roughness: 0.4, metalness: 0.7 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; group.add(m); return m; };
    add(new THREE.BoxGeometry(0.8, 0.22, 0.56), bodyMat, 0, 0.15, 0);
    add(new THREE.BoxGeometry(0.82, 0.025, 0.58), new THREE.MeshBasicMaterial({ color: 0x33b9e8 }), 0, 0.22, 0); // ışık şeridi
    for (const z of [0.24, -0.24])
        add(new THREE.BoxGeometry(0.03, 1.25, 0.03), steelMat, -0.36, 0.86, z);
    const shelves = [0.62, 1.08].map((y) => add(new THREE.BoxGeometry(0.72, 0.02, 0.52), steelMat, 0, y, 0).position.y);
    const screen = add(new THREE.BoxGeometry(0.03, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0x0f1922 }), -0.37, 1.38, 0);
    screen.add(new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshBasicMaterial({ color: 0x33b9e8 })));
    screen.children[0].position.set(0.017, 0, 0);
    screen.children[0].rotation.y = Math.PI / 2;
    const lamp = add(new THREE.CylinderGeometry(0.035, 0.04, 0.07, 12), new THREE.MeshBasicMaterial({ color: 0x6db92c }), -0.36, 1.52, 0);
    const b = BIZMO_BINS.M;
    const geo = crateGeometry(THREE, b.d, b.x, b.h); // arabada uzun kenar boyuna
    const loads = [0, 1, 2, 3].map((k) => {
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2463b8, roughness: 0.55 }));
        m.position.set(k % 2 ? 0.17 : -0.17, shelves[k >> 1] + 0.01, 0);
        m.castShadow = true;
        m.visible = false;
        group.add(m);
        return m;
    });
    let t = 0;
    return {
        group,
        /** Arabadaki kasalar (en çok 4) */
        setLoad(colors) {
            loads.forEach((m, k) => { m.visible = k < colors.length; if (k < colors.length)
                m.material.color.set(colors[k]); });
        },
        update(dt, moving) {
            t += dt;
            lamp.material.color.setHex(moving && !reduced() ? (Math.sin(t * 6) > 0 ? 0x8ed14f : 0x6db92c) : 0x6db92c);
        },
    };
}
/** Tek Euro kasa (+ içindeki malzeme): gantry yükü, konveyör, vitrin. Orijin alt orta; uzun kenar (d) z yönünde */
export function bizmoCrateMesh(THREE, size, opts = {}) {
    const b = BIZMO_BINS[size];
    const group = new THREE.Group();
    const crate = new THREE.Mesh(crateGeometry(THREE, b.x, b.d, b.h), new THREE.MeshStandardMaterial({ color: opts.color ?? 0x2463b8, roughness: 0.55 }));
    crate.castShadow = true;
    const fill = opts.fill ?? 0.8;
    const fh = Math.max(0.01, fill * (b.h - 0.035));
    const content = new THREE.Mesh(new THREE.BoxGeometry(b.x - 0.03, fh, b.d - 0.03), new THREE.MeshStandardMaterial({ color: opts.content ?? 0x9aa3ac, roughness: 0.7, metalness: 0.3 }));
    content.position.y = 0.012 + fh / 2;
    content.visible = fill > 0.02;
    group.add(crate, content);
    return group;
}
const disposeTree = (o) => o.traverse((x) => { x.geometry?.dispose?.(); x.material?.dispose?.(); });
// Gantry hücresinin paylaşılan dokuları (sarı-siyah ikaz şeridi, tel örgü çit): THREE başına bir kez üretilir
const cellTex = new WeakMap();
function gantryTextures(THREE) {
    let t = cellTex.get(THREE);
    if (t)
        return t;
    const make = (draw) => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        draw(c.getContext("2d"));
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
    };
    // 45° şerit, kenarları dikişsiz: (x + y) mod 32
    const stripes = make((g) => {
        const img = g.createImageData(64, 64);
        for (let y = 0; y < 64; y++)
            for (let x = 0; x < 64; x++) {
                const on = ((x + y) & 31) < 16, i = (y * 64 + x) * 4;
                img.data[i] = on ? 0x18 : 0xf2;
                img.data[i + 1] = on ? 0x1b : 0xb0;
                img.data[i + 2] = on ? 0x1e : 0x1e;
                img.data[i + 3] = 255;
            }
        g.putImageData(img, 0, 0);
    });
    // 50 mm göz tel örgü (doku 0,2 m'yi kaplar): uzaktan yarı saydam koyu perde gibi görünür
    const mesh = make((g) => {
        g.strokeStyle = "#262b31";
        g.lineWidth = 3;
        for (let k = 0; k <= 64; k += 16) {
            g.beginPath();
            g.moveTo(k, 0);
            g.lineTo(k, 64);
            g.stroke();
            g.beginPath();
            g.moveTo(0, k);
            g.lineTo(64, k);
            g.stroke();
        }
    });
    t = { stripes, mesh };
    cellTex.set(THREE, t);
    return t;
}
/**
 * Gantry loader hücresi (kasa deposu, çok derin): raf üstü gantry robotu + giriş / çıkış konveyörü + emniyet çiti.
 * Yerel eksen: x koridor boyunca, z = 0 koridor ekseni, 1 birim = 1 m.
 *   const g = bizmoGantryLoader(THREE, mode, { startX, endX, aisle, railY: rackTop + 0.14, rackTop, bay, label: "GL-1" });
 *   g.group.position.z = aisleZ;  her karede g.setPose({ x, y, rot, reach, width, grip }); g.update(dt, moving)
 *   g.setLoad("L", { color, content, fill }) · g.conveyor → { pickX, outX, y } · g.body (tıklama ışını) · g.mount(eye, look) · g.dispose()
 *
 * Yapı (gerçek hücrelerdeki gibi):
 *  · Ray: alüminyum profil kiriş (kanallı) + çelik lineer kılavuz ray + kremayer; her raf dikmesinde braketle raf üstüne bağlı;
 *    uçlarda zemine ankrajlı portal dikmeleri, köşebent, karşılıklı bağlantı kirişi, ikaz şeritli tampon + kauçuk takoz.
 *  · Enerji zinciri: +z rayının yanındaki kablo kanalında; köprü ilerledikçe dönüş kıvrımı yarı hızla kayar.
 *  · Köprü (X): lineer rulman arabalı iki uç taşıyıcı, dikey servo motor + redüktör (kremayer-pinyon), çift kutu kiriş,
 *    ortada Z arabası + motor, kumanda dolabı, kimlik plakası, üçlü sinyal kulesi (yeşil hazır, amber hareket), lazer mesafe ölçer.
 *  · Z: iki kademeli teleskobik kolon (dış kılıf yarı hızla iner; ünite yükseldikçe köprünün üstüne çıkar).
 *  · Kasa alma ünitesi (LHD): döner tabla, açık çerçeve, kayar yatak, iki yanda 3 kademeli teleskobik kol (her kademe
 *    uzanmanın üçte biri), kol uçlarında ve ortasında dönen parmaklar; kollar arası açıklık kasa ebadına göre ayarlanır.
 *  · Konveyör: C profil şase, makaralar (her beşincisi motorlu), yan kılavuz, toplama noktasında durdurucu + fotosel,
 *    barkod okuyucu kemeri, gantry bölgesi sınırında ışık perdesi. Çit: sarı dikmeli tel örgü, arka uçta bakım kapısı.
 */
export function bizmoGantryLoader(THREE, mode, o) {
    const group = new THREE.Group();
    const tex = gantryTextures(THREE);
    const owned = [];
    const mat = (p) => {
        const m = new THREE.MeshStandardMaterial(p);
        owned.push(m);
        return m;
    };
    const alu = mat({ color: 0xbfc6cd, roughness: 0.38, metalness: 0.72 });
    const steel = mat({ color: 0xa3abb3, roughness: 0.22, metalness: 0.9 });
    const yellow = mat({ color: 0xf2b01e, roughness: 0.5, metalness: 0.15 });
    const anth = mat({ color: mode === "dark" ? 0x283037 : 0x323a41, roughness: 0.55, metalness: 0.35 });
    const black = mat({ color: 0x17191c, roughness: 0.75, metalness: 0.1 });
    const groove = mat({ color: 0x5f676f, roughness: 0.5, metalness: 0.6 });
    const cabinet = mat({ color: 0xd3d6d8, roughness: 0.6, metalness: 0.1 });
    const orange = mat({ color: 0xf26b1d, roughness: 0.5 });
    const hazard = mat({ map: tex.stripes, roughness: 0.55, metalness: 0.1 });
    const reflector = mat({ color: 0xc8202a, roughness: 0.25, metalness: 0.2 });
    const fenceNet = mat({ map: tex.mesh, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
    const glow = (c, i = 1.2) => mat({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });
    const redDot = glow(0xff3b30, 1.6);
    const box = (parent, w, h, d, m, x, y, z, shadow = true) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mesh.position.set(x, y, z);
        mesh.castShadow = shadow;
        parent.add(mesh);
        return mesh;
    };
    const cyl = (parent, r, h, m, x, y, z, axis = "y", seg = 18) => {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
        mesh.position.set(x, y, z);
        if (axis === "x")
            mesh.rotation.z = Math.PI / 2;
        if (axis === "z")
            mesh.rotation.x = Math.PI / 2;
        mesh.castShadow = true;
        parent.add(mesh);
        return mesh;
    };
    // Alüminyum profil: gövde + her yan yüzde iki T kanalı
    const profile = (parent, len, h, d, x, y, z, along = "x") => {
        if (along === "x") {
            box(parent, len, h, d, alu, x, y, z);
            for (const s of [-1, 1])
                for (const k of [-1, 1])
                    box(parent, len, 0.011, 0.003, groove, x, y + k * h * 0.25, z + s * (d / 2 + 0.001), false);
        }
        else {
            box(parent, h, len, d, alu, x, y, z);
            for (const s of [-1, 1])
                for (const k of [-1, 1]) {
                    box(parent, 0.011, len, 0.003, groove, x + k * h * 0.25, y, z + s * (d / 2 + 0.001), false);
                    box(parent, 0.003, len, 0.011, groove, x + s * (h / 2 + 0.001), y, z + k * d * 0.25, false);
                }
        }
    };
    const span = o.aisle / 2 + 0.05; // ray ekseni: raf ön dikmelerinin üstü
    const x0 = o.startX - 0.4, x1 = o.endX + 1.25, len = x1 - x0, xm = (x0 + x1) / 2;
    const rY = o.railY, rackTop = o.rackTop ?? rY - 0.14, bay = o.bay ?? 2;
    const railTop = rY + 0.07 + 0.025;
    // ── Ray sistemi (sabit) ──
    for (const s of [-1, 1]) {
        const z = s * span;
        profile(group, len, 0.14, 0.12, xm, rY, z);
        box(group, len, 0.025, 0.034, steel, xm, rY + 0.0825, z); // lineer kılavuz ray
        box(group, len, 0.03, 0.012, anth, xm, rY + 0.035, z + s * 0.067, false); // kremayer (dış yüz)
        // Raf üstü braketler: her bölme dikmesinde
        const bh = rY - 0.07 - rackTop;
        if (bh > 0.005)
            for (let x = o.startX; x <= o.endX + 1e-6; x += bay) {
                box(group, 0.09, bh, 0.1, anth, x, rackTop + bh / 2, z, false);
                box(group, 0.16, 0.01, 0.14, anth, x, rackTop + 0.005, z, false);
            }
        // Uç portal dikmeleri: ankrajlı taban plakası, köşebent, tampon
        for (const end of [-1, 1]) {
            const x = end < 0 ? x0 + 0.06 : x1 - 0.06, inward = -end;
            profile(group, rY - 0.07, 0.12, 0.12, x, (rY - 0.07) / 2, z, "y");
            box(group, 0.3, 0.02, 0.3, anth, x, 0.01, z, false);
            for (const a of [-1, 1])
                for (const b of [-1, 1])
                    cyl(group, 0.012, 0.03, steel, x + a * 0.11, 0.035, z + b * 0.11, "y", 8);
            const brace = box(group, 0.05, 0.46, 0.05, alu, x + inward * 0.16, rY - 0.07 - 0.16, z);
            brace.rotation.z = -inward * (Math.PI / 4);
            box(group, 0.08, 0.1, 0.1, hazard, x + inward * 0.1, railTop + 0.05, z);
            cyl(group, 0.032, 0.07, black, x + inward * 0.175, railTop + 0.05, z, "x");
        }
    }
    // Uçlarda karşılıklı bağlantı kirişleri (portal)
    for (const x of [x0 + 0.06, x1 - 0.06]) {
        const beam = new THREE.Group();
        beam.position.set(x, rY, 0);
        beam.rotation.y = Math.PI / 2;
        profile(beam, 2 * span - 0.12, 0.12, 0.1, 0, 0, 0);
        group.add(beam);
    }
    // Lazer mesafe ölçerin reflektörü (−z rayının başında)
    box(group, 0.012, 0.12, 0.12, reflector, x0 + 0.2, railTop + 0.09, -span);
    // ── Enerji zinciri: +z rayının dışındaki kanalda ──
    const zc = span + 0.14, trayY = rY - 0.04, r = 0.1, link = 0.05;
    box(group, len - 0.3, 0.006, 0.1, alu, xm, trayY, zc, false);
    for (const k of [-1, 1])
        box(group, len - 0.3, 0.07, 0.004, alu, xm, trayY + 0.035, zc + k * 0.05, false);
    for (let x = x0 + 0.4; x < x1 - 0.2; x += 1.5)
        box(group, 0.03, 0.04, 0.08, anth, x, trayY + 0.01, span + 0.09, false);
    const F = x0 + 0.25, C = x1 - 0.35 - F, yl = trayY + 0.023, arc = Math.PI * r;
    const nLinks = Math.ceil((C + arc) / link) + 1;
    const chain = new THREE.InstancedMesh(new THREE.BoxGeometry(link - 0.004, 0.04, 0.07), black, nLinks);
    chain.frustumCulled = false;
    group.add(chain);
    const m4 = new THREE.Matrix4(), qz = new THREE.Quaternion(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0), zAxis = new THREE.Vector3(0, 0, 1);
    let chainX = NaN;
    // Alt kol F'den kıvrıma, yarım daire, üst kol köprüye: kıvrım B = (C + F + X) / 2, köprünün yarı hızıyla kayar
    const layoutChain = (bx) => {
        const X = Math.min(F + C, Math.max(F, bx));
        const B = (C + F + X) / 2, a = B - F;
        for (let k = 0; k < nLinks; k++) {
            const t = k * link + link / 2;
            let px, py, ang;
            if (t <= a) {
                px = F + t;
                py = yl;
                ang = 0;
            }
            else if (t <= a + arc) {
                const p = -Math.PI / 2 + (t - a) / r;
                px = B + r * Math.cos(p);
                py = yl + r + r * Math.sin(p);
                ang = p + Math.PI / 2;
            }
            else {
                px = B - (t - a - arc);
                py = yl + 2 * r;
                ang = Math.PI;
            }
            m4.compose(v3.set(px, py, zc), qz.setFromAxisAngle(zAxis, ang), t > C + arc ? zero : one);
            chain.setMatrixAt(k, m4);
        }
        chain.instanceMatrix.needsUpdate = true;
        chainX = bx;
    };
    // ── Köprü (X) ──
    const bridge = new THREE.Group();
    group.add(bridge);
    for (const s of [-1, 1]) {
        const z = s * span;
        for (const x of [-0.2, 0.2])
            box(bridge, 0.12, 0.05, 0.07, steel, x, railTop + 0.025, z); // lineer rulman arabası
        box(bridge, 0.66, 0.05, 0.22, anth, 0, railTop + 0.075, z);
        // Tahrik: redüktör + dikey servo motor (kremayer-pinyon, dış yüzde)
        box(bridge, 0.11, 0.1, 0.11, anth, 0.14, railTop + 0.05, z + s * 0.17);
        cyl(bridge, 0.048, 0.2, black, 0.14, railTop + 0.2, z + s * 0.17);
        box(bridge, 0.03, 0.03, 0.04, orange, 0.14, railTop + 0.27, z + s * 0.22, false);
    }
    // Enerji zinciri bağlantı kolu
    box(bridge, 0.05, 0.05, 0.16, anth, 0, yl + 2 * r + 0.02, span + 0.08, false);
    const gY = railTop + 0.1 + 0.11; // kiriş ekseni (0,22 m yükseklik)
    for (const x of [-0.2, 0.2]) {
        box(bridge, 0.1, 0.22, 2 * span + 0.22, yellow, x, gY, 0);
        box(bridge, 0.104, 0.012, 2 * span + 0.224, anth, x, gY + 0.11, 0, false);
        for (const s of [-1, 1])
            box(bridge, 0.104, 0.224, 0.06, hazard, x, gY, s * (span + 0.08), false);
    }
    // Z arabası (kirişler arası) + motor; kumanda dolabı; sinyal kulesi; lazer
    const zc0 = gY - 0.16;
    box(bridge, 0.3, 0.32, 0.28, anth, 0, gY, 0);
    box(bridge, 0.5, 0.02, 0.34, anth, 0, gY + 0.17, 0);
    box(bridge, 0.1, 0.08, 0.1, anth, 0, gY + 0.22, 0.17);
    cyl(bridge, 0.05, 0.22, black, 0, gY + 0.37, 0.17);
    box(bridge, 0.44, 0.3, 0.15, cabinet, 0, gY + 0.26, -span + 0.24);
    box(bridge, 0.004, 0.26, 0.002, groove, 0.02, gY + 0.26, -span + 0.316, false);
    box(bridge, 0.016, 0.06, 0.016, black, 0.15, gY + 0.26, -span + 0.322, false);
    cyl(bridge, 0.012, 0.12, black, 0, gY + 0.24, -0.15, "y", 10);
    const lamp = (c) => mat({ color: c, emissive: c, emissiveIntensity: 0.05, roughness: 0.3, transparent: true, opacity: 0.93 });
    const lamps = { r: lamp(0xe0342b), a: lamp(0xffa21f), g: lamp(0x2fbf4a) };
    [lamps.g, lamps.a, lamps.r].forEach((m, k) => cyl(bridge, 0.032, 0.05, m, 0, gY + 0.33 + k * 0.052, -0.15, "y", 16));
    cyl(bridge, 0.033, 0.02, cabinet, 0, gY + 0.495, -0.15, "y", 16);
    box(bridge, 0.06, 0.06, 0.08, anth, -0.36, railTop + 0.09, -span);
    box(bridge, 0.004, 0.02, 0.02, redDot, -0.392, railTop + 0.09, -span, false);
    // Kimlik plakası (kirişlerin dış yüzlerinde)
    let labelTex = null;
    if (o.label) {
        const c = document.createElement("canvas");
        c.width = 256;
        c.height = 96;
        const g = c.getContext("2d");
        g.fillStyle = "#1d2328";
        g.fillRect(0, 0, 256, 96);
        g.strokeStyle = "#f2b01e";
        g.lineWidth = 8;
        g.strokeRect(4, 4, 248, 88);
        g.fillStyle = "#ffffff";
        g.font = "700 56px system-ui, -apple-system, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(o.label, 128, 52);
        labelTex = new THREE.CanvasTexture(c);
        labelTex.colorSpace = THREE.SRGBColorSpace;
        const pm = mat({ map: labelTex, roughness: 0.6 });
        for (const s of [-1, 1]) {
            const p = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), pm);
            p.position.set(s * 0.2505 + s * 0.001, gY, -span * 0.45);
            p.rotation.y = (s * Math.PI) / 2;
            bridge.add(p);
        }
    }
    // ── Z: iki kademeli teleskobik kolon ──
    const yMin = o.yMin ?? 0.08, dMax = Math.max(0.6, zc0 - (yMin + 0.52));
    const Lo = dMax / 2 + 0.36, Li = dMax / 2 + 0.26;
    const sleeve = new THREE.Group();
    bridge.add(sleeve);
    profile(sleeve, Lo, 0.13, 0.13, 0, Lo / 2, 0, "y");
    box(sleeve, 0.012, Lo, 0.02, anth, 0, Lo / 2, 0.072, false); // Z kremayeri
    const carriage = new THREE.Group();
    bridge.add(carriage);
    profile(carriage, Li, 0.095, 0.095, 0, 0.52 + Li / 2, 0, "y");
    cyl(carriage, 0.14, 0.05, anth, 0, 0.495, 0, "y", 28); // döner tabla (sabit halka)
    cyl(carriage, 0.035, 0.12, black, 0.1, 0.58, 0.1, "y", 14); // döndürme motoru
    // ── Kasa alma ünitesi (döner) ──
    const unit = new THREE.Group();
    carriage.add(unit);
    box(unit, 0.76, 0.03, 0.6, anth, 0, 0.455, 0);
    for (const s of [-1, 1]) {
        box(unit, 0.04, 0.03, 0.04, black, 0.35, 0.425, s * 0.26, false); // fotosel
        box(unit, 0.004, 0.012, 0.012, redDot, 0.372, 0.425, s * 0.26, false);
    }
    box(unit, 0.7, 0.02, 0.16, black, 0, -0.01, 0); // kayar yatak
    for (const s of [-1, 1])
        box(unit, 0.7, 0.006, 0.012, steel, 0, 0.003, s * 0.06, false);
    const sides = [-1, 1].map((s) => {
        const side = new THREE.Group();
        unit.add(side);
        box(side, 0.74, 0.09, 0.026, cabinet, 0, 0.045, s * 0.05); // kol gövdesi (0. kademe)
        for (const x of [-0.33, 0.33])
            box(side, 0.03, 0.35, 0.03, cabinet, x, 0.09 + 0.175, s * 0.05); // çerçeve dikmesi
        cyl(side, 0.024, 0.1, black, -0.28, 0.115, s * 0.05, "x", 12); // kol motoru
        const st = [0.03, 0.018, 0.006].map((zz, k) => {
            const g = new THREE.Group();
            side.add(g);
            box(g, 0.72, 0.075 - k * 0.01, 0.011, alu, 0, 0.045, s * zz);
            return g;
        });
        // Parmaklar: uçta, ortada, arkada; ekseni kol boyunca, kalkıkken yukarı bakar
        const fingers = [-0.352, 0, 0.352].map((x) => {
            const pv = new THREE.Group();
            pv.position.set(x, 0.045, 0);
            st[2].add(pv);
            box(pv, 0.016, 0.04, 0.075, black, 0, 0, -s * 0.0375, false);
            return pv;
        });
        return { side, st, fingers, s };
    });
    const loadHolder = new THREE.Group();
    loadHolder.rotation.y = Math.PI / 2; // kasanın uzun kenarı kolların uzandığı yönde
    unit.add(loadHolder);
    // ── Konveyör (giriş / çıkış) ──
    const conv = { pickX: o.endX + 1.45, outX: o.endX + 3.85, y: 0.78 };
    const cx0 = o.endX + 0.75, cx1 = o.endX + 4.3, cl = cx1 - cx0, cm = (cx0 + cx1) / 2;
    for (const s of [-1, 1]) {
        box(group, cl, 0.1, 0.03, alu, cm, conv.y - 0.045, s * 0.37);
        box(group, cl, 0.01, 0.05, alu, cm, conv.y + 0.003, s * 0.36, false);
        cyl(group, 0.009, cl - 0.1, steel, cm, conv.y + 0.075, s * 0.33, "x", 8);
        for (let x = cx0 + 0.3; x < cx1; x += 0.7)
            box(group, 0.02, 0.07, 0.02, anth, x, conv.y + 0.04, s * 0.345, false);
    }
    for (let x = cx0 + 0.25; x < cx1; x += 1.1) {
        for (const s of [-1, 1]) {
            box(group, 0.05, conv.y - 0.1, 0.05, alu, x, (conv.y - 0.1) / 2, s * 0.33);
            box(group, 0.09, 0.015, 0.09, anth, x, 0.0075, s * 0.33, false);
        }
        box(group, 0.04, 0.04, 0.62, alu, x, 0.22, 0, false);
    }
    const nR = Math.floor(cl / 0.1);
    const motorAt = (k) => k % 5 === 2;
    const nMotor = Array.from({ length: nR }, (_, k) => k).filter(motorAt).length;
    const rollers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.024, 0.024, 0.68, 12), alu, nR - nMotor);
    const motors = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.68, 12), anth, nMotor);
    const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    for (let k = 0, a = 0, b = 0; k < nR; k++) {
        m4.compose(v3.set(cx0 + 0.05 + k * 0.1, conv.y - 0.025, 0), qr, one);
        if (motorAt(k))
            motors.setMatrixAt(b++, m4);
        else
            rollers.setMatrixAt(a++, m4);
    }
    rollers.receiveShadow = motors.receiveShadow = true;
    group.add(rollers, motors);
    box(group, 0.012, 0.05, 0.5, hazard, conv.pickX - 0.34, conv.y + 0.02, 0, false); // durdurucu
    box(group, 0.04, 0.05, 0.04, black, conv.pickX, conv.y + 0.06, -0.385, false); // fotosel
    box(group, 0.012, 0.012, 0.004, redDot, conv.pickX, conv.y + 0.06, -0.364, false);
    box(group, 0.05, 0.05, 0.01, reflector, conv.pickX, conv.y + 0.06, 0.385, false);
    const sx = o.endX + 3.35; // barkod okuyucu kemeri (ışık perdesinin operatör tarafında)
    for (const s of [-1, 1])
        box(group, 0.03, 0.55, 0.03, anth, sx, conv.y + 0.27, s * 0.4);
    box(group, 0.03, 0.03, 0.83, anth, sx, conv.y + 0.55, 0);
    box(group, 0.1, 0.06, 0.08, black, sx, conv.y + 0.51, 0);
    box(group, 0.06, 0.004, 0.04, redDot, sx, conv.y + 0.478, 0, false);
    box(group, 0.04, 0.12, 0.74, hazard, cx1 + 0.02, conv.y + 0.03, 0); // uç tamponu
    const lx = o.endX + 2.75; // ışık perdesi
    for (const s of [-1, 1]) {
        box(group, 0.05, 1.5, 0.05, yellow, lx, 0.75, s * 0.47);
        box(group, 0.03, 1.32, 0.006, black, lx, 0.8, s * 0.442, false);
    }
    // ── Emniyet çiti (sarı dikme + tel örgü), arka uçta bakım kapısı ──
    if (o.fence !== false) {
        const H = 2, fz = span + 0.3;
        const post = (x, z) => {
            box(group, 0.05, H, 0.05, yellow, x, H / 2, z, false);
            box(group, 0.12, 0.01, 0.12, anth, x, 0.005, z, false);
        };
        const panel = (xa, za, xb, zb, door = false) => {
            const L = Math.hypot(xb - xa, zb - za);
            const g = new THREE.Group();
            g.position.set((xa + xb) / 2, 0, (za + zb) / 2);
            g.rotation.y = Math.atan2(-(zb - za), xb - xa);
            group.add(g);
            const w = L - 0.07, h = H - 0.22;
            const geo = new THREE.PlaneGeometry(w, h);
            const uv = geo.attributes.uv;
            for (let k = 0; k < uv.count; k++)
                uv.setXY(k, uv.getX(k) * (w / 0.2), uv.getY(k) * (h / 0.2));
            const net = new THREE.Mesh(geo, fenceNet);
            net.position.y = 0.14 + h / 2;
            net.renderOrder = 2;
            g.add(net);
            for (const y of [0.14, 0.14 + h])
                box(g, w, 0.022, 0.022, anth, 0, y, 0, false);
            for (const x of [-w / 2, w / 2])
                box(g, 0.022, h, 0.022, anth, x, 0.14 + h / 2, 0, false);
            if (door) {
                box(g, 0.05, 0.16, 0.06, yellow, w / 2 - 0.08, 1.05, 0.04, false); // kapı kolu
                box(g, 0.07, 0.1, 0.05, mat({ color: 0xc8202a, roughness: 0.5 }), w / 2 - 0.08, 1.2, 0.04, false); // emniyet kilidi
            }
        };
        const run = (xa, za, xb, zb, doorMid = false) => {
            const L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.ceil(L / 1.4));
            for (let k = 0; k <= n; k++)
                post(xa + ((xb - xa) * k) / n, za + ((zb - za) * k) / n);
            for (let k = 0; k < n; k++)
                panel(xa + ((xb - xa) * k) / n, za + ((zb - za) * k) / n, xa + ((xb - xa) * (k + 1)) / n, za + ((zb - za) * (k + 1)) / n, doorMid && k === Math.floor(n / 2));
        };
        const fx0 = o.endX + 0.05;
        for (const s of [-1, 1]) {
            run(fx0, s * fz, lx, s * fz);
            run(lx, s * fz, lx, s * 0.52);
        }
        run(x0 - 0.25, -fz, x0 - 0.25, fz, true);
    }
    let load = null, t = 0, grip = 0, gripTo = 0, moving = false;
    const applyGrip = () => sides.forEach(({ fingers, s }) => fingers.forEach((pv) => (pv.rotation.x = s * (1 - grip) * (Math.PI / 2))));
    applyGrip();
    const api = {
        group,
        /** Hareketli gövde (köprü, Z, kasa alma ünitesi): tıklama / üzerine gelme ışını için */
        body: bridge,
        conveyor: conv,
        setPose(p) {
            bridge.position.x = p.x;
            carriage.position.y = p.y;
            const D = zc0 - (p.y + 0.52);
            sleeve.position.y = zc0 - D / 2 - 0.02; // dış kılıf yarı yolda
            unit.rotation.y = p.rot;
            const reach = Math.max(0, p.reach), w = p.width ?? 0.4;
            for (const { side, st, s } of sides) {
                side.position.z = s * (w / 2 + 0.012);
                st[0].position.x = reach / 3;
                st[1].position.x = (2 * reach) / 3;
                st[2].position.x = reach;
            }
            loadHolder.position.x = reach;
            gripTo = p.grip ?? (load ? 1 : 0);
            if (p.x !== chainX)
                layoutChain(p.x);
        },
        setLoad(size, opts = {}) {
            if (load) {
                loadHolder.remove(load);
                disposeTree(load);
                load = null;
            }
            if (size) {
                load = bizmoCrateMesh(THREE, size, opts);
                load.position.y = 0.004;
                loadHolder.add(load);
            }
        },
        /**
         * Ünite kamerası (bizmoFollow "mount"): göz üst plakanın ön kenarında, ortada (kolon arkada kalır); bakış iki kolun
         * arasından kol ucuna: kollar içerideyken yataktaki kasa yukarıdan, uzanınca rafın içi görünür. Dünya koordinatı yazar.
         */
        mount(eye, look) {
            unit.updateWorldMatrix(true, false);
            unit.localToWorld(eye.set(0.3, 0.6, 0));
            unit.localToWorld(look.set(Math.max(0, sides[0].st[2].position.x) + 0.4, 0.02, 0));
        },
        /** Sinyal kulesi: yeşil hazır (sürekli), amber hareket (yanıp söner; azaltılmış harekette sabit). Parmaklar yumuşakça döner */
        update(dt, isMoving) {
            t += dt;
            moving = isMoving;
            const still = reduced();
            lamps.g.emissiveIntensity = 1.1;
            lamps.a.emissiveIntensity = moving && (still || Math.sin(t * 8) > 0) ? 1.5 : 0.05;
            lamps.r.emissiveIntensity = 0.05;
            if (grip !== gripTo) {
                const d = gripTo - grip;
                grip = still || Math.abs(d) <= dt * 5 ? gripTo : grip + Math.sign(d) * dt * 5;
                applyGrip();
            }
        },
        dispose() {
            api.setLoad(null);
            group.traverse((x) => x.geometry?.dispose?.());
            owned.forEach((m) => m.dispose());
            labelTex?.dispose();
        },
    };
    layoutChain(o.endX + 0.65);
    return api;
}
