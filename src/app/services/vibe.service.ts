import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, throwError } from "rxjs";
import { catchError} from "rxjs/operators";


@Injectable({
    providedIn: 'root'
})

export class VibeService {

    constructor(private httpClient: HttpClient) { }
    private apiUrl = 'http://localhost:5030/api';

    private handleError(error: HttpErrorResponse) {
        let errorMessage = 'An error occurred';
        if (error.error instanceof ErrorEvent) {
            errorMessage = `Error: ${error.error.message}`;
        } else {
            errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
        }
        return throwError(() => errorMessage);
    }



    iniciarTarefa( data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/tarefa/iniciar-trajeto`, data)
            .pipe(
                catchError(this.handleError)
            );
    }

    finalizarTarefa(trajetoId: string, data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/tarefa/finalizar-trajeto/${trajetoId}`, data)
            .pipe(
                catchError(this.handleError)
            );
    }

    buscarTrajetoPorId(trajetoId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/tarefa/trajeto/${trajetoId}`)
            .pipe(
                catchError(this.handleError)
            );
    }
    buscarTrajetoPorUsuarioId(usuarioId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/tarefa/trajeto/${usuarioId}`)
            .pipe(
                catchError(this.handleError)
            );
    }

    iniciarOrdemServico(usuarioId: string, data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/tarefa/iniciar-execucao-servico/${usuarioId}`, data)
            .pipe(
                catchError(this.handleError)
            );
    }


    fimOrdemServico(execucaoServicoId: string, data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/tarefa/fim-execucao-servico/${execucaoServicoId}`, data)
            .pipe(
                catchError(this.handleError)
            );
    }

    buscarOrdemServicoPorId(execucaoServicoId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/tarefa/execucao-servico/${execucaoServicoId}`)
            .pipe(
                catchError(this.handleError)
            );
    }
    
    cadastrarEmpresa(data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/usuario/empresa`, data)
            .pipe(
                catchError(this.handleError)
            );
    }

    atualizarEmpresa(empresaId:string, data: any): Observable<any> {
        return this.httpClient.put<any>(`${this.apiUrl}/usuario/empresa/${empresaId}`, data)
            .pipe(
                catchError(this.handleError)
            );
    }

    buscarEmpresasPorId(empresaId:string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/empresa/${empresaId}`)
            .pipe(
                catchError(this.handleError)
            );
    }

    
    buscarEmpresas(): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/empresa`)
            .pipe(
                catchError(this.handleError)
            );
    }
    
    deletarEmpresa(empresaId:string ): Observable<any> {
        return this.httpClient.delete<any>(`${this.apiUrl}/usuario/empresa/${empresaId}`)
            .pipe(
                catchError(this.handleError)
            );
    }

    cadastrarCliente(data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/usuario/cliente`, data)
            .pipe(
                catchError(this.handleError)
            );
    }

    atualizarCliente(clienteId:string, data: any): Observable<any> {
        return this.httpClient.put<any>(`${this.apiUrl}/usuario/cliente/${clienteId}`, data)
            .pipe(
                catchError(this.handleError)
            );
    }

    buscarClientesPorCpf(cpf:string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/cliente/cpf/${cpf}`)
            .pipe(
                catchError(this.handleError)
            );
    }

    deletarCliente(clienteId:string ): Observable<any> {
        return this.httpClient.delete<any>(`${this.apiUrl}/usuario/cliente/${clienteId}`)
            .pipe(
                catchError(this.handleError)
            );
    }

  }