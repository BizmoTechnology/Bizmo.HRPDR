import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@ph/shared";
import { setAccessToken, setAuthFailureHandler } from "@/lib/api";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  organization: { id: string; name: string };
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** Oturum Bizmo.ID ile açıldıysa "bizmo-id" (çıkışta Bizmo.ID oturumu da kapatılır) */
  idp: "bizmo-id" | null;
  setAuth: (user: AuthUser, accessToken: string, idp?: "bizmo-id" | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      idp: null,

      setAuth: (user, accessToken, idp = null) => {
        setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true, idp });
      },

      clearAuth: () => {
        setAccessToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false, idp: null });
      },
    }),
    {
      name: "ph-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        idp: state.idp,
      }),
    }
  )
);

// Refresh token geçersizse kalıcı oturum bilgisi de temizlensin (AuthGuard yönlendirsin)
setAuthFailureHandler(() => useAuthStore.getState().clearAuth());
