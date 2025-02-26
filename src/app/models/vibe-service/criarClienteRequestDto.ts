import { EnderecoDto } from "./EnderecoDto";

export interface CriarClienteRequestDto {
    nomeCliente?: string;
    cpfCliente?: string;
    telefoneCliente?: string;
    endereco?: EnderecoDto;
  }