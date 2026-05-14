export type UserRole = 'ADMIN' | 'PROJETISTA';
export type ProjectStatus = 'PRONTO' | 'EM_EXECUCAO' | 'PAUSADO' | 'ATRASADO' | 'FINALIZADO';
export type SaleStatus = 'EM_NEGOCIACAO' | 'VENDEU' | 'NAO_VENDEU';

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  created_at: string;
}

export interface Projeto {
  id: string;
  cliente_id: string;
  projetista_id: string;
  status: ProjectStatus;
  data_inicio: string;
  prazo_termino: string;
  status_venda: SaleStatus;
  valor_venda?: number;
  forma_pagamento?: string;
  created_at: string;
  cliente?: Cliente;
  projetista?: User;
}

export interface Comissao {
  id: string;
  projeto_id: string;
  projetista_id: string;
  percentual: number;
  valor_calculado: number;
  mes_referencia: string;
  created_at: string;
  projeto?: Projeto;
}
