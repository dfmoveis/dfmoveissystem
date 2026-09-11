import { useState, useRef } from 'react';
import { 
  Upload, FileText, Plus, Trash2, Edit2, AlertTriangle, 
  CheckCircle2, RefreshCw, FileSpreadsheet, Download, Save, Layers, Search
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
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  // Save budget form
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [projectName, setProjectName] = useState('');

  // Add item form
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('UN');
  const [newItemCost, setNewItemCost] = useState('');

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

      // Convert raw items into BudgetItem matching with database
      const newBudgetItems: BudgetItem[] = allRawItems.map((raw, idx) => {
        const calculated = calculateItemPrice(
          {
            code: raw.code,
            description: raw.description,
            quantity: raw.quantity,
            unit: raw.unit,
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
      toast.success(`${parsedCount} itens importados e calculados com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao processar arquivo:', err);
      toast.error(`Erro na importação: ${err.message || 'Arquivo inválido'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      },
      database,
      settings
    );

    const updated = [...items, { ...calculated, item_number: items.length + 1 }];
    const res = recalculateBudget(updated, database, settings);
    setItems(res.items);

    // reset
    setNewItemCode('');
    setNewItemDesc('');
    setNewItemQty(1);
    setNewItemUnit('UN');
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

  // Inline Update of Item Margin
  const handleItemMarginChange = (id: string, newMargin: number) => {
    const updated = items.map(it => {
      if (it.id === id) {
        return calculateItemPrice(
          {
            code: it.original_code || it.code,
            description: it.description,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: it.unit_cost,
            margin: newMargin,
          },
          database,
          settings
        );
      }
      return it;
    });
    const res = recalculateBudget(updated, database, settings);
    setItems(res.items);
  };

  // Inline Update of Item Cost
  const handleItemCostChange = (id: string, newCost: number) => {
    const updated = items.map(it => {
      if (it.id === id) {
        return calculateItemPrice(
          {
            code: it.original_code || it.code,
            description: it.description,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: newCost,
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
  };

  // Clear Budget
  const handleClearBudget = () => {
    if (confirm('Deseja limpar todos os itens do orçamento atual?')) {
      setItems([]);
      toast.info('Orçamento limpo.');
    }
  };

  // PDF Export
  const handleExportPDF = () => {
    if (items.length === 0) {
      toast.warning('Adicione ou importe itens antes de gerar o PDF.');
      return;
    }
    generateBudgetPdf({
      clientName: clientName || 'Cliente DF Móveis',
      clientPhone,
      projectName: projectName || 'Móveis Planejados',
      items,
      settings,
      totals,
    });
    setPdfModalOpen(false);
    toast.success('Proposta comercial em PDF gerada!');
  };

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
            Preço final com margem e acréscimos
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
            {totals.items_count} itens computados
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
            Diferença entre venda e custo base
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

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* File Upload Hidden Input */}
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
            className="bg-[#17191d] text-white hover:bg-slate-800"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? 'Processando Arquivo...' : 'Importar Promob (XML / TXT / CSV / JSON)'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setAddItemModalOpen(true)}
            className="border-slate-300 hover:bg-slate-50"
          >
            <Plus className="mr-2 h-4 w-4 text-emerald-600" />
            Adicionar Item Manual
          </Button>

          {items.length > 0 && (
            <Button
              variant="ghost"
              onClick={handleClearBudget}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar Tudo
            </Button>
          )}
        </div>

        {/* Chapa Conversion Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <Layers className="h-4 w-4 text-slate-500" />
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
                  <SelectItem value="up">Arredondar p/ Cima (Teto)</SelectItem>
                  <SelectItem value="down">Arredondar p/ Baixo</SelectItem>
                  <SelectItem value="exact">Exato Fracionado</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            onClick={() => setPdfModalOpen(true)}
            disabled={items.length === 0}
            className="border border-[#cbb27a] bg-[#cbb27a]/15 text-[#91773d] hover:bg-[#cbb27a]/25"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>

          <Button
            onClick={() => setSaveModalOpen(true)}
            disabled={items.length === 0}
            className="bg-[#c92031] text-white hover:bg-[#aa1726]"
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar Orçamento
          </Button>
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
            Importe a lista de peças exportada pelo <strong>Promob (XML ou TXT)</strong> ou arquivo CSV de corte para calcular automaticamente os custos, margens e chapas de MDF.
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
                  <th className="py-3.5 pl-4 pr-2 font-semibold">#</th>
                  <th className="px-3 py-3.5 font-semibold">Código</th>
                  <th className="px-3 py-3.5 font-semibold">Descrição do Material</th>
                  <th className="px-3 py-3.5 text-center font-semibold">Qtd</th>
                  <th className="px-3 py-3.5 text-center font-semibold">Un</th>
                  <th className="px-3 py-3.5 text-right font-semibold">Custo Unit.</th>
                  <th className="px-3 py-3.5 text-center font-semibold">Margem</th>
                  <th className="px-3 py-3.5 text-right font-semibold">Preço Unit.</th>
                  <th className="px-3 py-3.5 text-right font-semibold">Total</th>
                  <th className="py-3.5 pl-3 pr-4 text-center font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 pl-4 pr-2 font-medium text-slate-400">
                        {index + 1}
                      </td>

                      <td className="px-3 py-3 font-mono font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {item.code}
                          {item.found ? (
                            <span title={item.resolved_from_subcode ? "Correspondência encontrada por subcódigo" : "Produto encontrado no banco de dados"}>
                              <CheckCircle2 className={`h-3.5 w-3.5 ${item.resolved_from_subcode ? 'text-blue-600' : 'text-emerald-600'}`} />
                            </span>
                          ) : (
                            <span title="Item não encontrado no banco — custo manual">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className="font-medium text-slate-800">{item.description}</span>
                        {item.is_chapa && (
                          <Badge variant="outline" className="ml-2 border-blue-200 bg-blue-50 text-[10px] text-blue-700">
                            Chapa MDF (5,09m²)
                          </Badge>
                        )}
                        {item.is_fita && (
                          <Badge variant="outline" className="ml-2 border-purple-200 bg-purple-50 text-[10px] text-purple-700">
                            Fita Borda
                          </Badge>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center font-semibold text-slate-900">
                        {item.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        {item.original_quantity !== undefined && item.original_quantity !== item.quantity && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            orig: {item.original_quantity} {item.original_unit}
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                          {item.unit}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => handleItemCostChange(item.id, parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-right font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
                        />
                      </td>

                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={item.margin}
                            onChange={(e) => handleItemMarginChange(item.id, parseFloat(e.target.value) || 0)}
                            className="w-14 rounded border border-slate-200 px-1 py-0.5 text-center font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400">%</span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right font-medium text-slate-600">
                        {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      <td className="px-3 py-3 text-right font-bold text-slate-900">
                        {item.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      <td className="py-3 pl-3 pr-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                          className="h-7 w-7 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Item Manual */}
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
                onChange={(e) => setNewItemCode(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição do Item</Label>
              <Input
                placeholder="Ex: MDF Branco 15mm 2 Faces"
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(parseFloat(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">UN</SelectItem>
                    <SelectItem value="M2">M²</SelectItem>
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
                  onChange={(e) => setNewItemCost(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddManualItem} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Adicionar ao Orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Salvar Orçamento */}
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome do Cliente</Label>
              <Input
                placeholder="Ex: João Silva"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">WhatsApp / Telefone</Label>
              <Input
                placeholder="(61) 99999-9999"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Ambiente / Projeto</Label>
              <Input
                placeholder="Ex: Cozinha Planejada + Área Gourmet"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!clientName.trim()) {
                  toast.error('Informe o nome do cliente.');
                  return;
                }
                onSaveBudget(clientName, projectName);
                setSaveModalOpen(false);
              }}
              className="bg-[#c92031] text-white hover:bg-[#aa1726]"
            >
              Salvar Orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Exportar Proposta PDF */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Proposta Comercial (PDF)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome do Cliente</Label>
              <Input
                placeholder="Ex: Dra. Mariana Costa"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Ambiente</Label>
              <Input
                placeholder="Ex: Suíte Master e Closet"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Resumo da Proposta:</p>
              <p>• Total de itens: <strong>{items.length}</strong></p>
              <p>• Valor total da proposta: <strong>{totals.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
              <p>• Layout com cabeçalho oficial DF Móveis e termos comerciais.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfModalOpen(false)}>
              Voltar
            </Button>
            <Button onClick={handleExportPDF} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              <Download className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
