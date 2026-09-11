import { useState, useRef } from 'react';
import { Search, Plus, Trash2, Edit2, RotateCcw, Package, Layers, Download, Upload } from 'lucide-react';
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
import { ProductItem } from '@/lib/orcamento/types';
import { DEFAULT_MATERIALS } from '@/lib/orcamento/default-materials';
import { CHAPA_AREA_M2, round2 } from '@/lib/orcamento/calculator';

interface DatabaseTabProps {
  database: ProductItem[];
  setDatabase: React.Dispatch<React.SetStateAction<ProductItem[]>>;
}

export function OrcamentoDatabaseTab({ database, setDatabase }: DatabaseTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [code, setCode] = useState('');
  const [subcodes, setSubcodes] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('M2');
  const [unitPrice, setUnitPrice] = useState('');
  const [fitaMetros, setFitaMetros] = useState('20');
  const [category, setCategory] = useState('MDF');

  const filteredProducts = database.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.code.toLowerCase().includes(term) ||
      p.description.toLowerCase().includes(term) ||
      (p.subcodes && p.subcodes.some(s => s.toLowerCase().includes(term)));

    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setCode('');
    setSubcodes('');
    setDescription('');
    setUnit('M2');
    setUnitPrice('');
    setFitaMetros('20');
    setCategory('MDF');
    setModalOpen(true);
  };

  const handleOpenEdit = (p: ProductItem) => {
    setEditingId(p.id);
    setCode(p.code);
    setSubcodes(p.subcodes ? p.subcodes.join(', ') : '');
    setDescription(p.description);
    setUnit(p.unit);
    setUnitPrice(p.unit_price.toString());
    setFitaMetros(p.fita_metros ? p.fita_metros.toString() : '20');
    setCategory(p.category || 'OUTROS');
    setModalOpen(true);
  };

  const handleSaveProduct = () => {
    if (!code.trim() || !description.trim()) {
      toast.error('Informe código e descrição.');
      return;
    }

    const priceNum = parseFloat(unitPrice.replace(',', '.')) || 0;
    const subcodeArr = subcodes
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (editingId) {
      setDatabase(prev =>
        prev.map(p =>
          p.id === editingId
            ? {
                ...p,
                code: code.trim(),
                subcodes: subcodeArr,
                description: description.trim(),
                unit,
                unit_price: priceNum,
                category,
                fita_metros: unit === 'M' || category === 'FITA' ? parseInt(fitaMetros, 10) || 20 : undefined,
              }
            : p
        )
      );
      toast.success('Produto atualizado!');
    } else {
      const newProduct: ProductItem = {
        id: `prod-${Date.now()}`,
        code: code.trim(),
        subcodes: subcodeArr,
        description: description.trim(),
        unit,
        unit_price: priceNum,
        category,
        fita_metros: unit === 'M' || category === 'FITA' ? parseInt(fitaMetros, 10) || 20 : undefined,
      };
      setDatabase(prev => [newProduct, ...prev]);
      toast.success('Produto cadastrado com sucesso!');
    }
    setModalOpen(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Deseja excluir este item da tabela de preços?')) {
      setDatabase(prev => prev.filter(p => p.id !== id));
      toast.info('Item removido.');
    }
  };

  const handleResetDefault = () => {
    if (confirm('Restaurar o catálogo de materiais padrão da DF Móveis?')) {
      setDatabase(DEFAULT_MATERIALS);
      toast.success('Catálogo restaurado para o padrão!');
    }
  };

  // Export Database to JSON
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banco_materiais_dfmoveis_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Catálogo exportado em JSON com sucesso!');
  };

  // Import Database from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          setDatabase(parsed);
          toast.success(`${parsed.length} produtos importados com sucesso!`);
        } else {
          toast.error('Formato inválido. O arquivo JSON deve conter uma lista de produtos.');
        }
      } catch (err) {
        toast.error('Erro ao ler arquivo JSON.');
      }
    };
    reader.readAsText(file);
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Search & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por código, descrição ou subcódigo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas Categorias</SelectItem>
              <SelectItem value="MDF">MDF / MDP</SelectItem>
              <SelectItem value="FITA">Fitas de Borda</SelectItem>
              <SelectItem value="FERRAGEM">Ferragens</SelectItem>
              <SelectItem value="OUTROS">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={jsonInputRef}
            onChange={handleImportJSON}
            accept=".json"
            className="hidden"
          />

          <Button
            variant="outline"
            onClick={() => jsonInputRef.current?.click()}
            className="text-xs"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar JSON
          </Button>

          <Button variant="outline" onClick={handleExportJSON} className="text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar JSON
          </Button>

          <Button variant="outline" onClick={handleResetDefault} className="text-xs">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restaurar Catálogo Padrão
          </Button>

          <Button onClick={handleOpenAdd} className="bg-[#c92031] text-xs text-white hover:bg-[#aa1726]">
            <Plus className="mr-1.5 h-4 w-4" />
            Cadastrar Produto
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#17191d] text-[11px] uppercase tracking-wider text-white">
              <tr>
                <th className="py-3 pl-4 pr-2 font-semibold">Código</th>
                <th className="px-3 py-3 font-semibold">Subcódigos / Apelidos</th>
                <th className="px-3 py-3 font-semibold">Descrição do Material</th>
                <th className="px-3 py-3 text-center font-semibold">Categoria</th>
                <th className="px-3 py-3 text-center font-semibold">Unidade</th>
                <th className="px-3 py-3 text-right font-semibold">Preço Custo Base</th>
                <th className="px-3 py-3 text-right font-semibold">Preço por Chapa (5,09m²)</th>
                <th className="py-3 pl-2 pr-4 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => {
                const isMDF = p.category === 'MDF' || p.unit === 'M2';
                const chapaPrice = isMDF ? round2(p.unit_price * CHAPA_AREA_M2) : null;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pl-4 pr-2 font-mono font-bold text-slate-900">
                      {p.code}
                    </td>

                    <td className="px-3 py-3">
                      {p.subcodes && p.subcodes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.subcodes.map(sub => (
                            <span
                              key={sub}
                              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-3 py-3 font-medium text-slate-800">
                      {p.description}
                      {p.fita_metros && (
                        <span className="ml-2 text-[10px] font-normal text-purple-600">
                          (Rolo {p.fita_metros}m)
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={
                          p.category === 'MDF'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : p.category === 'FITA'
                            ? 'border-purple-200 bg-purple-50 text-purple-700'
                            : 'border-slate-200 bg-slate-50 text-slate-700'
                        }
                      >
                        {p.category || 'GERAL'}
                      </Badge>
                    </td>

                    <td className="px-3 py-3 text-center font-semibold text-slate-600">
                      {p.unit}
                    </td>

                    <td className="px-3 py-3 text-right font-bold text-slate-900">
                      {p.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>

                    <td className="px-3 py-3 text-right font-medium text-slate-600">
                      {chapaPrice !== null
                        ? chapaPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </td>

                    <td className="py-3 pl-2 pr-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(p)}
                          className="h-7 w-7 text-slate-500 hover:text-slate-900"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteProduct(p.id)}
                          className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700"
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

      {/* MODAL: Cadastrar / Editar Produto */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Material' : 'Cadastrar Material'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Código Principal (ex: MDF-BRANCO-15)</Label>
              <Input
                placeholder="Código oficial"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Subcódigos / Apelidos (separados por vírgula)</Label>
              <Input
                placeholder="Ex: BRANCO15, 15BRANCO, MDF15BR"
                value={subcodes}
                onChange={e => setSubcodes(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição Comercial</Label>
              <Input
                placeholder="Ex: MDF Branco TX 15mm 2 Faces"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MDF">MDF / Painéis</SelectItem>
                    <SelectItem value="FITA">Fitas de Borda</SelectItem>
                    <SelectItem value="FERRAGEM">Ferragens</SelectItem>
                    <SelectItem value="OUTROS">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Unidade de Medida</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M2">Metro Quadrado (M²)</SelectItem>
                    <SelectItem value="UN">Unidade (UN)</SelectItem>
                    <SelectItem value="M">Metro Linear (M)</SelectItem>
                    <SelectItem value="PAR">Par</SelectItem>
                    <SelectItem value="CENTO">Cento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Preço Custo Unitário (R$)</Label>
                <Input
                  placeholder="Ex: 36,50"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  className="mt-1"
                />
              </div>
              {category === 'FITA' && (
                <div>
                  <Label className="text-xs">Metragem do Rolo (m)</Label>
                  <Input
                    type="number"
                    placeholder="20"
                    value={fitaMetros}
                    onChange={e => setFitaMetros(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProduct} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Salvar Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
