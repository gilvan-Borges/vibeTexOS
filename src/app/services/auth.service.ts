import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, catchError, switchMap, tap, map } from 'rxjs';
import { ControllAppService } from './controllApp.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private autenticadoSubject = new BehaviorSubject<boolean>(this.isLoggedIn());
  autenticado$ = this.autenticadoSubject.asObservable();

  private expedienteAtivoSubject = new BehaviorSubject<boolean>(false);
  expedienteAtivo$ = this.expedienteAtivoSubject.asObservable();

  private osEmAndamentoSubject = new BehaviorSubject<boolean>(false); // Novo BehaviorSubject para O.S. em andamento
  osEmAndamento$ = this.osEmAndamentoSubject.asObservable(); // Observable para O.S. em andamento

  constructor(
    private http: HttpClient,
    private router: Router,
    private controllAppService: ControllAppService,
    
  ) {
    // Restaurar estado do localStorage ao iniciar o serviço
    this.restaurarEstadoDoLocalStorage();
  }

  isLoggedIn(): boolean {
    return localStorage.getItem('usuario') !== null;
  }

  getUsuario(): any {
    const usuarioStorage = localStorage.getItem('usuario');
    return usuarioStorage ? JSON.parse(usuarioStorage).usuario : null;
  }

  login(userName: string, senha: string): void {
    // Exemplo obtendo geolocalização antes de tentar login
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);

        // 1ª TENTATIVA: endpoint do controllApp
        this.http
          .post(`${environment.controllApp}/usuario/authenticate`, { userName, senha })
          .pipe(
            catchError(err => {
              console.log('Tentando segundo endpoint (vibeservice)...');
              // Se der erro, retornamos null para sinalizar que o 1º endpoint falhou
              return of(null);
            })
          )
          .subscribe({
            next: (firstResponse: any) => {
              if (!firstResponse) {
                // 1º endpoint falhou -> faz a 2ª TENTATIVA no vibeservice
                this.http
                  .post(`${environment.vibeservice}/usuario/authenticate`, { userName, senha })
                  .subscribe({
                    next: (secondResponse: any) => {
                      console.log('Segundo endpoint autenticou com sucesso:', secondResponse);
                      this.processLoginSuccess(secondResponse, latitude, longitude);
                    },
                    error: (secondError) => {
                      console.error('Erro ao autenticar no segundo endpoint:', secondError);
                    },
                  });
              } else {
                // 1º endpoint teve sucesso
                console.log('Primeiro endpoint autenticou com sucesso:', firstResponse);
                this.processLoginSuccess(firstResponse, latitude, longitude);
              }
            },
            error: (firstError) => {
              // Caso o catchError não tenha capturado (erro muito cedo), cai aqui
              console.error('Erro inesperado no primeiro endpoint:', firstError);
            },
          });
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
      }
    );
  }

  /**
   * processLoginSuccess:
   * - Salva token no localStorage (se existir).
   * - Cria um objeto com dados do usuário, incluindo latitude/longitude.
   * - Redireciona com base no role do usuário.
   */
  private processLoginSuccess(response: any, latitude: string, longitude: string): void {
    // Se o back-end retorna um token, salve-o
    if (response.token) {
      localStorage.setItem('token', response.token);
      console.log('Token salvo com sucesso');
    }

    // Monta o objeto do usuário (ajuste conforme a estrutura do seu backend)
    const usuarioData = {
      usuario: response.usuario || response,            // se o backend devolve { usuario: {...}, token, ... }
      usuarioId: response.usuarioId || response.usuario?.usuarioId,
      token: response.token,
      isOnline: true,
      ultimaAutenticacao: new Date().toLocaleString(),
      latitudeAtual: latitude,
      longitudeAtual: longitude,
    };

    if (!usuarioData.usuarioId) {
      console.error('Resposta inválida: usuarioId não encontrado');
      return;
    }

    // Armazena no localStorage para persistência
    localStorage.setItem('usuario', JSON.stringify(usuarioData));
    console.log('Usuário salvo no localStorage:', usuarioData);

    // Redirecionamento baseado no "role"
    const role = usuarioData.usuario?.role?.toLowerCase();
    if (role === 'colaborador') {
      this.router.navigate([`/pages/expediente/${usuarioData.usuarioId}`]);
    } else if (role === 'administrador' || role === 'roteirizador') {
      this.router.navigate(['/pages/dashboard']);
    } else {
      console.log('Role não reconhecido. Ajuste a rota conforme necessário.');
    }
  }

  logout(): Promise<void> {
    return new Promise((resolve) => {
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
              this.osEmAndamentoSubject.next(false); // Define O.S. como inativa ao logout
              this.router.navigate(['/pages/usuarios/autenticar']);
              resolve();
            },
            error: (err) => {
              console.error('Erro ao atualizar status:', err);
              this.clearAllStorageData();
              this.autenticadoSubject.next(false);
              this.expedienteAtivoSubject.next(false);
              this.osEmAndamentoSubject.next(false); // Define O.S. como inativa ao logout
              this.router.navigate(['/pages/usuarios/autenticar']);
              resolve();
            },
          });
      } else {
        console.error('Usuário não encontrado para logout.');
        this.clearAllStorageData();
        this.autenticadoSubject.next(false);
        this.expedienteAtivoSubject.next(false);
        this.osEmAndamentoSubject.next(false); // Define O.S. como inativa ao logout
        this.router.navigate(['/pages/usuarios/autenticar']);
        resolve();
      }
    });
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
      this.router.navigate(['/pages/dashboard']);  // ✅ Agora Administrador e Roteirizador vão para o dashboard
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

        // Verificar O.S. em andamento (substitua pela lógica real do backend, se aplicável)
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
}