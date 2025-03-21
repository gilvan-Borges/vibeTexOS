import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ControllAppService } from './controllApp.service';

import { RegistrarPontoFimRequestDto } from '../models/control-app/registrar.ponto.fim.request';
import { RegistrarPausaInicioRequestDto } from '../models/control-app/registrar.pausa.inicio.request';
import { RegistrarFimPausaRequestDto } from '../models/control-app/registrar.fim.pausa.request';
import { RegistrarPontoInicioRequestDto } from '../models/control-app/registrar.ponto.inicio.request.dto';
import { RegistrarPontoInicioResponseDto } from '../models/control-app/registrar.ponto.inicio.response.dto';
import { RegistrarPontoFimResponseDto } from '../models/control-app/registrar.ponto.fim.response.dto';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class RegistrarPontoService {

  constructor(private http: HttpClient, 
    private controllAppService: ControllAppService) {}


  
  registrarInicioPausa(
    userId: string,
    request: RegistrarPausaInicioRequestDto
  ): Observable<any> {
    return this.controllAppService.pontoRegistarInicioPausa(userId, request);

    
  }
  registrarFimPausa(usuarioId: string, pontoId: string, request: RegistrarFimPausaRequestDto) {
    // Validar os parâmetros
    if (!usuarioId) {
      console.error('Erro: usuarioId é obrigatório para registrarFimPausa');
      return throwError(() => new Error('usuarioId é obrigatório'));
    }
  
    if (!pontoId) {
      console.error('Erro: pontoId é obrigatório para registrarFimPausa');
      return throwError(() => new Error('pontoId é obrigatório'));
    }
  
    const headers = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    };
  
    // Garantir que a URL seja construída corretamente sem barras duplas
    const baseUrl = environment.controllApp.endsWith('/') 
      ? environment.controllApp.slice(0, -1) 
      : environment.controllApp;
    
    const url = `${baseUrl}/ponto/${usuarioId}/registrarfimpausa/${pontoId}`;
    
    console.log('URL final para finalizar pausa:', url);
    console.log('Payload enviado:', request);
  
    // Especificar responseType: 'text' para aceitar respostas de texto simples
    return this.http.post(url, request, { 
      ...headers, 
      responseType: 'text' 
    });
  }

  registrarInicioExpediente(
    userId: string,
    request: RegistrarPontoInicioRequestDto
  ): Observable<RegistrarPontoInicioResponseDto> {
    // Recuperar userId do localStorage como fallback
    const resolvedUserId = userId || localStorage.getItem('usuarioId') || '';
    if (!resolvedUserId || resolvedUserId.trim() === '') {
      console.error('Erro: userId está vazio ou inválido.');
      throw new Error('userId é obrigatório para registrar o início do expediente.');
    }

    const formData = new FormData();
    formData.append('pontoId', request.pontoId);
    formData.append('inicioExpediente', request.inicioExpediente);
    formData.append('latitude', request.latitude);
    formData.append('longitude', request.longitude);
    formData.append('fotoInicioExpedienteFile', request.fotoInicioExpedienteFile);
    formData.append('observacoes', request.observacoes);

    // Construir a URL com o resolvedUserId
    const url = `${environment.controllApp}/ponto/${resolvedUserId}/registrarinicioexpediente`;
    console.log('URL construída para registrarInicioExpediente:', url);

    return this.http.post<RegistrarPontoInicioResponseDto>(url, formData);
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
