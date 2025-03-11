import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { RegisterRequestDto } from "../models/control-app/register.request,dto";
import { RegisterResponseDto } from "../models/control-app/register.response.dto";
import { forkJoin, Observable, throwError, of } from "rxjs";
import { catchError, tap, map, retry, timeout } from "rxjs/operators";
import { environment } from "../../environments/environment.development";
import { AutenticarResponseDto } from "../models/control-app/autenticar.response.dto";
import { UsuarioResponseDto } from "../models/control-app/usuario.response.dto";
import { RegistrarPontoInicioResponseDto } from "../models/control-app/registrar.ponto.inicio.response.dto";
import { RegistrarPontoFimRequestDto } from "../models/control-app/registrar.ponto.fim.request";
import { RegistrarPontoFimResponseDto } from "../models/control-app/registrar.ponto.fim.response.dto";
import { RegistrarPausaInicioRequestDto } from "../models/control-app/registrar.pausa.inicio.request";
import { RegistrarInicioPausaResponseDto } from "../models/control-app/registrar.pausa.inicio.response";
import { RegistrarFimPausaResponseDto } from "../models/control-app/registrar.fim.pausa.response";
import { RegistrarFimPausaRequestDto } from "../models/control-app/registrar.fim.pausa.request";

@Injectable({
  providedIn: 'root'
})

export class ControllAppService {

  constructor(private httpClient: HttpClient) { }
  private apiUrl = 'https://localhost:5141/api';

