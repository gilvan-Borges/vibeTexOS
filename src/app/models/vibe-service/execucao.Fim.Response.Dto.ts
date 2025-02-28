export interface ExecucaoFimResponseDto {
  execucaoServicoId: string;
  statusExecucao: string;
  fotoInicioServico?: string;
  fotoFimServico?: string;
  trajetoId: string;
  dataEHoraInicioExecucao: string; // Adicionado
  dataEHoraFimExecucao: string;
  duracao: string;
  observacaoCancelamento?: string;
  latitudeInicioExecucaoServico: string;
  longitudeInicioExecucaoServico: string;
  latitudeFimExecucaoServico: string;
  longitudeFimExecucaoServico: string;
  fotoCancelamento?: string;
  dataHoraCancelamento?: string;
  latitudeCancelaExecucao?: string;
  longitudeCancelaExecucao?: string;
}