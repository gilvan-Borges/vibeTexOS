// src/app/interfaces/ordem-servico.interface.ts
export interface OrdemServico {
  id: number;
  codigoOS: string;
  cliente: string;
  tipoServico: string; // Corrigido para tipoServico (com "o")
  colaborador: string | null;
  endereco: string;
  data: Date;
  status: 'pendente' | 'em_andamento' | 'concluido' | 'cancelado';
}