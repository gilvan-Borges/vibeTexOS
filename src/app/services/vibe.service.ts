import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, throwError } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
import { DespachoResponseDto } from "../models/vibe-service/despacho.response.dto";
import { CriarOrdemDeServicoRequestDto } from "../models/vibe-service/criarOrdemDeServicoRequestDto";
import { CriarOrdemDeServicoResponseDto } from "../models/vibe-service/criarOrdemDeServicoResponseDto";
import { ExecucaoResponseDto } from "../models/vibe-service/execucao.response.Dto";
import { ExecucaoRequestDto } from "../models/vibe-service/execucao.request.Dto";
import { IniciarTrajetoRequestDto } from '../models/vibe-service/iniciarTrajetoRequestDto';
import { IniciarTrajetoResponseDto } from '../models/vibe-service/iniciarTrajetoResponseDto';
import { ExecucaoFimResponseDto } from "../models/vibe-service/execucao.Fim.Response.Dto";
import { ExecucaoFimRequestDto } from "../models/vibe-service/execucao.Fim.Request.Dto";

@Injectable({
    providedIn: 'root'
})

export class VibeService {

    constructor(private httpClient: HttpClient) { }
    public apiUrl = 'http://localhost:5030/api';

    private handleError(error: HttpErrorResponse) {
        let errorMessage = 'An error occurred';
        if (error.error instanceof ErrorEvent) {
            errorMessage = `Error: ${error.error.message}`;
        } else {
            errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
        }
        return throwError(() => errorMessage);
    }

