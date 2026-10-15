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
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        setAccessToken(accessToken);
        set({ user, accessToken, isAuthenticated: true });
      },

      clearAuth: () => {
        setAccessToken(null);
        set({ user: null, accessToken: null, isAuthenticated: false });
      },
    }),
    {
      name: "ph-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Refresh token geçersizse kalıcı oturum bilgisi de temizlensin (AuthGuard yönlendirsin)
setAuthFailureHandler(() => useAuthStore.getState().clearAuth());
