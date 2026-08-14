import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CirclePause,
  Clock3,
  ContactRound,
  FolderKanban,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deadlineState,
  formatDate,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
} from "@/lib/project-utils";
import type { ProjectStatus } from "@/types/database";

export const Route = createFileRoute("/_dashboard/projetista/dashboard")({
  component: DesignerDashboard,
});

interface DesignerProject {
  id: string;
  nome: string | null;
  status: ProjectStatus;
  prazo_termino: string;
  estagio_andamento: string | null;
  cliente: { id: string; nome: string; telefone: string | null } | null;
}

interface AgendaItem {
  id: string;
  titulo: string;
  data_inicio: string;
  cliente: { nome: string } | null;
}

function effectiveStatus(project: DesignerProject): ProjectStatus {
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

function DesignerDashboard() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["designer-operation", user?.id],
    queryFn: async () => {
      if (!user?.id) return { projects: [], agenda: [] };
      const [projectResult, agendaResult] = await Promise.all([
        supabase
          .from("projetos")
          .select(
            "id, nome, status, prazo_termino, estagio_andamento, cliente:clientes(id, nome, telefone)",
          )
          .eq("projetista_id", user.id)
          .order("prazo_termino", { ascending: true }),
        supabase
          .from("agendamentos")
          .select("id, titulo, data_inicio, cliente:clientes(nome)")
          .gte("data_inicio", new Date().toISOString())
          .order("data_inicio", { ascending: true })
          .limit(4),
      ]);
      if (projectResult.error) throw projectResult.error;
      if (agendaResult.error) throw agendaResult.error;
      return {
        projects: (projectResult.data ?? []) as unknown as DesignerProject[],
        agenda: (agendaResult.data ?? []) as unknown as AgendaItem[],
      };
    },
    enabled: Boolean(user?.id),
  });

  const projects = useMemo(() => data?.projects ?? [], [data?.projects]);
  const agenda = data?.agenda ?? [];
  const priorities = useMemo(
    () =>
      projects
        .filter((project) => project.status !== "FINALIZADO")
        .sort((a, b) => {
          if (a.status === "PAUSADO" && b.status !== "PAUSADO") return 1;
          if (a.status !== "PAUSADO" && b.status === "PAUSADO") return -1;
          return a.prazo_termino.localeCompare(b.prazo_termino);
        })
        .slice(0, 6),
    [projects],
  );

  const uniqueClients = new Set(projects.map((project) => project.cliente?.id).filter(Boolean))
    .size;
  const cards = [
    {
      label: "Aguardando meu aceite",
      value: projects.filter((project) => project.status === "PRONTO").length,
      icon: UserRoundCheck,
      style: "bg-violet-50 text-violet-700",
    },
    {
      label: "Carga ativa",
      value: projects.filter((project) =>
        ["EM_EXECUCAO", "ATRASADO", "EM_ACOMPANHAMENTO"].includes(project.status),
      ).length,
      icon: FolderKanban,
      style: "bg-sky-50 text-sky-700",
    },
    {
      label: "Perto do prazo",
      value: projects.filter((project) => {
        const days = deadlineState(project.prazo_termino).days;
        return days !== null && days <= 2 && project.status !== "FINALIZADO";
      }).length,
      icon: Clock3,
      style: "bg-rose-50 text-rose-700",
    },
    {
      label: "Pausados pela gestão",
      value: projects.filter((project) => project.status === "PAUSADO").length,
      icon: CirclePause,
      style: "bg-slate-100 text-slate-700",
    },
    {
      label: "Clientes na carteira",
      value: uniqueClients,
      icon: ContactRound,
      style: "bg-amber-50 text-amber-700",
    },
  ];

  if (isLoading) return <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" />;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#1a1c21] px-6 py-7 text-white md:px-8 md:py-9">
        <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-[#c92031]/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#d6c08d]">
              <Sparkles className="h-3.5 w-3.5" /> Sua mesa de trabalho
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] md:text-4xl">
              Olá, {user?.nome?.split(" ")[0]}.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
              Aceite os projetos enviados pelo dono ou assuma somente o próximo item livre da fila.
              Depois, mantenha cada etapa avançando.
            </p>
          </div>
          <Button asChild className="bg-[#c92031] text-white hover:bg-[#aa1726]">
            <Link to="/demandas">
              Ver fila e solicitações <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((item) => (
          <Card key={item.label} className="workspace-card border-0 shadow-none">
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.style}`}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-950">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="workspace-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Prioridade de trabalho</p>
              <p className="mt-0.5 text-xs text-slate-400">Ordenado pelo prazo mais próximo</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/projetista/meus-projetos">Ver todos</Link>
            </Button>
          </div>
          {priorities.length === 0 ? (
            <div className="px-5 py-14 text-center text-sm text-slate-400">
              Nenhum projeto ativo na sua fila.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {priorities.map((project) => {
                const status = project.status === "PRONTO" ? "PRONTO" : effectiveStatus(project);
                const deadline = deadlineState(project.prazo_termino);
                return (
                  <div
                    key={project.id}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_150px_110px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {project.nome || "Projeto sem nome"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {project.cliente?.nome} · {project.estagio_andamento || "Início"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`w-fit rounded-full text-[9px] ${
                        project.status === "PRONTO"
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : PROJECT_STATUS_STYLES[status]
                      }`}
                    >
                      {project.status === "PRONTO"
                        ? "Aguardando seu aceite"
                        : PROJECT_STATUS_LABELS[status]}
                    </Badge>
                    <div className="sm:text-right">
                      <p className="text-xs font-medium text-slate-700">
                        {formatDate(project.prazo_termino)}
                      </p>
                      <p
                        className={`mt-1 text-[10px] ${deadline.tone === "danger" ? "font-semibold text-rose-600" : "text-slate-400"}`}
                      >
                        {deadline.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="workspace-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <CalendarDays className="h-4 w-4 text-[#c92031]" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Agenda da loja</p>
              <p className="text-xs text-slate-400">Próximos horários de todos</p>
            </div>
          </div>
          {agenda.length === 0 ? (
            <div className="px-5 py-14 text-center text-xs text-slate-400">Agenda livre.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {agenda.map((item) => {
                const date = new Date(item.data_inicio);
                return (
                  <div key={item.id} className="flex gap-3 px-5 py-4">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#f5f1e7]">
                      <span className="text-[9px] font-bold uppercase text-[#a08753]">
                        {date.toLocaleDateString("pt-BR", { month: "short" })}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{date.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">{item.titulo}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-400">
                        {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {item.cliente?.nome ?? "Equipe"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-slate-100 p-3">
            <Button asChild variant="ghost" size="sm" className="w-full text-xs">
              <Link to="/agenda">Abrir agenda compartilhada</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
