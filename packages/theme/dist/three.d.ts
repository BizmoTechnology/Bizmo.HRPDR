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
export type Mode = "light" | "dark";
export declare const BIZMO_3D: {
    readonly light: {
        readonly background: 15594231;
        readonly fog: 15988474;
        readonly node: 16777215;
        readonly nodeEdge: 1581871;
        readonly nodeLive: 7190828;
        readonly axon: 9411238;
        readonly axonActive: 38089;
        readonly signal: 5147678;
        readonly ground: 15133938;
        readonly gridLine: 13818596;
        readonly label: "#18232f";
        readonly hemiSky: 16777215;
        readonly hemiGround: 13884646;
        readonly key: 16777215;
        readonly exposure: 1.12;
        readonly floorDot: 10135736;
        readonly shadowOpacity: 0.1;
        readonly glow: 7190828;
    };
    readonly dark: {
        readonly background: 725787;
        readonly fog: 857373;
        readonly node: 2240831;
        readonly nodeEdge: 11056578;
        readonly nodeLive: 7190828;
        readonly axon: 3820380;
        readonly axonActive: 3389928;
        readonly signal: 7190828;
        readonly ground: 989732;
        readonly gridLine: 2241346;
        readonly label: "#eef3f8";
        readonly hemiSky: 10466248;
        readonly hemiGround: 857373;
        readonly key: 14674162;
        readonly exposure: 1.05;
        readonly floorDot: 3360602;
        readonly shadowOpacity: 0.42;
        readonly glow: 9359695;
    };
};
/** Kategori renkleri (veri katmanları, makine grupları) — charts.ts ile aynı sıra */
export declare const BIZMO_3D_SERIES: Record<Mode, number[]>;
/** Durum renkleri (makine/sensör: çalışıyor · uyarı · arıza · bilgi) — her zaman etiketle */
export declare const BIZMO_3D_STATUS: Record<Mode, {
    ok: number;
    warning: number;
    fault: number;
    info: number;
    idle: number;
}>;
/**
 * Sahne zemini, sis, ton eşleme ve renk uzayı.
 * transparent: true → arka plan ve sis çizilmez; tuvalin arkasındaki CSS zemini (.bz-scene) görünür.
 * Önerilen budur: tema değişince zemin CSS'ten kendiliğinden gelir. Renderer { alpha: true } ile oluşturulmalı.
 */
export declare function bizmoScene(THREE: any, scene: any, renderer: any, mode: Mode, opts?: {
    transparent?: boolean;
}): any;
/** Yumuşak, gölgesi sakin ışık düzeni: gökyüzü/zemin + tek anahtar ışık (+ koyuda arka kenar ışığı) */
export declare function bizmoLights(THREE: any, mode: Mode): any[];
/** Malzemeler: mat, düşük parlaklık; parlak/metalik efekt yok (marka: gösteriş yok, sakin) */
export declare function bizmoMaterials(THREE: any, mode: Mode): {
    node: any;
    nodeLive: any;
    nodeEdge: any;
    axon: any;
    axonActive: any;
    axonTube: any;
    axonTubeActive: any;
    axonTubeDim: any;
    signal: any;
    surface: any;
    glass: any;
    series: any[];
};
/** Düğüm kenar çizgisi: koyu temada hacmi okutur, açık temada ince lacivert kontur. mesh.add(bizmoEdges(THREE, mesh.geometry, m.nodeEdge)) */
export declare function bizmoEdges(THREE: any, geometry: any, material: any, thresholdAngle?: number): any;
/** Zemin ızgarası (dijital ikiz, yerleşim planı): ince, sisle kaybolan */
export declare function bizmoGrid(THREE: any, mode: Mode, size?: number, divisions?: number): any;
/**
 * Akson yolu: iki nokta arasında yalnız 0°/45°/90° kırılan çizgi (XZ düzleminde).
 * Önce eksen boyunca, sonra 45° çapraz, sonra yine eksen — "okunabilir sinyal yolu".
 */
