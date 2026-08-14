import { strFromU8, unzipSync } from "fflate";

type CellValue = string | number | boolean | null;

type ImportField =
  | "nome"
  | "telefone"
  | "email"
  | "endereco"
  | "created_at"
  | "nome_projeto"
  | "data_inicio"
  | "prazo_termino"
  | "status"
  | "status_venda"
  | "valor_venda"
  | "fonte"
  | "nome_arquiteto"
  | "observacoes";

export interface ClientImportRow {
  row_number: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  created_at: string | null;
  has_project: boolean;
  nome_projeto: string | null;
  data_inicio: string | null;
  prazo_termino: string | null;
  status: "PRONTO" | "EM_EXECUCAO" | "PAUSADO" | "ATRASADO" | "FINALIZADO" | "EM_ACOMPANHAMENTO";
  status_venda: "EM_NEGOCIACAO" | "VENDEU" | "NAO_VENDEU";
  valor_venda: number | null;
  fonte: "ARQUITETO" | "VENDA_DIRETA" | "INDICACAO" | null;
  nome_arquiteto: string | null;
  observacoes: string | null;
  warnings: string[];
}

export interface RejectedImportRow {
  row_number: number;
  reason: string;
}

export interface ClientImportPreview {
  file_name: string;
  sheet_name: string;
  rows: ClientImportRow[];
  rejected: RejectedImportRow[];
  detected_fields: string[];
}

const FIELD_LABELS: Record<ImportField, string> = {
  nome: "Cliente",
  telefone: "Telefone",
  email: "E-mail",
  endereco: "Endereço",
  created_at: "Data de cadastro",
  nome_projeto: "Projeto",
  data_inicio: "Início",
  prazo_termino: "Prazo",
  status: "Status do projeto",
  status_venda: "Status da venda",
  valor_venda: "Valor",
  fonte: "Origem",
  nome_arquiteto: "Arquiteto ou indicação",
  observacoes: "Observações",
};

const FIELD_ALIASES: Record<ImportField, string[]> = {
  nome: ["nome do cliente", "nome cliente", "nome completo", "cliente", "nome", "razao social"],
  telefone: ["telefone cliente", "telefone", "whatsapp", "whats app", "celular", "fone", "contato"],
  email: ["email cliente", "e mail cliente", "email", "e mail", "correio eletronico"],
  endereco: ["endereco completo", "endereco", "logradouro", "cidade bairro", "localizacao"],
  created_at: [
    "data de cadastro",
    "data cadastro",
    "cadastrado em",
    "cadastro cliente",
    "data do cliente",
  ],
  nome_projeto: ["nome do projeto", "nome projeto", "ambiente", "projeto", "servico"],
  data_inicio: ["data de inicio", "inicio do projeto", "inicio projeto", "data inicio", "inicio"],
  prazo_termino: [
    "prazo de termino",
    "prazo final",
    "data de entrega",
    "previsao de entrega",
    "vencimento",
    "prazo",
    "entrega",
  ],
  status: ["status do projeto", "situacao do projeto", "andamento", "etapa", "status projeto"],
  status_venda: ["status da venda", "situacao da venda", "resultado da venda", "venda"],
  valor_venda: [
    "valor da venda",
    "valor do projeto",
    "valor estimado",
    "orcamento",
    "valor venda",
    "valor",
  ],
  fonte: ["origem do cliente", "como chegou", "canal de entrada", "fonte", "origem"],
  nome_arquiteto: [
    "nome do arquiteto",
    "arquiteto parceiro",
    "quem indicou",
    "indicacao por",
    "arquiteto",
    "indicador",
    "parceiro",
  ],
  observacoes: ["observacoes", "observacao", "notas", "comentarios", "descricao", "detalhes"],
};

const FIELD_ORDER: ImportField[] = [
  "nome_projeto",
  "nome_arquiteto",
  "status_venda",
  "valor_venda",
  "prazo_termino",
  "data_inicio",
  "created_at",
  "telefone",
  "endereco",
  "observacoes",
  "fonte",
  "status",
  "email",
  "nome",
];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function valueText(value: CellValue | undefined) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function mapHeaders(row: CellValue[]) {
  const mapped = new Map<ImportField, number>();

  row.forEach((rawHeader, index) => {
    const header = normalizeText(rawHeader);
    if (!header) return;

    for (const field of FIELD_ORDER) {
      if (mapped.has(field)) continue;
      const aliases = FIELD_ALIASES[field].map(normalizeText);
      const exact = aliases.some((alias) => alias === header);
      const partial = aliases.some(
        (alias) => alias.length >= 5 && (header.includes(alias) || alias.includes(header)),
      );

      if (exact || partial) {
        mapped.set(field, index);
        break;
      }
    }
  });

  return mapped;
}

