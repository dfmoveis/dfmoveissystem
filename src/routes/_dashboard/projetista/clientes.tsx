import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, Star, Plus, Hand, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClientSpreadsheetImport } from "@/components/client-spreadsheet-import";

export const Route = createFileRoute("/_dashboard/projetista/clientes")({
  component: ProjetistaClientesPage,
});

interface ClienteRow {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  created_at: string;
  projetista_id: string | null;
  projetista: { id: string; nome: string } | null;
  projetos: Array<{
    id: string;
    nome: string | null;
    prazo_termino: string;
    status: string;
    created_at: string | null;
  }>;
}

const FONTES = [
  { value: "ARQUITETO", label: "Arquiteto" },
  { value: "VENDA_DIRETA", label: "Venda Direta" },
  { value: "INDICACAO", label: "Indicação" },
];

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "erro desconhecido";
}

function projectObservations(observacoes: string, fonte: string, nomeArquiteto: string) {
  const notes = observacoes.trim();
  const architect = fonte === "ARQUITETO" ? nomeArquiteto.trim() : "";
  return [architect ? `Arquiteto: ${architect}` : "", notes].filter(Boolean).join("\n") || null;
}

function ProjetistaClientesPage() {
  const { user, role } = useAuthStore();
  const isAdmin = role === "ADMIN";
  const queryClient = useQueryClient();

  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [pendingClient, setPendingClient] = useState<{ id: string; nome: string } | null>(null);

  const [clientForm, setClientForm] = useState({
    nome: "",
    telefone: "",
    fonte: "",
    nome_arquiteto: "",
    rt_arquiteto: "",
  });

  const [projectForm, setProjectForm] = useState({
    nome: "",
    fonte: "",
    nome_arquiteto: "",
    rt_arquiteto: "",
    valor_venda: "",
    data_inicio: new Date().toISOString().slice(0, 10),
    prazo_termino: "",
    observacoes: "",
    projetista_id: "",
  });

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select(
          "id, nome, email, telefone, endereco, created_at, projetista_id, projetista:projetista_id(id, nome), projetos(id, nome, prazo_termino, status, created_at)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClienteRow[];
    },
  });

  const { data: projetistas } = useQuery({
    queryKey: ["projetistas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, nome")
        .eq("role", "PROJETISTA")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const createClient = useMutation({
    mutationFn: async (data: typeof clientForm) => {
      console.log("[clientes] inserting client", data);
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { data: inserted, error } = await supabase
        .from("clientes")
        .insert([
          {
            nome: data.nome.trim(),
            telefone: data.telefone.trim(),
            email: null,
            endereco: null,
            projetista_id: isAdmin ? null : user.id,
          },
        ])
        .select("id, nome")
        .single();
      console.log("[clientes] insert result", { inserted, error });
      if (error) throw error;

      const today = new Date().toISOString().slice(0, 10);
      const initialProject: TablesInsert<"projetos"> = {
        cliente_id: inserted.id,
        projetista_id: null,
        status: "PRONTO" as const,
        status_venda: "EM_NEGOCIACAO" as const,
        data_inicio: today,
        prazo_termino: today,
        nome: null,
        fonte: data.fonte,
        observacoes: projectObservations("", data.fonte, data.nome_arquiteto),
        rt_arquiteto:
          data.fonte === "ARQUITETO" && data.rt_arquiteto
            ? parseFloat(data.rt_arquiteto)
            : null,
      };
      const { error: projectError } = await supabase.from("projetos").insert([initialProject]);
      if (projectError) throw projectError;
      return inserted as { id: string; nome: string };
    },
    onSuccess: async () => {
      setClientForm({
        nome: "",
        telefone: "",
        fonte: "",
        nome_arquiteto: "",
        rt_arquiteto: "",
      });
      setIsClientDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clientes-global"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["distribution-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-operation"] }),
      ]);
      toast.success("Cliente adicionado com sucesso!");
    },
    onError: (e: unknown) => {
      console.error("[clientes] insert error", e);
      toast.error("Erro ao salvar cliente: " + errorMessage(e));
    },
  });

  const createProject = useMutation({
    mutationFn: async (data: typeof projectForm) => {
      if (!user?.id || !pendingClient) throw new Error("Cliente não selecionado.");
      const today = new Date().toISOString().slice(0, 10);
      const assignedDesignerId = isAdmin && data.projetista_id ? data.projetista_id : null;
      const payload: TablesInsert<"projetos"> = {
        cliente_id: pendingClient.id,
        projetista_id: assignedDesignerId,
        status: "PRONTO" as const,
        status_venda: "EM_NEGOCIACAO" as const,
        data_inicio: data.data_inicio || today,
        prazo_termino: data.prazo_termino || data.data_inicio || today,
        valor_venda: data.valor_venda ? parseFloat(data.valor_venda) : null,
        observacoes: projectObservations(data.observacoes, data.fonte, data.nome_arquiteto),
        nome: data.nome.trim() || null,
        fonte: data.fonte || null,
        rt_arquiteto:
          data.fonte === "ARQUITETO"
            ? data.rt_arquiteto
              ? parseFloat(data.rt_arquiteto)
              : null
            : null,
      };
      console.log("[projetos] inserting", payload);
      const { error } = await supabase.from("projetos").insert([payload]);
      if (error) {
        console.error("[projetos] insert error", error);
        throw error;
      }
      if (assignedDesignerId) {
        const { error: clientError } = await supabase
          .from("clientes")
          .update({ projetista_id: assignedDesignerId })
          .eq("id", pendingClient.id);
        if (clientError) throw clientError;
      }
      return { assigned: Boolean(assignedDesignerId) };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-projects"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      queryClient.invalidateQueries({ queryKey: ["admin-operation"] });
      toast.success(
        res.assigned
          ? "Atendimento cadastrado e enviado para aceite da projetista!"
          : "Atendimento cadastrado e enviado ao superusuário para distribuição!",
      );
      setProjectForm({
        nome: "",
        fonte: "",
        nome_arquiteto: "",
        rt_arquiteto: "",
        valor_venda: "",
        data_inicio: new Date().toISOString().slice(0, 10),
        prazo_termino: "",
        observacoes: "",
        projetista_id: "",
      });
      setPendingClient(null);
      setIsProjectDialogOpen(false);
    },
    onError: (e: unknown) => toast.error("Erro ao criar projeto: " + errorMessage(e)),
  });

  const assignProjetista = useMutation({
    mutationFn: async ({
      clienteId,
      projetistaId,
    }: {
      clienteId: string;
      projetistaId: string;
    }) => {
      const { error } = await supabase
        .from("clientes")
        .update({ projetista_id: projetistaId })
        .eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      toast.success("Atendimento atualizado!");
    },
    onError: (e: unknown) => toast.error("Erro ao atribuir: " + errorMessage(e)),
  });

  const releaseAssignment = useMutation({
    mutationFn: async (clienteId: string) => {
      if (!isAdmin) throw new Error("Apenas administradores podem liberar atribuições.");
      const { error } = await supabase
        .from("clientes")
        .update({ projetista_id: null })
        .eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      toast.success("Atribuição liberada. Cliente em aberto novamente.");
    },
    onError: (e: unknown) => toast.error("Erro ao liberar: " + errorMessage(e)),
  });

  const handleSaveClient = () => {
    console.log("[clientes] handleSaveClient clicked", { clientForm, user });
    if (!clientForm.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!clientForm.telefone.trim()) {
      toast.error("Informe o WhatsApp do cliente.");
      return;
    }
    if (!clientForm.fonte) {
      toast.error("Informe de onde veio o cliente.");
      return;
    }
    if (clientForm.fonte === "ARQUITETO" && !clientForm.nome_arquiteto.trim()) {
      toast.error("Informe o nome do arquiteto.");
      return;
    }
    if (!user?.id) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }
    createClient.mutate(clientForm);
  };

  const handleSaveProject = () => {
    if (!user?.id) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }
    if (!pendingClient) {
      toast.error("Selecione um cliente.");
      return;
    }
    createProject.mutate(projectForm);
  };

  const visibleClientes = isAdmin
    ? clientes
    : clientes?.filter((cliente) => cliente.projetista_id === user?.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="workspace-eyebrow">Entrada da operação</p>
          <h1 className="workspace-title mt-2">Clientes e novos atendimentos</h1>
          <p className="mt-2 text-sm text-slate-500">
            {isAdmin
              ? "Cadastre o cliente, registre a origem e encaminhe o primeiro projeto."
              : "Sua carteira mostra apenas os clientes vinculados aos seus projetos."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isAdmin && user?.id && (
            <ClientSpreadsheetImport
              userId={user.id}
              onImported={() => {
                queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
                queryClient.invalidateQueries({ queryKey: ["projects"] });
              }}
            />
          )}
          <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar cliente</DialogTitle>
                <DialogDescription>
                  Informe os dados básicos e de onde veio este cliente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="nome">
                    Nome Completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nome"
                    value={clientForm.nome}
                    onChange={(e) => setClientForm({ ...clientForm, nome: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tel">
                    Telefone / WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tel"
                    placeholder="(00) 00000-0000"
                    value={clientForm.telefone}
                    onChange={(e) => setClientForm({ ...clientForm, telefone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Origem do cliente</Label>
                  <Select
                    value={clientForm.fonte}
                    onValueChange={(fonte) =>
                      setClientForm({
                        ...clientForm,
                        fonte,
                        nome_arquiteto: fonte === "ARQUITETO" ? clientForm.nome_arquiteto : "",
                        rt_arquiteto: fonte === "ARQUITETO" ? clientForm.rt_arquiteto : "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {FONTES.map((fonte) => (
                        <SelectItem key={fonte.value} value={fonte.value}>
                          {fonte.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {clientForm.fonte === "ARQUITETO" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="client-architect">Nome do arquiteto</Label>
                      <Input
                        id="client-architect"
                        placeholder="Ex: João Silva"
                        value={clientForm.nome_arquiteto}
                        onChange={(e) =>
                          setClientForm({ ...clientForm, nome_arquiteto: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="client-commission">% de comissão</Label>
                      <Input
                        id="client-commission"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Ex: 10"
                        value={clientForm.rt_arquiteto}
                        onChange={(e) =>
                          setClientForm({ ...clientForm, rt_arquiteto: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleSaveClient} disabled={createClient.isPending}>
                  {createClient.isPending ? "Salvando cliente..." : "Salvar cliente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Project dialog opened from a client's row action. */}
      <Dialog
        open={isProjectDialogOpen}
        onOpenChange={(open) => {
          setIsProjectDialogOpen(open);
          if (!open) setPendingClient(null);
        }}
      >
        <DialogContent className="gap-3 p-4 sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Dados do Projeto</DialogTitle>
            <DialogDescription>
              {pendingClient ? `Cliente: ${pendingClient.nome}` : "Selecione um cliente."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="nome-projeto">Nome do Projeto</Label>
              <Input
                id="nome-projeto"
                placeholder="Ex: Cozinha Planejada"
                value={projectForm.nome}
                onChange={(e) => setProjectForm({ ...projectForm, nome: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Fonte</Label>
              <Select
                value={projectForm.fonte}
                onValueChange={(v) => setProjectForm({ ...projectForm, fonte: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Como chegou esse cliente? (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {FONTES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {projectForm.fonte === "ARQUITETO" && (
              <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="nome-arquiteto">Nome do Arquiteto / Parceiro</Label>
                  <Input
                    id="nome-arquiteto"
                    placeholder="Ex: João Silva"
                    value={projectForm.nome_arquiteto}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, nome_arquiteto: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rt-arquiteto">% RT / Comissão</Label>
                  <Input
                    id="rt-arquiteto"
                    type="number"
                    placeholder="Ex: 10"
                    value={projectForm.rt_arquiteto}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, rt_arquiteto: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            {isAdmin && (
              <div className="grid gap-2 rounded-xl border border-[#cbb27a]/30 bg-[#fbf7eb] p-3 sm:col-span-2">
                <Label>Projetista responsável</Label>
                <Select
                  value={projectForm.projetista_id}
                  onValueChange={(value) =>
                    setProjectForm({ ...projectForm, projetista_id: value })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Deixar para distribuir depois" />
                  </SelectTrigger>
                  <SelectContent>
                    {projetistas?.map((projetista) => (
                      <SelectItem key={projetista.id} value={projetista.id}>
                        {projetista.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#7a6740]">
                  Se não escolher agora, o projeto ficará na Central de Distribuição.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="data-inicio">Data de início</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={projectForm.data_inicio}
                  onChange={(e) => setProjectForm({ ...projectForm, data_inicio: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prazo">Prazo de término</Label>
                <Input
                  id="prazo"
                  type="date"
                  value={projectForm.prazo_termino}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, prazo_termino: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="valor">Valor estimado (R$) — opcional</Label>
              <Input
                id="valor"
                type="number"
                value={projectForm.valor_venda}
                onChange={(e) => setProjectForm({ ...projectForm, valor_venda: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={2}
                value={projectForm.observacoes}
                onChange={(e) => setProjectForm({ ...projectForm, observacoes: e.target.value })}
              />
            </div>
            {!isAdmin && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 sm:col-span-2">
                Após o cadastro, o superusuário escolherá a projetista e confirmará o prazo.
              </div>
            )}
          </div>
          <DialogFooter className="sticky -bottom-4 z-10 -mx-4 border-t bg-background px-4 pb-0 pt-3">
            <Button onClick={handleSaveProject} disabled={createProject.isPending}>
              {createProject.isPending ? "Salvando atendimento..." : "Salvar atendimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="workspace-card border-0 shadow-none">
        <CardHeader>
          <CardTitle>{isAdmin ? "Base de clientes" : "Minha carteira de clientes"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cadastro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Projeto e prazo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={7} className="h-12 bg-muted/20" />
                  </TableRow>
                ))
              ) : visibleClientes && visibleClientes.length > 0 ? (
                visibleClientes.map((c) => {
                  const isMine = c.projetista?.id && c.projetista.id === user?.id;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>{c.telefone || "-"}</span>
                          <span>{c.email || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {c.endereco || "-"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const latestProject = [...(c.projetos ?? [])].sort(
                            (first, second) =>
                              new Date(second.created_at ?? 0).getTime() -
                              new Date(first.created_at ?? 0).getTime(),
                          )[0];
                          if (!latestProject) {
                            return <span className="text-xs text-slate-400">Sem projeto</span>;
                          }
                          const statusLabels: Record<string, string> = {
                            PRONTO: "Pronto",
                            EM_EXECUCAO: "Em execução",
                            PAUSADO: "Pausado",
                            ATRASADO: "Atrasado",
                            FINALIZADO: "Finalizado",
                            EM_ACOMPANHAMENTO: "Em acompanhamento",
                          };
                          return (
                            <div className="min-w-[150px]">
                              <p className="text-sm font-medium text-slate-800">
                                {latestProject.nome || "Projeto sem nome"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Prazo:{" "}
                                {new Date(
                                  `${latestProject.prazo_termino}T12:00:00`,
                                ).toLocaleDateString("pt-BR")}
                              </p>
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                {statusLabels[latestProject.status] ?? latestProject.status}
                              </Badge>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const assigned = !!c.projetista_id;

                          // Caso 1: Cliente em aberto (sem projetista)
                          if (!assigned) {
                            if (isAdmin) {
                              // Admin pode atribuir qualquer projetista
                              return (
                                <Select
                                  value=""
                                  onValueChange={(v) =>
                                    assignProjetista.mutate({ clienteId: c.id, projetistaId: v })
                                  }
                                  disabled={assignProjetista.isPending}
                                >
                                  <SelectTrigger className="h-8 w-[200px]">
                                    <SelectValue placeholder="Em aberto — atribuir" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {projetistas?.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            // Projetista: cliente sem dono — apenas indicador
                            return (
                              <Badge variant="outline" className="h-8 px-3 text-muted-foreground">
                                Em aberto
                              </Badge>
                            );
                          }

                          // Caso 2: Cliente já atribuído
                          const badge = (
                            <Badge
                              className={cn(
                                "gap-1",
                                isMine
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100",
                              )}
                            >
                              {isMine && <Star className="h-3 w-3 fill-current" />}
                              {isMine ? `Eu (${c.projetista?.nome})` : c.projetista?.nome}
                            </Badge>
                          );

                          if (!isAdmin) {
                            // Projetista NÃO pode alterar — só visualiza
                            return badge;
                          }

                          // Admin: badge + transferir + liberar
                          return (
                            <div className="flex items-center gap-2">
                              {badge}
                              <Select
                                value={c.projetista_id ?? ""}
                                onValueChange={(v) =>
                                  assignProjetista.mutate({ clienteId: c.id, projetistaId: v })
                                }
                                disabled={assignProjetista.isPending}
                              >
                                <SelectTrigger className="h-7 w-[150px] text-xs">
                                  <SelectValue placeholder="Transferir" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projetistas
                                    ?.filter((p) => p.id !== c.projetista_id)
                                    .map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.nome}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2"
                                onClick={() => releaseAssignment.mutate(c.id)}
                                disabled={releaseAssignment.isPending}
                                title="Liberar atribuição"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPendingClient({ id: c.id, nome: c.nome });
                            setIsProjectDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Novo Projeto
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
