export interface RegistrarFimPausaResponseDto {
    pontoId: string;
    retornoPausa: string;  // Corresponde a RetornoPausa no backend
    latitude: string ;  // Ajuste para aceitar nullable do backend
    longitude: string;
    observacoes: string ;
    dataHoraRetornoPausa: string;  // Corresponde ao DataHoraRetornoPausa
  }
  