import { EnderecoDto } from "./EnderecoDto";

export interface CriarEmpresaRequestDto {
    nomeDaEmpresa?: string;
    endereco?: EnderecoDto;
  }