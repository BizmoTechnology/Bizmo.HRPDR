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
export declare function bizmoConnection(o?: {
    ping?: () => Promise<boolean>;
    interval?: number;
}): {
    readonly state: ConnState;
    on(f: (s: ConnState, info: {
        nextRetryMs: number;
    }) => void): () => boolean;
    /** Hemen dene ("Şimdi dene" düğmesi) */
    retry(): Promise<void>;
    /** Uygulama isteği ağ hatasıyla düştüğünde çağırın: yoklama başlar */
    reportFailure(): void;
    destroy(): void;
};
export type QueueStatus = "pending" | "sending" | "error" | "conflict";
export type QueueItem<T = unknown> = {
    id: string;
    type: string;
    data: T;
    label?: string;
    at: number;
    tries: number;
    status: QueueStatus;
    error?: string;
};
export type SendResult = "ok" | "conflict" | {
    error: string;
    retry?: boolean;
};
/**
 * Bekleyen işlem kuyruğu. Kayıtlar IndexedDB'de; yük (data) cihazda üretilen, dışa aktarılamaz AES-GCM anahtarıyla şifreli
 * (dosyadan okunamaz; aynı kökenli betik açabilir — XSS'e karşı CSP ayrıca gerekir). Sıra korunur: bir işlem gönderilemezse
 * arkasındakiler beklemez yalnız aynı nesneye ait olanlar bekler (key). send() "ok" · "conflict" · { error, retry } döner.
 */
export declare function bizmoQueue<T = unknown>(o: {
    name: string;
    send: (item: QueueItem<T>) => Promise<SendResult>;
    key?: (item: QueueItem<T>) => string;
    memory?: boolean;
}): {
    ready: Promise<void>;
    readonly items: QueueItem<T>[];
    readonly size: number;
    on(f: (items: QueueItem<T>[]) => void): () => boolean;
    /** İşlemi sıraya alır; id aynı zamanda sunucu için kimlik anahtarıdır (Idempotency-Key) */
    add(op: {
        type: string;
        data: T;
        label?: string;
    }): Promise<QueueItem<T>>;
    /** Sırayla gönderir; çevrimiçi olunca ve "Şimdi gönder"de çağırın. Aynı nesnedeki sonraki işlemler hata / çakışmada bekler */
    flush(): Promise<void>;
    /** Çakışmada kullanıcının kararı: "mine" yeniden gönderilir (sunucu sürümü bilerek ezilir), "theirs" işlem bırakılır */
    resolve(id: string, choice: "mine" | "theirs", data?: T): Promise<void>;
    remove: (id: string) => Promise<void>;
    /** Çıkışta: cihazdaki tüm bekleyen işlemleri ve anahtarı siler */
    clear(): Promise<void>;
};
/** "az önce" · "3 dakika önce" · "2 saat önce" · "dün" */
export declare function bizmoAgo(at: number, now?: number): string;
/**
 * Veri tazeliği göstergesi: `.bz-fresh` öğesine "Güncellendi · 3 dk önce" yazar, data-state canlı / eskiyor / bayat olur;
 * her 15 sn'de yenilenir. Bayat veri gösteren ekranda kullanıcı eski veriye göre karar vermemeli (andon §21.2 ile aynı mantık).
 */
export declare function bizmoFreshness(el: HTMLElement, o: {
    at: number;
    agingMs?: number;
    staleMs?: number;
    prefix?: string;
}): {
    touch(t?: number): void;
    destroy(): void;
};
