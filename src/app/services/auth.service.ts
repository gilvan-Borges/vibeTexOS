import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, catchError, switchMap, tap, map, throwError } from 'rxjs';
import { ControllAppService } from './controllApp.service';
import { VibeService } from './vibe.service'; // Injete o VibeService
import { environment } from '../../environments/environment';
import { CriarOrdemDeServicoResponseDto } from '../models/vibe-service/criarOrdemDeServicoResponseDto'; // Ajuste o caminho

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = environment.vibeservice;

  private autenticadoSubject = new BehaviorSubject<boolean>(false);
  public autenticado$ = this.autenticadoSubject.asObservable();

  private expedienteAtivoSubject = new BehaviorSubject<boolean>(false);
  public expedienteAtivo$ = this.expedienteAtivoSubject.asObservable();

  private osEmAndamentoSubject = new BehaviorSubject<boolean>(false);
  public osEmAndamento$ = this.osEmAndamentoSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private controllAppService: ControllAppService,
    private vibeService: VibeService // Injete o VibeService
  ) {
    this.restaurarEstadoDoLocalStorage();
    this.autenticadoSubject.next(this.isLoggedInInternal());
  }

  private isLoggedInInternal(): boolean {
    return localStorage.getItem('usuario') !== null;
  }

  public isLoggedIn(): boolean {
    return this.autenticadoSubject.getValue();
  }

  public getAutenticadoStatus(): Observable<boolean> {
    return this.autenticado$;
  }

  public getUsuario(): any {
    const usuarioStorage = localStorage.getItem('usuario');
    return usuarioStorage ? JSON.parse(usuarioStorage).usuario : null;
  }

  public login(userName: string, senha: string): void {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);

        this.http
          .post(`${environment.controllApp}/usuario/authenticate`, { userName, senha })
          .pipe(
            catchError((error1) => {
              console.error('Erro na primeira API (controllApp):', error1);
              return this.http.post(`${environment.vibeservice}/usuario/authenticate`, { userName, senha }).pipe(
                catchError((error2) => {
                  console.error('Erro na segunda API (vibeservice):', error2);
                  this.autenticadoSubject.next(false);
                  return throwError(() => error2);
                })
              );
            })
          )
          .subscribe({
            next: (response: any) => {
              console.log('Autenticação bem-sucedida:', response);
              this.processLoginSuccess(response, latitude, longitude);
              this.autenticadoSubject.next(true);
            },
            error: (error) => {
              console.error('Erro geral na autenticação:', error);
              this.autenticadoSubject.next(false);
            },
          });
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        this.autenticadoSubject.next(false);
      }
    );
  }

  private processLoginSuccess(response: any, latitude: string, longitude: string): void {
    if (response.token) {
      localStorage.setItem('token', response.token);
      console.log('Token salvo com sucesso');
    }

    const usuarioData = {
      usuario: response.usuario || response,
      usuarioId: response.usuarioId || response.usuario?.usuarioId,
      nomeUsuario: response.username || response.usuario?.username,
      token: response.token,
      role: response.role || response.usuario?.role,
      isOnline: true,
      ultimaAutenticacao: new Date().toLocaleString(),
      latitudeAtual: latitude,
      longitudeAtual: longitude,
    };

    if (!usuarioData.usuarioId) {
      console.error('Resposta inválida: usuarioId não encontrado');
      return;
    }

    localStorage.setItem('usuario', JSON.stringify(usuarioData));
    console.log('Usuário salvo no localStorage:', usuarioData);

    // Verificar O.S. em andamento na API após login
    this.verificarOrdemEmAndamentoNaAPI(usuarioData.usuarioId);

    const role = usuarioData.usuario?.role?.toLowerCase();
    if (role === 'colaborador') {
      this.router.navigate([`/pages/horas-colaborador/${usuarioData.usuarioId}`], { replaceUrl: true });
    } else if (role === 'administrador' || role === 'roteirizador') {
      this.router.navigate(['/pages/dashboard'], { replaceUrl: true });
    } else {
      console.log('Role não reconhecido. Ajuste a rota conforme necessário.');
    }

    // Recarrega a página após a navegação para qualquer tipo de usuário
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }

  public logout(): void {
    const usuario = this.getUsuario();
    if (usuario && usuario.usuarioId) {
      this.controllAppService
        .atualizarStatusUsuario(usuario.usuarioId, false)
        .subscribe({
          next: () => {
            console.log('Status atualizado para offline.');
            this.clearAllStorageData();
            this.autenticadoSubject.next(false);
            this.expedienteAtivoSubject.next(false);
            this.osEmAndamentoSubject.next(false);
            this.router.navigate(['/pages/usuarios/autenticar']);
          },
          error: (err) => {
            console.error('Erro ao atualizar status:', err);
            this.clearAllStorageData();
            this.autenticadoSubject.next(false);
            this.expedienteAtivoSubject.next(false);
            this.osEmAndamentoSubject.next(false);
            this.router.navigate(['/pages/usuarios/autenticar']);
          },
        });
    } else {
      console.error('Usuário não encontrado para logout.');
      this.clearAllStorageData();
      this.autenticadoSubject.next(false);
      this.expedienteAtivoSubject.next(false);
      this.osEmAndamentoSubject.next(false);
      this.router.navigate(['/pages/usuarios/autenticar']);
    }
  }

  private clearAllStorageData(): void {
    localStorage.removeItem('token');
    localStorage.clear();
    sessionStorage.clear();
  }

  public verificarEstadoExpedienteEOS(usuarioId: string): Observable<void> {
    return this.controllAppService.PontoGetAll().pipe(
      map((response) => {
        const hoje = new Date().toISOString().split('T')[0];
        const pontoAtivo = response.find(
          (ponto) =>
            ponto.usuarioId === usuarioId &&
            new Date(ponto.inicioExpediente).toISOString().split('T')[0] === hoje &&
            !ponto.fimExpediente
        );
        this.expedienteAtivoSubject.next(!!pontoAtivo);

        // Não verificar localStorage aqui, apenas API
        this.verificarOrdemEmAndamentoNaAPI(usuarioId);
      }),
      catchError((err) => {
        console.error('Erro ao verificar estado do expediente e O.S.:', err);
        this.expedienteAtivoSubject.next(false);
        this.osEmAndamentoSubject.next(false);
        return of(undefined);
      })
    );
  }

  public setExpedienteAtivo(ativo: boolean): void {
    this.expedienteAtivoSubject.next(ativo);
  }

  public setOsEmAndamento(value: boolean): void {
    this.osEmAndamentoSubject.next(value);
    localStorage.setItem('osEmAndamento', value.toString());
  }

  private restaurarEstadoDoLocalStorage(): void {
    const usuario = this.getUsuario();
    if (usuario && usuario.usuarioId) {
      this.verificarEstadoExpedienteEOS(usuario.usuarioId).subscribe();
    }
    // Remover verificação inicial do localStorage para osEmAndamento
    this.osEmAndamentoSubject.next(false); // Estado inicial falso até a API verificar
  }

  public getToken(): string | null {
    return localStorage.getItem('token');
  }

  public setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  public verificarToken(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('Token não encontrado'));
    }

    return this.http.get<any>(`${this.apiUrl}/auth/verificar-token`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((error) => {
        console.error('Token inválido:', error);
        return throwError(() => error);
      })
    );
  }

  // Método para verificar O.S. em andamento na API
  private verificarOrdemEmAndamentoNaAPI(usuarioId: string): void {
    this.vibeService.buscarOrdemServicoUsuarioId(usuarioId).subscribe({
      next: (response: CriarOrdemDeServicoResponseDto[]) => {
        console.log('Resposta da API para ordens:', response);

        const ordemEmAndamento = response.find(
          (ordem) => ordem.statusOrdem === 'EmAndamento' && ordem.usuarioId === usuarioId
        );

        if (ordemEmAndamento) {
          console.log('Ordem em andamento encontrada:', ordemEmAndamento);
          localStorage.setItem('osEmAndamento', 'true');
          localStorage.setItem('ordemServicoId', ordemEmAndamento.ordemDeServicoId || '');
          this.osEmAndamentoSubject.next(true);
        } else {
          console.log('Nenhuma ordem em andamento encontrada para o usuarioId:', usuarioId);
          localStorage.setItem('osEmAndamento', 'false');
          this.osEmAndamentoSubject.next(false);
        }
      },
      error: (error) => {
        console.error('Erro ao verificar ordens em andamento:', error);
        localStorage.setItem('osEmAndamento', 'false');
        this.osEmAndamentoSubject.next(false);
      },
    });
  }
}