import { EnderecoDto } from "./EnderecoDto";

export interface EmpresaResponseDto {
  empresaId: string;           
  ativo: boolean;
  nomeDaEmpresa?: string;
  endereco?: EnderecoDto;
}