export declare function axonPath(a: [number, number, number], b: [number, number, number]): [number, number, number][];
/** Sinyal: yol boyunca tek yönde akan nokta. t ∈ [0,1) her karede artırılır */
export declare function pointOnPath(path: [number, number, number][], t: number): [number, number, number];
/** Hareket tercihi: azaltılmış harekette sinyaller durur, kamera otomatik dönmez */
export declare const prefersReducedMotion: () => boolean;
/** Sayfa temasını izler: data-theme / .dark / işletim sistemi değişince callback(mode) */
export declare function watchMode(cb: (m: Mode) => void): () => void;
/**
 * Zemin: yalnız gölgeyi gösteren saydam düzlem + kenarlara doğru solan nokta ızgara (planlama kâğıdı hissi).
 * Tema değişince setMode(mode) çağrılır.
 */
export declare function bizmoFloor(THREE: any, mode: Mode, opts?: {
    size?: number;
    spacing?: number;
}): {
    group: any;
    setMode: (m: Mode) => void;
};
/** Düğüm: yuvarlak disk (puck). Uygulama, makine, birim. Kenar çizgisi için bizmoEdges ekleyin */
export declare function bizmoPuck(THREE: any, material: any, opts?: {
    radius?: number;
    height?: number;
}): any;
/** Durum halkası: yalnız uyarı ve arızada çizilir (sakin sahne: "çalışıyor" halka almaz) */
export declare function bizmoStatusRing(THREE: any, color: number, radius?: number): any;
/** Akson tüpü: 0°/45°/90° yolu kalınlığı olan çizgi olarak (1px WebGL çizgisinden daha okunur) */
export declare function bizmoAxonTube(THREE: any, path: [number, number, number][], material: any, radius?: number): any;
/** Yumuşak parıltı dokusu (sinyal başı, canlı düğüm halesi) */
export declare function bizmoGlowTexture(THREE: any, color: number): any;
/**
 * Sinyal: parlak baş + sönümlenen kuyruk. Yol boyunca tek yönde akar.
 *   const s = bizmoSignal(THREE, mode); scene.add(s.group); her karede s.set(path, t)
 */
export declare function bizmoSignal(THREE: any, mode: Mode, opts?: {
    size?: number;
    trail?: number;
}): {
    group: any;
    set(path: [number, number, number][], t: number, gap?: number, lift?: number): void;
    setMode(m: Mode): void;
};
/** Canlı düğüm halesi: genişleyip sönen halka (azaltılmış harekette sabit) */
export declare function bizmoPulse(THREE: any, mode: Mode, radius?: number): {
    mesh: any;
    update(time: number): void;
    setMode(m: Mode): void;
};
/** OrbitControls ayarı: yumuşak sönüm, zemin altına inmez, sınırlı yakınlaştırma. Sınıfı parametre olarak verin */
export declare function bizmoOrbit(OrbitControls: any, camera: any, dom: HTMLElement, opts?: {
    minDistance?: number;
    maxDistance?: number;
    autoRotate?: boolean;
}): any;
/**
 * Kamerayı bir noktaya yumuşakça odaklar (kontrol hedefi ile birlikte). Azaltılmış harekette anında.
 * Aynı kontrolde yeni odaklama öncekini durdurur; kullanıcı sürüklemeye başlarsa odaklama bırakılır
 * (iki animasyon ya da animasyon + el aynı kamerayı çekiştirip titretmez).
 */
export declare function bizmoFocus(camera: any, controls: any, target: [number, number, number], opts?: {
    distance?: number;
    duration?: number;
    position?: [number, number, number];
}): Promise<void>;
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
export declare function bizmoFollow(THREE: any, camera: any, controls: any, opts?: {
    mountFov?: number;
}): {
    readonly active: boolean;
    readonly mode: "chase" | "mount";
    start(m?: "chase" | "mount", offset?: [number, number, number]): void;
    stop(): void;
    update(dt: number, anchor: any, mount?: {
        eye: any;
        look: any;
    }): void;
};
/** 3B noktayı ekrana yansıtıp HTML etiketi taşır; kameranın arkasındaysa gizler. Her karede çağrılır */
export declare function bizmoProjectLabel(camera: any, position: any, el: HTMLElement, width: number, height: number): boolean;
/** Üzerine gelme ve seçim: işaretçi + ışın. Boşluğa tıklamak seçimi kaldırır (null) */
export declare function bizmoPicker(THREE: any, camera: any, dom: HTMLElement, getTargets: () => any[], on: {
    hover?: (obj: any | null, hit?: any) => void;
    select?: (obj: any | null, hit?: any) => void;
}): () => void;
/**
 * Sahnenin bir kısmını kaplayan panel varken ağı kalan alanda ortalar (etiket yansıtması da doğru kalır).
 *   bizmoViewInset(camera, W, H, { left: panel.offsetWidth + 12 })
 */
