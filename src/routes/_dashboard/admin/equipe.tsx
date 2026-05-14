import { createFileRoute } from '@tanstack/react-router';
import { useTeam } from '@/hooks/use-team';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Mail, User as UserIcon, Key, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute('/_dashboard/admin/equipe')({
  component: EquipePage,
});

function EquipePage() {
  const { data: team, isLoading, addMember, deleteMember } = useTeam();
  const [isOpen, setIsOpen] = useState(false);
  const [newMember, setNewMember] = useState({ nome: '', email: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMember.mutateAsync(newMember);
    setNewMember({ nome: '', email: '' });
    setIsOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Equipe</h1>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Projetista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Projetista</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input 
                  id="nome" 
                  value={newMember.nome}
                  onChange={e => setNewMember(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Carlos Designer" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail Corporativo</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={newMember.email}
                  onChange={e => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="carlos@dfmoveis.com" 
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={addMember.isPending}>
                {addMember.isPending ? 'Salvando...' : 'Adicionar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))
        ) : team?.map((member) => (
          <Card key={member.id} className="overflow-hidden group">
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UserIcon className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">{member.nome}</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground truncate">
                  <Mail className="mr-1 h-3 w-3" />
                  {member.email}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mt-2 pt-4 border-t">
                <div className="text-sm font-medium">
                  Comissão: <span className="text-primary">5%</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja remover este projetista?')) {
                      deleteMember.mutate(member.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && team?.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">Nenhum projetista cadastrado ainda.</p>
        </div>
      )}
    </div>
  );
}

