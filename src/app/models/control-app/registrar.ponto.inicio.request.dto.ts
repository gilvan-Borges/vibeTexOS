export interface RegistrarPontoInicioRequestDto {
  pontoId: string;
  inicioExpediente:string;
  latitude: string;
  longitude: string;
  fotoInicioExpedienteFile: string; // Enviar como Base64
  observacoes: string;
}
