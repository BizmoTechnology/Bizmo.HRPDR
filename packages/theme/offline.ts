/**
 * Bizmo Universal Theme · bağlantı, çevrimdışı kuyruk ve tazelik (çerçeveden bağımsız)
 *
 *   const conn = bizmoConnection({ ping: () => fetch("/api/saglik", { method: "HEAD" }).then((r) => r.ok) });
 *   conn.on((s) => …)                    "online" · "offline" · "reconnecting" (navigator.onLine tek başına güvenilmez: ping)
 *   const q = bizmoQueue({ name: "toplama", send: (op) => api.post(op) });   cihazda şifreli (AES-GCM) bekleyen işlem kuyruğu
 *   await q.add({ type: "pick.confirm", data: { line: 12, qty: 9 } });       bağlanınca sırayla, kimlik anahtarıyla bir kez gönderilir
 *   bizmoFreshness(el, { at: Date.now(), agingMs: 60_000, staleMs: 300_000 })  "az önce" · "3 dk önce" + canlı / eskiyor / bayat
 *
 * Kurallar (DESIGN.md §40): kuyruk token ve oturum bilgisi taşımaz; kişisel veri yerine kimlik ve miktar taşır. Yük cihazda
 * dışa aktarılamaz bir anahtarla şifrelenir; çıkışta (clear) silinir. Her işlem bir kimlik anahtarı (idempotency key) taşır:
 * sunucu aynı işlemi iki kez uygulamaz. Çakışmada (sunucudaki kayıt değişmişse) kullanıcıya iki sürüm gösterilir, sessizce ezilmez.
 */

export type ConnState = "online" | "offline" | "reconnecting";

/**
 * Bağlantı durumu: tarayıcı olayları + isteğe bağlı sağlık yoklaması (ping). Çevrimdışıyken artan aralıkla (2 → 4 → … 30 sn)
 * yeniden dener; retry() hemen dener. Kararsız ağda durum titremesin diye "online"a geçiş bir başarılı yoklama ister.
 */
export function bizmoConnection(o: { ping?: () => Promise<boolean>; interval?: number } = {}) {
  let state: ConnState = typeof navigator === "undefined" || navigator.onLine ? "online" : "offline";
  let wait = 2000, timer = 0, nextAt = 0;
  const subs = new Set<(s: ConnState, info: { nextRetryMs: number }) => void>();
  const set = (s: ConnState) => {
    if (s === state && s !== "reconnecting") return;
    state = s;
    subs.forEach((f) => f(s, { nextRetryMs: Math.max(0, nextAt - Date.now()) }));
  };
  const probe = async () => {
    if (!navigator.onLine) return false;
    if (!o.ping) return true;
    try { return await Promise.race([o.ping(), new Promise<boolean>((r) => setTimeout(() => r(false), 5000))]); } catch { return false; }
  };
  const schedule = () => {
    clearTimeout(timer);
    nextAt = Date.now() + wait;
    timer = window.setTimeout(check, wait);
    wait = Math.min(wait * 2, 30000);
  };
  async function check() {
    if (state !== "online") set("reconnecting");
    const ok = await probe();
    if (ok) { wait = 2000; clearTimeout(timer); set("online"); if (o.interval) { timer = window.setTimeout(check, o.interval); } }
    else { set("offline"); schedule(); }
  }
  const onOffline = () => { set("offline"); schedule(); };
  const onOnline = () => void check();
  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  if (o.interval) timer = window.setTimeout(check, o.interval);
  return {
    get state() { return state; },
    on(f: (s: ConnState, info: { nextRetryMs: number }) => void) { subs.add(f); f(state, { nextRetryMs: 0 }); return () => subs.delete(f); },
    /** Hemen dene ("Şimdi dene" düğmesi) */
    retry() { wait = 2000; return check(); },
    /** Uygulama isteği ağ hatasıyla düştüğünde çağırın: yoklama başlar */
    reportFailure() { if (state === "online") { set("offline"); schedule(); } },
    destroy() { clearTimeout(timer); window.removeEventListener("offline", onOffline); window.removeEventListener("online", onOnline); subs.clear(); },
  };
}

