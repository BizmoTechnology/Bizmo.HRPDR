import type { UserRole } from "@ph/shared";
import { useAuthStore } from "@/store/auth.store";

/** development.md §8 — sunucudaki ROLE_GROUPS ile aynı tutulmalı */
const MANAGE: UserRole[] = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER"];
const ANALYZE: UserRole[] = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "ANALYST"];
const AI_CONFIG: UserRole[] = ["SUPER_ADMIN", "ADMIN"];

export function usePermissions() {
  const role = useAuthStore((s) => s.user?.role);
  return {
    role,
    /** Personel, soru, soru seti ve değerlendirme oluşturma/düzenleme */
    canManage: !!role && MANAGE.includes(role),
    /** AI analizi, İK onayı, rapor oluşturma/indirme */
    canAnalyze: !!role && ANALYZE.includes(role),
    /** AI sağlayıcı ve prompt yapılandırması */
    canConfigureAi: !!role && AI_CONFIG.includes(role),
  };
}
