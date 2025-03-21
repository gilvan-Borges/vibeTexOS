import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, throwError } from "rxjs";
import { catchError, map, tap } from "rxjs/operators";
import { CriarOrdemDeServicoRequestDto } from "../models/vibe-service/criarOrdemDeServicoRequestDto";
import { CriarOrdemDeServicoResponseDto } from "../models/vibe-service/criarOrdemDeServicoResponseDto";
import { ExecucaoResponseDto } from "../models/vibe-service/execucao.response.Dto";
import { IniciarTrajetoRequestDto } from '../models/vibe-service/iniciarTrajetoRequestDto';
import { IniciarTrajetoResponseDto } from '../models/vibe-service/iniciarTrajetoResponseDto';
import { ExecucaoFimResponseDto } from "../models/vibe-service/execucao.Fim.Response.Dto";
import { ExecucaoFimRequestDto } from "../models/vibe-service/execucao.Fim.Request.Dto";
import { RegisterRoteirizadorRequestDto, RegisterRoteirizadorResponseDto } from "../models/vibe-service/registerRoteirizadorDto";
import { ReiniciarExecucaoServicoRequestDto } from "../models/vibe-service/reiniciar.Execucao.Servico.Request.Dto";
import { ReiniciarExecucaoServicoResponseDto } from "../models/vibe-service/reiniciar.Execucao.Servico.Response.Dto";
import { environment } from "../../environments/environment.development";

@Injectable({
    providedIn: 'root'
})

export class VibeService {

    constructor(private httpClient: HttpClient) { }
    public apiUrl =  environment.vibeservice;

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
            console.warn('Token não encontrado no localStorage');
            return new HttpHeaders({
                'Content-Type': 'application/json'
            });
        }

        console.log('Token encontrado:', token.substring(0, 10) + '...');
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });
    }


    cadastrarRoteirizador(request: FormData): Observable<any> {
        return this.httpClient.post(`${this.apiUrl}/roteirizadores`, request, {
            headers: this.getHeaders()
        }).pipe(
            catchError(this.handleError)
        );
    }


    // Método para enviar como application/json
    cadastrarRoteirizadorJson(data: { nome: string; userName: string; senha: string }): Observable<any> {
        // Usa getHeaders() e adiciona Content-Type
        const headers = this.getHeaders().set('Content-Type', 'application/json');
        return this.httpClient.post(`${this.apiUrl}/roteirizadores`, data, { headers }).pipe(
            catchError(this.handleError)
        );
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
        return this.httpClient.delete(`${this.apiUrl}/usuario/ordem-servico/${ordemDeServicoId}`, {
            headers: this.getHeaders(),
            responseType: 'text' // Define que a resposta pode ser texto (ou vazia)
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
                
            })
        });
    }

    cancelarExecucaoServico(execucaoServicoId: string, usuarioId: string, formData: FormData): Observable<ExecucaoResponseDto> {
        const url = `${this.apiUrl}/tarefa/cancelar-execucao-servico/${execucaoServicoId}/${usuarioId}`;

        return this.httpClient.post<ExecucaoResponseDto>(url, formData, {
            headers: new HttpHeaders({
            })
        });
    }

    reiniciarExecucaoServico(execucaoServicoId: string, usuarioId: string, formData: FormData): Observable<ReiniciarExecucaoServicoResponseDto> {
       
        const url = `${this.apiUrl}/tarefa/reiniciar-execucao-servico/${execucaoServicoId}/${usuarioId}`;
        console.log('URL gerada para iniciarTrajeto:', url); // Log para depuração
        console.log('Requisição enviada:', formData);
        return this.httpClient.post<ReiniciarExecucaoServicoResponseDto>(url, formData, {
          headers: new HttpHeaders({})
          
        }).pipe(
          tap(response => console.log('Execução reiniciada:', response)),
          catchError(this.handleError)
          
        );
        
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
        const token = localStorage.getItem('token');

        // Usando new HttpHeaders sem Content-Type para FormData
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });

        console.log('Enviando formulário de serviço com token:', token ? 'Token presente' : 'Token ausente');

        return this.httpClient.put<any>(url, formData, { headers }).pipe(
            tap(response => console.log('Formulário enviado com sucesso:', response)),
            catchError(error => {
                console.error('Erro ao enviar formulário:', error);
                return throwError(() => error);
            })
        );
    }
}