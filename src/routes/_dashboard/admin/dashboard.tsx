import { useMemo } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CirclePause,
  Clock3,
  ContactRound,
  FolderKanban,
  Route as RouteIcon,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import {
  deadlineState,
  formatDate,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
} from "@/lib/project-utils";
import type { ProjectStatus } from "@/types/database";
import { ensureAuthStoreHydrated } from "@/hooks/use-auth";

export const Route = createFileRoute("/_dashboard/admin/dashboard")({
  beforeLoad: async () => {
    const { role } = await ensureAuthStoreHydrated();
    if (role !== "ADMIN") throw redirect({ to: "/projetista/dashboard" });
  },
  component: AdminDashboard,
});

interface OperationProject {
  id: string;
  nome: string | null;
  status: ProjectStatus;
  prazo_termino: string;
  projetista_id: string | null;
  cliente: { nome: string } | null;
  projetista: { id: string; nome: string; avatar_url: string | null } | null;
}

interface OperationDesigner {
  id: string;
  nome: string;
  avatar_url: string | null;
}

interface AgendaItem {
  id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  criado_por: { nome: string } | null;
  cliente: { nome: string } | null;
}

function statusWithDeadline(project: OperationProject): ProjectStatus {
  const deadline = deadlineState(project.prazo_termino);
  if (
    deadline.days !== null &&
    deadline.days < 0 &&
    !["PAUSADO", "FINALIZADO"].includes(project.status)
  ) {
    return "ATRASADO";
  }
  return project.status;
}

