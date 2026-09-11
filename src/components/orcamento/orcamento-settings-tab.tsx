import { useState } from 'react';
import { Settings, Plus, Trash2, CheckCircle2, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { BudgetSettings, AdditionItem } from '@/lib/orcamento/types';
import { calculateAdditionsFactor } from '@/lib/orcamento/calculator';

interface SettingsTabProps {
  settings: BudgetSettings;
  setSettings: React.Dispatch<React.SetStateAction<BudgetSettings>>;
  onSaveSettings: (newSettings: BudgetSettings) => void;
}

export function OrcamentoSettingsTab({ settings, setSettings, onSaveSettings }: SettingsTabProps) {
  const [form, setForm] = useState<BudgetSettings>({ ...settings });
  const [newAdditionName, setNewAdditionName] = useState('');
  const [newAdditionVal, setNewAdditionVal] = useState('');

  const additionsFactor = calculateAdditionsFactor(form);
  const additionsTotalPercent = (additionsFactor - 1) * 100;

  const handleAddCustomAddition = () => {
    if (!newAdditionName.trim()) {
      toast.error('Informe o nome do acréscimo.');
      return;
    }
    const val = parseFloat(newAdditionVal.replace(',', '.')) || 0;
    const newItem: AdditionItem = {
      id: `add-${Date.now()}`,
      nome: newAdditionName.trim(),
      valor: val,
    };
    setForm(prev => ({
      ...prev,
      outros: [...(prev.outros || []), newItem],
    }));
    setNewAdditionName('');
    setNewAdditionVal('');
    toast.success('Acréscimo adicionado!');
  };

  const handleRemoveAddition = (id: string) => {
    setForm(prev => ({
      ...prev,
      outros: prev.outros.filter(o => o.id !== id),
    }));
  };

  const handleSave = () => {
    setSettings(form);
    onSaveSettings(form);
    toast.success('Configurações salvas com sucesso!');
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#c92031]" />
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Margem Padrão de Lucro
              </CardTitle>
              <CardDescription className="text-xs">
                Defina o percentual de markup padrão aplicado sobre o custo dos materiais.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <div className="w-44">
              <Label className="text-xs font-semibold text-slate-700">Margem Padrão (%)</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={form.margin}
                  onChange={e => setForm({ ...form, margin: parseFloat(e.target.value) || 0 })}
                  className="pr-8 text-sm font-bold"
                />
                <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 flex-1">
              <p className="font-semibold text-slate-800">Exemplo prático:</p>
              <p>
                Com margem de <strong>{form.margin}%</strong>, um item com custo de R$ 100,00 terá preço base de{' '}
                <strong>
                  {(100 * (1 + form.margin / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>{' '}
                antes dos acréscimos operacionais.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Additions */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-bold text-slate-900">
            Acréscimos Operacionais & Comissões
          </CardTitle>
          <CardDescription className="text-xs">
            Taxas agregadas automaticamente no cálculo final de cada produto do orçamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs font-medium text-slate-700">Frete (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.frete}
                onChange={e => setForm({ ...form, frete: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Montagem (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.montagem}
                onChange={e => setForm({ ...form, montagem: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Comissão de Vendas (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.comissao_vendas}
                onChange={e => setForm({ ...form, comissao_vendas: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Comissão Executivo (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.comissao_executivo}
                onChange={e => setForm({ ...form, comissao_executivo: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-semibold"
              />
            </div>
          </div>

          {/* Custom Additions List */}
          <div className="border-t border-slate-100 pt-4">
            <Label className="text-xs font-semibold text-slate-700">Outros Acréscimos Personalizados</Label>
            <div className="mt-2 space-y-2">
              {(form.outros || []).map(o => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-800">{o.nome}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#c92031]">+{o.valor}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAddition(o.id)}
                      className="h-6 w-6 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="Nome do acréscimo (ex: Reserva Técnica)"
                  value={newAdditionName}
                  onChange={e => setNewAdditionName(e.target.value)}
                  className="text-xs flex-1"
                />
                <Input
                  type="number"
                  placeholder="Valor (%)"
                  value={newAdditionVal}
                  onChange={e => setNewAdditionVal(e.target.value)}
                  className="w-28 text-xs"
                />
                <Button onClick={handleAddCustomAddition} variant="outline" className="text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          {/* Additions Total Factor Card */}
          <div className="rounded-xl bg-[#17191d] p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Fator de Acréscimos Totais</p>
                <p className="text-lg font-bold text-[#cbb27a]">
                  +{additionsTotalPercent.toFixed(1)}% (Multiplicador {additionsFactor.toFixed(3)})
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF Settings */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-bold text-slate-900">
            Colunas Visíveis na Proposta Comercial (PDF)
          </CardTitle>
          <CardDescription className="text-xs">
            Escolha quais informações de preço aparecem para o cliente no PDF final.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Exibir Preço Unitário por Item</p>
              <p className="text-xs text-slate-500">Mostra a coluna de valor unitário na tabela do PDF.</p>
            </div>
            <Switch
              checked={form.pdf_show_unit_price}
              onCheckedChange={val => setForm({ ...form, pdf_show_unit_price: val })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Exibir Valor Total por Item</p>
              <p className="text-xs text-slate-500">Mostra a coluna de total de cada item na proposta.</p>
            </div>
            <Switch
              checked={form.pdf_show_item_total}
              onCheckedChange={val => setForm({ ...form, pdf_show_item_total: val })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