export declare function bizmoViewInset(camera: any, width: number, height: number, inset?: {
    left?: number;
    right?: number;
    bottom?: number;
}): void;
export type MachineStatus = "ok" | "warning" | "fault" | "idle";
/**
 * Tezgâh (CNC, torna, pres): gövde + cam kapı + kontrol paneli + dönen iş mili + durum lambası + ton şeridi.
 *   const m = bizmoMachine(THREE, mode, mats, { hue: 0x7f8fa6 }); scene.add(m.group); m.setStatus("fault"); her karede m.update(dt, rpm)
 */
export declare function bizmoMachine(THREE: any, mode: Mode, mats: ReturnType<typeof bizmoMaterials>, opts?: {
    w?: number;
    h?: number;
    d?: number;
    hue?: number;
}): {
    group: any;
    pickable: any;
    setStatus(s: MachineStatus): void;
    /** rpm: dakikadaki devir (0 = duruyor). Arızada lamba yumuşakça nabız atar, hiç sönmez (çakar değil; azaltılmış harekette sabit) */
    update(dt: number, rpm: number): void;
    dispose(): void;
};
/** Bant / yol üzerinde akan parçalar (üretim hattı, depo). speed 0 → durur */
export declare function bizmoFlow(THREE: any, path: [number, number, number][], opts?: {
    count?: number;
    size?: number;
    color?: number;
    lift?: number;
}): {
    group: any;
    material: any;
    /** speed: yol uzunluğu başına döngü/sn; dönüş: bu karede yolun sonuna ulaşan parça sayısı */
    update(dt: number, speed: number): number;
};
/** Araç (sevkiyat haritası): kabin + dorse; yol boyunca yön alır. Uyarıda turuncu lamba */
export declare function bizmoTruck(THREE: any, mode: Mode, mats: ReturnType<typeof bizmoMaterials>, opts?: {
    hue?: number;
}): {
    group: any;
    pickable: any;
    pickables: any[];
    setWarning(on: boolean): void;
    /** Yol üzerinde t konumuna taşır ve gidiş yönüne çevirir */
    place(path: [number, number, number][], t: number): void;
};
/** Depo yerleşimi için göz adresi şeması (location.ts · bizmoLocationScheme ile aynı biçim) */
export type WarehouseScheme = {
    blocks: string[];
    levels: string[];
    bays: number;
    positions: number;
    total: number;
    at(i: number): {
        block: string;
        bay: number;
        level: string;
        pos: number;
    };
};
export type WarehouseOptions = {
    /** Bölme genişliği (dikme ekseninden dikme eksenine, m) */
    bayWidth?: number;
    /** Raf derinliği (m) */
    depth?: number;
    /** Kat yüksekliği (m); A katı zemindir */
    levelHeight?: number;
    /** Koridor genişliği (m, forklift) */
    aisle?: number;
    /** Sırt sırta raflar arası boşluk (m) */
    flue?: number;
    /** Rampa kapısı sayısı (raf uçlarının karşısındaki duvarda) */
    docks?: number;
};
/**
 * Gerçekçi depo: seçmeli palet rafı (mavi dikme, turuncu kiriş), EUR palet + yük, sırt sırta sıralar ve koridorlar,
 * beton zemin + sarı şeritler, raf sonu blok tabelaları, koruyucular, rampa kapıları. Gözler InstancedMesh ile çizilir
 * (binlerce göz tek çizim çağrısı); seçim için görünmez "hit" kutuları (hit.instanceId = göz indeksi).
 *   const wh = bizmoWarehouse(THREE, mode, loc, { docks: 4 }); scene.add(wh.group);
 *   wh.setSlot(i, { filled: true, height: 1.1, color: 0xc9a77c }); wh.commit(); wh.select(i);
 */
