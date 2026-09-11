import { BudgetItem, BudgetSettings, ProductItem } from './types';

// Constante padrão de Marcenaria no Brasil: Chapa MDF (2,75m x 1,85m = 5,0875 m² ≈ 5,09 m²)
export const CHAPA_AREA_M2 = 5.09;

// Arredondamento contábil preciso para 2 casas decimais
export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// Normalização de código para comparação consistente
export function normalizeCode(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

// Normalização de texto removendo acentos e espaços
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// Detecta se o item é chapa de MDF ou MDP
export function isChapa(code: string, description: string): boolean {
  const normCode = normalizeCode(code);
  const normDesc = normalizeText(description);
  return (
    normCode.includes('chapa') ||
    normCode.endsWith('.mdf') ||
    normCode.endsWith('.mdp') ||
    normDesc.includes('mdf') ||
    normDesc.includes('mdp') ||
    normDesc.includes('chapa')
  );
}

// Detecta se o item é Fita de Borda
export function isFitaBorda(code: string, description: string): boolean {
  const text = normalizeText(`${code} ${description}`);
  return text.includes('fita') && (text.includes('borda') || text.includes('pvc'));
}

// Extrai metragem do rolo de fita a partir da descrição (ex: "Rolo 20m", "50M")
export function extractFitaMetros(description: string): number | null {
  const match = description.match(/(\d+)\s*(?:m|metros|metro|mt)\b/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (val > 0 && val <= 500) return val;
  }
  return null;
}

// Calcula o fator multiplicador dos acréscimos globais
export function calculateAdditionsFactor(settings: BudgetSettings): number {
  const frete = Number(settings.frete) || 0;
  const montagem = Number(settings.montagem) || 0;
  const comissaoVendas = Number(settings.comissao_vendas) || 0;
  const comissaoExecutivo = Number(settings.comissao_executivo) || 0;
  const outrosTotal = (settings.outros || []).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

  const totalAcrescimosPercentual = frete + montagem + comissaoVendas + comissaoExecutivo + outrosTotal;
  return 1 + totalAcrescimosPercentual / 100;
}

// Localiza o produto no banco cadastrado pelo código principal ou subcódigos
export function matchProduct(
  code: string,
  description: string,
  database: ProductItem[]
): { product: ProductItem | undefined; isSubcodeMatch: boolean } {
  const cleanCode = normalizeCode(code);
  if (!cleanCode) return { product: undefined, isSubcodeMatch: false };

  // 1. Busca exata por código principal
  let found = database.find(p => normalizeCode(p.code) === cleanCode);
  if (found) return { product: found, isSubcodeMatch: false };

  // 2. Busca por subcódigos / apelidos
  found = database.find(p =>
    p.subcodes && p.subcodes.some(sub => normalizeCode(sub) === cleanCode)
  );
  if (found) return { product: found, isSubcodeMatch: true };

  // 3. Busca por descrição contendo o código
  found = database.find(p =>
    normalizeText(p.description).includes(cleanCode) ||
    cleanCode.includes(normalizeCode(p.code))
  );

  return { product: found, isSubcodeMatch: false };
}

// Calcula preços e totais de um item individual
export function calculateItemPrice(
  item: {
    code: string;
    description: string;
    quantity: number;
    unit?: string;
    unit_cost?: number;
    margin?: number;
  },
  database: ProductItem[],
  settings: BudgetSettings
): BudgetItem {
  const { product: matched, isSubcodeMatch } = matchProduct(item.code, item.description, database);
  const found = !!matched;

  const isItemChapa = isChapa(item.code, item.description);
  const isItemFita = isFitaBorda(item.code, item.description);

  // Custo base unitário
  let unit_cost = item.unit_cost !== undefined ? item.unit_cost : (matched ? matched.unit_price : 0);
  const fitaMetros = matched?.fita_metros || extractFitaMetros(item.description) || 20;

  // Se for Fita de Borda em rolo e a lista vier em metros lineares (M):
  if (isItemFita && fitaMetros > 0 && item.unit?.toUpperCase() === 'M') {
    unit_cost = round2(unit_cost / fitaMetros);
  }

  // Margem de lucro do item ou margem padrão
  const marginPercent = item.margin !== undefined ? item.margin : settings.margin;

  // Fator de acréscimos globais
  const additionsFactor = calculateAdditionsFactor(settings);

  // Fórmula central: Custo x (1 + Margem/100) x Fator de Acréscimos
  const priceWithMargin = unit_cost * (1 + marginPercent / 100);
  const unit_price = round2(priceWithMargin * additionsFactor);

  // Quantidade e unidade (considera modo chapa se aplicável)
  let effectiveQuantity = item.quantity;
  let displayUnit = matched?.unit || item.unit || 'UN';

  if (isItemChapa && settings.chapa_mode === 'chapa') {
    const chapasCount = item.quantity / CHAPA_AREA_M2;
    if (settings.chapa_rounding === 'up') {
      effectiveQuantity = Math.ceil(chapasCount);
    } else if (settings.chapa_rounding === 'down') {
      effectiveQuantity = Math.floor(chapasCount);
    } else {
      effectiveQuantity = round2(chapasCount);
    }
    displayUnit = 'CHAPA';
  }

  const total_cost = round2(unit_cost * effectiveQuantity);
  const total_price = round2(unit_price * effectiveQuantity);

  return {
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    item_number: 1,
    code: matched ? matched.code : item.code,
    description: matched ? `${item.description} (${matched.description})` : item.description,
    quantity: effectiveQuantity,
    unit: displayUnit,
    unit_cost,
    margin: marginPercent,
    unit_price,
    total_cost,
    total_price,
    found,
    is_chapa: isItemChapa,
    is_fita: isItemFita,
    fita_metros: isItemFita ? fitaMetros : undefined,
    original_code: item.code,
    original_quantity: item.quantity,
    original_unit: item.unit,
    resolved_from_subcode: isSubcodeMatch,
  };
}

// Recalcula todos os itens do orçamento
export function recalculateBudget(
  items: BudgetItem[],
  database: ProductItem[],
  settings: BudgetSettings
): {
  items: BudgetItem[];
  totals: {
    total_cost: number;
    total_price: number;
    gross_profit: number;
    profit_margin_percent: number;
    items_count: number;
  };
} {
  const recalculatedItems = items.map((it, idx) => {
    const updated = calculateItemPrice(
      {
        code: it.original_code || it.code,
        description: it.description,
        quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
        unit: it.original_unit || it.unit,
        unit_cost: it.unit_cost,
        margin: it.margin,
      },
      database,
      settings
    );
    return {
      ...updated,
      id: it.id,
      item_number: idx + 1,
    };
  });

  const total_cost = round2(recalculatedItems.reduce((acc, curr) => acc + curr.total_cost, 0));
  const total_price = round2(recalculatedItems.reduce((acc, curr) => acc + curr.total_price, 0));
  const gross_profit = round2(total_price - total_cost);
  const profit_margin_percent = total_cost > 0 ? round2((gross_profit / total_cost) * 100) : 0;

  return {
    items: recalculatedItems,
    totals: {
      total_cost,
      total_price,
      gross_profit,
      profit_margin_percent,
      items_count: recalculatedItems.length,
    },
  };
}
