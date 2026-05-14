import * as React from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { 
  LayoutDashboard, 
  Users, 
  UserSquare2, 
  Briefcase, 
  DollarSign, 
  LogOut,
  Menu,
  ChevronLeft,
  CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/hooks/use-auth';
import { useTeam } from '@/hooks/use-team';
import { UserRole } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';

export function DashboardLayout() {
  const { user, role, setRole, setUser } = useAuthStore();
  const { data: team } = useTeam();

  const adminLinks = [
    { title: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' },
    { title: 'Equipe', icon: Users, to: '/admin/equipe' },
    { title: 'CRM (Clientes)', icon: UserSquare2, to: '/admin/crm' },
    { title: 'Agenda', icon: CalendarDays, to: '/agenda' },
    { title: 'Comissões', icon: DollarSign, to: '/admin/comissoes' },
  ];

  const projetistaLinks = [
    { title: 'Meus Projetos', icon: Briefcase, to: '/projetista/dashboard' },
    { title: 'Clientes', icon: UserSquare2, to: '/projetista/clientes' },
    { title: 'Agenda', icon: CalendarDays, to: '/agenda' },
    { title: 'Perfil', icon: UserSquare2, to: '/projetista/perfil' },
  ];

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'PROJETISTA' && team && team.length > 0) {
      setUser(team[0]);
    } else if (newRole === 'ADMIN') {
      setUser({
        id: '00000000-0000-0000-0000-000000000000',
        nome: 'Admin Teste',
        email: 'rangelmaker@gmail.com',
        role: 'ADMIN',
        created_at: new Date().toISOString(),
      });
    }
  };

  const currentLinks = role === 'ADMIN' ? adminLinks : projetistaLinks;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-border">
          <SidebarHeader className="p-4 border-b border-border">
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                DF
              </div>
              <span className="font-bold text-lg tracking-tight">DF Móveis</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {currentLinks.map((link) => (
                    <SidebarMenuItem key={link.to}>
                      <SidebarMenuButton asChild tooltip={link.title}>
                        <Link 
                          to={link.to} 
                          className="flex items-center gap-3"
                          activeProps={{ className: 'bg-accent text-accent-foreground' }}
                        >
                          <link.icon className="h-4 w-4" />
                          <span>{link.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarGroupLabel>Desenvolvimento</SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="px-3 py-2">
                  <select 
                    value={role} 
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    className="w-full p-2 text-xs rounded border bg-background"
                  >
                    <option value="ADMIN">Visão ADMIN</option>
                    <option value="PROJETISTA">Visão PROJETISTA</option>
                  </select>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xs font-bold">
                    {user?.nome.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{user?.nome}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold">DF Móveis Planejados</h2>
            </div>
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
