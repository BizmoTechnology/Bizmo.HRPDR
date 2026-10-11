"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User, Building2, Lock, Bell, Loader2,
  Check, CheckCheck, Eye, EyeOff,
} from "lucide-react";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import {
  useNotificationList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/use-api";
import { toast } from "sonner";

interface NotificationUi {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** Kart başlığı: nötr simge kutusu + başlık (+ isteğe bağlı açıklama, sağda tek eylem) */
function SectionHeader({
  icon: Icon,
  title,
  sub,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="bz-icon-box" aria-hidden="true">
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
        {sub && <p className="text-[12.5px] text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { data: notifData, isLoading: notifLoading } = useNotificationList({ pageSize: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications: NotificationUi[] = (notifData?.items ?? []).map(
    (n) => ({
      id: n.id,
      title: n.title,
      message: n.body ?? "",
      isRead: !!n.readAt,
      createdAt: n.createdAt,
    }),
  );

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Tüm alanları doldurun");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Yeni şifreler eşleşmiyor");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Şifre en az 8 karakter olmalıdır");
      return;
    }
    toast.info("Yakında aktif olacak");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success("Tüm bildirimler okundu olarak işaretlendi"),
      onError: () => toast.error("İşlem başarısız"),
    });
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const roleLabels: Record<string, string> = {
    ADMIN: "Yönetici",
    HR_MANAGER: "İK Yöneticisi",
    VIEWER: "Görüntüleyici",
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const initials = (user?.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toLocaleUpperCase("tr-TR");

  return (
    <motion.div
      className="w-full space-y-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item} className="bz-page-header mb-2">
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Ayarlar</h1>
          <p className="bz-page-header__sub">
            Hesap ve sistem ayarlarınızı yönetin
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          {/* Profil */}
          <motion.div variants={item} className="min-w-0">
            <GlassCard hover={false}>
              <SectionHeader icon={User} title="Profil" sub="Hesabınıza ait bilgiler" />

              <div className="flex items-start gap-4">
                <span className="bz-avatar bz-avatar--lg" aria-hidden="true">
                  {initials || "?"}
                </span>
                <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-[12px] font-medium text-muted-foreground">Ad soyad</dt>
                    <dd className="mt-0.5 truncate text-[14px] font-semibold text-foreground">
                      {user?.name ?? "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[12px] font-medium text-muted-foreground">E-posta</dt>
                    <dd className="mt-0.5 truncate text-[14px] font-semibold text-foreground">
                      {user?.email ?? "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[12px] font-medium text-muted-foreground">Rol</dt>
                    <dd className="mt-1">
                      {user?.role ? (
                        <span className="bz-chip">{roleLabels[user.role] ?? user.role}</span>
                      ) : (
                        <span className="text-[14px] text-fg3">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </GlassCard>
          </motion.div>

          {/* Organizasyon */}
          <motion.div variants={item} className="min-w-0">
            <GlassCard hover={false}>
              <SectionHeader icon={Building2} title="Organizasyon" sub="Bağlı olduğunuz kuruluş" />

              <dl>
                <dt className="text-[12px] font-medium text-muted-foreground">Kuruluş adı</dt>
                <dd className="mt-0.5 text-[14px] font-semibold text-foreground">
                  {user?.organization?.name ?? "—"}
                </dd>
              </dl>
            </GlassCard>
          </motion.div>

          {/* Güvenlik */}
          <motion.div variants={item}>
            <GlassCard hover={false} className="p-0">
              <form onSubmit={handlePasswordSubmit}>
                <div className="p-5">
                  <SectionHeader icon={Lock} title="Güvenlik" sub="Giriş şifrenizi değiştirin" />

                  <div className="space-y-4">
                    <div className="bz-form-row">
                      <label htmlFor="current-password" className="bz-label">
                        Mevcut şifre
                      </label>
                      <div className="bz-input-group">
                        <input
                          id="current-password"
                          type={showCurrent ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          autoComplete="current-password"
                          className="bz-field pr-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent((v) => !v)}
                          className="bz-icon-btn bz-icon-btn--sm absolute right-1.5 top-1/2 -translate-y-1/2"
                          aria-label={showCurrent ? "Şifreyi gizle" : "Şifreyi göster"}
                          title={showCurrent ? "Şifreyi gizle" : "Şifreyi göster"}
                          aria-pressed={showCurrent}
                        >
                          {showCurrent ? <EyeOff /> : <Eye />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="bz-form-row">
                        <label htmlFor="new-password" className="bz-label">
                          Yeni şifre
                        </label>
                        <div className="bz-input-group">
                          <input
                            id="new-password"
                            type={showNew ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            autoComplete="new-password"
                            aria-describedby="new-password-hint"
                            className="bz-field pr-11"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNew((v) => !v)}
                            className="bz-icon-btn bz-icon-btn--sm absolute right-1.5 top-1/2 -translate-y-1/2"
                            aria-label={showNew ? "Şifreyi gizle" : "Şifreyi göster"}
                            title={showNew ? "Şifreyi gizle" : "Şifreyi göster"}
                            aria-pressed={showNew}
                          >
                            {showNew ? <EyeOff /> : <Eye />}
                          </button>
                        </div>
                        <p id="new-password-hint" className="bz-hint">
                          En az 8 karakter
                        </p>
                      </div>

                      <div className="bz-form-row">
                        <label htmlFor="confirm-password" className="bz-label">
                          Yeni şifre (tekrar)
                        </label>
                        <input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          className="bz-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-divider px-5 py-4">
                  <button type="submit" className="bz-btn bz-btn--primary">
                    <Lock />
                    Şifreyi güncelle
                  </button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        </div>

        {/* Bildirimler */}
        <motion.div variants={item} id="bildirimler" className="min-w-0">
          <GlassCard hover={false}>
            <SectionHeader
              icon={Bell}
              title="Bildirimler"
              sub={
                notifLoading
                  ? "Yükleniyor..."
                  : unreadCount > 0
                    ? `${unreadCount} okunmamış bildirim`
                    : notifications.length > 0
                      ? "Tüm bildirimler okundu"
                      : undefined
              }
              action={
                unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markAllRead.isPending}
                    className="bz-btn bz-btn--ghost bz-btn--sm"
                  >
                    {markAllRead.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <CheckCheck />
                    )}
                    <span className="hidden sm:inline">Tümünü okundu işaretle</span>
                    <span className="sm:hidden">Tümünü oku</span>
                  </button>
                ) : undefined
              }
            />

            {notifLoading ? (
              <div className="space-y-1" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 py-3">
                    <div className="bz-skeleton mt-1.5 h-2 w-2 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="bz-skeleton h-3.5 w-1/3" />
                      <div className="bz-skeleton h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="bz-empty py-10">
                <Bell className="h-7 w-7 text-fg3" aria-hidden="true" />
                <p className="bz-empty__title text-[15px]">Bildirim yok</p>
                <p className="bz-empty__text">
                  Yeni bir bildirim geldiğinde burada görünür.
                </p>
              </div>
            ) : (
              <ul className="bz-list -mx-1">
                {notifications.map((n) => (
                  <li key={n.id} className="bz-list-item items-start gap-3 px-1 py-3">
                    <span
                      className={cn(
                        "bz-dot mt-[7px]",
                        n.isRead ? "opacity-40" : "bz-dot--success",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13.5px]",
                          n.isRead ? "font-medium text-fg2" : "font-semibold text-foreground",
                        )}
                      >
                        {n.title}
                        {!n.isRead && <span className="sr-only"> (okunmadı)</span>}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted-foreground">
                        {n.message || "—"}
                      </p>
                      <time
                        dateTime={n.createdAt}
                        className="mt-1 block text-[11.5px] text-fg3 tabular-nums"
                      >
                        {new Date(n.createdAt).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() =>
                          markRead.mutate(n.id, {
                            onSuccess: () => toast.success("Okundu olarak işaretlendi"),
                          })
                        }
                        disabled={markRead.isPending}
                        className="bz-icon-btn bz-icon-btn--sm flex-none"
                        aria-label={`Okundu işaretle: ${n.title}`}
                        title="Okundu işaretle"
                      >
                        <Check />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  );
}
