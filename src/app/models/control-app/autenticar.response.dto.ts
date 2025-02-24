export interface AutenticarResponseDto {
  usuarioId: string;
  nome: string;
  userName: string;
  email: string;
  cpf: string;
  role: string;
  dataHoraAutenticacao: string; // Changed from Date to string
  isOnline: boolean;
  tipoUsuario: string;
}
