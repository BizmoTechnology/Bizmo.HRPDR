/**
 * Bizmo Universal Theme · güvenlik ve KVKK arayüz yardımcıları (çerçeveden bağımsız)
 *
 *   bizmoMask("10000000146", "tckn")                     → "100••••••46"
 *   bizmoMaskedField(el, { kind: "iban", masked, fetch, onReveal })   süreli "Göster" (varsayılan 15 sn), kendiliğinden kapanır
 *   isValidTckn(v) · isValidIban(v) · formatIban(v)
 *   bizmoSessionTimeout({ idleMs, warnMs, onWarn, onTick, onActive, onExpire, keepAlive })   boşta kalma + sekmeler arası eşitleme
 *   bizmoOtpInput(el, { length: 6, onComplete })          tek kullanımlık kod (yeniden doğrulama)
 *   bizmoWatermark(el, "TR-07 · 11.10.2026 14:20")        ekran filigranı (sızıntı caydırma)
 *
 * Kurallar (DESIGN.md §39): tam değer tarayıcıya yalnız "Göster" ile, sunucudan (BFF) ve sunucu tarafında denetim
 * kaydıyla gelir; sayfa maskeli hali taşır. Token ve oturum çerezi tarayıcı kodunda tutulmaz (httpOnly çerez BFF'de) —
 * bu modül yalnız arayüz durumunu yönetir. Denetim olayı içerik değil metadata taşır (kim, ne zaman, alan türü, nesne).
 */
const DOT = "•";
const digits = (v) => v.replace(/\D/g, "");
const keep = (v, head, tail) => (v.length <= head + tail ? DOT.repeat(v.length) : v.slice(0, head) + DOT.repeat(v.length - head - tail) + v.slice(v.length - tail));
/** Maskeleme kuralları: kimlik doğrulamaya yetecek kadar (baş / son haneler) görünür, gerisi gizli */
export function bizmoMask(value, kind = "text") {
    const v = (value ?? "").trim();
    if (!v)
        return "";
    switch (kind) {
        case "tckn": return keep(digits(v), 3, 2);
        case "vkn": return keep(digits(v), 2, 2);
        case "iban": {
            const c = v.replace(/\s+/g, "").toUpperCase();
            return formatIban(c.slice(0, 4) + DOT.repeat(Math.max(0, c.length - 8)) + c.slice(-4));
        }
        case "phone": {
            const d = digits(v);
            const local = d.startsWith("90") && d.length === 12 ? d.slice(2) : d.startsWith("0") && d.length === 11 ? d.slice(1) : d;
            if (local.length !== 10)
                return keep(d, 0, 2);
            return `+90 ${local.slice(0, 3)} ${DOT.repeat(3)} ${DOT.repeat(2)} ${local.slice(8)}`;
        }
        case "email": {
            const [user, domain] = v.split("@");
            return domain ? `${user.slice(0, 1)}${DOT.repeat(Math.max(3, user.length - 1))}@${domain}` : keep(v, 1, 0);
        }
        case "card": {
            const d = digits(v);
            return `${DOT.repeat(4)} ${DOT.repeat(4)} ${DOT.repeat(4)} ${d.slice(-4)}`;
        }
        case "name": return v.split(/\s+/).map((w) => w.slice(0, 2) + DOT.repeat(Math.max(2, w.length - 2))).join(" ");
        default: return keep(v, 0, Math.min(4, Math.floor(v.length / 3)));
    }
}
/** TC kimlik numarası algoritma denetimi (11 hane, ilk hane 0 değil, 10. ve 11. hane kontrolü) — gerçekliği değil biçimi doğrular */
export function isValidTckn(value) {
    const d = digits(value);
    if (!/^[1-9]\d{10}$/.test(d))
        return false;
    const n = [...d].map(Number);
    const odd = n[0] + n[2] + n[4] + n[6] + n[8], even = n[1] + n[3] + n[5] + n[7];
    const d10 = (((odd * 7 - even) % 10) + 10) % 10;
    const d11 = n.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
    return n[9] === d10 && n[10] === d11;
}
/** IBAN mod 97 denetimi; TR IBAN 26 karakter */
export function isValidIban(value) {
    const c = value.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(c))
        return false;
    if (c.startsWith("TR") && c.length !== 26)
        return false;
    const r = (c.slice(4) + c.slice(0, 4)).replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
    let m = 0;
    for (const ch of r)
        m = (m * 10 + Number(ch)) % 97;
    return m === 1;
}
export const formatIban = (v) => v.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
/**
 * Maskeli alan: `.bz-masked` öğesine değer + göz düğmesi + süre çubuğu kurar. "Göster"de değer fetch() ile sunucudan
 * istenir (sunucu yetkiyi denetler ve kaydı yazar), onReveal ile istemci tarafında yalnız metadata olayı gönderilir.
 * Süre dolunca, sekme gizlenince ya da yeniden basınca maskelenir; değer bellekte tutulmaz.
 */
