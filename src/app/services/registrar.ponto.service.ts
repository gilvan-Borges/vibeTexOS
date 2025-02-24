import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ControllAppService } from './controllApp.service';

import { RegistrarPontoFimRequestDto } from '../models/control-app/registrar.ponto.fim.request';
import { RegistrarPausaInicioRequestDto } from '../models/control-app/registrar.pausa.inicio.request';
import { RegistrarFimPausaRequestDto } from '../models/control-app/registrar.fim.pausa.request';
import { RegistrarPontoInicioRequestDto } from '../models/control-app/registrar.ponto.inicio.request.dto';
import { RegistrarPontoInicioResponseDto } from '../models/control-app/registrar.ponto.inicio.response.dto';
import { RegistrarPontoFimResponseDto } from '../models/control-app/registrar.ponto.fim.response.dto';

@Injectable({
  providedIn: 'root',
})
export class RegistrarPontoService {
  private apiUrl = 'https://api.exemplo.com'; // Substitua pela URL da sua API

  constructor(private http: HttpClient, private controllAppService: ControllAppService) {}


  


  registrarInicioPausa(
    userId: string,
    request: RegistrarPausaInicioRequestDto
  ): Observable<any> {
    return this.controllAppService.pontoRegistarInicioPausa(userId, request);
  }

  registrarFimPausa(
    userId: string,
    pausaId: string,
    request: RegistrarFimPausaRequestDto
  ): Observable<any> {
    return this.controllAppService.pontoRegistarFimPausa(userId, pausaId, request);
  }

  registrarInicioExpediente(
    userId: string,
    request: RegistrarPontoInicioRequestDto
  ): Observable<RegistrarPontoInicioResponseDto> {
    const formData = new FormData();
    formData.append('pontoId', request.pontoId);
    formData.append('inicioExpediente', request.inicioExpediente);
    formData.append('latitude', request.latitude);
    formData.append('longitude', request.longitude);
    formData.append('fotoInicioExpedienteFile', request.fotoInicioExpedienteFile);
    formData.append('observacoes', request.observacoes);

    return this.controllAppService.pontoRegistrarInicioExpediente(userId, formData);
  }

  registrarFimExpediente(
    userId: string,
    pontoId: string,
    request: RegistrarPontoFimRequestDto
  ): Observable<RegistrarPontoFimResponseDto> {
    const formData = new FormData();
    formData.append('fimExpediente', request.fimExpediente);
    formData.append('pontoId', request.pontoId);
    formData.append('latitude', request.latitude);
    formData.append('longitude', request.longitude);
    formData.append('fotoFimExpedienteFile', request.fotoFimExpedienteFile);
    formData.append('observacoes', request.observacoes);

    return this.controllAppService.pontoRegistarFimExpediente(userId, pontoId, formData);
  }
}