// ───────── Şifreli kalıcı kuyruk (IndexedDB + WebCrypto) ─────────

export type QueueStatus = "pending" | "sending" | "error" | "conflict";
export type QueueItem<T = unknown> = { id: string; type: string; data: T; label?: string; at: number; tries: number; status: QueueStatus; error?: string };
export type SendResult = "ok" | "conflict" | { error: string; retry?: boolean };

const idb = (name: string) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(`bz-queue-${name}`, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("items", { keyPath: "id" }); r.result.createObjectStore("keys"); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const tx = <T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => { const r = fn(db.transaction(store, mode).objectStore(store)); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/**
 * Bekleyen işlem kuyruğu. Kayıtlar IndexedDB'de; yük (data) cihazda üretilen, dışa aktarılamaz AES-GCM anahtarıyla şifreli
 * (dosyadan okunamaz; aynı kökenli betik açabilir — XSS'e karşı CSP ayrıca gerekir). Sıra korunur: bir işlem gönderilemezse
 * arkasındakiler beklemez yalnız aynı nesneye ait olanlar bekler (key). send() "ok" · "conflict" · { error, retry } döner.
 */
export function bizmoQueue<T = unknown>(o: { name: string; send: (item: QueueItem<T>) => Promise<SendResult>; key?: (item: QueueItem<T>) => string; memory?: boolean }) {
  const subs = new Set<(items: QueueItem<T>[]) => void>();
  let items: QueueItem<T>[] = [];
  let db: IDBDatabase | null = null, cryptoKey: CryptoKey | null = null, flushing = false;
  const persistent = !o.memory && typeof indexedDB !== "undefined" && !!globalThis.crypto?.subtle;
  const emit = () => subs.forEach((f) => f([...items]));
  const enc = new TextEncoder(), dec = new TextDecoder();

  // Anahtar: cihazda üretilir, dışa aktarılamaz; silinmişse (çıkış) ilk yazımda yenisi üretilir
  const keyOf = async () => {
    if (cryptoKey || !db) return cryptoKey;
    cryptoKey = (await tx<CryptoKey | undefined>(db, "keys", "readonly", (s) => s.get("k"))) ?? null;
    if (!cryptoKey) {
      cryptoKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await tx(db, "keys", "readwrite", (s) => s.put(cryptoKey, "k"));
    }
    return cryptoKey;
  };
  // Diskte yalnız kimlik + şifreli kayıt durur (etiket, tür, yük dahil her şey şifreli)
  type Row = { id: string; iv: Uint8Array<ArrayBuffer>; payload: ArrayBuffer };
  const ready = (async () => {
    if (!persistent) return;
    db = await idb(o.name);
    const key = await keyOf();
    const rows = await tx<Row[]>(db, "items", "readonly", (s) => s.getAll());
    const all = await Promise.all(rows.map(async (r) => {
      try { return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: r.iv }, key!, r.payload))) as QueueItem<T>; } catch { return null; }
    }));
    items = all.filter((x): x is QueueItem<T> => !!x).sort((a, b) => a.at - b.at).map((x) => ({ ...x, status: x.status === "sending" ? "pending" : x.status }));
    emit();
  })();

  const save = async (it: QueueItem<T>) => {
    const key = await keyOf();
    if (!db || !key) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(it)));
    await tx(db, "items", "readwrite", (s) => s.put({ id: it.id, iv, payload } satisfies Row));
  };
  const drop = async (id: string) => { items = items.filter((x) => x.id !== id); if (db) await tx(db, "items", "readwrite", (s) => s.delete(id)); emit(); };

  const api = {
    ready,
    get items() { return [...items]; },
    get size() { return items.length; },
    on(f: (items: QueueItem<T>[]) => void) { subs.add(f); f([...items]); return () => subs.delete(f); },
    /** İşlemi sıraya alır; id aynı zamanda sunucu için kimlik anahtarıdır (Idempotency-Key) */
    async add(op: { type: string; data: T; label?: string }) {
      await ready;
      const it: QueueItem<T> = { id: crypto.randomUUID(), type: op.type, data: op.data, label: op.label, at: Date.now(), tries: 0, status: "pending" };
      items.push(it);
      await save(it);
      emit();
      return it;
    },
    /** Sırayla gönderir; çevrimiçi olunca ve "Şimdi gönder"de çağırın. Aynı nesnedeki sonraki işlemler hata / çakışmada bekler */
    async flush() {
      await ready;
      if (flushing) return;
      flushing = true;
      try {
        const blocked = new Set<string>();
        for (const it of [...items]) {
          const k = o.key?.(it) ?? it.id;
          if (blocked.has(k) || it.status === "conflict") { blocked.add(k); continue; }
          it.status = "sending"; it.tries++; emit();
          let r: SendResult;
          try { r = await o.send(it); } catch (e) { r = { error: e instanceof Error ? e.message : "Ağ hatası", retry: true }; }
          if (r === "ok") { await drop(it.id); continue; }
          blocked.add(k);
          if (r === "conflict") { it.status = "conflict"; it.error = "Sunucudaki kayıt değişmiş"; }
          else { it.status = r.retry === false ? "error" : "pending"; it.error = r.error; }
          await save(it);
          emit();
          if (r !== "conflict" && r.retry !== false) break; // ağ hatası: kalanlar sonra
        }
      } finally { flushing = false; }
    },
    /** Çakışmada kullanıcının kararı: "mine" yeniden gönderilir (sunucu sürümü bilerek ezilir), "theirs" işlem bırakılır */
    async resolve(id: string, choice: "mine" | "theirs", data?: T) {
      const it = items.find((x) => x.id === id);
      if (!it) return;
      if (choice === "theirs") return drop(id);
      if (data !== undefined) it.data = data;
      it.status = "pending"; it.error = undefined;
      await save(it);
      emit();
    },
    remove: drop,
    /** Çıkışta: cihazdaki tüm bekleyen işlemleri ve anahtarı siler */
    async clear() {
      await ready;
      items = [];
      if (db) { await tx(db, "items", "readwrite", (s) => s.clear()); await tx(db, "keys", "readwrite", (s) => s.clear()); }
      cryptoKey = null;
      emit();
    },
  };
  return api;
}

