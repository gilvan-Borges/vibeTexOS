import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  of,
  catchError,
  map,
  throwError,
} from 'rxjs';
import { ControllAppService } from './controllApp.service';
import { VibeService } from './vibe.service';
import { environment } from '../../environments/environment';
import { CriarOrdemDeServicoResponseDto } from '../models/vibe-service/criarOrdemDeServicoResponseDto';

interface RegistroPonto {
  id: string;
  pontoIdExpediente: string;
  pontoIdPausa: string | null;
  usuarioId: string;
  inicioExpediente: string | null;
  fimExpediente: string | null;
  inicioPausa: string | null;
  retornoPausa: string | null;
}

// Dados do expediente salvos no localStorage
interface DadosExpediente {
  pontoIdExpediente: string | null;
  pontoIdPausa: string | null;
  timestamps: {
    inicio: string;
    'almoco-inicio': string;
    'almoco-fim': string;
    fim: string;
  };
  disabled: boolean[];
  inicioPausaTime: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = environment.vibeservice;

  // Observables para estados
  private autenticadoSubject = new BehaviorSubject<boolean>(false);
  public autenticado$ = this.autenticadoSubject.asObservable();

  private expedienteSubject = new BehaviorSubject<RegistroPonto | null>(null);
  public expediente$ = this.expedienteSubject.asObservable();

  private expedienteAtivoSubject = new BehaviorSubject<boolean>(false);
  public expedienteAtivo$ = this.expedienteAtivoSubject.asObservable();

