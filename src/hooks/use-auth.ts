import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserRole, User } from '@/types/database';

interface AuthState {
  hydrated: boolean;
  user: User | null;
  role: UserRole;
  deferredPrompt: any;
  setHydrated: (hydrated: boolean) => void;
  setRole: (role: UserRole) => void;
  setUser: (user: User | null) => void;
  setDeferredPrompt: (prompt: any) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hydrated: false,
      user: null,
      role: 'PROJETISTA',
      deferredPrompt: null,
      setHydrated: (hydrated) => set({ hydrated }),
      setRole: (role) => set({ role }),
      setUser: (user) => set({ user }),
      setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
      logout: () => set({ user: null, role: 'PROJETISTA', deferredPrompt: null }),
    }),
    {
      name: 'df-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ user, role }) => ({ user, role }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) {
          state?.setHydrated(true);
        }
      },
    }
  )
);

export async function ensureAuthStoreHydrated() {
  if (typeof window === 'undefined') {
    return useAuthStore.getState();
  }

  if (!useAuthStore.persist.hasHydrated()) {
    await useAuthStore.persist.rehydrate();
  }

  return useAuthStore.getState();
}
