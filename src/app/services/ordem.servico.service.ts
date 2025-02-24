import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';

export interface OrdemServico {
  id: string;
  codigo: string;
  dataAbertura: Date;
  dataFinalizacao?: Date;
  tipo: string;
  status: string;
  endereco: string;
  tecnicoId?: string;
  tecnicoNome?: string;
  prioridade: string;
  tempoEstimado: number;
  tempoReal?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrdemServicoService {
  constructor(private http: HttpClient) {}

  getOrdens(): Observable<OrdemServico[]> {
    return this.http.get<OrdemServico[]>(`${environment.controllApp}/ordem-servico`);
  }

  getOrdensPorPeriodo(dataInicial: Date, dataFinal: Date): Observable<OrdemServico[]> {
    return this.http.get<OrdemServico[]>(
      `${environment.controllApp}/ordem-servico/periodo`,
      { params: { dataInicial: dataInicial.toISOString(), dataFinal: dataFinal.toISOString() } }
    );
  }

  getOrdensPorTecnico(tecnicoId: string): Observable<OrdemServico[]> {
    return this.http.get<OrdemServico[]>(`${environment.controllApp}/ordem-servico/tecnico/${tecnicoId}`);
  }
}
