import { EnderecoDto } from "./EnderecoDto";

export interface ClienteResponseDto {
    clienteId: string;        // Guid no C#, string no front
    nomeCliente?: string;
    cpfCliente?: string;
    telefoneCliente?: string;
    ativo: boolean;
    endereco?: EnderecoDto;
  }