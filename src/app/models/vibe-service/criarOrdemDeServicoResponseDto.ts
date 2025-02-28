export interface CriarOrdemDeServicoResponseDto {
    ordemDeServicoId: string;
    usuarioId: string;
    clienteId: string;
    dataEHoraInicioServico: string | null;
    dataEHoraFimServico: string | null;
    tipoServico: string;
    dataHoraCadastro: string;
    observacoesReparo: string | null;
    numeroOrdemDeServico: string;
    statusOrdem: string;
    assinaturaCliente: string | null;
    atribuida: boolean;
    despachoId?: string; // Adicionado como opcional, já que nem toda ordem terá um despacho inicialmente
  }