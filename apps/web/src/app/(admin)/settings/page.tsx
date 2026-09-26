"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User, Building2, Lock, Bell, Loader2,
  CheckCircle2, Eye, EyeOff, AlertCircle,
} from "lucide-react";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { api, apiErrorMessage } from "@/lib/api";
import { ROLE_LABELS } from "@ph/shared";
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

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Tüm alanları doldurun");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Yeni şifreler eşleşmiyor");
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error("Şifre en az 8 karakter olmalı, bir büyük harf ve bir rakam içermelidir");
      return;
    }
    setChangingPassword(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      toast.success("Şifreniz güncellendi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Şifre güncellenemedi"));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success("Tüm bildirimler okundu olarak işaretlendi"),
      onError: () => toast.error("İşlem başarısız"),
    });
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  const roleLabels: Record<string, string> = ROLE_LABELS;

  return (
    <motion.div
      className="space-y-6 w-full"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold text-foreground">Ayarlar</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Hesap ve sistem ayarlarınızı yönetin
        </p>
      </motion.div>

      {/* Profile */}
      <motion.div variants={item}>
        <GlassCard hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Profil</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Ad Soyad</label>
              <div className="h-10 px-3 rounded-xl bg-muted/40 border border-border/30 flex items-center">
                <span className="text-sm text-foreground">{user?.name ?? "—"}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">E-posta</label>
              <div className="h-10 px-3 rounded-xl bg-muted/40 border border-border/30 flex items-center">
                <span className="text-sm text-foreground">{user?.email ?? "—"}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Rol</label>
              <div className="h-10 px-3 rounded-xl bg-muted/40 border border-border/30 flex items-center">
                <span className="text-sm text-foreground">
                  {user?.role ? (roleLabels[user.role] ?? user.role) : "—"}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Organization */}
      <motion.div variants={item}>
        <GlassCard hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-accent-purple" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Organizasyon</h2>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Kuruluş Adı</label>
            <div className="h-10 px-3 rounded-xl bg-muted/40 border border-border/30 flex items-center">
              <span className="text-sm text-foreground">
                {user?.organization?.name ?? "—"}
              </span>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Security */}
      <motion.div variants={item}>
        <GlassCard hover={false}>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-accent-orange/10 flex items-center justify-center">
              <Lock className="h-4 w-4 text-accent-orange" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Güvenlik</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Mevcut Şifre
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mevcut şifreniz"
                  className="w-full h-10 px-3 pr-10 rounded-xl bg-muted/50 border border-border/50 text-sm
                    placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Yeni Şifre
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Yeni şifre (min 8 karakter)"
                    className="w-full h-10 px-3 pr-10 rounded-xl bg-muted/50 border border-border/50 text-sm
                      placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Şifre Tekrar
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Yeni şifreyi tekrarlayın"
                  className="w-full h-10 px-3 rounded-xl bg-muted/50 border border-border/50 text-sm
                    placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={changingPassword}
              className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold
                hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-60"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Şifreyi Güncelle
            </motion.button>
          </form>
        </GlassCard>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={item} id="bildirimler">
        <GlassCard hover={false}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-accent-teal/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-accent-teal" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Bildirimler</h2>
            </div>
            {notifications.some((n) => !n.isRead) && (
              <button
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
                className="text-xs text-primary hover:underline underline-offset-4 flex items-center gap-1"
              >
                {markAllRead.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          {notifLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Bildirim bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl transition-colors",
                    n.isRead ? "bg-muted/20" : "bg-primary/5 border border-primary/10",
                  )}
                >
                  <div className={cn(
                    "h-2 w-2 rounded-full mt-2 flex-shrink-0",
                    n.isRead ? "bg-muted-foreground/30" : "bg-primary",
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm",
                      n.isRead ? "text-muted-foreground" : "text-foreground font-medium",
                    )}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {n.message || "—"}
                    </p>
                    <span className="text-[10px] text-muted-foreground/50 mt-1 block">
                      {new Date(n.createdAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() =>
                        markRead.mutate(n.id, {
                          onSuccess: () => toast.success("Okundu olarak işaretlendi"),
                        })
                      }
                      disabled={markRead.isPending}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                      title="Okundu işaretle"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
