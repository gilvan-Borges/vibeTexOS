export interface UpdateOrdemDeServicoRequestDto {
    numeroOrdemDeServico?: string;
    clienteId?: string;
    tipoServico?: string;
    statusOrdem?: string; // O campo que queremos atualizar
    observacoesReparo?: string;
    dataEHoraInicioServico?: string;
    dataEHoraFimServico?: string;

  }