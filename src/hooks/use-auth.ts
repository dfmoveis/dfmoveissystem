import { create } from 'zustand';
import { UserRole, User } from '@/types/database';

interface AuthState {
  user: User | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: 'PROJETISTA',
  setRole: (role) => set({ role }),
  setUser: (user) => set({ user }),
}));
