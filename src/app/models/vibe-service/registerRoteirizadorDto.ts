export interface RegisterRoteirizadorRequestDto {
    nome: string;
    username: string;
    senha: string;
}

export interface RegisterRoteirizadorResponseDto {
    RoteirizadorId: string;
    nome: string;
    username: string;
    senha: string;
}
