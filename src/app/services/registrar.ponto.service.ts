import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { RegistrarPausaInicioRequestDto } from '../models/control-app/registrar.pausa.inicio.request';
import { RegistrarFimPausaRequestDto } from '../models/control-app/registrar.fim.pausa.request';
import { environment } from '../../environments/environment.development';
import { ControllAppService } from './controllApp.service';

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
}
