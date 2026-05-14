import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserRole, User } from '@/types/database';

interface AuthState {
  hydrated: boolean;
  user: User | null;
  role: UserRole;
  setHydrated: (hydrated: boolean) => void;
  setRole: (role: UserRole) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hydrated: false,
      user: null,
      role: 'PROJETISTA',
      setHydrated: (hydrated) => set({ hydrated }),
      setRole: (role) => set({ role }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, role: 'PROJETISTA' }),
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
  if (!useAuthStore.persist.hasHydrated()) {
    await useAuthStore.persist.rehydrate();
  }

  return useAuthStore.getState();
}
