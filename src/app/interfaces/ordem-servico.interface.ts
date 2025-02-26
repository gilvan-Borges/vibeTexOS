export interface OrdemServico {
  id?: string;
  ordemDeServicoId: string;
  numeroOrdemDeServico: string;
  codigoOS: string;
  cliente: string;
  clienteId: string;
  tipoServico: string;
  dataHoraCadastro: string;
  status: string;
  endereco: string;
  usuarioId: string;
  colaborador: string;
  atribuida: boolean; // Adiciona o campo atribuida
}
