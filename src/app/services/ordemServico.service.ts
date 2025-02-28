import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class OrdemServicoService {
  private apiUrl = 'http://localhost:5030/api';

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

  private handleError(error: any): Observable<never> {
    console.error('Erro na requisição:', error);
    return throwError(() => new Error('Erro ao buscar dados. Tente novamente mais tarde.'));
  }
}