import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class OrdemServicoService {
   public apiUrl =  environment.vibeservice;

  constructor(private httpClient: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer seu-token-aqui'
    });
  }

  buscarOrdemServicoPorId(ordemDeServicoId: string): Observable<any> {
    return this.httpClient.get<any>(`${this.apiUrl}/usuario/ordem-servico/${ordemDeServicoId}`, {
        headers: this.getHeaders() // Adiciona os headers com token
    }).pipe(
        catchError(this.handleError)
    );
  }

  // Novo método para atualizar o status da ordem de serviço
  atualizarStatusOrdemServico(ordemDeServicoId: string, status: string): Observable<any> {
    return this.httpClient.patch<any>(
      `${this.apiUrl}/ordem-servico/${ordemDeServicoId}/status`,
      { status },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  // Novo método para buscar ordens por status
  buscarOrdensPorStatus(usuarioId: string, status: string): Observable<any> {
    return this.httpClient.get<any>(
      `${this.apiUrl}/usuario/${usuarioId}/ordens-servico?status=${status}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: any): Observable<never> {
    console.error('Erro na requisição:', error);
    return throwError(() => new Error('Erro ao buscar dados. Tente novamente mais tarde.'));
  }
}