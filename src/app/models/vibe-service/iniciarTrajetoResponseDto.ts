import { EnderecoDto } from "./EnderecoDto";

export interface IniciarTrajetoResponseDto {
    latitudeInicioTrajeto?: string | null;
    longitudeInicioTrajeto?: string | null;
    localDestino?: string | null;
    statusTrajeto?: string | null;
    dataEHoraInicioTrajeto?: Date | null;
    enderecoCliente?: EnderecoDto | null;
    despachoId: string;
    trajetoId: string;
  }
