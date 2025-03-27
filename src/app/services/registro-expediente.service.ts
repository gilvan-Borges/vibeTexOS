import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { ControllAppService } from './controllApp.service';
import { RegistrarPontoService } from './registrar.ponto.service';
import { ServicoFoto } from './foto.service';
import { ServicoArmazenamento } from './armazenamento.service';
import { ServicoFormatacao } from './formatacao.service';
import { WebcamImage } from 'ngx-webcam';

export interface EstadoExpediente {
  expedienteAtivo: boolean;
  pausaAtiva: boolean;
  timestamps: { [key: string]: string };
  disabled: boolean[];
}

@Injectable({
  providedIn: 'root'
})
export class RegistroExpedienteService {
  private tempoRestantePausaSubject = new BehaviorSubject<number>(0);
  tempoRestantePausa$ = this.tempoRestantePausaSubject.asObservable();
  
  private expedienteAtivoSubject = new BehaviorSubject<boolean>(false);
  expedienteAtivo$ = this.expedienteAtivoSubject.asObservable();
  
  private estadoExpedienteSubject = new BehaviorSubject<EstadoExpediente>({
    expedienteAtivo: false,
    pausaAtiva: false,
    timestamps: {},
    disabled: [false, true, true, true]
  });
  estadoExpediente$ = this.estadoExpedienteSubject.asObservable();

  private pausaLiberadaSubject = new Subject<void>();
  public pausaLiberada$ = this.pausaLiberadaSubject.asObservable();

  private intervalId: any;

  constructor(
    private router: Router,
    private controllAppService: ControllAppService,
    private registrarPontoService: RegistrarPontoService,
    private servicoFoto: ServicoFoto,
    private servicoArmazenamento: ServicoArmazenamento,
    private servicoFormatacao: ServicoFormatacao
  ) {
    this.iniciarVerificacaoTempoPausa();
    this.carregarEstadoInicial();
  }

  private carregarEstadoInicial(): void {
    const dadosExpediente = this.servicoArmazenamento.carregarDadosExpediente();
    if (dadosExpediente) {
      this.atualizarEstado({
        expedienteAtivo: true,
        pausaAtiva: !!dadosExpediente.timestamps['almoco-inicio'] && !dadosExpediente.timestamps['almoco-fim'],
        timestamps: dadosExpediente.timestamps,
        disabled: dadosExpediente.disabled
      });
    }
  }

  private atualizarEstado(novoEstado: Partial<EstadoExpediente>): void {
    const estadoAtual = this.estadoExpedienteSubject.value;
    const estadoAtualizado = { ...estadoAtual, ...novoEstado };
    this.estadoExpedienteSubject.next(estadoAtualizado);
    this.expedienteAtivoSubject.next(estadoAtualizado.expedienteAtivo);
  }

  atualizarStatusExpediente(ativo: boolean): void {
    this.atualizarEstado({
      expedienteAtivo: ativo,
      pausaAtiva: false,
      timestamps: ativo ? { inicio: new Date().toISOString() } : {},
      disabled: ativo ? [true, false, true, true] : [false, true, true, true]
    });
  }

  registrarInicioExpediente(idUsuario: string, data: string, latitude: string, longitude: string, webcamImage: WebcamImage | null, observacoes: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!webcamImage?.imageAsBase64) {
        reject('Por favor, capture uma foto primeiro.');
        return;
      }

