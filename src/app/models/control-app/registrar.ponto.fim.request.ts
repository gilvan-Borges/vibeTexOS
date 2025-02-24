export interface RegistrarPontoFimRequestDto {
  fimExpediente: string;
  pontoId: string;
  latitude: string;
  longitude: string;
  fotoFimExpedienteFile: string;
  observacoes: string;
}