    private getHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('Token não encontrado');
            return new HttpHeaders();
        }
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
    }



    atualizarUsuarioTecnico(empresaId: string, usuarioId: string, data: any): Observable<any> {
        const url = `${this.apiUrl}/usuario/${empresaId}/${usuarioId}/atualizar-tecnico`;
        console.log('📡 Atualizando usuário técnico:', { url, data });

        return this.httpClient.put<any>(url, data, {
            headers: this.getHeaders()
        }).pipe(
            tap(response => console.log('✅ API Response:', response)),
            catchError(error => {
                console.error('❌ API Error:', error);
                return throwError(() => error);
            })
        );
    }

    cadastrarOrdemServico(
        clienteId: string,
        data: CriarOrdemDeServicoRequestDto
    ): Observable<CriarOrdemDeServicoResponseDto> {
        const url = `${this.apiUrl}/usuario/ordem-servico/${clienteId}`;
        return this.httpClient.post<CriarOrdemDeServicoResponseDto>(url, data, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    buscarOrdemServicoPorId(ordemDeServicoId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/ordem-servico/${ordemDeServicoId}`, {
            headers: this.getHeaders() // Adiciona os headers com token
        }).pipe(
            catchError(this.handleError)
        );
    }

    deletarOrdemServico(ordemDeServicoId: string): Observable<any> {
        return this.httpClient.delete<any>(`${this.apiUrl}/usuario/ordem-servico/${ordemDeServicoId}`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }


    atualizarOrdemServicoDespacho(ordemDeServicoId: string, colaboradorId: string): Observable<any> {
        // Corrigindo a URL (dispachar -> despachar) e usando PUT em vez de POST
        const url = `${this.apiUrl}/usuario/ordem-servico/${ordemDeServicoId}/dispachar/${colaboradorId}`;
        return this.httpClient.put(url, {}, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    atualizarOrdemServico(
        ordemDeServicoId: string, requestData: CriarOrdemDeServicoRequestDto): Observable<any> {

        return this.httpClient.put<any>(`${this.apiUrl}/usuario/ordem-servico/${ordemDeServicoId}`,
            requestData,
            { headers: this.getHeaders() }
        ).pipe(catchError(this.handleError));
    }


    buscarOrdemServicoUsuarioId(usuarioId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/ordem-servico/usuario/${usuarioId}`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    buscarOrdemServico(): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/ordem-servico`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }


    iniciarTrajeto(despachoId: string, usuarioId: string, request: IniciarTrajetoRequestDto): Observable<IniciarTrajetoResponseDto> {
        return this.httpClient.post<IniciarTrajetoResponseDto>(
            `${this.apiUrl}/tarefa/${despachoId}/${usuarioId}/iniciar-trajeto`,
            request,
            { headers: this.getHeaders() }
        ).pipe(
            tap(response => console.log('Trajeto iniciado:', response)),
            catchError(this.handleError)
        );
    }

    finalizarTrajeto(trajetoId: string, usuarioId: string, data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/tarefa/finalizar-trajeto/${trajetoId}/${usuarioId}`, data, {
            headers: this.getHeaders()
        }).pipe(
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

    // Iniciar execução with FormData
    iniciarExecucaoServico(trajetoIdFinalizado: string, usuarioId: string, request: FormData): Observable<ExecucaoResponseDto> {
        const url = `${this.apiUrl}/tarefa/iniciar-execucao-servico/${trajetoIdFinalizado}/${usuarioId}`;
        return this.httpClient.post<ExecucaoResponseDto>(url, request, {
            headers: new HttpHeaders({
                // Não defina 'Content-Type' explicitamente, pois FormData define automaticamente multipart/form-data
            })
        });
    }

    cancelarExecucaoServico(execucaoServicoId: string, usuarioId: string, formData: FormData): Observable<ExecucaoResponseDto> {
        const url = `${this.apiUrl}/tarefa/cancelar-execucao-servico/${execucaoServicoId}/${usuarioId}`;

        return this.httpClient.post<ExecucaoResponseDto>(url, formData, {
            headers: new HttpHeaders({
                // Não defina 'Content-Type' explicitamente, pois FormData define automaticamente multipart/form-data
            })
        });
    }

    public finalizarExecucaoServico(execucaoId: string, usuarioId: string, data: FormData | ExecucaoFimRequestDto): Observable<ExecucaoFimResponseDto> {
        const url = `${this.apiUrl}/tarefa/finalizar-execucao-servico/${execucaoId}/${usuarioId}`;

        // If it's FormData, send it directly
        if (data instanceof FormData) {
            return this.httpClient.post<ExecucaoFimResponseDto>(url, data);
        }

        // If it's ExecucaoFimRequestDto, convert to FormData
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, value);
            }
        });

        return this.httpClient.post<ExecucaoFimResponseDto>(url, formData);
    }

    cadastrarEmpresa(data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/usuario/empresa`, data, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    atualizarEmpresa(empresaId: string, data: any): Observable<any> {
        return this.httpClient.put<any>(`${this.apiUrl}/usuario/empresa/${empresaId}`, data, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    buscarEmpresasPorId(empresaId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/empresa/${empresaId}`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }


    buscarEmpresas(): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/empresa/todos`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    deletarEmpresa(empresaId: string): Observable<any> {
        return this.httpClient.delete<any>(`${this.apiUrl}/usuario/empresa/${empresaId}`, {
            headers: this.getHeaders(),
            responseType: 'text' as 'json' // Add this line to handle empty responses
        }).pipe(
            map(() => ({ success: true })), // Transform empty response to a success object
            catchError(this.handleError)
        );
    }

    cadastrarCliente(data: any): Observable<any> {
        return this.httpClient.post<any>(`${this.apiUrl}/usuario/cliente`, data, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    atualizarCliente(clienteId: string, data: any): Observable<any> {
        return this.httpClient.put<any>(`${this.apiUrl}/usuario/cliente/${clienteId}`, data, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    buscarClientesPorCpf(cpf: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/cliente/cpf/${cpf}`)
            .pipe(
                catchError(this.handleError)
            );
    }

    buscarClientesPorId(clienteId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/clientes/id/${clienteId}`)
            .pipe(
                catchError(this.handleError)
            );
    }


    buscarClientes(): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/clientes`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }


    deletarCliente(clienteId: string): Observable<any> {
        return this.httpClient.delete<any>(`${this.apiUrl}/usuario/cliente/${clienteId}`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    buscarClientePorId(clienteId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/cliente/${clienteId}`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    buscarUsuarioPorId(usuarioId: string): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/public/tecnico/${usuarioId}`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    buscarUsuario(): Observable<any> {
        return this.httpClient.get<any>(`${this.apiUrl}/usuario/public/tecnico`, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }

    buscarFotoUsuario(usuarioId: string): Observable<any> {
        return this.httpClient.get(`${this.apiUrl}/usuario/public/tecnico/foto/${usuarioId}`, {
            responseType: 'blob'
        }).pipe(
            catchError(this.handleError)
        );
    }

    enviarFormularioServico(ordemServicoId: string, formData: FormData): Observable<any> {
        const url = `${this.apiUrl}/tarefa/ordem-servico/${ordemServicoId}/assinatura`;

        // Using new HttpHeaders without Content-Type for FormData
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        });

        return this.httpClient.put<any>(url, formData, { headers }).pipe(
            tap(response => console.log('Formulário enviado com sucesso:', response)),
            catchError(error => {
                console.error('Erro ao enviar formulário:', error);
                return throwError(() => error);
            })
        );
    }

}