function findHeader(matrix: CellValue[][]) {
  let best: { rowIndex: number; fields: Map<ImportField, number>; score: number } | null = null;

  const candidates = matrix.slice(0, 12);
  for (let rowIndex = 0; rowIndex < candidates.length; rowIndex += 1) {
    const row = candidates[rowIndex];
    const fields = mapHeaders(row);
    if (!fields.has("nome")) continue;
    const score = fields.size + (fields.has("telefone") ? 2 : 0) + (fields.has("email") ? 2 : 0);
    if (!best || score > best.score) best = { rowIndex, fields, score };
  }

  if (!best) {
    throw new Error(
      "Não encontrei uma coluna de cliente. Use um cabeçalho como “Cliente” ou “Nome do cliente”.",
    );
  }

  return best;
}

function excelSerialToIso(value: number) {
  if (!Number.isFinite(value) || value < 1 || value > 100000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000;
  return new Date(utc).toISOString().slice(0, 10);
}

function parseDate(value: CellValue | undefined) {
  if (typeof value === "number") return excelSerialToIso(value);
  const raw = valueText(value);
  if (!raw) return null;
  if (/^\d+(?:[.,]\d+)?$/.test(raw)) return excelSerialToIso(Number(raw.replace(",", ".")));

  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const [, year, month, day] = iso;
    return validIsoDate(Number(year), Number(month), Number(day));
  }

  const br = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (br) {
    const [, day, month, rawYear] = br;
    const year = Number(rawYear) < 100 ? 2000 + Number(rawYear) : Number(rawYear);
    return validIsoDate(year, Number(month), Number(day));
  }

  return null;
}

function validIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function dateToTimestamp(date: string | null) {
  return date ? `${date}T12:00:00.000Z` : null;
}

