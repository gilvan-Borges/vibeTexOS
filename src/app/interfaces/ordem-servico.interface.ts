export interface OrdemServico {
  id?: string;
  ordemDeServicoId: string;
  despachoId?: string;
  numeroOrdemDeServico: string;
  codigoOS: string;
  cliente: string;
  clienteId: string;
  tipoServico: string;
  dataHoraCadastro: string;
  status: string;
  statusOrdem?: string; // Adicionado para compatibilidade
  endereco: string;
  usuarioId: string;
  colaborador: string;
  atribuida: boolean;
  clienteData?: any; // Dados do cliente quando carregados
  observacoesReparo?: string;
  dataEHoraInicioServico?: string | null;
  dataEHoraFimServico?: string | null;
}
