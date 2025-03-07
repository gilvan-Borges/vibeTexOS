import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, catchError, switchMap, tap, map, throwError } from 'rxjs';
import { ControllAppService } from './controllApp.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private autenticadoSubject = new BehaviorSubject<boolean>(false);
  autenticado$ = this.autenticadoSubject.asObservable();

  private expedienteAtivoSubject = new BehaviorSubject<boolean>(false);
  expedienteAtivo$ = this.expedienteAtivoSubject.asObservable();

  private osEmAndamentoSubject = new BehaviorSubject<boolean>(false);
  osEmAndamento$ = this.osEmAndamentoSubject.asObservable();

  private apiUrl = 'http://localhost:5030/api';

  constructor(
    private http: HttpClient,
    private router: Router,
    private controllAppService: ControllAppService,
  ) {
    this.restaurarEstadoDoLocalStorage();
    this.autenticadoSubject.next(this.isLoggedInInternal());
  }

  private isLoggedInInternal(): boolean {
    return localStorage.getItem('usuario') !== null;
  }

  isLoggedIn(): boolean {
    return this.autenticadoSubject.getValue();
  }

  getAutenticadoStatus(): Observable<boolean> {
    return this.autenticado$;
  }

  getUsuario(): any {
    const usuarioStorage = localStorage.getItem('usuario');
    return usuarioStorage ? JSON.parse(usuarioStorage).usuario : null;
  }

  login(userName: string, senha: string): void {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);

        // Tenta autenticar na primeira API (controllApp)
        this.http
          .post(`${environment.controllApp}/usuario/authenticate`, { userName, senha })
          .pipe(
            catchError((error1) => {
              console.error('Erro na primeira API (controllApp):', error1);
              // Se a primeira API falhar, tenta a segunda API (vibeservice)
              return this.http.post(`${environment.vibeservice}/usuario/authenticate`, { userName, senha }).pipe(
                catchError((error2) => {
                  console.error('Erro na segunda API (vibeservice):', error2);
                  this.autenticadoSubject.next(false);
                  return throwError(() => error2); // Propaga o erro final
                })
              );
            })
          )
          .subscribe({
            next: (response: any) => {
              console.log('Autenticação bem-sucedida:', response);
              this.processLoginSuccess(response, latitude, longitude);
              this.autenticadoSubject.next(true); // Atualiza o estado de autenticação
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

    const role = usuarioData.usuario?.role?.toLowerCase();
    if (role === 'colaborador') {
      this.router.navigate([`/pages/expediente/${usuarioData.usuarioId}`]);
    } else if (role === 'administrador' || role === 'roteirizador') {
      this.router.navigate(['/pages/dashboard']);
    } else {
      console.log('Role não reconhecido. Ajuste a rota conforme necessário.');
    }
  }

  logout(): void {
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

  private handleAuthentication(response: any): void {
    const usuario = response.usuario;
    console.log('Dados do usuário para autenticação:', usuario);

    if (!usuario || !usuario.usuarioId) {
      console.error('Erro: usuário ou ID do usuário não encontrado.', usuario);
      return;
    }

    console.log('Redirecionando o usuário com ID:', usuario.usuarioId);

    if (usuario.role?.toLowerCase() === 'colaborador') {
      this.router.navigate([`/pages/expediente/${usuario.usuarioId}`]);
    } else if (usuario.role?.toLowerCase() === 'administrador' || usuario.role?.toLowerCase() === 'roteirizador') {
      this.router.navigate(['/pages/dashboard']);
    }

    this.controllAppService
      .atualizarStatusUsuario(usuario.usuarioId, true)
      .subscribe({
        next: () => {
          console.log('Status atualizado com sucesso.');
        },
        error: (err) => {
          console.error('Erro ao atualizar status:', err);
        },
      });
  }

  private clearAllStorageData(): void {
    localStorage.removeItem('token');
    localStorage.clear();
    sessionStorage.clear();
  }

  verificarEstadoExpedienteEOS(usuarioId: string): Observable<void> {
    return this.controllAppService.PontoGetAll().pipe(
      map(response => {
        const hoje = new Date().toISOString().split('T')[0];
        const pontoAtivo = response.find(ponto =>
          ponto.usuarioId === usuarioId &&
          new Date(ponto.inicioExpediente).toISOString().split('T')[0] === hoje &&
          !ponto.fimExpediente
        );
        this.expedienteAtivoSubject.next(!!pontoAtivo);

        const osEmAndamento = localStorage.getItem('osEmAndamento') && localStorage.getItem('osIniciada') === 'true';
        this.osEmAndamentoSubject.next(!!osEmAndamento);
      }),
      catchError(err => {
        console.error('Erro ao verificar estado do expediente e O.S.:', err);
        this.expedienteAtivoSubject.next(false);
        this.osEmAndamentoSubject.next(false);
        return of(undefined);
      })
    );
  }

  setExpedienteAtivo(ativo: boolean): void {
    this.expedienteAtivoSubject.next(ativo);
  }

  setOsEmAndamento(ativo: boolean): void {
    this.osEmAndamentoSubject.next(ativo);
    localStorage.setItem('osIniciada', ativo.toString());
  }

  restaurarEstadoDoLocalStorage(): void {
    const usuario = this.getUsuario();
    if (usuario && usuario.usuarioId) {
      this.verificarEstadoExpedienteEOS(usuario.usuarioId).subscribe();
    }
    const osEmAndamento = localStorage.getItem('osIniciada') === 'true';
    this.osEmAndamentoSubject.next(osEmAndamento);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  verificarToken(): Observable<any> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => new Error('Token não encontrado'));
    }

    return this.http.get<any>(`${this.apiUrl}/auth/verificar-token`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).pipe(
      catchError(error => {
        console.error('Token inválido:', error);
        return throwError(() => error);
      })
    );
  }
}