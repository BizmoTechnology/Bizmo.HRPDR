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
export type AlertSoundState = "unsupported" | "locked" | "ready" | "muted";
/**
 * Sesli uyarı çalar. autoUnlock: sayfadaki ilk dokunuş / tuşta sesi açar (TV ve hat başı ekranları için);
 * vitrin gibi başka içeriklerin de olduğu sayfalarda kapalı tutun, ses yalnız açıkça istenince başlasın.
 */
export declare function bizmoAlertSound(opts?: {
    volume?: number;
    autoUnlock?: boolean;
}): {
    readonly supported: boolean;
    /** unsupported · locked (tarayıcı dokunuş bekliyor) · ready · muted */
    readonly state: AlertSoundState;
    volume: number;
    muted: boolean;
    /** Kullanıcı eylemi içinde çağırın; ses açılabildiyse true */
    unlock(): Promise<boolean>;
    /** Kalıbı çalar; ses kapalı / kilitliyse false (görsel uyarı yine gösterilmelidir) */
    play(kind: AlertSoundKind): boolean;
};
/**
 * Sesli duyuru. Yalnız cihazda çalışan (localService) ses kullanılır: çevrimiçi sesler metni üçüncü taraf
 * sunucusuna gönderebilir (KVKK). Uygun ses yoksa available=false ve speak() hiçbir şey yapmaz.
 */
export declare function bizmoSpeech(opts?: {
    lang?: string;
}): {
    readonly available: boolean;
    /** Ses listesi tarayıcıda geç yüklenir; hazır olunca uygun ses var mı */
    ready(): Promise<boolean>;
    speak(text: string, o?: {
        rate?: number;
        volume?: number;
        interrupt?: boolean;
    }): boolean;
    cancel(): void;
};
/**
 * Masaüstü (sistem) bildirimi: ekran başında olmayan ofis kullanıcısı için. İçerik en az bilgiyle
 * (istasyon + olay); kişi adı yazılmaz. İzin yalnız kullanıcı eylemiyle istenir.
 */
export declare const bizmoDesktopNotify: {
    readonly permission: NotificationPermission | "unsupported";
    request(): Promise<NotificationPermission | "unsupported">;
    show(title: string, opts?: {
        body?: string;
        tag?: string;
        requireInteraction?: boolean;
        onClick?: () => void;
    }): Notification | null;
};