export function bizmoMaskedField(el, o) {
    const ms = o.revealMs ?? 15000;
    const label = o.label ?? "değer";
    el.classList.add("bz-masked");
    el.dataset.state = "masked";
    el.innerHTML = `<span class="bz-masked__value"></span><button type="button" class="bz-masked__toggle" aria-pressed="false"></button><span class="bz-masked__timer" aria-hidden="true"></span>`;
    const out = el.querySelector(".bz-masked__value");
    const btn = el.querySelector(".bz-masked__toggle");
    const timer = el.querySelector(".bz-masked__timer");
    const masked = o.masked ?? (o.value ? bizmoMask(o.value, o.kind) : "••••••");
    const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
    let t = 0;
    const hide = () => {
        clearTimeout(t);
        el.dataset.state = "masked";
        out.textContent = masked;
        out.setAttribute("aria-label", `${label}, maskeli`);
        btn.innerHTML = EYE;
        btn.setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-label", `${label} göster`);
        btn.title = `${label} göster (${Math.round(ms / 1000)} sn)`;
    };
    const show = async () => {
        el.setAttribute("aria-busy", "true");
        try {
            const v = o.fetch ? await o.fetch() : o.value;
            if (!v)
                return hide();
            o.onReveal?.({ kind: o.kind, field: o.field, objectType: o.objectType, objectId: o.objectId, at: new Date().toISOString() });
            out.textContent = o.kind === "iban" ? formatIban(v) : v;
            out.removeAttribute("aria-label");
            el.dataset.state = "revealed";
            el.style.setProperty("--_t", `${ms}ms`);
            timer.style.animation = "none";
            void timer.offsetWidth;
            timer.style.animation = "";
            btn.innerHTML = EYE_OFF;
            btn.setAttribute("aria-pressed", "true");
            btn.setAttribute("aria-label", `${label} gizle`);
            btn.title = `${label} gizle`;
            t = window.setTimeout(hide, ms);
        }
        finally {
            el.removeAttribute("aria-busy");
        }
    };
    const onClick = () => (el.dataset.state === "revealed" ? hide() : void show());
    const onVis = () => { if (document.hidden && el.dataset.state === "revealed")
        hide(); };
    btn.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", onVis);
    hide();
    return { hide, reveal: show, destroy() { hide(); btn.removeEventListener("click", onClick); document.removeEventListener("visibilitychange", onVis); } };
}
/**
 * Oturum zaman aşımı: kullanıcı etkinliği (dokunma, tuş, kaydırma) yoksa idleMs sonunda onExpire; warnMs önce onWarn
 * ve her saniye onTick(kalan sn). Uyarı açıkken pasif hareket süreyi uzatmaz — kullanıcı "Devam et" (extend) demelidir.
 * Aynı uygulamanın sekmeleri BroadcastChannel ile eşitlenir: bir sekmedeki etkinlik diğerlerini canlı tutar, çıkış hepsini kapatır.
 * keepAlive: BFF oturumunu yeniler (çerez sunucuda); false dönerse oturum sunucuda bitmiş sayılır.
 */
