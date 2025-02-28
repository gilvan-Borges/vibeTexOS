export interface ExecucaoResponseDto {
  execucaoServicoId: string; // Agora garantido
  fotoInicio?: string;
  fotoFimServico?: string;
  statusExecucao?: string;
  dataEHoraInicioExecucao?: string;
  dataEHoraFimExecucao?: string | Date;
  duracao?: string;
  latitudeInicioExecucaoServico?: string;
  longitudeInicioExecucaoServico?: string;
  latitudeFimExecucaoServico?: string;
  longitudeFimExecucaoServico?: string;
  }
  