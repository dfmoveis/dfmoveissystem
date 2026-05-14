import { create } from 'zustand';
import { UserRole, User } from '@/types/database';

interface AuthState {
  user: User | null;
  role: UserRole;
  setRole: (role: UserRole) => void;
  setUser: (user: User | null) => void;
}

// Mock user for development as requested
const MOCK_ADMIN: User = {
  id: '00000000-0000-0000-0000-000000000000',
  nome: 'Admin Teste',
  email: 'rangelmaker@gmail.com',
  role: 'ADMIN',
  created_at: new Date().toISOString(),
};

export const useAuthStore = create<AuthState>((set) => ({
  user: MOCK_ADMIN,
  role: 'ADMIN',
  setRole: (role) => set({ role }),
  setUser: (user) => set({ user }),
}));
