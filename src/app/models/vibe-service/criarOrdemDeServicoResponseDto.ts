export interface CriarOrdemDeServicoResponseDto {
    ordemDeServicoId: string;
    usuarioId?: string;
    clienteId?: string;
    tipoServico?: string;
    statusOrdem?: string;
    numeroOrdemDeServico?: string;
    atribuida?: boolean;
    observacoesReparo?: string;
    dataEHoraInicioServico?: string | null;
    dataEHoraFimServico?: string | null;
    dataHoraCadastro?: string;
    despachoId?: string;
    codigoOS?: string; 
    cliente?: string; 
    endereco?: string; 
    colaborador?: string; 
    execucoes?: any; 
}