  private osEmAndamentoSubject = new BehaviorSubject<boolean>(false);
  public osEmAndamento$ = this.osEmAndamentoSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private controllAppService: ControllAppService,
    private vibeService: VibeService
  ) {
    this.restaurarEstadoDoLocalStorage();
    this.autenticadoSubject.next(this.isLoggedInInternal());
  }

  // ----------------------------------------------------------------
  //  Métodos públicos de autenticação / estado
  // ----------------------------------------------------------------

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
    // Obtém geolocalização para salvar no usuário
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);

        this.autenticarPrimeiraTentativa(userName, senha, latitude, longitude);
      },
      (error) => {
        console.error('Erro ao obter geolocalização:', error);
        this.autenticadoSubject.next(false);
      }
    );
  }
  private atualizarLocalizacao(usuarioId: string): void {
    console.log('[DEBUG] Disparando captura de localização');
  
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(7);
        const longitude = position.coords.longitude.toFixed(7);
  
        console.log('[DEBUG] Localização capturada com sucesso:', { latitude, longitude });
  
        this.controllAppService.atualizarCoordenadasUsuario(usuarioId, latitude, longitude).subscribe({
          next: () => {
            console.log('[DEBUG] Localização atualizada na API com sucesso');
  
            // Atualizar no localStorage
            const usuarioStorage = localStorage.getItem('usuario');
            if (usuarioStorage) {
              const usuarioData = JSON.parse(usuarioStorage);
              usuarioData.latitudeAtual = latitude;
              usuarioData.longitudeAtual = longitude;
              localStorage.setItem('usuario', JSON.stringify(usuarioData));
              console.log('[DEBUG] LocalStorage atualizado com nova localização:', {
                latitudeAtual: usuarioData.latitudeAtual,
                longitudeAtual: usuarioData.longitudeAtual,
              });
            }
          },
          error: (err) => {
            console.error('[DEBUG] Erro ao atualizar localização na API:', err);
          }
        });
      },
      (error) => {
        console.error('[DEBUG] Erro ao capturar localização do navegador:', error);
      }
    );
  }
  

  private iniciarAtualizacaoPeriodicaLocalizacao(usuarioId: string): void {
    console.log('[DEBUG] 🕒 iniciando atualização periódica para:', usuarioId);
  
    this.atualizarLocalizacao(usuarioId);
  
    setInterval(() => {
      this.atualizarLocalizacao(usuarioId);
    }, 60000);
  }


  public logout(): void {
    const usuario = this.getUsuario();
    if (usuario?.usuarioId) {
      this.controllAppService.atualizarStatusUsuario(usuario.usuarioId, false).subscribe({
        next: () => this.finalizarLogout(),
        error: (err) => {
          console.error('Erro ao atualizar status:', err);
          this.finalizarLogout();
        },
      });
    } else {
      this.finalizarLogout();
    }
  }

  public verificarEstadoExpedienteEOS(usuarioId: string): Observable<void> {
    console.log('[DEBUG] Verificando estado expediente para usuarioId:', usuarioId);

    return this.controllAppService.PontoGetByUsuarioId(usuarioId).pipe(
      map((registros: RegistroPonto[]) => {
        console.log('[DEBUG] Registros de ponto obtidos:', registros);
        const pontoAtivo = registros.find(
          (ponto) => ponto.inicioExpediente && !ponto.fimExpediente
        );

        // Atualiza o estado local e localStorage
        this.expedienteAtivoSubject.next(!!pontoAtivo);
        localStorage.setItem('expedienteAtivo', String(!!pontoAtivo));

        if (pontoAtivo) {
          this.salvarDadosExpedienteNoLocalStorage(pontoAtivo);
        }

        // Também verifica se há ordem de serviço em andamento
        this.verificarOrdemEmAndamentoNaAPI(usuarioId);
      }),
      catchError((err) => {
        console.error('[DEBUG] Erro ao verificar estado:', err);
        this.expedienteAtivoSubject.next(false);
        this.osEmAndamentoSubject.next(false);
        return of(undefined);
      })
    );
  }

  // ----------------------------------------------------------------
  //  Métodos auxiliares de login
  // ----------------------------------------------------------------

  private autenticarPrimeiraTentativa(
    userName: string,
    senha: string,
    latitude: string,
    longitude: string
  ): void {
    // Primeira tentativa: controllApp
    this.http
      .post(`${environment.controllApp}/usuario/authenticate`, { userName, senha })
      .pipe(
        catchError((error1) => {
          console.error('Erro na API controllApp:', error1);
          // Segunda tentativa: vibeService
          return this.http
            .post(`${environment.vibeservice}/usuario/authenticate`, { userName, senha })
            .pipe(
              catchError((error2) => {
                console.error('Erro na API vibeservice:', error2);
                this.autenticadoSubject.next(false);
                return throwError(() => error2);
              })
            );
        })
      )
      .subscribe({
        next: (response: any) => {
          this.processLoginSuccess(response, latitude, longitude);
          this.autenticadoSubject.next(true);
        },
        error: (error) => {
          console.error('Erro na autenticação:', error);
          this.autenticadoSubject.next(false);
        },
      });
  }

  private processLoginSuccess(response: any, latitude: string, longitude: string): void {
    if (response.token) {
      localStorage.setItem('token', response.token);
    }

    const usuarioData = this.montarUsuarioData(response, latitude, longitude);
    if (!usuarioData.usuarioId) {
      console.error('usuarioId não encontrado na resposta');
      return;
    }

    localStorage.setItem('usuario', JSON.stringify(usuarioData));
    localStorage.setItem('usuarioId', usuarioData.usuarioId);

    // Busca registros de expediente e O.S. em andamento
    this.buscarRegistrosExpedienteDoDia(usuarioData.usuarioId);
    this.verificarOrdemEmAndamentoNaAPI(usuarioData.usuarioId);

    // Redireciona com base no role e, após navegar, recarrega
    const role = usuarioData.role?.toLowerCase();
    let rotaDestino = '/pages/dashboard';

    if (role === 'colaborador') {
      rotaDestino = `/pages/horas-colaborador/${usuarioData.usuarioId}`;
    } else if (role === 'administrador' || role === 'roteirizador') {
      rotaDestino = '/pages/dashboard';
    }

    this.router.navigate([rotaDestino], { replaceUrl: true }).then(() => {
      window.location.reload();
    });
    this.iniciarAtualizacaoPeriodicaLocalizacao(usuarioData.usuarioId);

  }

  private montarUsuarioData(response: any, latitude: string, longitude: string): any {
    return {
      usuario: response.usuario || response,
      usuarioId: response.usuarioId || response.usuario?.usuarioId,
      nomeUsuario: response.username || response.usuario?.username,
      token: response.token,
      role: response.role || response.usuario?.role,
      isOnline: true,
      ultimaAutenticacao: new Date().toISOString(),
      latitudeAtual: latitude,
      longitudeAtual: longitude,
    };
  }

  // ----------------------------------------------------------------
  //  Métodos para gerenciar dados de expediente
  // ----------------------------------------------------------------

  private buscarRegistrosExpedienteDoDia(usuarioId: string): void {
    console.log('[DEBUG] Buscando registros de expediente para usuarioId:', usuarioId);

    this.controllAppService.PontoGetByUsuarioId(usuarioId).subscribe({
      next: (registros: RegistroPonto[]) => {
        console.log('[DEBUG] Registros obtidos da API:', registros);

        if (!registros || registros.length === 0) {
          console.warn('[DEBUG] Nenhum registro encontrado na API');
          this.inicializarDadosExpedientePadrao();
          return;
        }

        // Filtra registros do dia atual
        let registrosDoDia = registros.filter((r) =>
          this.verificarDataDeHoje(r.inicioExpediente) ||
          this.verificarDataDeHoje(r.fimExpediente) ||
          this.verificarDataDeHoje(r.inicioPausa) ||
          this.verificarDataDeHoje(r.retornoPausa)
        );

        console.log('[DEBUG] Registros filtrados como "dia atual":', registrosDoDia);

        // Se não houver para hoje, pega o mais recente com início
        if (registrosDoDia.length === 0) {
          console.warn('[DEBUG] Nenhum registro para hoje; usando o mais recente');
          registrosDoDia = registros
            .filter((r) => !!r.inicioExpediente)
            .sort(
              (a, b) =>
                new Date(b.inicioExpediente!).getTime() -
                new Date(a.inicioExpediente!).getTime()
            );
        }

        if (registrosDoDia.length === 0) {
          this.inicializarDadosExpedientePadrao();
          return;
        }

        // Seleciona o primeiro como mais relevante
        const registro = registrosDoDia[0];
        console.log('[DEBUG] Registro escolhido:', registro);

        // Define estado dos botões e salva no localStorage
        const dadosExpediente: DadosExpediente = {
          pontoIdExpediente: registro.pontoIdExpediente || null,
          pontoIdPausa: registro.pontoIdPausa || null,
          timestamps: {
            inicio: registro.inicioExpediente || '',
            'almoco-inicio': registro.inicioPausa || '',
            'almoco-fim': registro.retornoPausa || '',
            fim: registro.fimExpediente || '',
          },
          disabled: this.determinarEstadoBotoes(registro),
          inicioPausaTime: registro.inicioPausa || '',
        };

        console.log('[DEBUG] Salvando dadosExpediente no localStorage:', dadosExpediente);
        localStorage.setItem('dadosExpediente', JSON.stringify(dadosExpediente));

        if (registro.pontoIdExpediente) {
          localStorage.setItem('pontoIdExpediente', registro.pontoIdExpediente);
        }
        if (registro.pontoIdPausa) {
          localStorage.setItem('pontoIdPausa', registro.pontoIdPausa);
        }

        const expedienteAtivo = !!registro.inicioExpediente && !registro.fimExpediente;
        localStorage.setItem('expedienteAtivo', String(expedienteAtivo));
        this.expedienteAtivoSubject.next(expedienteAtivo);

        console.log('[DEBUG] ExpedienteAtivo:', expedienteAtivo);
      },
      error: (err) => {
        console.error('[DEBUG] Erro ao buscar registros de expediente:', err);
        this.inicializarDadosExpedientePadrao();
      },
    });
  }

  private verificarDataDeHoje(dataString: string | null): boolean {
    if (!dataString) return false;

    // Extrai a parte da data do registro
    const dataRegistro = new Date(dataString);
    // Cria uma string "YYYY-MM-DD" usando o horário local do registro
    const anoRegistro = dataRegistro.getFullYear();
    const mesRegistro = String(dataRegistro.getMonth() + 1).padStart(2, '0');
    const diaRegistro = String(dataRegistro.getDate()).padStart(2, '0');
    const dataRegistroStr = `${anoRegistro}-${mesRegistro}-${diaRegistro}`;

    // Pega a data local do usuário
    const hoje = new Date();
    const anoHoje = hoje.getFullYear();
    const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
    const diaHoje = String(hoje.getDate()).padStart(2, '0');
    const dataHojeStr = `${anoHoje}-${mesHoje}-${diaHoje}`;

    console.log('Data do registro:', dataRegistroStr);
    console.log('Data local de hoje:', dataHojeStr);

    return dataRegistroStr === dataHojeStr;
  }





  private determinarEstadoBotoes(registro: RegistroPonto): boolean[] {
    // Padrão: [Início, Iniciar Pausa, Finalizar Pausa, Finalizar Expediente]
    let estado = [false, true, true, true];

    if (registro.inicioExpediente && !registro.fimExpediente) {
      // Expediente iniciado
      if (registro.inicioPausa && !registro.retornoPausa) {
        // Pausa em andamento
        estado = [true, true, false, true];
      } else if (registro.inicioPausa && registro.retornoPausa) {
        // Pausa concluída
        estado = [true, true, true, false];
      } else {
        // Sem pausa ainda
        estado = [true, false, true, true];
      }
    } else if (registro.inicioExpediente && registro.fimExpediente) {
      // Expediente finalizado
      estado = [true, true, true, true];
    }

    return estado;
  }

  private inicializarDadosExpedientePadrao(): void {
    const dadosPadrao: DadosExpediente = {
      pontoIdExpediente: null,
      pontoIdPausa: null,
      timestamps: {
        inicio: '',
        'almoco-inicio': '',
        'almoco-fim': '',
        fim: '',
      },
      disabled: [false, true, true, true],
      inicioPausaTime: '',
    };

    localStorage.setItem('dadosExpediente', JSON.stringify(dadosPadrao));
    localStorage.removeItem('pontoIdExpediente');
    localStorage.removeItem('pontoIdPausa');
    localStorage.setItem('expedienteAtivo', 'false');
    this.expedienteAtivoSubject.next(false);
  }

  private salvarDadosExpedienteNoLocalStorage(registro: RegistroPonto): void {
    const dadosExpediente = {
      pontoIdExpediente: registro.pontoIdExpediente || registro.id || null,
      pontoIdPausa: registro.pontoIdPausa || null,
      timestamps: {
        inicio: registro.inicioExpediente || '',
        'almoco-inicio': registro.inicioPausa || '',
        'almoco-fim': registro.retornoPausa || '',
        fim: registro.fimExpediente || '',
      },
      disabled: this.determinarEstadoBotoes(registro),
      inicioPausaTime: registro.inicioPausa || '',
    };

    localStorage.setItem('dadosExpediente', JSON.stringify(dadosExpediente));
    if (registro.pontoIdExpediente) {
      localStorage.setItem('pontoIdExpediente', registro.pontoIdExpediente);
    }
    if (
      registro.pontoIdPausa &&
      registro.pontoIdPausa !== '00000000-0000-0000-0000-000000000000'
    ) {
      localStorage.setItem('pontoIdPausa', registro.pontoIdPausa);
    }
  }

  // ----------------------------------------------------------------
  //  Métodos para gerenciar O.S. e tokens
  // ----------------------------------------------------------------

  public setExpedienteAtivo(ativo: boolean): void {
    this.expedienteAtivoSubject.next(ativo);
    console.log('ExpedienteAtivo:', ativo);
  }

  public setOsEmAndamento(value: boolean): void {
    this.osEmAndamentoSubject.next(value);
    localStorage.setItem('osEmAndamento', String(value));
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
    return this.http
      .get<any>(`${this.apiUrl}/auth/verificar-token`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(catchError((error) => throwError(() => error)));
  }

  private verificarOrdemEmAndamentoNaAPI(usuarioId: string): void {
    this.vibeService.buscarOrdemServicoUsuarioId(usuarioId).subscribe({
      next: (response: CriarOrdemDeServicoResponseDto[]) => {
        const ordemEmAndamento = response.find(
          (ordem) => ordem.statusOrdem === 'EmAndamento' && ordem.usuarioId === usuarioId
        );
        const osEmAndamento = !!ordemEmAndamento;

        localStorage.setItem('osEmAndamento', String(osEmAndamento));
        if (ordemEmAndamento) {
          localStorage.setItem('ordemServicoId', ordemEmAndamento.ordemDeServicoId || '');
        }
        this.osEmAndamentoSubject.next(osEmAndamento);
      },
      error: (error) => {
        console.error('Erro ao verificar ordens:', error);
        localStorage.setItem('osEmAndamento', 'false');
        this.osEmAndamentoSubject.next(false);
      },
    });
  }

  // ----------------------------------------------------------------
  //  Métodos privados de manutenção / logout
  // ----------------------------------------------------------------

  private finalizarLogout(): void {
    this.clearAllStorageData();
    this.autenticadoSubject.next(false);
    this.expedienteAtivoSubject.next(false);
    this.osEmAndamentoSubject.next(false);
    this.router.navigate(['/pages/usuarios/autenticar']);
  }

  private clearAllStorageData(): void {
    localStorage.clear();
    sessionStorage.clear();
  }

  private restaurarEstadoDoLocalStorage(): void {
    const usuario = this.getUsuario();
    if (usuario?.usuarioId) {
      this.verificarEstadoExpedienteEOS(usuario.usuarioId).subscribe();
    }
    // Assume que não há O.S. em andamento até verificar na API
    this.osEmAndamentoSubject.next(false);
  }

  private isLoggedInInternal(): boolean {
    return !!localStorage.getItem('usuario');
  }
}
