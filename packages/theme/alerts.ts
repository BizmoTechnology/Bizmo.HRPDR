/**
 * Bizmo Universal Theme · sesli uyarı ve bildirim (andon, izleme ve operasyon ekranları; çerçeveden bağımsız)
 *
 *   const sound = bizmoAlertSound();            Web Audio ile cihazda üretilen kısa kalıplar (ses dosyası ve ağ yok)
 *   await sound.unlock();                        tarayıcı sesi bir kez kullanıcı dokunuşuyla açar (otomatik oynatma kuralı)
 *   sound.play("alarm");                         alarm · escalation · warning · call · resolved · stale · test · scan · scanError
 *   sound.volume = 0.5; sound.muted = false;
 *   const speech = bizmoSpeech();                yalnız cihazdaki yerel Türkçe ses: metin cihaz dışına gönderilmez (KVKK)
 *   speech.speak("CNC-04 arıza");
 *   await bizmoDesktopNotify.request();          sistem bildirimi izni (kullanıcı eylemi içinde)
 *   bizmoDesktopNotify.show("Yeni arıza · CNC-04", { body, tag });
 *
 * Kiosk / TV: Chrome'u --autoplay-policy=no-user-gesture-required ile açın; aksi hâlde ilk dokunuşa kadar ses kapalıdır
 * ve ekranda "Ses kapalı · dokunun" gösterilmelidir (DESIGN.md §21.2).
 */

export type AlertSoundKind = "alarm" | "escalation" | "warning" | "call" | "resolved" | "stale" | "test" | "scan" | "scanError";

type Note = { f: number; t: number; d: number; w?: OscillatorType; g?: number };

// Kalıplar: ton yüksekliği ve ritim ciddiyeti anlatır (alarm iki tonlu ve tekrarlı, olumlu olay yükselen üçlü)
const PATTERNS: Record<AlertSoundKind, Note[]> = {
  // Arıza: 880 / 660 Hz iki ton, ~1,1 sn (belirgin ama tiz değil)
  alarm: [
    { f: 880, t: 0, d: 0.22, w: "square", g: 0.5 },
    { f: 660, t: 0.27, d: 0.22, w: "square", g: 0.5 },
    { f: 880, t: 0.54, d: 0.22, w: "square", g: 0.5 },
    { f: 660, t: 0.81, d: 0.3, w: "square", g: 0.5 },
  ],
  // Eskalasyon: yükselen üçlü, iki kez
  escalation: [
    { f: 660, t: 0, d: 0.16, w: "sawtooth", g: 0.45 },
    { f: 880, t: 0.18, d: 0.16, w: "sawtooth", g: 0.45 },
    { f: 1175, t: 0.36, d: 0.26, w: "sawtooth", g: 0.45 },
    { f: 660, t: 0.75, d: 0.16, w: "sawtooth", g: 0.45 },
    { f: 880, t: 0.93, d: 0.16, w: "sawtooth", g: 0.45 },
    { f: 1175, t: 1.11, d: 0.34, w: "sawtooth", g: 0.45 },
  ],
  // Uyarı: aynı tonda iki kısa bip
  warning: [
    { f: 740, t: 0, d: 0.14, w: "triangle" },
    { f: 740, t: 0.22, d: 0.2, w: "triangle" },
  ],
  // Çağrı açıldı: yumuşak iki notalı çan
  call: [
    { f: 988, t: 0, d: 0.35 },
    { f: 1319, t: 0.16, d: 0.5 },
  ],
  // Giderildi: yükselen do-mi-sol
  resolved: [
    { f: 523, t: 0, d: 0.18, w: "triangle" },
    { f: 659, t: 0.14, d: 0.18, w: "triangle" },
    { f: 784, t: 0.28, d: 0.42, w: "triangle" },
  ],
  // Veri gecikmeli / bağlantı: alçalan iki pes ton
  stale: [
    { f: 392, t: 0, d: 0.25 },
    { f: 294, t: 0.28, d: 0.45 },
  ],
  test: [
    { f: 988, t: 0, d: 0.3 },
    { f: 1319, t: 0.14, d: 0.45 },
  ],
  // Okutma kabul: el terminallerindeki kısa tiz bip (eldiven ve gürültüde duyulur, rahatsız etmez)
  scan: [{ f: 2093, t: 0, d: 0.08, w: "square", g: 0.4 }],
  // Okutma red: alçak, kalın iki vızıltı — kabulden ayırt edilir (ekrandaki nedenle birlikte)
  scanError: [
    { f: 220, t: 0, d: 0.16, w: "sawtooth", g: 0.5 },
    { f: 196, t: 0.2, d: 0.24, w: "sawtooth", g: 0.5 },
  ],
};

export type AlertSoundState = "unsupported" | "locked" | "ready" | "muted";

/**
 * Sesli uyarı çalar. autoUnlock: sayfadaki ilk dokunuş / tuşta sesi açar (TV ve hat başı ekranları için);
 * vitrin gibi başka içeriklerin de olduğu sayfalarda kapalı tutun, ses yalnız açıkça istenince başlasın.
 */