export declare function bizmoWarehouse(THREE: any, mode: Mode, scheme: WarehouseScheme, opts?: WarehouseOptions): {
    group: any;
    /** Seçim için: intersectObject(hit) → instanceId = göz indeksi */
    hit: any;
    signs: {
        block: string;
        position: [number, number, number];
    }[];
    bounds: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
        rackTop: number;
    };
    rowZ: number[];
    aisleZ: (b: number) => number;
    rack: {
        startX: number;
        endX: number;
        bayWidth: number;
        levelHeight: number;
        depth: number;
    };
    dockZ: (k: number) => number;
    dockX: number;
    /** Göz merkezi (yükün ortası) */
    slotCenter(i: number): [number, number, number];
    /** Forkliftin göz önünde durduğu nokta (koridor ekseni) ve kat yüksekliği */
    slotFront(i: number): {
        x: number;
        z: number;
        facing: number;
        lift: number;
    };
    setSlot(i: number, s: {
        filled?: boolean;
        height?: number;
        color?: number;
        ghost?: number | null;
    }): void;
    /** setSlot değişikliklerini çizime aktarır (toplu güncellemeden sonra bir kez) */
    commit(): void;
    select(i: number | null): void;
    hover(i: number | null): void;
    /** Seçili göz kutusu yumuşak nabız (her karede; azaltılmış harekette sabit) */
    update(now: number): void;
};
/**
 * Forklift (ileri uzanır tip): sarı gövde, karşı ağırlık, koruma kafesi, iki kademeli direk, çatal + yük, döner lamba.
 *   const f = bizmoForklift(THREE, mode); f.setLift(3); f.setLoad(0xc9a77c); f.group.position / rotation.y
 */
export declare function bizmoForklift(THREE: any, mode: Mode, opts?: {
    color?: number;
}): {
    group: any;
    /** Çatal yüksekliği (m); 1,5 m üstünde iç direk uzanır */
    setLift(h: number): void;
    /** Çataldaki yük: renk ve yükseklik, null = boş */
    setLoad(color: number | null, height?: number): void;
    /** Hareket ederken döner lamba yumuşak nabız (azaltılmış harekette sabit) */
    update(dt: number, moving: boolean): void;
};
export type BinSize = "L" | "M" | "S";
/**
 * Euro kasa ebatları ve istasyondaki yerleşim. x: koridora paralel genişlik, d: derinlik (ön → arka), h: yükseklik (m).
 * Bir istasyona arkalı önlü 2 büyük kasa sığar; orta kasadan 4 (derinlikte), küçükten 8 (2 yan yana × 4 derinlikte).
 */
export declare const BIZMO_BINS: Record<BinSize, {
    label: string;
    dims: string;
    x: number;
    d: number;
    h: number;
    across: number;
    deep: number;
}>;
export declare const binCapacity: (s: BinSize) => number;
/** Kasa içindeki yer: 0 = ön (koridor tarafı) sol; across 2 ise sol / sağ, sonra bir arkaya */
export declare const binSlotName: (s: BinSize, slot: number) => string;
export type BinCrate = {
    size: BinSize;
    slot: number;
    color: number;
    fill: number;
    content: number;
};
/**
 * Kasa deposu: galvaniz raf (dikme + katlar), istasyon barkod etiketleri, plastik Euro kasalar (3 ebat), kasa içi malzeme.
 * Göz adresi palet deposuyla aynı (A-3-D-2); her göz bir istasyondur, kasalar istasyonda önden arkaya dizilir.
 *   const bs = bizmoBinStore(THREE, mode, loc); bs.setSlot(i, { crates: [{ size: "L", slot: 0, color: 0x2463b8, fill: 0.8, content: 0x8a949e }] }); bs.commit();
 */
