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
    codigoOS?: string; // Adicionado para resolver o erro
    cliente?: string;  // Adicionado para compatibilidade
    endereco?: string; // Adicionado para compatibilidade
    colaborador?: string; // Adicionado para compatibilidade
}