export function bizmoSessionTimeout(o) {
    const warnMs = Math.min(o.warnMs ?? 60_000, o.idleMs);
    const bc = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(o.channel ?? "bz-session");
    let last = Date.now(), warned = false, done = false, lastSent = 0;
    // Kapanmış kanala gönderim hata fırlatır: gönderim hiçbir zaman oturum akışını kesmemeli
    const send = (msg) => { try {
        bc?.postMessage(msg);
    }
    catch { /* kanal kapalı */ } };
    const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"];
    const activity = () => {
        if (warned || done)
            return;
        last = Date.now();
        if (last - lastSent > 5000) {
            lastSent = last;
            send({ type: "activity", at: last });
        }
    };
    const expire = (broadcast) => {
        if (done)
            return;
        done = true;
        if (broadcast)
            send({ type: "expire" });
        stop();
        o.onExpire();
    };
    const tick = () => {
        if (done)
            return;
        const left = o.idleMs - (Date.now() - last);
        if (left <= 0)
            return expire(true);
        if (left <= warnMs) {
            const s = Math.ceil(left / 1000);
            if (!warned) {
                warned = true;
                o.onWarn?.(s);
            }
            o.onTick?.(s);
        }
    };
    const iv = window.setInterval(tick, 1000);
    EVENTS.forEach((e) => document.addEventListener(e, activity, { passive: true, capture: true }));
    if (bc)
        bc.onmessage = (e) => {
            if (e.data?.type === "activity") {
                last = Math.max(last, e.data.at);
                if (warned) {
                    warned = false;
                    o.onActive?.();
                }
            }
            if (e.data?.type === "expire")
                expire(false);
            if (e.data?.type === "extend") {
                last = e.data.at;
                if (warned) {
                    warned = false;
                    o.onActive?.();
                }
            }
        };
    function stop() {
        clearInterval(iv);
        EVENTS.forEach((e) => document.removeEventListener(e, activity, { capture: true }));
        if (bc) {
            bc.onmessage = null;
            bc.close();
        }
    }
    return {
        /** "Devam et": süreyi baştan başlatır, sunucu oturumunu yeniler, diğer sekmelere bildirir */
        async extend() {
            const ok = await o.keepAlive?.();
            if (ok === false)
                return expire(true);
            last = Date.now();
            warned = false;
            send({ type: "extend", at: last });
            o.onActive?.();
        },
        /** "Çıkış yap": tüm sekmelerde oturumu kapatır */
        logout() { expire(true); },
        stop() { done = true; stop(); },
        get secondsLeft() { return Math.max(0, Math.ceil((o.idleMs - (Date.now() - last)) / 1000)); },
    };
}
/** Tek kullanımlık kod: hane başına kutu, otomatik ilerleme, yapıştırma dağıtımı, geri silme; tamamlanınca onComplete */
export function bizmoOtpInput(el, o = {}) {
    const n = o.length ?? 6;
    el.classList.add("bz-otp");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", o.label ?? "Doğrulama kodu");
    el.innerHTML = Array.from({ length: n }, (_, i) => `<input inputmode="numeric" autocomplete="${i === 0 ? "one-time-code" : "off"}" maxlength="1" aria-label="${i + 1}. hane" />`).join("");
    const boxes = [...el.querySelectorAll("input")];
    const code = () => boxes.map((b) => b.value).join("");
    const check = () => { const c = code(); if (c.length === n && /^\d+$/.test(c))
        o.onComplete?.(c); };
    boxes.forEach((b, i) => {
        b.addEventListener("input", () => {
            b.value = b.value.replace(/\D/g, "").slice(-1);
            el.dataset.state = "";
            if (b.value && i < n - 1)
                boxes[i + 1].focus();
            check();
        });
        b.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !b.value && i > 0) {
                boxes[i - 1].focus();
                boxes[i - 1].value = "";
                e.preventDefault();
            }
            if (e.key === "ArrowLeft" && i > 0)
                boxes[i - 1].focus();
            if (e.key === "ArrowRight" && i < n - 1)
                boxes[i + 1].focus();
        });
        b.addEventListener("paste", (e) => {
            const d = (e.clipboardData?.getData("text") ?? "").replace(/\D/g, "").slice(0, n);
            if (!d)
                return;
            e.preventDefault();
            boxes.forEach((x, k) => (x.value = d[k] ?? ""));
            boxes[Math.min(d.length, n - 1)].focus();
            check();
        });
    });
    return {
        get value() { return code(); },
        clear() { boxes.forEach((b) => (b.value = "")); boxes[0].focus(); },
        /** Hatalı kod: kutular kırmızı, temizlenir, ilk kutuya döner */
        error() { el.dataset.state = "error"; boxes.forEach((b) => (b.value = "")); boxes[0].focus(); },
        focus() { boxes[0].focus(); },
    };
}
/** Ekran filigranı: görenin oturum kimliği + zaman çapraz tekrarlanır (ekran görüntüsü sızıntısını caydırır) */
export function bizmoWatermark(el, text) {
    const t = text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="170"><text x="150" y="90" transform="rotate(-24 150 90)" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="rgb(128,128,128)" fill-opacity="0.2">${t}</text></svg>`;
    el.classList.add("bz-watermark");
    el.style.setProperty("--_wm", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}