function parseMoney(value: CellValue | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let raw = valueText(value).replace(/[^\d,.-]/g, "");
  if (!raw) return null;

  if (raw.includes(",") && raw.includes(".")) {
    raw =
      raw.lastIndexOf(",") > raw.lastIndexOf(".")
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapProjectStatus(value: CellValue | undefined): ClientImportRow["status"] {
  const normalized = normalizeText(value);
  if (/final|conclu|entreg/.test(normalized)) return "FINALIZADO";
  if (/atras|vencid/.test(normalized)) return "ATRASADO";
  if (/paus|aguard/.test(normalized)) return "PAUSADO";
  if (/acompanha/.test(normalized)) return "EM_ACOMPANHAMENTO";
  if (/execu|andamento|produ/.test(normalized)) return "EM_EXECUCAO";
  return "PRONTO";
}

function mapSaleStatus(value: CellValue | undefined): ClientImportRow["status_venda"] {
  const normalized = normalizeText(value);
  if (/nao vendeu|perdid|cancelad|recusad/.test(normalized)) return "NAO_VENDEU";
  if (/vendeu|vendid|fechad|aprovad/.test(normalized)) return "VENDEU";
  return "EM_NEGOCIACAO";
}

function mapSource(value: CellValue | undefined): ClientImportRow["fonte"] {
  const normalized = normalizeText(value);
  if (/arquit/.test(normalized)) return "ARQUITETO";
  if (/indica|parceir|recomenda/.test(normalized)) return "INDICACAO";
  if (/diret|loja|espontan/.test(normalized)) return "VENDA_DIRETA";
  return null;
}

function normalizeEmail(value: CellValue | undefined) {
  const email = valueText(value).toLowerCase();
  return email || null;
}

function normalizePhone(value: CellValue | undefined) {
  const phone = valueText(value);
  return phone || null;
}

function duplicateKey(email: string | null, phone: string | null) {
  if (email) return `email:${email}`;
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 8 ? `phone:${digits}` : null;
}

function parseRows(
  matrix: CellValue[][],
  fileName: string,
  sheetName: string,
): ClientImportPreview {
  const { rowIndex, fields } = findHeader(matrix);
  const rows: ClientImportRow[] = [];
  const rejected: RejectedImportRow[] = [];
  const seen = new Set<string>();
  const fieldValue = (row: CellValue[], field: ImportField) => {
    const index = fields.get(field);
    return index === undefined ? undefined : row[index];
  };

  for (let index = rowIndex + 1; index < matrix.length; index += 1) {
    const sourceRow = matrix[index];
    if (!sourceRow || sourceRow.every((cell) => !valueText(cell))) continue;
    const rowNumber = index + 1;
    const nome = valueText(fieldValue(sourceRow, "nome"));

    if (!nome) {
      rejected.push({ row_number: rowNumber, reason: "Nome do cliente não informado" });
      continue;
    }

    const telefone = normalizePhone(fieldValue(sourceRow, "telefone"));
    const email = normalizeEmail(fieldValue(sourceRow, "email"));
    const key = duplicateKey(email, telefone);
    if (key && seen.has(key)) {
      rejected.push({
        row_number: rowNumber,
        reason: "Cliente repetido dentro da própria planilha",
      });
      continue;
    }
    if (key) seen.add(key);

    const createdDate = parseDate(fieldValue(sourceRow, "created_at"));
    const rawCreatedDate = valueText(fieldValue(sourceRow, "created_at"));
    const parsedStart = parseDate(fieldValue(sourceRow, "data_inicio"));
    const rawStart = valueText(fieldValue(sourceRow, "data_inicio"));
    const parsedDeadline = parseDate(fieldValue(sourceRow, "prazo_termino"));
    const rawDeadline = valueText(fieldValue(sourceRow, "prazo_termino"));
    const projectFields: ImportField[] = [
      "nome_projeto",
      "data_inicio",
      "prazo_termino",
      "status",
      "status_venda",
      "valor_venda",
      "fonte",
      "nome_arquiteto",
    ];
    const hasProject = projectFields.some((field) => valueText(fieldValue(sourceRow, field)));
    const warnings: string[] = [];

    if (!telefone && !email) warnings.push("Sem telefone e e-mail");
    if (rawCreatedDate && !createdDate)
      warnings.push("Data de cadastro inválida; será usada a data da importação");
    if (rawStart && !parsedStart) warnings.push("Data de início inválida");
    if (rawDeadline && !parsedDeadline) warnings.push("Prazo inválido");

    const dataInicio = parsedStart ?? (hasProject ? createdDate : null);
    rows.push({
      row_number: rowNumber,
      nome,
      telefone,
      email,
      endereco: valueText(fieldValue(sourceRow, "endereco")) || null,
      created_at: dateToTimestamp(createdDate),
      has_project: hasProject,
      nome_projeto: valueText(fieldValue(sourceRow, "nome_projeto")) || null,
      data_inicio: dataInicio,
      prazo_termino: parsedDeadline ?? dataInicio,
      status: mapProjectStatus(fieldValue(sourceRow, "status")),
      status_venda: mapSaleStatus(fieldValue(sourceRow, "status_venda")),
      valor_venda: parseMoney(fieldValue(sourceRow, "valor_venda")),
      fonte: mapSource(fieldValue(sourceRow, "fonte")),
      nome_arquiteto: valueText(fieldValue(sourceRow, "nome_arquiteto")) || null,
      observacoes: valueText(fieldValue(sourceRow, "observacoes")) || null,
      warnings,
    });
  }

  if (rows.length > 2000) {
    throw new Error(
      "A planilha tem mais de 2.000 clientes válidos. Divida-a em dois arquivos para importar.",
    );
  }
  if (!rows.length) {
    throw new Error("Nenhum cliente válido foi encontrado na planilha.");
  }

  return {
    file_name: fileName,
    sheet_name: sheetName,
    rows,
    rejected,
    detected_fields: Array.from(fields.keys()).map((field) => FIELD_LABELS[field]),
  };
}

function decodeCsv(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("\uFFFD")) return utf8.replace(/^\uFEFF/, "");
  return new TextDecoder("windows-1252").decode(bytes).replace(/^\uFEFF/, "");
}

function delimiterScore(text: string, delimiter: string) {
  let score = 0;
  let quoted = false;
  for (const character of text.slice(0, 8000)) {
    if (character === '"') quoted = !quoted;
    if (!quoted && character === delimiter) score += 1;
  }
  return score;
}

function parseCsv(text: string): CellValue[][] {
  const delimiters = [";", ",", "\t"];
  const delimiter = delimiters.sort((a, b) => delimiterScore(text, b) - delimiterScore(text, a))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function xmlDocument(content: Uint8Array, label: string) {
  const document = new DOMParser().parseFromString(strFromU8(content), "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    throw new Error(`Não foi possível ler ${label} no arquivo Excel.`);
  }
  return document;
}

function normalizeZipPath(target: string) {
  const raw = target.replace(/\\/g, "/");
  const full = raw.startsWith("/") ? raw.slice(1) : `xl/${raw}`;
  const parts: string[] = [];
  for (const part of full.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}

function parseXlsx(buffer: ArrayBuffer) {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error("O arquivo Excel está corrompido ou protegido por senha.");
  }

  const workbookBytes = archive["xl/workbook.xml"];
  const relationsBytes = archive["xl/_rels/workbook.xml.rels"];
  if (!workbookBytes || !relationsBytes)
    throw new Error("Não encontrei uma planilha válida dentro do arquivo Excel.");

  const workbook = xmlDocument(workbookBytes, "a estrutura da planilha");
  const relations = xmlDocument(relationsBytes, "as referências da planilha");
  const firstSheet = workbook.getElementsByTagNameNS("*", "sheet")[0];
  if (!firstSheet) throw new Error("O arquivo Excel não possui nenhuma aba.");
  const relationshipId =
    firstSheet.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "id",
    ) ?? firstSheet.getAttribute("r:id");
  const relationship = Array.from(relations.getElementsByTagNameNS("*", "Relationship")).find(
    (item) => item.getAttribute("Id") === relationshipId,
  );
  const target = relationship?.getAttribute("Target");
  if (!target) throw new Error("Não consegui localizar a primeira aba do arquivo Excel.");
  const worksheetBytes = archive[normalizeZipPath(target)];
  if (!worksheetBytes) throw new Error("A primeira aba do arquivo Excel não pôde ser lida.");

  const sharedBytes = archive["xl/sharedStrings.xml"];
  const sharedStrings = sharedBytes
    ? Array.from(
        xmlDocument(sharedBytes, "os textos compartilhados").getElementsByTagNameNS("*", "si"),
      ).map((item) =>
        Array.from(item.getElementsByTagNameNS("*", "t"))
          .map((text) => text.textContent ?? "")
          .join(""),
      )
    : [];
  const worksheet = xmlDocument(worksheetBytes, "os dados da planilha");
  const matrix: CellValue[][] = [];

  for (const rowNode of Array.from(worksheet.getElementsByTagNameNS("*", "row"))) {
    const rowNumber = Number(rowNode.getAttribute("r")) || matrix.length + 1;
    const row: CellValue[] = [];
    for (const cell of Array.from(rowNode.getElementsByTagNameNS("*", "c"))) {
      const reference = cell.getAttribute("r") ?? "A1";
      const type = cell.getAttribute("t");
      const raw = cell.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
      let value: CellValue = raw;
      if (type === "s") value = sharedStrings[Number(raw)] ?? "";
      else if (type === "inlineStr") {
        value = Array.from(cell.getElementsByTagNameNS("*", "t"))
          .map((text) => text.textContent ?? "")
          .join("");
      } else if (type === "b") value = raw === "1";
      else if (!type || type === "n")
        value = raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
      row[columnIndex(reference)] = value;
    }
    matrix[rowNumber - 1] = row;
  }

  return { matrix, sheetName: firstSheet.getAttribute("name") || "Primeira aba" };
}

export async function parseClientSpreadsheet(file: File): Promise<ClientImportPreview> {
  if (!file.size) throw new Error("O arquivo selecionado está vazio.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A planilha deve ter no máximo 5 MB.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Formato não aceito. Envie um arquivo Excel (.xlsx) ou CSV (.csv).");
  }

  const buffer = await file.arrayBuffer();
  if (extension === "csv") {
    return parseRows(parseCsv(decodeCsv(buffer)), file.name, "Arquivo CSV");
  }

  const { matrix, sheetName } = parseXlsx(buffer);
  return parseRows(matrix, file.name, sheetName);
}

export function formatImportDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "—";
}
