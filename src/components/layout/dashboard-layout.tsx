import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

import logoDF from "@/assets/logo-df.png";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuthStore, validateStoredAccess } from "@/hooks/use-auth";
import { initials } from "@/lib/project-utils";

const PAGE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Visão da operação",
  "/admin/equipe": "Equipe de projetos",
  "/admin/crm": "Pipeline comercial",
  "/admin/comissoes": "Comissões",
  "/projetista/dashboard": "Minha operação",
  "/projetista/meus-projetos": "Meus projetos",
  "/projetista/clientes": "Clientes e entradas",
  "/projetista/perfil": "Meu perfil",
  "/demandas": "Central de distribuição",
  "/agenda": "Agenda compartilhada",
};

const adminLinks = [
  { title: "Visão geral", icon: LayoutDashboard, to: "/admin/dashboard" },
  { title: "Distribuição", icon: RouteIcon, to: "/demandas" },
  { title: "Clientes", icon: ContactRound, to: "/projetista/clientes" },
  { title: "Agenda da loja", icon: CalendarDays, to: "/agenda" },
  { title: "Equipe", icon: UsersRound, to: "/admin/equipe" },
  { title: "Pipeline", icon: BriefcaseBusiness, to: "/admin/crm" },
  { title: "Comissões", icon: CircleDollarSign, to: "/admin/comissoes" },
] as const;

const designerLinks = [
  { title: "Minha visão", icon: LayoutDashboard, to: "/projetista/dashboard" },
  { title: "Próximo da fila", icon: RouteIcon, to: "/demandas" },
  { title: "Meus projetos", icon: BriefcaseBusiness, to: "/projetista/meus-projetos" },
  { title: "Clientes", icon: ContactRound, to: "/projetista/clientes" },
  { title: "Agenda da loja", icon: CalendarDays, to: "/agenda" },
] as const;

export function DashboardLayout() {
  const { user, role, logout } = useAuthStore();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const links = role === "ADMIN" ? adminLinks : designerLinks;
  const pageTitle = PAGE_TITLES[pathname] ?? "DF Móveis";
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  useEffect(() => {
    let mounted = true;
    const verifyAccess = async () => {
      const access = await validateStoredAccess();
      if (!mounted || access.authorized) return;

      if (access.account && ["PENDING", "BLOCKED"].includes(access.reason)) {
        window.location.href = `/aguardando-aprovacao?email=${encodeURIComponent(access.account.email)}`;
        return;
      }
      window.location.href = "/";
    };

    const interval = window.setInterval(() => void verifyAccess(), 20_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const signOut = () => {
    logout();
    try {
      localStorage.removeItem("df-auth-storage");
    } catch {
      // Storage may be unavailable in private browsing.
    }
    window.location.href = "/";
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f5f4f0] text-slate-950">
        <Sidebar className="border-r-0 bg-[#17191d] text-white">
          <SidebarHeader className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8f4e9] p-1.5 shadow-sm">
                <img src={logoDF} alt="DF Móveis" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-wide">DF Móveis</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#cbb27a]">
                  Central de projetos
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4">
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Operação
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {links.map((link) => (
                    <SidebarMenuItem key={link.to}>
                      <SidebarMenuButton
                        asChild
                        tooltip={link.title}
                        className="h-10 rounded-lg text-white/65 hover:bg-white/8 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white"
                        isActive={pathname === link.to}
                      >
                        <Link to={link.to} className="flex items-center gap-3">
                          <link.icon className="h-[18px] w-[18px]" />
                          <span className="font-medium">{link.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {role === "ADMIN" && (
              <div className="mx-3 mt-5 rounded-xl border border-[#cbb27a]/20 bg-[#cbb27a]/8 p-3">
                <div className="flex items-center gap-2 text-[#dcc898]">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-semibold">Acesso de superusuário</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-white/45">
                  Você controla responsáveis, prazos e prioridades da equipe.
                </p>
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#c92031] text-xs font-bold text-white">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.nome}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(user?.nome)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{user?.nome}</p>
                <p className="truncate text-[10px] text-white/40">
                  {role === "ADMIN" ? "Superusuário" : "Projetista"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/45 hover:bg-white/10 hover:text-white"
                onClick={signOut}
                aria-label="Sair do sistema"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-black/[0.06] bg-[#f5f4f0]/95 px-4 backdrop-blur md:px-7">
            <SidebarTrigger className="-ml-1" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold text-slate-900 md:text-base">
                {pageTitle}
              </h1>
              <p className="hidden text-xs capitalize text-slate-500 sm:block">{today}</p>
            </div>
            <Button
              asChild
              className="h-9 rounded-lg bg-[#c92031] px-3 text-xs text-white hover:bg-[#aa1726] md:px-4"
            >
              <Link to="/projetista/clientes">
                <Plus className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Novo atendimento</span>
                <span className="sm:hidden">Novo</span>
              </Link>
            </Button>
          </header>
          <div className="mx-auto w-full max-w-[1600px] p-4 md:p-7 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
