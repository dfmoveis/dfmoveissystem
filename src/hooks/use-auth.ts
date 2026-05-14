import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserRole, User } from '@/types/database';

interface AuthState {
  user: User | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: 'PROJETISTA',
      setRole: (role) => set({ role }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, role: 'PROJETISTA' }),
    }),
    {
      name: 'df-auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