export declare function bizmoBinStore(THREE: any, mode: Mode, scheme: WarehouseScheme, opts?: {
    positionWidth?: number;
    depth?: number;
    levelHeight?: number;
    aisle?: number;
    flue?: number;
    docks?: number;
}): {
    group: any;
    hit: any;
    signs: {
        block: string;
        position: [number, number, number];
    }[];
    bounds: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
        rackTop: number;
    };
    rowZ: number[];
    aisleZ: (b: number) => number;
    rack: {
        startX: number;
        endX: number;
        bayWidth: number;
        levelHeight: number;
        depth: number;
    };
    dockZ: (k: number) => number;
    dockX: number;
    capacity: {
        L: number;
        M: number;
        S: number;
    };
    slotCenter(i: number): [number, number, number];
    slotFront(i: number): {
        x: number;
        z: number;
        facing: number;
        lift: number;
    };
    setSlot(i: number, s: {
        crates?: BinCrate[];
        ghost?: number | null;
    }): void;
    commit(): void;
    select(i: number | null): void;
    hover(i: number | null): void;
    update(now: number): void;
};
/**
 * Toplama arabası (otonom mobil robot, AMR): alçak gövde + ışık şeridi, direk, iki rafta kasa, ekran, lamba.
 *   const c = bizmoPickCart(THREE, mode); c.setLoad([0x2463b8, 0x6b7178]); c.group.position / rotation.y
 */
export declare function bizmoPickCart(THREE: any, mode: Mode): {
    group: any;
    /** Arabadaki kasalar (en çok 4) */
    setLoad(colors: number[]): void;
    update(dt: number, moving: boolean): void;
};
/** Tek Euro kasa (+ içindeki malzeme): gantry yükü, konveyör, vitrin. Orijin alt orta; uzun kenar (d) z yönünde */
export declare function bizmoCrateMesh(THREE: any, size: BinSize, opts?: {
    color?: number;
    content?: number;
    fill?: number;
}): any;
export type GantryPose = {
    /** Köprü konumu (koridor boyunca, m) */
    x: number;
    /** Kasa alma ünitesinin yatak üstü = taşınan kasanın tabanı (m) */
    y: number;
    /** Ünite yönü: 0 = konveyör (+x), π/2 = −z rafı, −π/2 = +z rafı */
    rot: number;
    /** Teleskobik kolların uzanması (m) */
    reach: number;
    /** Kollar arası açıklık = kasa genişliği (m, varsayılan 0,4: büyük kasa) */
    width?: number;
    /** Parmaklar: 0 kalkık (kollar kasanın yanından geçer), 1 inik (kasanın arkasını kavrar); verilmezse yük varken iner */
    grip?: number;
};
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
export declare function bizmoGantryLoader(THREE: any, mode: Mode, o: {
    startX: number;
    endX: number;
    aisle: number;
    railY: number;
    rackTop?: number;
    bay?: number;
    yMin?: number;
    label?: string;
    fence?: boolean;
}): {
    group: any;
    /** Hareketli gövde (köprü, Z, kasa alma ünitesi): tıklama / üzerine gelme ışını için */
    body: any;
    conveyor: {
        pickX: number;
        outX: number;
        y: number;
    };
    setPose(p: GantryPose): void;
    setLoad(size: BinSize | null, opts?: {
        color?: number;
        content?: number;
        fill?: number;
    }): void;
    /**
     * Ünite kamerası (bizmoFollow "mount"): göz üst plakanın ön kenarında, ortada (kolon arkada kalır); bakış iki kolun
     * arasından kol ucuna: kollar içerideyken yataktaki kasa yukarıdan, uzanınca rafın içi görünür. Dünya koordinatı yazar.
     */
    mount(eye: any, look: any): void;
    /** Sinyal kulesi: yeşil hazır (sürekli), amber hareket (yanıp söner; azaltılmış harekette sabit). Parmaklar yumuşakça döner */
    update(dt: number, isMoving: boolean): void;
    dispose(): void;
};
