import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  formatImportDate,
  parseClientSpreadsheet,
  type ClientImportPreview,
} from "@/lib/client-import";
import { cn } from "@/lib/utils";

interface ClientSpreadsheetImportProps {
  userId: string;
  onImported: () => void;
}

interface ImportResult {
  insertedClients: number;
  insertedProjects: number;
  skippedDuplicates: number;
}

function readImportResult(value: Json): ImportResult {
  const result = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    insertedClients: Number(result.inserted_clients ?? 0),
    insertedProjects: Number(result.inserted_projects ?? 0),
    skippedDuplicates: Number(result.skipped_duplicates ?? 0),
  };
}

function downloadTemplate() {
  const header = [
    "Cliente",
    "Telefone",
    "Email",
    "Endereço",
    "Data de cadastro",
    "Projeto",
    "Data de início",
    "Prazo",
    "Status do projeto",
    "Status da venda",
    "Valor",
    "Origem",
    "Arquiteto ou indicação",
    "Observações",
  ].join(";");
  const example = [
    "Maria da Silva",
    "(65) 99999-9999",
    "maria@email.com",
    "Av. Exemplo, 100",
    "15/08/2025",
    "Cozinha planejada",
    "20/08/2025",
    "15/09/2025",
    "Em execução",
    "Vendeu",
    "35000,00",
    "Arquiteto",
    "João Arquitetura",
    "Cliente antigo importado",
  ].join(";");
  const blob = new Blob([`\uFEFF${header}\r\n${example}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-clientes-df-moveis.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ClientSpreadsheetImport({ userId, onImported }: ClientSpreadsheetImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ClientImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setPreview(null);
    setParseError(null);
    setIsParsing(false);
    setIsDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParseError(null);
    setPreview(null);
    setIsParsing(true);
    try {
      setPreview(await parseClientSpreadsheet(file));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    } finally {
      setIsParsing(false);
    }
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Selecione uma planilha primeiro.");
      const rows = preview.rows.map(
        ({ row_number: _rowNumber, warnings: _warnings, ...row }) => row,
      );
      const { data, error } = await supabase.rpc("import_client_spreadsheet", {
        p_importing_user_id: userId,
        p_rows: rows as unknown as Json,
      });
      if (error) throw error;
      return readImportResult(data);
    },
    onSuccess: (result) => {
      const projectText = result.insertedProjects
        ? ` e ${result.insertedProjects} projeto${result.insertedProjects === 1 ? "" : "s"}`
        : "";
      toast.success(
        `${result.insertedClients} cliente${result.insertedClients === 1 ? "" : "s"}${projectText} ${result.insertedClients === 1 && !result.insertedProjects ? "importado" : "importados"}.`,
      );
      if (result.skippedDuplicates) {
        toast.info(
          `${result.skippedDuplicates} duplicado${result.skippedDuplicates === 1 ? "" : "s"} já existente${result.skippedDuplicates === 1 ? "" : "s"} ${result.skippedDuplicates === 1 ? "foi ignorado" : "foram ignorados"}.`,
        );
      }
      onImported();
      setOpen(false);
      reset();
    },
    onError: (error: unknown) => {
      toast.error(
        `Não foi possível importar: ${error instanceof Error ? error.message : "erro desconhecido"}`,
      );
    },
  });

  const projectCount = preview?.rows.filter((row) => row.has_project).length ?? 0;
  const warningCount = preview?.rows.filter((row) => row.warnings.length).length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen && !importMutation.isPending) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="border-[#cbb27a]/60 bg-white">
          <FileSpreadsheet className="mr-2 h-4 w-4 text-[#9a7a33]" />
          Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[920px]">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4ead0] text-[#8a6926]">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl">Importar minha carteira de clientes</DialogTitle>
          <DialogDescription className="max-w-2xl">
            Envie Excel ou CSV. O sistema reconhece as colunas, organiza os clientes e aproveita
            datas, projetos, prazos, valores e origem quando essas informações existirem.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-3 py-1">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                void handleFile(event.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex min-h-56 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition",
                isDragging
                  ? "border-[#b18b39] bg-[#fbf6e9]"
                  : "border-slate-200 bg-slate-50/70 hover:border-[#cbb27a] hover:bg-[#fdfaf2]",
              )}
            >
              {isParsing ? (
                <>
                  <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#a07d32]" />
                  <span className="font-semibold text-slate-800">
                    Lendo e organizando sua planilha…
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="mb-4 h-10 w-10 text-[#a07d32]" />
                  <span className="font-semibold text-slate-800">
                    Clique ou arraste a planilha aqui
                  </span>
                  <span className="mt-2 text-sm text-slate-500">
                    Excel (.xlsx) ou CSV, até 5 MB e 2.000 clientes
                  </span>
                </>
              )}
            </button>

            {parseError && (
              <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Não sabe como organizar as colunas?
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Baixe o modelo, mas você também pode usar sua planilha atual.
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar modelo
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-emerald-950">{preview.file_name}</p>
                  <p className="text-xs text-emerald-700">Aba analisada: {preview.sheet_name}</p>
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                <X className="mr-2 h-4 w-4" />
                Trocar arquivo
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryCard
                label="Prontos para importar"
                value={preview.rows.length}
                tone="emerald"
              />
              <SummaryCard label="Com projeto ou prazo" value={projectCount} tone="gold" />
              <SummaryCard label="Com algum aviso" value={warningCount} tone="slate" />
              <SummaryCard label="Linhas ignoradas" value={preview.rejected.length} tone="red" />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Colunas reconhecidas
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.detected_fields.map((field) => (
                  <Badge key={field} variant="outline" className="bg-white text-slate-700">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead>Projeto e prazo</TableHead>
                    <TableHead>Leitura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 10).map((row) => (
                    <TableRow key={row.row_number}>
                      <TableCell>
                        <p className="font-medium text-slate-900">{row.nome}</p>
                        <p className="text-xs text-slate-400">Linha {row.row_number}</p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <p>{row.telefone || "—"}</p>
                        <p>{row.email || "—"}</p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {formatImportDate(row.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {row.has_project ? (
                          <>
                            <p className="font-medium text-slate-800">
                              {row.nome_projeto || "Projeto sem nome"}
                            </p>
                            <p>Prazo: {formatImportDate(row.prazo_termino)}</p>
                          </>
                        ) : (
                          "Somente cliente"
                        )}
                      </TableCell>
                      <TableCell>
                        {row.warnings.length ? (
                          <span className="text-xs text-amber-700">{row.warnings.join(" · ")}</span>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            Completo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.rows.length > 10 && (
                <div className="border-t bg-slate-50 px-4 py-2 text-center text-xs text-slate-500">
                  Prévia das 10 primeiras linhas. Outras {preview.rows.length - 10} também serão
                  importadas.
                </div>
              )}
            </div>

            {(preview.rejected.length > 0 || warningCount > 0) && (
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Linhas sem nome ou repetidas na planilha serão ignoradas. Datas inválidas usarão a
                  data da importação. Você pode continuar e revisar os clientes depois.
                </p>
              </div>
            )}

            <p className="text-xs leading-5 text-slate-500">
              Clientes já existentes na sua carteira, identificados pelo mesmo e-mail ou telefone,
              não serão duplicados. Projetos encontrados na planilha ficarão vinculados à sua
              carteira e poderão ser transferidos pelo superusuário.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={importMutation.isPending}
          >
            Cancelar
          </Button>
          {preview && (
            <Button
              type="button"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || !preview.rows.length}
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              {importMutation.isPending
                ? "Importando…"
                : `Importar ${preview.rows.length} clientes`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "gold" | "slate" | "red";
}) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    gold: "border-[#dfca99] bg-[#fbf6e9] text-[#72561d]",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div className={cn("rounded-xl border p-3", tones[tone])}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs">{label}</p>
    </div>
  );
}
