export interface ReiniciarExecucaoServicoResponseDto {
    ordemDeServicoId: string;
    numeroOrdemDeServico: string; // Ex.: "6.1"
    despachoId: string; // Novo despachoid gerado
    // Outros campos, se necessário
  }