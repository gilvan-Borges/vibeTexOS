import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
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
            }
            this.router.navigate(['/pages/ordem-servico']);
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
            localStorage.setItem('inicioPausaTime', new Date().toISOString());
            this.atualizarEstado({
              pausaAtiva: true,
              timestamps: { ...this.estadoExpedienteSubject.value.timestamps, 'almoco-inicio': data },
              disabled: [true, true, false, true]
            });
          }
          this.router.navigate(['/pages/expediente']);
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
          this.router.navigate(['/pages/ordem-servico']);
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

      if (!webcamImage?.imageAsBase64) {
        reject('Por favor, capture uma foto primeiro');
        return;
      }

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
          reject(err.error?.message || 'Erro desconhecido');
        }
      });
    });
  }

  iniciarVerificacaoTempoPausa(): void {
    this.intervalId = setInterval(() => {
      const inicioPausaTime = localStorage.getItem('inicioPausaTime');
      if (inicioPausaTime) {
        const now = new Date().getTime();
        const pauseStart = new Date(inicioPausaTime).getTime();
        const diffHours = (now - pauseStart) / (1000 * 60 * 60);
        
        if (diffHours < 1) {
          const minutosRestantes = Math.ceil((1 - diffHours) * 60);
          this.tempoRestantePausaSubject.next(minutosRestantes);
        } else {
          this.tempoRestantePausaSubject.next(0);
        }
      }
    }, 1000);
  }

  obterMensagemTempoPausa(): Observable<string> {
    return this.tempoRestantePausa$.pipe(
      map(minutos => {
        if (minutos <= 0) return '';
        
        const horas = Math.floor(minutos / 60);
        const minutosRestantes = minutos % 60;
        
        if (horas > 0) {
          return `Faltam ${horas}h ${minutosRestantes}min para finalizar a pausa`;
        } else {
          return `Faltam ${minutosRestantes}min para finalizar a pausa`;
        }
      })
    );
  }

  verificarPodeFinalizarPausa(): boolean {
    const inicioPausaTime = localStorage.getItem('inicioPausaTime');
    if (!inicioPausaTime) return false;

    const now = new Date().getTime();
    const pauseStart = new Date(inicioPausaTime).getTime();
    const diffHours = (now - pauseStart) / (1000 * 60 * 60);

    return diffHours >= 1;
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