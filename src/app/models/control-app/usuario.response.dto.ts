export interface UsuarioResponseDto {
  usuarioId: string;
  nome: string;
  userName: string;
  email: string;
  cpf: string;
  role: string;
  latitudeAtual: string | null;
  longitudeAtual: string | null;  // Note: API has typo in property name
  horaEntrada: string;
  horaSaida: string;
  horaAlmocoInicio: string;
  horaAlmocoFim: string;
  isOnline: boolean;
  ativo: boolean;
  fotoUrl: string;
  dataHoraUltimaAutenticacao: string;
}