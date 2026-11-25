import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

/**
 * Personelle sonuç paylaşımı (kurum varsayılanı + kayıt bazlı geçersiz kılma).
 * Sunucudaki karşılığı: server/src/lib/sharing.ts
 */

export interface OrgSettings {
  /** Sonuçlar personelle varsayılan olarak paylaşılsın mı? (sistem varsayılanı: hayır) */
  shareResultsDefault: boolean;
}

/** Kayıt düzeyi tri-state: null = kurum varsayılanı */
export type ShareOverride = boolean | null;
export type ShareChoice = "default" | "share" | "noshare";

/** Formlarda kullanılan alanlar (Assessment, ReviewCycle, CareerPlan …) */
export interface ShareFields {
  shareWithEmployee?: ShareOverride;
}

export const orgSettingsKey = ["org-settings"] as const;

/** Kurum ayarlarını yalnız yöneticiler değiştirebilir (sunucu: SETTINGS_WRITE_ROLES) */
const SETTINGS_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN"];

export function useOrgSettings() {
  return useQuery({
    queryKey: orgSettingsKey,
    queryFn: () => api.get<{ data: OrgSettings }>("/api/org-settings").then((r) => r.data.data),
    staleTime: 60_000,
  });
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<OrgSettings>) =>
      api.put<{ data: OrgSettings }>("/api/org-settings", patch).then((r) => r.data.data),
    onSuccess: (data) => {
      qc.setQueryData(orgSettingsKey, data);
    },
  });
}

export function useCanEditOrgSettings(): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return !!role && SETTINGS_WRITE_ROLES.includes(role);
}

export function resolveShare(override: ShareOverride | undefined, orgDefault: boolean): boolean {
  return typeof override === "boolean" ? override : orgDefault;
}

export function toShareChoice(override: ShareOverride | undefined): ShareChoice {
  if (override === true) return "share";
  if (override === false) return "noshare";
  return "default";
}

export function fromShareChoice(choice: ShareChoice): ShareOverride {
  if (choice === "share") return true;
  if (choice === "noshare") return false;
  return null;
}