  // Fix the headers method return type
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Token não encontrado');
      return new HttpHeaders();
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  register(formData: FormData): Observable<RegisterResponseDto> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    const url = `${environment.controllApp}/usuario/register`;
    console.log('🚀 Calling API:', url);
    console.log('📤 FormData contents:');
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
    });

    return this.httpClient.post<RegisterResponseDto>(url, formData, {
      headers,
      reportProgress: true
    }).pipe(
      tap(response => {
        console.log('📨 API Response:', response);
      }),
      catchError(this.handleError)
    );
  }

  autenticar(userName: string,  senha: string): Observable<any> {
    // Primeira requisição para o endpoint 1
    const request1 = this.httpClient.post<AutenticarResponseDto>(
      environment.controllApp + '/usuario/authenticate',
      { userName, senha }
    );

    // Segunda requisição para o endpoint 2
    const request2 = this.httpClient.post<AutenticarResponseDto>(
      environment.vibeservice + '/usuario/authenticate',
      { userName, senha }
    );

    // Executa ambas as requisições simultaneamente usando forkJoin
    return forkJoin([request1, request2]);
  }

  usuarioGetAll(request: RegisterRequestDto): Observable<UsuarioResponseDto[]> {
    return this.httpClient.get<UsuarioResponseDto[]>(
      `${environment.controllApp}/usuario/tecnicos`,
      {
        headers: this.getHeaders(),
        params: request as any
      }
    ).pipe(
      map(usuarios => usuarios.map(usuario => ({
        ...usuario,
        fotoUrl: usuario.fotoUrl ? `${environment.controllApp}${usuario.fotoUrl}` : ''
      }))),
      catchError(this.handleError)
    );
  }

  pontoRegistrarInicioExpediente(idUsuario: string, formData: FormData): Observable<RegistrarPontoInicioResponseDto> {
    const token = localStorage.getItem('token');
    if (!token) {
      return throwError(() => new Error('Token não encontrado'));
    }

    // For FormData, only include Authorization header
    const headers = {
      'Authorization': `Bearer ${token}`
    };

    console.log('📤 Dados do FormData:');
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
    });

    return this.httpClient.post<RegistrarPontoInicioResponseDto>(
      `${environment.controllApp}/ponto/${idUsuario}/registrarinicioexpediente/`,
      formData,
      { headers }
    ).pipe(
      tap(response => console.log('📨 Resposta da API:', response)),
      catchError(error => {
        console.error('❌ Erro na requisição:', error);
        if (error.status === 401) {
          console.error('Token inválido ou expirado');
        }
        return throwError(() => error);
      })
    );
  }

  pontoRegistarFimExpediente(usuarioId: string, pontoId: string, formData: FormData): Observable<RegistrarPontoFimResponseDto> {
    const token = localStorage.getItem('token');
    if (!token) {
      return throwError(() => new Error('Token não encontrado'));
    }
    
    // For FormData, only include Authorization header
    const headers = {
      'Authorization': `Bearer ${token}`
    };
    
    return this.httpClient.post<RegistrarPontoFimResponseDto>(
      `${environment.controllApp}/ponto/${usuarioId}/registrarfimexpediente/${pontoId}`,
      formData,
      { headers }
    ).pipe(
      tap(response => console.log('📨 Resposta da API:', response)),
      catchError(error => {
        console.error('❌ Erro na requisição:', error);
        throw error;
      })
    );
  }

  pontoRegistarInicioPausa(usuarioId: string, request: RegistrarPausaInicioRequestDto): Observable<RegistrarInicioPausaResponseDto> {
    return this.httpClient.post<RegistrarInicioPausaResponseDto>(
      `${environment.controllApp}/ponto/${usuarioId}/registrariniciopausa`,
      request,
      { headers: this.getHeaders() }
    );
  }


  registrarFimPausa(usuarioId: string, pontoId: string, request: RegistrarFimPausaRequestDto) {
    const headers = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`  // Recupere o token do localStorage ou onde você salvou
      }
    };

    const url = `https://localhost:5141/api/ponto/${usuarioId}/registrarfimpausa/${pontoId}`;
    console.log('URL correta:', url);
    console.log('Payload enviado:', request);

    return this.httpClient.post(url, request, headers);
  }

  getHorasTrabalhadas(usuarioId: string): Observable<any[]> {
    return this.httpClient.get<any[]>(`${this.apiUrl}/ponto/${usuarioId}/pontos-combinados`)
      .pipe(
        catchError(this.handleError)
      );
  }

  getHorasTrabalhadasPorId(usuarioId: string,): Observable<any[]> {
    return this.httpClient.get<any[]>(`${this.apiUrl}/ponto/${usuarioId}/tecnico-com-pontos`)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse) {
    console.error('An error occurred:', error);
    if (error.status === 401) {
      return throwError(() => new Error('Não autorizado. Por favor, faça login novamente.'));
    }
    if (error.status === 0) {
      return throwError(() => new Error('Erro de conexão com o servidor. Verifique sua conexão.'));
    }
    const message = error.error?.message || error.message || 'Erro desconhecido';
    return throwError(() => new Error(message));
  }

  uploadFile(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.httpClient.post<{ url: string }>('https://localhost:5141/api/image/upload', formData);
  }


  atualizarStatusUsuario(usuarioId: string, isOnline: boolean): Observable<any> {
    const formData = new FormData();
    formData.append('isOnline', JSON.stringify(isOnline));

    return this.httpClient.put(`${this.apiUrl}/usuario/update/${usuarioId}`, formData);
  }

  atualizarCoordenadasUsuario(usuarioId: string, latitude: string, longitude: string): Observable<any> {
    console.log('Enviando coordenadas via query string:', { latitude, longitude });
    return this.httpClient.put(
      `${this.apiUrl}/usuario/update-location/${usuarioId}?latitude=${latitude}&longitude=${longitude}`,
      {},
      { responseType: 'text' }  // Aqui informamos que a resposta esperada é texto simples
    );
  }

  atualizarUsuario(usuarioId: string, formData: FormData): Observable<RegisterResponseDto> {
    return this.httpClient.put<RegisterResponseDto>(
      `${this.apiUrl}/usuario/update/${usuarioId}`,
      formData
    );
  }

  usuarioGetById(id: string): Observable<UsuarioResponseDto> {
    return this.httpClient.get<UsuarioResponseDto>(`${this.apiUrl}/usuario/${id}`);
  }



  colaboradorPontoGetAll(usuarioId: string): Observable<any> {
    return this.httpClient.get(`${this.apiUrl}/ponto/${usuarioId}/tecnico-com-pontos`);
  }

  PontoGetAll(): Observable<any[]> {
    return this.httpClient.get<any[]>(`${this.apiUrl}/ponto/pontos-combinados`);
  }

  PontoTrajetos(): Observable<any[]> {
    return this.httpClient.get<any[]>(`${this.apiUrl}/ponto/pontos-trajetos`);
  }

  PontoGetByUsuarioId(usuarioId: string): Observable<any[]> {
        // Ensure usuarioId is properly formatted and URL doesn't have double slashes
    const url = `${this.apiUrl}/ponto/${usuarioId}/pontos-combinados`.replace(/([^:]\/)\/+/g, "$1");
    
    return this.httpClient.get<any[]>(url, { headers: this.getHeaders() }).pipe(
      retry(2), // Retry failed requests up to 2 times
      timeout(5000), // Set a 5-second timeout
      tap(response => {
        const count = response?.length || 0;
        console.log(`📌 Resposta da API pontos-combinados: ${count} registros encontrados`);
      }),
      catchError(error => {
        console.error(`❌ Erro ao buscar pontos para usuário ${usuarioId}:`, error);
        
        if (error.status === 401) {
          console.warn('🔑 Erro de autenticação ao buscar pontos. Token pode ter expirado.');
          // Poderia disparar uma ação de renovação de token aqui
        } else if (error.status === 400) {
          console.warn('🚫 Requisição inválida. Verifique parâmetros e formato.');
        }
        
        return throwError(() => error);
      })
    );
  }

  deleteById(id: string): Observable<any> {
    return this.httpClient.delete(`${this.apiUrl}/usuario/delete/${id}`,{
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
  cadastrarEmpresa(data: any): Observable<any> {
    return this.httpClient.post<any>(`${this.apiUrl}/usuario/empresa`, data, {
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
    return this.httpClient.get<any>(`${this.apiUrl}/usuario/empresa`, {
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

}