export function bizmoAlertSound(opts: { volume?: number; autoUnlock?: boolean } = {}) {
  const AC: typeof AudioContext | undefined =
    typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let volume = Math.min(1, Math.max(0, opts.volume ?? 0.6));
  let muted = false;

  const ensure = () => {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    return ctx;
  };

  const api = {
    get supported() {
      return !!AC;
    },
    /** unsupported · locked (tarayıcı dokunuş bekliyor) · ready · muted */
    get state(): AlertSoundState {
      if (!AC) return "unsupported";
      if (muted) return "muted";
      return ctx?.state === "running" ? "ready" : "locked";
    },
    get volume() {
      return volume;
    },
    set volume(v: number) {
      volume = Math.min(1, Math.max(0, v));
      if (master) master.gain.value = volume;
    },
    get muted() {
      return muted;
    },
    set muted(m: boolean) {
      muted = m;
    },
    /** Kullanıcı eylemi içinde çağırın; ses açılabildiyse true */
    async unlock() {
      const c = ensure();
      if (!c) return false;
      if (c.state !== "running") {
        try {
          await c.resume();
        } catch {
          /* tarayıcı izin vermedi */
        }
      }
      return c.state === "running";
    },
    /** Kalıbı çalar; ses kapalı / kilitliyse false (görsel uyarı yine gösterilmelidir) */
    play(kind: AlertSoundKind) {
      if (muted || !ctx || !master || ctx.state !== "running") return false;
      const start = ctx.currentTime + 0.02;
      for (const n of PATTERNS[kind]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = n.w ?? "sine";
        o.frequency.value = n.f;
        // Kare ve testere dalga daha gür duyulur: aynı algılanan yükseklik için kısılır
        const peak = (n.g ?? 0.6) * (o.type === "square" || o.type === "sawtooth" ? 0.35 : 1);
        g.gain.setValueAtTime(0.0001, start + n.t);
        g.gain.exponentialRampToValueAtTime(peak, start + n.t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, start + n.t + n.d);
        o.connect(g).connect(master);
        o.start(start + n.t);
        o.stop(start + n.t + n.d + 0.05);
      }
      return true;
    },
  };

  if (opts.autoUnlock && typeof document !== "undefined") {
    const once = () => {
      void api.unlock();
      document.removeEventListener("pointerdown", once, true);
      document.removeEventListener("keydown", once, true);
    };
    document.addEventListener("pointerdown", once, true);
    document.addEventListener("keydown", once, true);
    // Kiosk bayrağıyla açılmış tarayıcıda dokunuş beklemeden çalışır
    void api.unlock();
  }
  return api;
}

/**
 * Sesli duyuru. Yalnız cihazda çalışan (localService) ses kullanılır: çevrimiçi sesler metni üçüncü taraf
 * sunucusuna gönderebilir (KVKK). Uygun ses yoksa available=false ve speak() hiçbir şey yapmaz.
 */
export function bizmoSpeech(opts: { lang?: string } = {}) {
  const lang = (opts.lang ?? "tr-TR").toLowerCase().slice(0, 2);
  const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
  const pick = () => synth?.getVoices().find((v) => v.localService && v.lang.toLowerCase().startsWith(lang)) ?? null;
  return {
    get available() {
      return !!pick();
    },
    /** Ses listesi tarayıcıda geç yüklenir; hazır olunca uygun ses var mı */
    ready() {
      return new Promise<boolean>((resolve) => {
        if (!synth) return resolve(false);
        if (synth.getVoices().length) return resolve(!!pick());
        const on = () => {
          synth.removeEventListener("voiceschanged", on);
          resolve(!!pick());
        };
        synth.addEventListener("voiceschanged", on);
        setTimeout(() => resolve(!!pick()), 1500);
      });
    },
    speak(text: string, o: { rate?: number; volume?: number; interrupt?: boolean } = {}) {
      const v = pick();
      if (!synth || !v) return false;
      if (o.interrupt) synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      u.lang = v.lang;
      u.rate = o.rate ?? 1;
      u.volume = o.volume ?? 1;
      synth.speak(u);
      return true;
    },
    cancel() {
      synth?.cancel();
    },
  };
}

/**
 * Masaüstü (sistem) bildirimi: ekran başında olmayan ofis kullanıcısı için. İçerik en az bilgiyle
 * (istasyon + olay); kişi adı yazılmaz. İzin yalnız kullanıcı eylemiyle istenir.
 */
export const bizmoDesktopNotify = {
  get permission(): NotificationPermission | "unsupported" {
    return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  },
  async request(): Promise<NotificationPermission | "unsupported"> {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission !== "default") return Notification.permission;
    return Notification.requestPermission();
  },
  show(title: string, opts: { body?: string; tag?: string; requireInteraction?: boolean; onClick?: () => void } = {}) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return null;
    try {
      const n = new Notification(title, { body: opts.body, tag: opts.tag, requireInteraction: opts.requireInteraction });
      n.onclick = () => {
        window.focus();
        opts.onClick?.();
        n.close();
      };
      return n;
    } catch {
      // Android Chrome sayfa içinden bildirime izin vermez (service worker gerekir)
      return null;
    }
  },
};