      this.servicoFoto.prepararFotoParaEnvio(webcamImage).then((resultado: { fotoFormatada: string, fotoArquivo: Blob } | null) => {
        if (!resultado) {
          reject('Erro ao preparar a foto. Tente novamente.');
          return;
        }

        const { fotoFormatada, fotoArquivo } = resultado;
        const formData = new FormData();
        formData.append('inicioExpediente', data);
        formData.append('latitude', (parseFloat(latitude) * 1e7).toString());
        formData.append('longitude', (parseFloat(longitude) * 1e7).toString());
        formData.append('Observacoes', observacoes || '');
        formData.append('FotoInicioExpediente', fotoFormatada);
        formData.append('FotoInicioExpedienteFile', fotoArquivo, 'foto.jpg');

        this.controllAppService.pontoRegistrarInicioExpediente(idUsuario, formData).subscribe({
          next: (response) => {
            if (response?.pontoId) {
              this.servicoArmazenamento.salvarPontoId('expediente', response.pontoId);
              this.atualizarEstado({
                expedienteAtivo: true,
                timestamps: { ...this.estadoExpedienteSubject.value.timestamps, inicio: data },
                disabled: [true, false, true, true]
              });

              // Atualizar localStorage com os dados retornados
              const dadosExpediente = {
                pontoIdExpediente: response.pontoId,
                pontoIdPausa: null,
                timestamps: { ...this.estadoExpedienteSubject.value.timestamps, inicio: data },
                disabled: [true, false, true, true],
                inicioPausaTime: null
              };
              this.servicoArmazenamento.salvarDadosExpediente(dadosExpediente);
            }
            this.router.navigate([`/pages/ordem-servico/pendentes`, idUsuario]);
            resolve();
          },
          error: (err) => {
            reject(err.error?.message || 'Erro desconhecido');
          }
        });
      });
    });
  }

  registrarInicioPausa(idUsuario: string, data: string, latitude: string, longitude: string, observacoes: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = {
        inicioPausa: data,
        latitude: latitude,
        longitude: longitude,
        observacoes: observacoes,
      };

      this.registrarPontoService.registrarInicioPausa(idUsuario, request).subscribe({
        next: (response) => {
          if (response && response.pontoId) {
            this.servicoArmazenamento.salvarPontoId('pausa', response.pontoId);
            
            // Salvar inicioPausaTime em formato ISO para garantir compatibilidade
            const dataISO = new Date(data).toISOString();
            localStorage.setItem('inicioPausaTime', dataISO);
            
            this.atualizarEstado({
              pausaAtiva: true,
              timestamps: { ...this.estadoExpedienteSubject.value.timestamps, 'almoco-inicio': data },
              disabled: [true, true, false, true]
            });

            // Atualizar localStorage com os dados retornados
            const dadosExpediente = {
              pontoIdExpediente: this.servicoArmazenamento.obterPontoId('expediente') || null,
              pontoIdPausa: response.pontoId,
              timestamps: { ...this.estadoExpedienteSubject.value.timestamps, 'almoco-inicio': data },
              disabled: [true, true, false, true],
              inicioPausaTime: dataISO
            };
            this.servicoArmazenamento.salvarDadosExpediente(dadosExpediente);
            
            console.log('Início da pausa registrado com sucesso:', {
              pontoId: response.pontoId,
              inicioPausaTime: dataISO
            });
          }
          this.router.navigate(['/pages/expediente', idUsuario]);
          resolve();
        },
        error: (err) => {
          reject('Erro ao registrar o início da pausa');
        }
      });
    });
  }

  registrarFimPausa(idUsuario: string, data: string, latitude: string, longitude: string, observacoes: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pontoIdPausa = this.servicoArmazenamento.obterPontoId('pausa');
      
      if (!this.verificarPodeFinalizarPausa()) {
        reject('Ainda não é possível finalizar a pausa');
        return;
      }

      if (!pontoIdPausa) {
        reject('É necessário registrar o início da pausa primeiro');
        return;
      }

      const request = {
        fimPausa: data,
        latitude: latitude,
        longitude: longitude,
        observacoes: observacoes,
      };

      this.registrarPontoService.registrarFimPausa(idUsuario, pontoIdPausa, request).subscribe({
        next: () => {
          this.limparDadosPausa();
          this.atualizarEstado({
            pausaAtiva: false,
            timestamps: { ...this.estadoExpedienteSubject.value.timestamps, 'almoco-fim': data },
            disabled: [true, true, true, false]
          });
          // Redirecionar incluindo o ID do usuário
          this.router.navigate(['/pages/ordem-servico/pendentes', idUsuario]);
          resolve();
        },
        error: (err) => {
          reject('Erro ao registrar o fim da pausa');
        }
      });
    });
  }

  registrarFimExpediente(idUsuario: string, data: string, latitude: string, longitude: string, webcamImage: WebcamImage | null, observacoes: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pontoIdExpediente = this.servicoArmazenamento.obterPontoId('expediente');

      if (!pontoIdExpediente) {
        reject('É necessário registrar o início do expediente antes de finalizar');
        return;
      }

      if (!idUsuario) {
        reject('ID do usuário não encontrado');
        return;
      }

      if (!webcamImage?.imageAsBase64) {
        reject('Por favor, capture uma foto primeiro');
        return;
      }

      console.log(`Registrando fim de expediente - usuarioId: "${idUsuario}", pontoId: "${pontoIdExpediente}"`);

      const formData = new FormData();
      const fotoFormatada = this.servicoFoto.formatarFotoBase64(webcamImage.imageAsBase64);
      const fotoArquivo = this.servicoFoto.converterParaBlob(fotoFormatada, 'foto-fim.jpg');

      formData.append('fotoFimExpedienteFile', fotoArquivo, 'foto-fim.jpg');
      formData.append('fotoFimExpediente', fotoFormatada);
      formData.append('fimExpediente', data);
      formData.append('latitude', latitude);
      formData.append('longitude', longitude);
      formData.append('observacoes', observacoes || '');

      this.controllAppService.pontoRegistarFimExpediente(idUsuario, pontoIdExpediente, formData).subscribe({
        next: () => {
          this.servicoArmazenamento.removerPontoId('expediente');
          this.atualizarEstado({
            expedienteAtivo: false,
            pausaAtiva: false,
            timestamps: { ...this.estadoExpedienteSubject.value.timestamps, fim: data },
            disabled: [true, true, true, true]
          });
          
          // Mostra a mensagem
          alert('Expediente finalizado com sucesso! Volte amanhã para iniciar outro expediente.');
          
          // Redireciona para a página de ordens realizadas
          this.router.navigate(['/pages/ordem-servico/realizadas', idUsuario]);
          
          resolve();
        },
        error: (err) => {
          console.error('Erro ao finalizar expediente:', err);
          reject(err.error?.message || 'Erro desconhecido');
        }
      });
    });
  }

  iniciarVerificacaoTempoPausa(): void {
    // Primeiro, tentar obter do localStorage diretamente
    let inicioPausaTime = localStorage.getItem('inicioPausaTime');
    
    // Se não encontrar, verificar nos timestamps do expediente
    if (!inicioPausaTime) {
      console.log('inicioPausaTime não encontrado, verificando timestamps do expediente');
      const dadosExpediente = localStorage.getItem('dadosExpediente');
      if (dadosExpediente) {
        try {
          const dados = JSON.parse(dadosExpediente);
          if (dados.timestamps && dados.timestamps['almoco-inicio']) {
            inicioPausaTime = dados.timestamps['almoco-inicio'];
            console.log('Usando almoco-inicio dos timestamps:', inicioPausaTime);
            
            // Atualiza o inicioPausaTime no localStorage para manter consistência
            if (inicioPausaTime !== null) {
              localStorage.setItem('inicioPausaTime', inicioPausaTime);
            }
          }
        } catch (error) {
          console.error('Erro ao processar dados do expediente:', error);
        }
      }
    }
    
    if (!inicioPausaTime || isNaN(Date.parse(inicioPausaTime))) {
      console.warn('Horário de início da pausa inválido ou não encontrado.');
      return;
    }

    try {
      // Tenta converter para timestamp válido
      let inicioPausaTimestamp: number;
      
      // Se for um formato ISO válido, usa diretamente
      if (!isNaN(Date.parse(inicioPausaTime))) {
        inicioPausaTimestamp = new Date(inicioPausaTime).getTime();
      } else if (typeof inicioPausaTime === 'string' && inicioPausaTime.includes(':')) {
        // Se for no formato "HH:MM hrs", tenta converter
        const [hours, minutes] = inicioPausaTime.replace(' hrs', '').split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const hoje = new Date();
          hoje.setHours(hours, minutes, 0, 0);
          inicioPausaTimestamp = hoje.getTime();
        } else {
          throw new Error('Formato de hora inválido');
        }
      } else {
        throw new Error('Formato de data não reconhecido');
      }

      // Inicia o intervalo para verificar o tempo restante
      this.intervalId = setInterval(() => {
        const now = new Date().getTime();
        const diffHours = (now - inicioPausaTimestamp) / (1000 * 60 * 60);
    
        if (diffHours < 1) {
          const minutosRestantes = Math.ceil((1 - diffHours) * 60);
          this.tempoRestantePausaSubject.next(minutosRestantes);
        } else {
          this.tempoRestantePausaSubject.next(0);
          this.verificarTempoPausa();
          clearInterval(this.intervalId); // Interrompe o intervalo após liberar o botão
        }
      }, 1000);
    } catch (error) {
      console.error('Erro ao processar horário da pausa:', error);
    }
  }

  private verificarTempoPausa(): void {
    // Primeiro, tentar obter do localStorage diretamente
    let inicioPausaTime = localStorage.getItem('inicioPausaTime');
    
    // Se não encontrar, verificar nos timestamps do expediente
    if (!inicioPausaTime) {
      console.log('inicioPausaTime não encontrado, verificando timestamps do expediente');
      const dadosExpediente = localStorage.getItem('dadosExpediente');;
      if (dadosExpediente) {
        try {
          const dados = JSON.parse(dadosExpediente);
          if (dados.timestamps && dados.timestamps['almoco-inicio']) {
            inicioPausaTime = dados.timestamps['almoco-inicio'];
            console.log('Usando almoco-inicio dos timestamps:', inicioPausaTime);
            
            // Atualiza o inicioPausaTime no localStorage para manter consistência
            if (inicioPausaTime !== null) {
              localStorage.setItem('inicioPausaTime', inicioPausaTime);
            }
          }
        } catch (error) {
          console.error('Erro ao processar dados do expediente:', error);
        }
      }
    }

    if (!inicioPausaTime) {
      console.warn('Horário de início da pausa não encontrado.');
      return;
    }

    try {
      let inicioPausaTimestamp: number;
      
      // Se for um formato ISO válido, usa diretamente
      if (!isNaN(Date.parse(inicioPausaTime))) {
        inicioPausaTimestamp = new Date(inicioPausaTime).getTime();
      } else if (typeof inicioPausaTime === 'string' && inicioPausaTime.includes(':')) {
        // Se for no formato "HH:MM hrs", tenta converter
        const [hours, minutes] = inicioPausaTime.replace(' hrs', '').split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const hoje = new Date();
          hoje.setHours(hours, minutes, 0, 0);
          inicioPausaTimestamp = hoje.getTime();
        } else {
          throw new Error('Formato de hora inválido');
        }
      } else {
        throw new Error('Formato de data não reconhecido');
      }
      
      const agora = new Date().getTime();
      const tempoDecorrido = agora - inicioPausaTimestamp;
      
      const tempoMinimoPausa = 3600000; // 1 hora em milissegundos
      if (tempoDecorrido >= tempoMinimoPausa) {
        console.log('🔔 Botão de finalizar pausa liberado!');
        this.pausaLiberadaSubject.next(); // Dispara o evento para liberar o botão
        this.enviarNotificacao();
      }
    } catch (error) {
      console.error('Erro ao verificar tempo de pausa:', error);
    }
  }

  private enviarNotificacao(): void {
    // Verificar se o navegador suporta notificações
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        const notification = new Notification('Pausa Liberada', {
          body: 'Você já pode finalizar sua pausa de almoço.',
          icon: 'assets/img/logo.png'
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            const notification = new Notification('Pausa Liberada', {
              body: 'Você já pode finalizar sua pausa de almoço.',
              icon: 'assets/img/logo.png'
            });
          }
        });
      }
    }
  }

  obterMensagemTempoPausa(): Observable<string> {
    return this.tempoRestantePausa$.pipe(
      map(minutos => {
        if (minutos > 0) {
          const horas = Math.floor(minutos / 60);
          const minutosRestantes = minutos % 60;

          if (horas > 0) {
            return `Faltam ${horas}h ${minutosRestantes}min para voltar ao trabalho.`;
          } else {
            return `Faltam ${minutosRestantes} minutos para voltar ao trabalho.`;
          }
        } else {
          return 'O botão de finalizar pausa será liberado em breve.';
        }
      })
    );
  }

  verificarPodeFinalizarPausa(): boolean {
    // Primeiro, tentar obter do localStorage diretamente
    let inicioPausaTime = localStorage.getItem('inicioPausaTime');
    
    // Se não encontrar, verificar nos timestamps do expediente
    if (!inicioPausaTime) {
      console.log('inicioPausaTime não encontrado, verificando timestamps do expediente');
      const dadosExpediente = localStorage.getItem('dadosExpediente');
      if (dadosExpediente) {
        try {
          const dados = JSON.parse(dadosExpediente);
          if (dados.timestamps && dados.timestamps['almoco-inicio']) {
            inicioPausaTime = dados.timestamps['almoco-inicio'];
            console.log('Usando almoco-inicio dos timestamps:', inicioPausaTime);
            
            // Atualiza o inicioPausaTime no localStorage para manter consistência
            if (inicioPausaTime !== null) {
              localStorage.setItem('inicioPausaTime', inicioPausaTime);
            }
          }
        } catch (error) {
          console.error('Erro ao processar dados do expediente:', error);
        }
      }
    }
    
    if (!inicioPausaTime) {
      console.log('Não foi encontrado um horário de início de pausa válido');
      return false;
    }

    try {
      // Tenta converter para timestamp
      let inicioPausaTimestamp: number;
      
      // Se for um formato ISO válido, usa diretamente
      if (!isNaN(Date.parse(inicioPausaTime))) {
        inicioPausaTimestamp = new Date(inicioPausaTime).getTime();
      } else if (typeof inicioPausaTime === 'string' && inicioPausaTime.includes(':')) {
        // Se for no formato "HH:MM hrs", tenta converter
        const [hours, minutes] = inicioPausaTime.replace(' hrs', '').split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const hoje = new Date();
          hoje.setHours(hours, minutes, 0, 0);
          inicioPausaTimestamp = hoje.getTime();
        } else {
          throw new Error('Formato de hora inválido');
        }
      } else {
        throw new Error('Formato de data não reconhecido');
      }
      
      const now = new Date().getTime();
      const diffMs = now - inicioPausaTimestamp;
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours >= 1;
    } catch (error) {
      console.error('Erro ao verificar tempo de pausa:', error);
      return false;
    }
  }

  private limparDadosPausa(): void {
    this.servicoArmazenamento.limparDadosPausa();
  }

  destruir(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.tempoRestantePausaSubject.next(0);
  }
}