function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-operation"],
    queryFn: async () => {
      const today = new Date().toISOString();
      const [projectResult, designerResult, agendaResult] = await Promise.all([
        supabase
          .from("projetos")
          .select(
            "id, nome, status, prazo_termino, projetista_id, cliente:clientes(nome), projetista:users(id, nome, avatar_url)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("users")
          .select("id, nome, avatar_url")
          .eq("role", "PROJETISTA")
          .eq("status", "ATIVO")
          .order("nome"),
        supabase
          .from("agendamentos")
          .select(
            "id, titulo, data_inicio, data_fim, tipo, criado_por:users(nome), cliente:clientes(nome)",
          )
          .gte("data_inicio", today)
          .order("data_inicio", { ascending: true })
          .limit(5),
      ]);

      if (projectResult.error) throw projectResult.error;
      if (designerResult.error) throw designerResult.error;
      if (agendaResult.error) throw agendaResult.error;

      return {
        projects: (projectResult.data ?? []) as unknown as OperationProject[],
        designers: (designerResult.data ?? []) as OperationDesigner[],
        agenda: (agendaResult.data ?? []) as unknown as AgendaItem[],
      };
    },
  });

  const projects = useMemo(() => data?.projects ?? [], [data?.projects]);
  const designers = useMemo(() => data?.designers ?? [], [data?.designers]);
  const agenda = data?.agenda ?? [];

  const attentionProjects = useMemo(
    () =>
      projects
        .filter((project) => {
          const deadline = deadlineState(project.prazo_termino);
          return (
            !project.projetista_id ||
            project.status === "PAUSADO" ||
            (deadline.days !== null && deadline.days <= 2 && project.status !== "FINALIZADO")
          );
        })
        .sort((a, b) => {
          if (!a.projetista_id && b.projetista_id) return -1;
          if (a.projetista_id && !b.projetista_id) return 1;
          return a.prazo_termino.localeCompare(b.prazo_termino);
        })
        .slice(0, 6),
    [projects],
  );

  const workload = useMemo(
    () =>
      designers.map((designer) => {
        const own = projects.filter((project) => project.projetista_id === designer.id);
        const active = own.filter((project) =>
          ["EM_EXECUCAO", "ATRASADO", "EM_ACOMPANHAMENTO"].includes(project.status),
        );
        const pending = own.filter((project) => project.status === "PRONTO");
        const dueSoon = active.filter((project) => {
          const days = deadlineState(project.prazo_termino).days;
          return days !== null && days <= 2;
        });
        return {
          ...designer,
          active: active.length,
          pending: pending.length,
          paused: own.filter((project) => project.status === "PAUSADO").length,
          dueSoon: dueSoon.length,
        };
      }),
    [designers, projects],
  );

  const indicators = [
    {
      label: "Novas entradas",
      value: projects.filter((project) => !project.projetista_id).length,
      description: "aguardando distribuição",
      icon: RouteIcon,
      style: "bg-amber-50 text-amber-700",
    },
    {
      label: "Distribuições pendentes antigas",
      value: projects.filter((project) => project.projetista_id && project.status === "PRONTO")
        .length,
      description: "solicitações enviadas",
      icon: UserRoundCheck,
      style: "bg-violet-50 text-violet-700",
    },
    {
      label: "Em desenvolvimento",
      value: projects.filter((project) => statusWithDeadline(project) === "EM_EXECUCAO").length,
      description: "na carga da equipe",
      icon: FolderKanban,
      style: "bg-sky-50 text-sky-700",
    },
    {
      label: "Pausados",
      value: projects.filter((project) => project.status === "PAUSADO").length,
      description: "fora da carga ativa",
      icon: CirclePause,
      style: "bg-slate-100 text-slate-700",
    },
    {
      label: "Atenção ao prazo",
      value: projects.filter((project) => statusWithDeadline(project) === "ATRASADO").length,
      description: "projetos vencidos",
      icon: Clock3,
      style: "bg-rose-50 text-rose-700",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#1a1c21] px-6 py-7 text-white md:px-8 md:py-9">
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-[#c92031]/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-24 w-48 bg-[#cbb27a]/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#d6c08d]">
              <Sparkles className="h-3.5 w-3.5" /> Controle da loja
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.035em] md:text-4xl">
              Tudo que entrou, quem está fazendo e quando precisa ficar pronto.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
              Uma visão simples da carga das três projetistas, dos prazos e da agenda compartilhada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              <Link to="/demandas">
                Distribuir projetos <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link to="/agenda">Ver agenda</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {indicators.map((indicator) => (
          <Card key={indicator.label} className="workspace-card border-0 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{indicator.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                    {indicator.value}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">{indicator.description}</p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${indicator.style}`}
                >
                  <indicator.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <div className="workspace-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Projetos que pedem atenção</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Sem responsável, pausados ou próximos do prazo
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/demandas">
                Ver central <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          {attentionProjects.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-emerald-700">Operação em dia</p>
              <p className="mt-1 text-xs text-slate-400">
                Nenhum projeto precisa de ação imediata.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attentionProjects.map((project) => {
                const status = statusWithDeadline(project);
                const deadline = deadlineState(project.prazo_termino);
                return (
                  <div
                    key={project.id}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {project.nome || "Projeto sem nome"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {project.cliente?.nome ?? "Cliente não informado"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        src={project.projetista?.avatar_url}
                        name={project.projetista?.nome ?? "Sem responsável"}
                        className="h-7 w-7 rounded-lg"
                      />
                      <span className="truncate text-xs text-slate-600">
                        {project.projetista?.nome ?? "Sem responsável"}
                      </span>
                    </div>
                    <div className="sm:text-right">
                      <Badge
                        variant="outline"
                        className={`rounded-full text-[9px] ${PROJECT_STATUS_STYLES[status]}`}
                      >
                        {PROJECT_STATUS_LABELS[status]}
                      </Badge>
                      <p
                        className={`mt-1 text-[10px] ${deadline.tone === "danger" ? "font-semibold text-rose-600" : "text-slate-400"}`}
                      >
                        {formatDate(project.prazo_termino)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="workspace-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#c92031]" />
              <p className="text-sm font-semibold text-slate-900">Próximos compromissos</p>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">Agenda visível para toda a equipe</p>
          </div>
          {agenda.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-400">
              Nenhum compromisso futuro.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {agenda.map((item) => {
                const date = new Date(item.data_inicio);
                return (
                  <div key={item.id} className="flex gap-3 px-5 py-3.5">
                    <div className="w-11 shrink-0 rounded-lg bg-[#f5f1e7] py-1.5 text-center">
                      <p className="text-[9px] font-bold uppercase text-[#a08753]">
                        {date.toLocaleDateString("pt-BR", { month: "short" })}
                      </p>
                      <p className="text-lg font-semibold leading-5 text-slate-800">
                        {date.getDate()}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{item.titulo}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-400">
                        {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {item.cliente?.nome ?? item.criado_por?.nome ?? "Equipe"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-[#a08753]" />
              <h3 className="text-sm font-semibold text-slate-900">Carga da equipe</h3>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Projetos pausados ficam fora da carga ativa
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to="/admin/equipe">Gerenciar equipe</Link>
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {workload.map((designer) => (
            <div key={designer.id} className="workspace-card p-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={designer.avatar_url}
                  name={designer.nome}
                  className="h-11 w-11 rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{designer.nome}</p>
                  <p className="text-[11px] text-slate-400">Projetista</p>
                </div>
                <span className="text-2xl font-semibold tracking-tight text-slate-900">
                  {designer.active}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Aceite</p>
                  <p
                    className={`mt-1 text-sm font-semibold ${designer.pending ? "text-violet-600" : "text-slate-700"}`}
                  >
                    {designer.pending}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                    Perto do prazo
                  </p>
                  <p
                    className={`mt-1 text-sm font-semibold ${designer.dueSoon ? "text-rose-600" : "text-slate-700"}`}
                  >
                    {designer.dueSoon}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">Pausados</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{designer.paused}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