// ───────── Tazelik ─────────

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("tr", { numeric: "auto" }) : null;
/** "az önce" · "3 dakika önce" · "2 saat önce" · "dün" */
export function bizmoAgo(at: number, now = Date.now()) {
  const s = Math.round((now - at) / 1000);
  if (s < 45) return "az önce";
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["minute", 60], ["hour", 3600], ["day", 86400], ["week", 604800]];
  let u: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const x of units) if (s >= x[1]) u = x;
  return rtf ? rtf.format(-Math.round(s / u[1]), u[0]) : `${Math.round(s / u[1])} ${u[0]}`;
}

/**
 * Veri tazeliği göstergesi: `.bz-fresh` öğesine "Güncellendi · 3 dk önce" yazar, data-state canlı / eskiyor / bayat olur;
 * her 15 sn'de yenilenir. Bayat veri gösteren ekranda kullanıcı eski veriye göre karar vermemeli (andon §21.2 ile aynı mantık).
 */
export function bizmoFreshness(el: HTMLElement, o: { at: number; agingMs?: number; staleMs?: number; prefix?: string }) {
  let at = o.at;
  const aging = o.agingMs ?? 60_000, stale = o.staleMs ?? 300_000;
  el.classList.add("bz-fresh");
  const paint = () => {
    const age = Date.now() - at;
    el.dataset.state = age >= stale ? "stale" : age >= aging ? "aging" : "live";
    el.textContent = `${o.prefix ?? "Güncellendi"} · ${bizmoAgo(at)}`;
    el.title = new Date(at).toLocaleString("tr-TR");
  };
  paint();
  const iv = window.setInterval(paint, 15000);
  return { touch(t = Date.now()) { at = t; paint(); }, destroy() { clearInterval(iv); } };
}
