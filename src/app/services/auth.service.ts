import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, catchError, switchMap } from 'rxjs';
import { ControllAppService } from './controllApp.service';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private autenticadoSubject = new BehaviorSubject<boolean>(this.isLoggedIn());
  autenticado$ = this.autenticadoSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private controllAppService: ControllAppService
  ) {}

  isLoggedIn(): boolean {
    return localStorage.getItem('usuario') !== null;
  }

  getUsuario(): any {
    const usuarioStorage = localStorage.getItem('usuario');
    return usuarioStorage ? JSON.parse(usuarioStorage).usuario : null;
  }

  login(username: string, cpf: string, senha: string): void {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);

        // Tenta primeiro endpoint
        this.http.post(
          `${environment.controllApp}/usuario/authenticate`,
          { userName: username, cpf, senha }
        ).pipe(
          catchError(err => {
            console.log('Tentando segundo endpoint após falha no primeiro...');
            return this.http.post(
              `${environment.vibeservice}/usuario/authenticate`,
              { userName: username, cpf, senha }
            );
          }),
          catchError(err => {
            console.log('Ambos os endpoints falharam.');
            return of(null);
          })
        ).subscribe({
          next: (response: any) => {
            if (!response) {
              console.error('Nenhuma autenticação teve sucesso.');
              return;
            }

            // Salvar o token de autenticação
            if (response.token) {
              localStorage.setItem('token', response.token);
              console.log('Token salvo com sucesso');
            }

            // Ensure response has the expected structure
            const usuarioData = {
              usuario: response.usuario || response,
              usuarioId: response.usuarioId || response.usuario?.usuarioId,
              token: response.token, // Incluir o token nos dados do usuário
              isOnline: true,
              ultimaAutenticacao: new Date().toLocaleString(),
              latitudeAtual: latitude,
              longitudeAtual: longitude,
            };

            if (!usuarioData.usuarioId) {
              console.error('Resposta inválida: usuarioId não encontrado');
              return;
            }

            // Store complete user data
            localStorage.setItem('usuario', JSON.stringify(usuarioData));
            console.log('Usuário salvo:', usuarioData);
            
            this.autenticadoSubject.next(true);
            this.handleAuthentication(usuarioData);
          },
          error: (err) => {
            console.error('Erro ao autenticar:', err);
          },
        });
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
      }
    );
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
              this.router.navigate(['/pages/usuarios/autenticar']);
              resolve();
            },
            error: (err) => {
              console.error('Erro ao atualizar status:', err);
              this.clearAllStorageData();
              this.autenticadoSubject.next(false);
              this.router.navigate(['/pages/usuarios/autenticar']);
              resolve();
            },
          });
      } else {
        console.error('Usuário não encontrado para logout.');
        this.clearAllStorageData();
        this.autenticadoSubject.next(false);
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
    } else if (usuario.role?.toLowerCase() === 'administrador') {
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
}
