export interface RegisterRequestDto {
    id?: string;
    nome?: string;
    userName?: string;
    email?: string;
    senha?: string;
    cpf?: string;
    empresaId?: string;
    role: string; 
    horaEntrada?: string;
    horaSaida?: string;
    horaAlmocoInicio?: string;
    horaAlmocoFim?: string;
    fotoUrl?: string;
    isOnline?: boolean;
}
