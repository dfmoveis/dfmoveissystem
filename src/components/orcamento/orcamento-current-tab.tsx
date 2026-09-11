import { useState, useRef, useMemo } from 'react';
import { 
  Upload, Plus, Trash2, Edit2, AlertTriangle, 
  CheckCircle2, FileSpreadsheet, Download, Save, Layers, Search, Check, Loader2, Link2, Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { BudgetItem, BudgetSettings, ProductItem } from '@/lib/orcamento/types';
import { parsePromobXML, parseTXT, parseCSV, parseJSON } from '@/lib/orcamento/parsers';
import { 
  calculateItemPrice, recalculateBudget, CHAPA_AREA_M2, round2, isChapa 
} from '@/lib/orcamento/calculator';
import { generateBudgetPdf } from '@/lib/orcamento/pdf-generator';
import { INITIAL_CHAPAS_CATALOG, BrandCatalog, CatalogByBrand } from '@/lib/orcamento/chapas-catalog';

interface CurrentTabProps {
  items: BudgetItem[];
  setItems: React.Dispatch<React.SetStateAction<BudgetItem[]>>;
  database: ProductItem[];
  settings: BudgetSettings;
  setSettings: React.Dispatch<React.SetStateAction<BudgetSettings>>;
  totals: {
    total_cost: number;
    total_price: number;
    gross_profit: number;
    profit_margin_percent: number;
    items_count: number;
  };
  onSaveBudget: (clientName: string, projectName: string) => void;
}

export function OrcamentoCurrentTab({
  items,
  setItems,
  database,
  settings,
  setSettings,
  totals,
  onSaveBudget,
}: CurrentTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  // Client & Project Info
  const [clientName, setClientName] = useState('Cliente DF Móveis');
  const [projectName, setProjectName] = useState('Ambiente Planejado');

  // Filter / Search inside current table
  const [filterSearch, setFilterSearch] = useState('');

  // Add manual item form
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('M2');
  const [newItemCost, setNewItemCost] = useState('');

  // Modal de Vinculação Rápida de Chapa (ex: Arauco.Beige Matt)
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkingItem, setLinkingItem] = useState<BudgetItem | null>(null);
  const [selectedBrand, setSelectedBrand] = useState('Arauco');
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedThickness, setSelectedThickness] = useState<'6mm' | '15mm' | '18mm' | '25mm'>('15mm');

  // Available brands in catalog
  const brandsList = Object.keys(INITIAL_CHAPAS_CATALOG).filter(
    b => INITIAL_CHAPAS_CATALOG[b].type === 'brand'
  );

  // Lines for selected brand in modal
  const brandLines = useMemo(() => {
    const b = INITIAL_CHAPAS_CATALOG[selectedBrand];
    return b && b.type === 'brand' ? (b as BrandCatalog).lines : [];
  }, [selectedBrand]);

  // Handle File Upload (Promob XML, TXT, CSV, JSON)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let parsedCount = 0;
    const allRawItems: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await file.text();
        const filename = file.name.toLowerCase();

        let parsed: any[] = [];
        if (filename.endsWith('.xml')) {
          parsed = parsePromobXML(content);
        } else if (filename.endsWith('.txt')) {
          parsed = parseTXT(content);
        } else if (filename.endsWith('.csv')) {
          parsed = parseCSV(content);
        } else if (filename.endsWith('.json')) {
          parsed = parseJSON(content);
        } else {
          toast.error(`Formato não suportado: ${file.name}. Use XML, TXT, CSV ou JSON.`);
          continue;
        }

        allRawItems.push(...parsed);
        parsedCount += parsed.length;
      }

      if (allRawItems.length === 0) {
        toast.warning('Nenhum item válido encontrado nos arquivos.');
        setIsUploading(false);
        return;
      }

      // Convert raw items into BudgetItem matching with database and brand catalog
      const newBudgetItems: BudgetItem[] = allRawItems.map((raw, idx) => {
        const calculated = calculateItemPrice(
          {
            code: raw.code,
            description: raw.description,
            quantity: raw.quantity,
            unit: raw.unit,
            margin: settings.margin, // Sempre herda a margem configurada!
          },
          database,
          settings
        );
        return {
          ...calculated,
          item_number: idx + 1,
        };
      });

      setItems(newBudgetItems);

      const matchedCount = newBudgetItems.filter(i => i.found).length;
      toast.success(`${parsedCount} itens importados!`, {
        description: `${matchedCount} itens identificados e precificados automaticamente.`,
      });
    } catch (err: any) {
      console.error('Erro ao processar arquivo:', err);
      toast.error(`Erro na importação: ${err.message || 'Arquivo inválido'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Direct Save Budget without blocking modal
  const handleDirectSave = () => {
    if (items.length === 0) {
      toast.warning('Adicione ou importe itens antes de salvar o orçamento.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      onSaveBudget(clientName.trim() || 'Cliente DF Móveis', projectName.trim() || 'Orçamento');
      setIsSaving(false);
      setSaveSuccess(true);
      toast.success('Orçamento salvo com sucesso!', {
        description: `Salvo na aba "Meus Orçamentos & Agrupados".`,
      });

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (e: any) {
      setIsSaving(false);
      console.error('Erro ao salvar orçamento:', e);
      toast.error('Erro ao salvar orçamento localmente.');
    }
  };

  // Direct PDF Export
  const handleDirectExportPDF = () => {
    if (items.length === 0) {
      toast.warning('Adicione ou importe itens antes de gerar o PDF.');
      return;
    }

    try {
      generateBudgetPdf({
        clientName: clientName || 'Cliente DF Móveis',
        projectName: projectName || 'Móveis Planejados',
        items,
        settings,
        totals,
      });
      toast.success('Proposta comercial em PDF baixada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao exportar PDF.');
    }
  };

  // Open Link Modal for Item
  const handleOpenLinkModal = (item: BudgetItem) => {
    setLinkingItem(item);
    // Try to pre-select brand from code
    const raw = `${item.code} ${item.description}`.toLowerCase();
    const foundBrand = brandsList.find(b => raw.includes(b.toLowerCase()));
    if (foundBrand) setSelectedBrand(foundBrand);

    // Pre-select thickness
    if (/\b6mm\b|\.6\./i.test(raw)) setSelectedThickness('6mm');
    else if (/\b18mm\b|\.18\./i.test(raw)) setSelectedThickness('18mm');
    else if (/\b25mm\b|\.25\./i.test(raw)) setSelectedThickness('25mm');
    else setSelectedThickness('15mm');

    setSelectedLine(brandLines[0]?.name || '');
    setLinkModalOpen(true);
  };

  // Apply Linker to single item or all similar items
  const handleApplyLink = (applyToAllSimilar: boolean) => {
    if (!linkingItem || !selectedLine) return;

    const brandData = INITIAL_CHAPAS_CATALOG[selectedBrand] as BrandCatalog;
    const lineObj = brandData?.lines.find(l => l.name === selectedLine);
    if (!lineObj) return;

    const boardPrice = lineObj.prices[selectedThickness] || lineObj.prices['15mm'] || 0;
    const m2Cost = round2(boardPrice / CHAPA_AREA_M2);

    // Filter key to match similar items: e.g. "Arauco.Beige Matt"
    const targetCode = linkingItem.code;

    const updated = items.map(it => {
      const isTarget = applyToAllSimilar
        ? it.code === targetCode || it.description === linkingItem.description
        : it.id === linkingItem.id;

      if (isTarget) {
        return calculateItemPrice(
          {
            code: `${selectedBrand.toUpperCase()}-${lineObj.name.toUpperCase().replace(/\s+/g, '_')}-${selectedThickness}`,
            description: `${it.description} [${selectedBrand} - ${lineObj.name} ${selectedThickness}]`,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.unit,
            unit_cost: m2Cost,
            margin: it.margin,
          },
          database,
          settings
        );
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings);
    setItems(res.items);
    setLinkModalOpen(false);

    if (applyToAllSimilar) {
      toast.success(`Vinculado a todos os itens com "${linkingItem.code}"!`, {
        description: `Preço de custo definido como ${m2Cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m².`,
      });
    } else {
      toast.success(`Item vinculado a ${selectedBrand} - ${lineObj.name}!`);
    }
  };

  // Add Manual Item
  const handleAddManualItem = () => {
    if (!newItemCode.trim() && !newItemDesc.trim()) {
      toast.error('Informe ao menos o código ou descrição do item.');
      return;
    }

    const costNumber = newItemCost ? parseFloat(newItemCost.replace(',', '.')) : undefined;

    const calculated = calculateItemPrice(
      {
        code: newItemCode.trim(),
        description: newItemDesc.trim() || newItemCode.trim(),
        quantity: newItemQty || 1,
        unit: newItemUnit,
        unit_cost: costNumber,
        margin: settings.margin,
      },
      database,
      settings
    );

    const updated = [...items, { ...calculated, item_number: items.length + 1 }];
    const res = recalculateBudget(updated, database, settings);
    setItems(res.items);

    setNewItemCode('');
    setNewItemDesc('');
    setNewItemQty(1);
    setNewItemUnit('M2');
    setNewItemCost('');
    setAddItemModalOpen(false);
    toast.success('Item adicionado ao orçamento!');
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    const updated = items.filter(it => it.id !== id);
    const res = recalculateBudget(updated, database, settings);
    setItems(res.items);
    toast.info('Item removido.');
  };

  // Clear Budget
  const handleClearBudget = () => {
    if (confirm('Deseja limpar todos os itens do orçamento atual?')) {
      setItems([]);
      toast.info('Orçamento limpo.');
    }
  };

  // Filtered items list
  const filteredItems = useMemo(() => {
    if (!filterSearch.trim()) return items;
    const term = filterSearch.toLowerCase();
    return items.filter(
      it =>
        it.code.toLowerCase().includes(term) ||
        it.description.toLowerCase().includes(term)
    );
  }, [items, filterSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[#c92031] bg-white shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Valor Total de Venda
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {totals.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-slate-500">
            Com margem de <strong>{settings.margin}%</strong> e acréscimos
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-600 bg-white shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Custo Total dos Materiais
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-700">
              {totals.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-slate-500">
            {totals.items_count} peças processadas
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-white shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lucro Bruto Estimado
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-700">
              {totals.gross_profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-slate-500">
            Diferença líquida sobre os insumos
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#cbb27a] bg-white shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Margem Real / Markup
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-[#b09657]">
              {totals.profit_margin_percent}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-slate-500">
            Margem aplicada sobre custo total
          </CardContent>
        </Card>
      </div>

      {/* Client and Project Quick Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="w-60">
            <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cliente</Label>
            <Input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Nome do cliente..."
              className="mt-0.5 h-8 text-xs font-bold text-slate-900"
            />
          </div>

          <div className="w-64">
            <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ambiente / Projeto</Label>
            <Input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Ex: Cozinha Planejada + Ilha"
              className="mt-0.5 h-8 text-xs font-medium text-slate-800"
            />
          </div>
        </div>

        {/* Action Buttons: Direct Save & PDF */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleDirectExportPDF}
            disabled={items.length === 0}
            variant="outline"
            className="h-9 border-[#cbb27a] bg-[#cbb27a]/10 text-[#886e35] hover:bg-[#cbb27a]/20"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Exportar PDF
          </Button>

          <Button
            onClick={handleDirectSave}
            disabled={items.length === 0 || isSaving}
            className={`h-9 font-semibold text-xs transition-all duration-300 ${
              saveSuccess
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-[#c92031] text-white hover:bg-[#aa1726]'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="mr-1.5 h-4 w-4" />
                Salvo com Sucesso!
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-4 w-4" />
                Salvar Orçamento
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Toolbar: Import & Chapa Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xml,.txt,.csv,.json"
            multiple
            className="hidden"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-[#17191d] text-xs text-white hover:bg-slate-800"
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {isUploading ? 'Processando Arquivo...' : 'Importar Promob (XML / TXT / CSV)'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setAddItemModalOpen(true)}
            className="border-slate-300 text-xs hover:bg-slate-50"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Adicionar Item Manual
          </Button>

          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearBudget}
              className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Limpar Lista
            </Button>
          )}
        </div>

        {/* Chapa Conversion Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-medium text-slate-700">Chapas MDF:</span>
            <Select
              value={settings.chapa_mode}
              onValueChange={(val: 'm2' | 'chapa') => {
                const updatedSettings = { ...settings, chapa_mode: val };
                setSettings(updatedSettings);
                const res = recalculateBudget(items, database, updatedSettings);
                setItems(res.items);
              }}
            >
              <SelectTrigger className="h-7 border-0 bg-transparent p-0 font-semibold text-slate-900 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m2">Exibir em M²</SelectItem>
                <SelectItem value="chapa">Exibir em Chapas (5,09m²)</SelectItem>
              </SelectContent>
            </Select>

            {settings.chapa_mode === 'chapa' && (
              <Select
                value={settings.chapa_rounding}
                onValueChange={(val: 'up' | 'down' | 'exact') => {
                  const updatedSettings = { ...settings, chapa_rounding: val };
                  setSettings(updatedSettings);
                  const res = recalculateBudget(items, database, updatedSettings);
                  setItems(res.items);
                }}
              >
                <SelectTrigger className="h-7 border-0 bg-transparent p-0 font-semibold text-slate-900 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">Teto (p/ Cima)</SelectItem>
                  <SelectItem value="down">Piso (p/ Baixo)</SelectItem>
                  <SelectItem value="exact">Exato</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {items.length > 0 && (
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filtrar peças..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Table or Empty State */}
      {items.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
            <FileSpreadsheet className="h-8 w-8 text-[#c92031]" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">
            Nenhum arquivo ou item carregado
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Importe a lista de peças exportada pelo <strong>Promob (XML ou TXT)</strong>. O sistema reconhece automaticamente as marcas de chapa (Arauco, Duratex, Guararapes, etc.) e calcula os custos e preços com precisão.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#c92031] text-white hover:bg-[#aa1726]"
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar Arquivo Promob
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddItemModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Inserir Item Manualmente
            </Button>
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#17191d] text-[11px] uppercase tracking-wider text-white">
                <tr>
                  <th className="py-3 pl-4 pr-2 font-semibold">#</th>
                  <th className="px-3 py-3 font-semibold">Código / Referência</th>
                  <th className="px-3 py-3 font-semibold">Descrição do Material</th>
                  <th className="px-3 py-3 text-center font-semibold">Qtd</th>
                  <th className="px-3 py-3 text-center font-semibold">Un</th>
                  <th className="px-3 py-3 text-right font-semibold">Custo Unit.</th>
                  <th className="px-3 py-3 text-center font-semibold">Margem</th>
                  <th className="px-3 py-3 text-right font-semibold">Preço Unit.</th>
                  <th className="px-3 py-3 text-right font-semibold">Total</th>
                  <th className="py-3 pl-2 pr-4 text-center font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, index) => {
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 pl-4 pr-2 font-medium text-slate-400">
                        {index + 1}
                      </td>

                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[280px]" title={item.code}>
                            {item.code}
                          </span>

                          {item.found ? (
                            <span title="Chapa/Produto reconhecido com sucesso!">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenLinkModal(item)}
                              className="flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100 border border-amber-200"
                              title="Clique para vincular a marca e linha correta"
                            >
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              Vincular
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-800">{item.description}</span>
                        {item.is_chapa && (
                          <Badge variant="outline" className="ml-1.5 border-blue-200 bg-blue-50 text-[9px] text-blue-700">
                            Chapa
                          </Badge>
                        )}
                        {item.is_fita && (
                          <Badge variant="outline" className="ml-1.5 border-purple-200 bg-purple-50 text-[9px] text-purple-700">
                            Fita
                          </Badge>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center font-semibold text-slate-900">
                        {item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                          {item.unit}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                        {item.unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700">
                        {item.margin}%
                      </td>

                      <td className="px-3 py-2.5 text-right font-medium text-slate-600">
                        {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                        {item.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      <td className="py-2.5 pl-2 pr-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenLinkModal(item)}
                            className="h-7 w-7 text-slate-400 hover:text-blue-600"
                            title="Alterar/Vincular Chapa"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-7 w-7 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Vincular Chapa / Linha Inteligente */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#cbb27a]" />
              Vincular Marca & Linha de Chapa
            </DialogTitle>
          </DialogHeader>

          {linkingItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <p className="text-slate-500">Item Selecionado:</p>
                <p className="font-mono font-bold text-slate-900">{linkingItem.code}</p>
                <p className="font-medium text-slate-700">{linkingItem.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">1. Marca</Label>
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {brandsList.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">2. Espessura</Label>
                  <Select
                    value={selectedThickness}
                    onValueChange={(val: '6mm' | '15mm' | '18mm' | '25mm') => setSelectedThickness(val)}
                  >
                    <SelectTrigger className="mt-1 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6mm">6mm (Fundo)</SelectItem>
                      <SelectItem value="15mm">15mm (Padrão)</SelectItem>
                      <SelectItem value="18mm">18mm (Estrutura)</SelectItem>
                      <SelectItem value="25mm">25mm (Engrosso)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">3. Linha / Padrão da Marca ({selectedBrand})</Label>
                <Select value={selectedLine} onValueChange={setSelectedLine}>
                  <SelectTrigger className="mt-1 text-xs font-semibold">
                    <SelectValue placeholder="Selecione a linha..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {brandLines.map(line => {
                      const p = line.prices[selectedThickness];
                      return (
                        <SelectItem key={line.id} value={line.name}>
                          {line.name} {p ? `— R$ ${p.toFixed(2)}/chapa` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleApplyLink(false)}
              className="text-xs flex-1"
            >
              Vincular Apenas Este Item
            </Button>
            <Button
              onClick={() => handleApplyLink(true)}
              className="bg-[#c92031] text-white hover:bg-[#aa1726] text-xs flex-1"
            >
              Vincular a TODOS Similares
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Inserir Item Manual */}
      <Dialog open={addItemModalOpen} onOpenChange={setAddItemModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Item Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Código / Referência</Label>
              <Input
                placeholder="Ex: MDF-BRANCO-15"
                value={newItemCode}
                onChange={e => setNewItemCode(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição do Item</Label>
              <Input
                placeholder="Ex: Tampo de Ilha 18mm"
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItemQty}
                  onChange={e => setNewItemQty(parseFloat(e.target.value) || 1)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M2">M²</SelectItem>
                    <SelectItem value="UN">UN</SelectItem>
                    <SelectItem value="M">Metros (M)</SelectItem>
                    <SelectItem value="PAR">Par</SelectItem>
                    <SelectItem value="CENTO">Cento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Custo Base (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={newItemCost}
                  onChange={e => setNewItemCost(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddManualItem} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
