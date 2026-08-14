import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  CirclePause,
  Clock3,
  ContactRound,
  FolderKanban,
  Pause,
  Play,
  Route as RouteIcon,
  Search,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deadlineState,
  formatDate,
  initials,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
  SOURCE_LABELS,
} from "@/lib/project-utils";
import type { ProjectStatus } from "@/types/database";

export const Route = createFileRoute("/_dashboard/demandas")({
  component: DistributionPage,
});

interface DistributionProject {
  id: string;
  cliente_id: string;
  nome: string | null;
  fonte: string | null;
  nome_arquiteto: string | null;
  data_inicio: string;
  prazo_termino: string;
  status: ProjectStatus;
  estagio_andamento: string | null;
  observacoes: string | null;
  created_at: string | null;
  projetista_id: string | null;
  cliente: { id: string; nome: string; telefone: string | null } | null;
  projetista: { id: string; nome: string; avatar_url: string | null } | null;
}

interface Designer {
  id: string;
  nome: string;
  avatar_url: string | null;
}

type StatusFilter = "TODOS" | "SEM_RESPONSAVEL" | ProjectStatus;

function effectiveStatus(project: DistributionProject): ProjectStatus {
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

function DistributionPage() {
  const { user, role } = useAuthStore();
  const isAdmin = role === "ADMIN";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODOS");
  const [selectedProject, setSelectedProject] = useState<DistributionProject | null>(null);
  const [designerId, setDesignerId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [claimDeadline, setClaimDeadline] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["distribution-projects", isAdmin ? "all" : user?.id],
    queryFn: async () => {
      const fields =
        "id, cliente_id, nome, fonte, nome_arquiteto, data_inicio, prazo_termino, status, estagio_andamento, observacoes, created_at, projetista_id, cliente:clientes(id, nome, telefone), projetista:users(id, nome, avatar_url)";

      if (isAdmin) {
        const { data, error } = await supabase
          .from("projetos")
          .select(fields)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as unknown as DistributionProject[];
      }

      if (!user?.id) return [];
      const [ownResult, nextResult] = await Promise.all([
        supabase
          .from("projetos")
          .select(fields)
          .eq("projetista_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("projetos")
          .select(fields)
          .is("projetista_id", null)
          .eq("status", "PRONTO")
          .order("created_at", { ascending: true })
          .limit(1),
      ]);
      if (ownResult.error) throw ownResult.error;
      if (nextResult.error) throw nextResult.error;
      return [
        ...(ownResult.data ?? []),
        ...(nextResult.data ?? []),
      ] as unknown as DistributionProject[];
    },
    enabled: isAdmin || Boolean(user?.id),
  });

  const { data: designers = [] } = useQuery({
    queryKey: ["distribution-designers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, nome, avatar_url")
        .eq("role", "PROJETISTA")
        .eq("status", "ATIVO")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Designer[];
    },
  });

  const workload = useMemo(
    () =>
      designers.reduce<Record<string, number>>((acc, designer) => {
        acc[designer.id] = projects.filter(
          (project) =>
            project.projetista_id === designer.id &&
            ["EM_EXECUCAO", "ATRASADO", "EM_ACOMPANHAMENTO"].includes(project.status),
        ).length;
        return acc;
      }, {}),
    [designers, projects],
  );

  const ownProjects = useMemo(
    () => (isAdmin ? projects : projects.filter((project) => project.projetista_id === user?.id)),
    [isAdmin, projects, user?.id],
  );

  const nextAvailableProject = useMemo(
    () =>
      isAdmin
        ? null
        : (projects.find((project) => !project.projetista_id && project.status === "PRONTO") ??
          null),
    [isAdmin, projects],
  );

  const visibleProjects = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return ownProjects.filter((project) => {
      const matchesSearch =
        !term ||
        project.nome?.toLocaleLowerCase("pt-BR").includes(term) ||
        project.cliente?.nome.toLocaleLowerCase("pt-BR").includes(term) ||
        project.projetista?.nome.toLocaleLowerCase("pt-BR").includes(term);
      const status = project.status === "PRONTO" ? "PRONTO" : effectiveStatus(project);
      const matchesStatus =
        statusFilter === "TODOS" ||
        (statusFilter === "SEM_RESPONSAVEL" && !project.projetista_id) ||
        status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [ownProjects, search, statusFilter]);

  const invalidateOperation = () => {
    queryClient.invalidateQueries({ queryKey: ["distribution-projects"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["admin-operation"] });
    queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
  };

  const addHistory = async (projectId: string, content: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from("anotacoes_projeto").insert({
      projeto_id: projectId,
      autor_id: user.id,
      autor_nome: user.nome,
      conteudo: content,
    });
    if (error) console.warn("[distribution] history entry not saved", error.message);
  };

  const assignProject = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error("Somente o superusuário pode distribuir projetos.");
      if (!selectedProject || !designerId || !deadline) {
        throw new Error("Escolha a projetista e defina o prazo.");
      }
      const designer = designers.find((item) => item.id === designerId);
      const { error } = await supabase
        .from("projetos")
        .update({
          projetista_id: designerId,
          prazo_termino: deadline,
          status: "PRONTO",
          estagio_andamento: "Aguardando aceite da projetista",
        })
        .eq("id", selectedProject.id);
      if (error) throw error;

      const { error: clientError } = await supabase
        .from("clientes")
        .update({ projetista_id: designerId })
        .eq("id", selectedProject.cliente_id);
      if (clientError) throw clientError;

      await addHistory(
        selectedProject.id,
        `Projeto reservado pelo superusuário para ${designer?.nome ?? "projetista"}, aguardando aceite, com prazo em ${formatDate(deadline)}.`,
      );
    },
    onSuccess: () => {
      invalidateOperation();
      toast.success("Solicitação enviada para a projetista aceitar.");
      setSelectedProject(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const acceptAssignedProject = useMutation({
    mutationFn: async (project: DistributionProject) => {
      if (!user?.id || isAdmin) throw new Error("Ação disponível apenas para projetistas.");
      const { data, error } = await supabase
        .from("projetos")
        .update({
          status: "EM_EXECUCAO",
          estagio_andamento: "Briefing e levantamento",
        })
        .eq("id", project.id)
        .eq("projetista_id", user.id)
        .eq("status", "PRONTO")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Esta solicitação não está mais disponível para aceite.");
      await addHistory(project.id, `${user.nome} aceitou a solicitação enviada pelo superusuário.`);
    },
    onSuccess: () => {
      invalidateOperation();
      toast.success("Projeto aceito e iniciado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const claimNextProject = useMutation({
    mutationFn: async () => {
      if (!user?.id || isAdmin) throw new Error("Ação disponível apenas para projetistas.");
      if (!nextAvailableProject) throw new Error("Não há projeto livre na fila.");
      if (!claimDeadline) throw new Error("Informe o prazo que você consegue cumprir.");

      const { data, error } = await supabase
        .from("projetos")
        .update({
          projetista_id: user.id,
          prazo_termino: claimDeadline,
          status: "EM_EXECUCAO",
          estagio_andamento: "Briefing e levantamento",
        })
        .eq("id", nextAvailableProject.id)
        .is("projetista_id", null)
        .eq("status", "PRONTO")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error("A fila mudou e este projeto já foi assumido. O próximo será atualizado.");
      }

      const { error: clientError } = await supabase
        .from("clientes")
        .update({ projetista_id: user.id })
        .eq("id", nextAvailableProject.cliente_id);
      if (clientError) throw clientError;

      await addHistory(
        nextAvailableProject.id,
        `${user.nome} assumiu o próximo projeto da fila com prazo em ${formatDate(claimDeadline)}.`,
      );
    },
    onSuccess: () => {
      setClaimDeadline("");
      invalidateOperation();
      toast.success("Próximo projeto da fila assumido com sucesso.");
    },
    onError: (error: Error) => {
      invalidateOperation();
      toast.error(error.message);
    },
  });

  const changeProjectState = useMutation({
    mutationFn: async ({
      project,
      action,
    }: {
      project: DistributionProject;
      action: "PAUSE" | "RESUME";
    }) => {
      if (!isAdmin) throw new Error("Somente o superusuário pode alterar a fila.");
      const nextStatus = action === "PAUSE" ? "PAUSADO" : "EM_EXECUCAO";
      const nextStage = action === "PAUSE" ? "Pausado pelo superusuário" : "Retomado";
      const { error } = await supabase
        .from("projetos")
        .update({ status: nextStatus, estagio_andamento: nextStage })
        .eq("id", project.id);
      if (error) throw error;
      await addHistory(
        project.id,
        action === "PAUSE"
          ? "Projeto pausado pelo superusuário para reorganização da fila."
          : "Projeto retomado pelo superusuário.",
      );
    },
    onSuccess: (_, variables) => {
      invalidateOperation();
      toast.success(variables.action === "PAUSE" ? "Projeto pausado." : "Projeto retomado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openAssignment = (project: DistributionProject) => {
    setSelectedProject(project);
    setDesignerId(project.projetista_id ?? "");
    setDeadline(project.prazo_termino || "");
  };

  const counts = {
    waiting: ownProjects.filter((project) => !project.projetista_id).length,
    requests: ownProjects.filter((project) => project.projetista_id && project.status === "PRONTO")
      .length,
    active: ownProjects.filter((project) => effectiveStatus(project) === "EM_EXECUCAO").length,
    paused: ownProjects.filter((project) => project.status === "PAUSADO").length,
    overdue: ownProjects.filter((project) => effectiveStatus(project) === "ATRASADO").length,
  };

  const metricItems = isAdmin
    ? [
        {
          label: "Livres na fila",
          value: counts.waiting,
          icon: ContactRound,
          tone: "text-amber-700 bg-amber-50",
        },
        {
          label: "Aguardando aceite",
          value: counts.requests,
          icon: UserRoundCheck,
          tone: "text-violet-700 bg-violet-50",
        },
        {
          label: "Em desenvolvimento",
          value: counts.active,
          icon: FolderKanban,
          tone: "text-sky-700 bg-sky-50",
        },
        {
          label: "Projetos pausados",
          value: counts.paused,
          icon: CirclePause,
          tone: "text-slate-700 bg-slate-100",
        },
        {
          label: "Prazos vencidos",
          value: counts.overdue,
          icon: Clock3,
          tone: "text-rose-700 bg-rose-50",
        },
      ]
    : [
        {
          label: "Aguardando meu aceite",
          value: counts.requests,
          icon: UserRoundCheck,
          tone: "text-violet-700 bg-violet-50",
        },
        {
          label: "Em desenvolvimento",
          value: counts.active,
          icon: FolderKanban,
          tone: "text-sky-700 bg-sky-50",
        },
        {
          label: "Projetos pausados",
          value: counts.paused,
          icon: CirclePause,
          tone: "text-slate-700 bg-slate-100",
        },
        {
          label: "Prazos vencidos",
          value: counts.overdue,
          icon: Clock3,
          tone: "text-rose-700 bg-rose-50",
        },
      ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="workspace-eyebrow">Fluxo de produção</p>
          <h2 className="workspace-title mt-2">
            {isAdmin ? "Central de distribuição" : "Minha fila de projetos"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {isAdmin
              ? "Distribua cada entrada, acompanhe a capacidade das projetistas e reorganize a fila sem perder o prazo."
              : "Você pode assumir somente o próximo projeto livre da fila ou aceitar uma solicitação definida pelo superusuário."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 rounded-xl border border-[#cbb27a]/30 bg-[#fbf7eb] px-3 py-2 text-xs text-[#725e32]">
            <RouteIcon className="h-4 w-4" />
            Somente você distribui ou pausa projetos
          </div>
        )}
      </section>

      <section
        className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
      >
        {metricItems.map((item) => (
          <Card key={item.label} className="workspace-card border-0 shadow-none">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
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

      {isAdmin && designers.length > 0 && (
        <section className="workspace-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="mr-1 text-xs font-semibold text-slate-500">Carga ativa:</span>
            {designers.map((designer) => (
              <div
                key={designer.id}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3"
              >
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-[9px] font-bold text-white">
                  {designer.avatar_url ? (
                    <img src={designer.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(designer.nome)
                  )}
                </div>
                <span className="text-xs font-medium text-slate-700">{designer.nome}</span>
                <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                  {workload[designer.id] ?? 0}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isAdmin && (
        <section className="workspace-card overflow-hidden border border-[#cbb27a]/35 bg-gradient-to-r from-[#fffdf7] to-white">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.55fr)] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6f35]">
                <RouteIcon className="h-4 w-4" /> Próximo da fila
              </div>
              {nextAvailableProject ? (
                <>
                  <h3 className="mt-3 text-lg font-semibold text-slate-950">
                    {nextAvailableProject.nome || "Projeto sem nome"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {nextAvailableProject.cliente?.nome ?? "Cliente não encontrado"}
                    {nextAvailableProject.fonte
                      ? ` · ${SOURCE_LABELS[nextAvailableProject.fonte] ?? nextAvailableProject.fonte}`
                      : ""}
                  </p>
                  <p className="mt-3 max-w-xl text-xs leading-5 text-slate-500">
                    Este é o projeto livre mais antigo. A ordem é automática e os demais projetos da
                    fila não ficam disponíveis para escolha.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="mt-3 font-semibold text-slate-900">Nenhum projeto livre agora</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Quando houver uma nova entrada livre, somente a primeira aparecerá aqui.
                  </p>
                </>
              )}
            </div>
            {nextAvailableProject && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <Label htmlFor="claim-deadline">Prazo que consigo entregar</Label>
                <Input
                  id="claim-deadline"
                  type="date"
                  value={claimDeadline}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setClaimDeadline(event.target.value)}
                  className="mt-2"
                />
                <Button
                  className="mt-3 w-full bg-[#c92031] text-white hover:bg-[#aa1726]"
                  disabled={!claimDeadline || claimNextProject.isPending}
                  onClick={() => claimNextProject.mutate()}
                >
                  {claimNextProject.isPending ? "Assumindo..." : "Pegar próximo projeto"}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="workspace-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, projeto ou projetista..."
              className="h-10 border-slate-200 bg-slate-50/70 pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="h-10 w-full border-slate-200 bg-white md:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os projetos</SelectItem>
              {isAdmin && <SelectItem value="SEM_RESPONSAVEL">Sem responsável</SelectItem>}
              <SelectItem value="PRONTO">
                {isAdmin ? "Livres ou aguardando aceite" : "Aguardando meu aceite"}
              </SelectItem>
              <SelectItem value="EM_EXECUCAO">Em desenvolvimento</SelectItem>
              <SelectItem value="PAUSADO">Pausados</SelectItem>
              <SelectItem value="ATRASADO">Atrasados</SelectItem>
              <SelectItem value="FINALIZADO">Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="mt-4 font-semibold text-slate-800">Nenhum projeto neste filtro</p>
            <p className="mt-1 text-sm text-slate-500">A operação está organizada por aqui.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleProjects.map((project) => {
              const awaitingAcceptance =
                project.status === "PRONTO" && Boolean(project.projetista_id);
              const status = project.status === "PRONTO" ? "PRONTO" : effectiveStatus(project);
              const deadlineInfo = deadlineState(project.prazo_termino);
              return (
                <article
                  key={project.id}
                  className="grid gap-4 p-4 transition-colors hover:bg-[#faf9f6] lg:grid-cols-[minmax(0,1.5fr)_minmax(190px,.7fr)_minmax(170px,.6fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold text-slate-900">
                        {project.nome || "Projeto sem nome"}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`rounded-full text-[10px] ${
                          awaitingAcceptance
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : PROJECT_STATUS_STYLES[status]
                        }`}
                      >
                        {awaitingAcceptance
                          ? isAdmin
                            ? "Aguardando aceite"
                            : "Solicitação do superusuário"
                          : PROJECT_STATUS_LABELS[status]}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">
                      {project.cliente?.nome ?? "Cliente não encontrado"}
                      {project.cliente?.telefone ? ` · ${project.cliente.telefone}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {project.fonte
                        ? (SOURCE_LABELS[project.fonte] ?? project.fonte)
                        : "Origem não informada"}
                      {project.nome_arquiteto ? ` · ${project.nome_arquiteto}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900 text-[10px] font-bold text-white">
                      {project.projetista?.avatar_url ? (
                        <img
                          src={project.projetista.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(project.projetista?.nome ?? "Sem responsável")
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {project.projetista?.nome ?? "Aguardando distribuição"}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {project.estagio_andamento || "Etapa não informada"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                      {formatDate(project.prazo_termino)}
                    </div>
                    <p
                      className={`mt-1 text-[11px] ${deadlineInfo.tone === "danger" ? "font-semibold text-rose-600" : deadlineInfo.tone === "warning" ? "text-amber-600" : "text-slate-400"}`}
                    >
                      {deadlineInfo.label}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => openAssignment(project)}
                      >
                        <UserRoundCheck className="mr-1.5 h-3.5 w-3.5" />
                        {project.projetista_id ? "Reorganizar" : "Distribuir"}
                      </Button>
                      {project.status === "PAUSADO" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => changeProjectState.mutate({ project, action: "RESUME" })}
                        >
                          <Play className="mr-1.5 h-3.5 w-3.5" /> Retomar
                        </Button>
                      ) : project.projetista_id && project.status !== "FINALIZADO" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-slate-500 hover:bg-slate-100"
                          onClick={() => changeProjectState.mutate({ project, action: "PAUSE" })}
                        >
                          <Pause className="mr-1.5 h-3.5 w-3.5" /> Pausar
                        </Button>
                      ) : null}
                    </div>
                  )}
                  {!isAdmin && awaitingAcceptance && (
                    <div className="flex items-center lg:justify-end">
                      <Button
                        size="sm"
                        className="h-8 bg-[#c92031] text-white hover:bg-[#aa1726]"
                        disabled={acceptAssignedProject.isPending}
                        onClick={() => acceptAssignedProject.mutate(project)}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {acceptAssignedProject.isPending ? "Aceitando..." : "Aceitar solicitação"}
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(selectedProject)}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Distribuir projeto</DialogTitle>
            <DialogDescription>
              {selectedProject?.cliente?.nome} · {selectedProject?.nome || "Projeto sem nome"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-3">
            <div className="grid gap-2">
              <Label>Projetista responsável</Label>
              <Select value={designerId} onValueChange={setDesignerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma projetista" />
                </SelectTrigger>
                <SelectContent>
                  {designers.map((designer) => (
                    <SelectItem key={designer.id} value={designer.id}>
                      {designer.nome} · {workload[designer.id] ?? 0} ativos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Projetos pausados não entram na carga ativa.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-deadline">Prazo acordado</Label>
              <Input
                id="project-deadline"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProject(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => assignProject.mutate()}
              disabled={assignProject.isPending || !designerId || !deadline}
              className="bg-[#c92031] text-white hover:bg-[#aa1726]"
            >
              {assignProject.isPending ? "Salvando..." : "Confirmar distribuição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
