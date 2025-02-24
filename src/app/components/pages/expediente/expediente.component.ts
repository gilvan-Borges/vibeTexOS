import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, Observable, of } from 'rxjs';
import { WebcamImage, WebcamInitError, WebcamModule } from 'ngx-webcam';
import { AuthService } from '../../../services/auth.service';

import { RegistrarPausaInicioRequestDto } from '../../../models/control-app/registrar.pausa.inicio.request';

import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RegistrarFimPausaRequestDto } from '../../../models/control-app/registrar.fim.pausa.request';
import { RegistrarPontoService } from '../../../services/registrar.ponto.service';
import { ServicoFoto } from '../../../services/foto.service';
import { ServicoLocalizacao } from '../../../services/localizacao.service';
import { ServicoArmazenamento } from '../../../services/armazenamento.service';
import { ServicoFormatacao } from '../../../services/formatacao.service';
import { UsuarioService } from '../../../services/usuario.service';

import { RegistroExpedienteService } from '../../../services/registro-expediente.service';
import { NgxSpinnerService } from 'ngx-spinner';


@Component({
  selector: 'app-expediente',
  imports: [
    WebcamModule,
    CommonModule,
    HttpClientModule,
    FormsModule,
    RouterModule
  ],
  templateUrl: './expediente.component.html',
  styleUrls: ['./expediente.component.css'],
})
export class ExpedienteComponent implements OnInit, OnDestroy {
  switchCamera = of(true);
  modalVisible = false;
  modalObsVisible = false;
  tipoRegistro: string = '';
  idUsuario: string = '';
  coordenadas: string = '';
  webcamImage: WebcamImage | null = null;
  observacoes: string = '';
  pontoId: string = '';
  pausaId: string = ''; // nova propriedade
  errors: WebcamInitError[] = [];
  trigger: Subject<void> = new Subject<void>();

  private locationUpdateSubscription: Subscription | undefined;
  usuarioId: string = '';
  disabled: boolean[] = [false, true, true, true];  // Botões de controle
  timestamps: { [key: string]: string } = {
    inicio: '',
    'almoco-inicio': '',
    'almoco-fim': '',
    fim: '',
  };
  obsDesabilitada: { [key: string]: boolean } = {
    inicio: false,
    'almoco-inicio': false,
    'almoco-fim': false,
    fim: false,
  };

  coordenadasRegistro: { [key: string]: { latitude: number, longitude: number } } = {
    inicio: { latitude: 0, longitude: 0 },
    'almoco-inicio': { latitude: 0, longitude: 0 },
    'almoco-fim': { latitude: 0, longitude: 0 },
    fim: { latitude: 0, longitude: 0 },
  };

  registroExistente: boolean = false;
  mensagemRegistroExistente: string = '';
  expedienteAtivo: boolean = false;
  mensagemPausa$ = new Observable<string>();
  pausaAtiva: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private registrarPontoService: RegistrarPontoService,
    private route: ActivatedRoute,
    private servicoFoto: ServicoFoto,
    private servicoLocalizacao: ServicoLocalizacao,
    private servicoArmazenamento: ServicoArmazenamento,
    private servicoFormatacao: ServicoFormatacao,
    private usuarioService: UsuarioService,
    public registroExpediente: RegistroExpedienteService,
    private spinner: NgxSpinnerService
  ) { }

  public triggerCapture(): void {
    console.log('Disparando captura de imagem...');
    this.trigger.next();
  }
  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  ngOnInit(): void {
    // Define timeout para mostrar spinner apenas se demorar
    const timeoutId = setTimeout(() => {
      this.spinner.show();
    }, 1000); // Mostra spinner após 1 segundo se API não responder

    Promise.all([
      this.verificarRegistroDoDia(),
      this.verificarExpedienteAtivo()
    ]).then(() => {
      clearTimeout(timeoutId); // Cancela o timeout se API respondeu
      this.spinner.hide();
      this.mensagemPausa$ = this.registroExpediente.obterMensagemTempoPausa();
      this.verificarEstadoPausa();
      this.registroExpediente.iniciarVerificacaoTempoPausa();
    }).catch(error => {
      clearTimeout(timeoutId);
      this.spinner.hide();
      console.error('Erro ao carregar dados:', error);
    });

    const usuario = this.authService.getUsuario();
    if (usuario) {
      console.log('Usuário encontrado:', usuario);
      this.idUsuario = usuario.usuarioId;
      this.verificarRegistroDoDia();
      this.verificarExpedienteAtivo();
      this.mensagemPausa$ = this.registroExpediente.obterMensagemTempoPausa();
      
      // Verifica se existe uma pausa em andamento e configura o timer
      const inicioPausaTime = localStorage.getItem('inicioPausaTime');
      if (inicioPausaTime && this.timestamps['almoco-inicio'] && !this.timestamps['almoco-fim']) {
        this.disabled[2] = !this.registroExpediente.verificarPodeFinalizarPausa();
      }
      setTimeout(() => {
        this.spinner.hide();
      });
    } else {
      this.router.navigate(['/pages/usuarios/autenticar']);
      return;
    }
    this.route.paramMap.subscribe(params => {
      this.usuarioId = params.get('usuarioId') || '';
      console.log('Usuário autenticado com ID:', this.usuarioId);
    });

    this.locationUpdateSubscription = this.usuarioService.iniciarAtualizacaoDeLocalizacao(this.idUsuario);
  }

  ngOnDestroy(): void {
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
    }
    this.registroExpediente.destruir();
  }

  abrirModal(tipo: string): void {
    this.tipoRegistro = tipo;
    this.observacoes = '';
    this.modalVisible = true;

    // Se for pausa, registra direto sem abrir câmera
    if (tipo === 'almoco-inicio' || tipo === 'almoco-fim') {
      navigator.geolocation.getCurrentPosition((position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const dataAtual = new Date().toISOString();

        if (tipo === 'almoco-inicio') {
          this.registrarInicioPausa(dataAtual, latitude.toString(), longitude.toString());
        } else {
          this.registrarFimPausa(dataAtual, latitude.toString(), longitude.toString());
        }
      });
      this.fecharModal();
    }
  }

  fecharModal(): void {
    this.modalVisible = false;
    this.observacoes = '';
  }

  abrirObs(tipo: string): void {
    // Simula carregar uma observação anterior se existir (mock)
    this.observacoes = `Observação carregada para ${tipo}`;
  }

  registrarAcao(): void {
    console.log("🚀 Iniciando captura de localização...");
    
    // Define timeout para mostrar spinner apenas se demorar
    const timeoutId = setTimeout(() => {
      this.spinner.show();
    }, 1000);

    this.servicoLocalizacao.capturarCoordenadas()
      .then(({ latitude, longitude }) => {
        clearTimeout(timeoutId); // Cancela o timeout se API respondeu
        this.spinner.hide();
        console.log("📍 Coordenadas capturadas:", { latitude, longitude });
        
        this.coordenadasRegistro[this.tipoRegistro] = { 
          latitude: Number(latitude), 
          longitude: Number(longitude) 
        };

        const dataAtual = this.servicoFormatacao.formatarDataAtual();
        
        switch (this.tipoRegistro) {
          case 'inicio':
            this.registroExpediente.registrarInicioExpediente(
              this.idUsuario,
              dataAtual,
              latitude,
              longitude,
              this.webcamImage,
              this.observacoes
            ).then(() => {
              this.timestamps['inicio'] = this.formatarHora(new Date().toISOString());
              this.disabled[0] = true;
              this.disabled[1] = false;
              this.obsDesabilitada['inicio'] = true;
              this.salvarDadosNoLocalStorage();
              this.registroExpediente.atualizarStatusExpediente(true);
              
              // Adiciona o ID do usuário na rota
              this.router.navigate(['/pages/ordem-servico/pendentes', this.idUsuario]);
            }).catch(error => {
              alert(error);
            });
            break;

          case 'almoco-inicio':
            this.registroExpediente.registrarInicioPausa(
              this.idUsuario,
              dataAtual,
              latitude,
              longitude,
              this.observacoes
            ).then(() => {
              this.timestamps['almoco-inicio'] = this.formatarHora(new Date().toISOString());
              this.disabled[1] = true;
              this.disabled[2] = true;
              this.obsDesabilitada['almoco-inicio'] = true;
              this.salvarDadosNoLocalStorage();
              window.location.reload(); // Recarrega a página após iniciar a pausa
            }).catch(error => {
              alert(error);
            });
            break;

          case 'almoco-fim':
            this.registroExpediente.registrarFimPausa(
              this.idUsuario,
              dataAtual,
              latitude,
              longitude,
              this.observacoes
            ).then(() => {
              this.timestamps['almoco-fim'] = this.formatarHora(new Date().toISOString());
              this.disabled[2] = true;
              this.disabled[3] = false;
              this.obsDesabilitada['almoco-fim'] = true;
              this.salvarDadosNoLocalStorage();
            }).catch(error => {
              alert(error);
            });
            break;

          case 'fim':
            this.registroExpediente.registrarFimExpediente(
              this.idUsuario,
              dataAtual,
              latitude,
              longitude,
              this.webcamImage,
              this.observacoes
            ).then(() => {
              this.timestamps['fim'] = this.formatarHora(new Date().toISOString());
              this.disabled = [true, true, true, true];
              this.obsDesabilitada['fim'] = true;
              this.salvarDadosNoLocalStorage();
              this.registroExpediente.atualizarStatusExpediente(false);
            }).catch(error => {
              alert(error);
            });
            break;
        }

        this.fecharModal();
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        this.spinner.hide();
        console.error("❌ Erro ao obter localização:", error);
        alert("Erro ao capturar localização. Verifique as permissões de localização.");
      });
  }

  handleImage(webcamImage: WebcamImage): void {
    console.log('Imagem capturada - processando...');
    if (webcamImage && webcamImage.imageAsBase64) {
      this.webcamImage = webcamImage;
      this.servicoFoto.adicionarDataHoraImagem(webcamImage.imageAsBase64).then(imagemComData => {
        // Cria uma nova imagem com a data/hora
        const dataUrl = `data:image/jpeg;base64,${imagemComData}`;
        
        // Cria uma imagem temporária para obter as dimensões
        const tempImage = new Image();
        tempImage.onload = () => {
          const imageData = new ImageData(tempImage.width, tempImage.height);
          this.webcamImage = new WebcamImage(
            dataUrl,
            'image/jpeg',
            imageData
          );
          this.registrarAcao();
        };
        tempImage.src = dataUrl;
      });
    } else {
      console.error('Imagem não capturada corretamente');
      alert('Erro ao capturar imagem. Tente novamente.');
    }
  }
  
  public handleInitError(error: WebcamInitError): void {
    console.error('🚨 Erro ao inicializar a webcam:', error);
    this.errors.push(error);  // Adiciona o erro ao array sem sobrescrever
  }
  
  private handleImageCaptureOrProceed(callback: () => void): void {
    if (this.tipoRegistro === 'inicio' || this.tipoRegistro === 'fim') {
      if (this.webcamImage?.imageAsBase64) {
        callback();  // Executa o registro se a imagem estiver disponível
      } else {
        alert('Por favor, capture uma foto antes de prosseguir.');
      }
    } else {
      callback();  // Apenas prossegue sem captura de imagem
    }
  }

  private formatarHora(data: string | null, isFim: boolean = false): string {
    return this.servicoFormatacao.formatarHora(data, isFim);
  }

  private registrarInicioPausa(data: string, latitude: string, longitude: string): void {
    const request: RegistrarPausaInicioRequestDto = {
        inicioPausa: data,
        latitude: latitude,
        longitude: longitude,
        observacoes: this.observacoes,
    };

   
    const timeoutId = setTimeout(() => {
        this.spinner.show();
    }, 0);

    this.registrarPontoService.registrarInicioPausa(this.idUsuario, request)
        .subscribe({
            next: (response) => {
                clearTimeout(timeoutId); // Cancela o timeout se a resposta chegou antes do tempo limite
                this.spinner.hide(); // Oculta o spinner caso tenha sido ativado

                console.log('✅ Início da pausa registrado com sucesso:', response);

                if (response && response.pontoId) {
                    localStorage.setItem('pontoIdPausa', response.pontoId);
                    this.pausaId = response.pontoId;
                    console.log('📌 PontoId da pausa salvo:', response.pontoId);
                }

                const horaAtual = new Date().toISOString();
                this.timestamps['almoco-inicio'] = this.formatarHora(horaAtual);
                console.log('⏰ Timestamp do início da pausa atualizado:', this.timestamps['almoco-inicio']);
                
                // Atualiza botões
                this.disabled[1] = true;
                this.disabled[2] = true;
                this.obsDesabilitada['almoco-inicio'] = true;

                // Salva o horário de início da pausa no localStorage
                localStorage.setItem('inicioPausaTime', horaAtual);
                this.salvarDadosNoLocalStorage();

                // Agenda o desbloqueio do botão após 1 hora
                const timer = setTimeout(() => {
                    if (this.timestamps['almoco-inicio'] && !this.timestamps['almoco-fim']) {
                        this.disabled[2] = false;
                        this.salvarDadosNoLocalStorage();
                        console.log('⏰ Botão de fim de pausa desbloqueado após 1 hora');
                    }
                }, 3600000); // 1 hora em milissegundos

                localStorage.setItem('pausaTimer', timer.toString());

                // Redireciona para a página de expediente
                this.router.navigate(['/pages/expediente']);
            },
            error: (err) => {
                clearTimeout(timeoutId);
                this.spinner.hide();
                console.error('❌ Erro ao registrar início da pausa:', err);
                alert('Erro ao registrar o início da pausa. Tente novamente.');
            }
        });
}


  private registrarFimPausa(data: string, latitude: string, longitude: string): void {
    const pontoIdInicioPause = localStorage.getItem('pontoIdPausa');
    
    if (!this.registroExpediente.verificarPodeFinalizarPausa()) {
      return;
    }

    if (!pontoIdInicioPause) {
      console.error('❌ Erro: PontoId da pausa não encontrado');
      alert('É necessário registrar o início da pausa primeiro.');
      return;
    }

    console.log('📌 Registrando fim de pausa com pontoId:', pontoIdInicioPause);

    const request: RegistrarFimPausaRequestDto = {
      fimPausa: data,
      latitude: latitude,
      longitude: longitude,
      observacoes: this.observacoes || '',
    };

    this.registrarPontoService.registrarFimPausa(
      this.idUsuario,
      pontoIdInicioPause,
      request
    ).subscribe({
      next: (response) => {
        console.log('✅ Fim da pausa registrado com sucesso:', response);
        
        const horaAtual = new Date().toISOString();
        this.timestamps['almoco-fim'] = this.formatarHora(horaAtual);
        console.log('⏰ Timestamp do fim da pausa atualizado:', this.timestamps['almoco-fim']);
        
        this.disabled[2] = true;
        this.disabled[3] = false;
        this.obsDesabilitada['almoco-fim'] = true;
        
        // Limpa os dados da pausa do localStorage
        localStorage.removeItem('pontoIdPausa');
        localStorage.removeItem('inicioPausaTime');
        const timerId = localStorage.getItem('pausaTimer');
        if (timerId) {
          clearTimeout(parseInt(timerId));
          localStorage.removeItem('pausaTimer');
        }
        
        this.pausaId = '';
        this.salvarDadosNoLocalStorage();

        // Recarrega a página antes de redirecionar
        window.location.reload();

        // Redireciona para a página de ordem de serviço
        this.router.navigate(['/pages/ordem-servico']);
      },
      error: (err) => {
        console.error('❌ Erro ao registrar fim da pausa:', err);
        alert('Erro ao registrar o fim da pausa. Tente novamente.');
      }
    });
  }

  encerrarSessao(limparDados: boolean = true): void {
    this.usuarioService.encerrarSessao(this.idUsuario, limparDados);
  }

  carregarUsuario(): void {
    const usuarioData = localStorage.getItem('usuario');
    if (usuarioData) {
      const usuario = JSON.parse(usuarioData);
      this.idUsuario = usuario.id;
    }
  }
  
  // Salva os dados importantes no localStorage
  private salvarDadosNoLocalStorage(): void {
    const dadosExpediente = {
      pontoIdExpediente: this.servicoArmazenamento.obterPontoId('expediente'),
      pontoIdPausa: this.servicoArmazenamento.obterPontoId('pausa'),
      timestamps: this.timestamps,
      disabled: this.disabled,
      inicioPausaTime: localStorage.getItem('inicioPausaTime')
    };

    this.servicoArmazenamento.salvarDadosExpediente(dadosExpediente);
  }

  desativarBotoesConformeRegistros(): void {
    if (!this.timestamps['inicio']) {
      this.disabled[0] = false;
    } else if (!this.timestamps['almoco-inicio']) {
      this.disabled[1] = false;
    } else if (!this.timestamps['almoco-fim']) {
      this.disabled[2] = false;
    } else if (!this.timestamps['fim']) {
      this.disabled[3] = false;
    }
  }

  abrirCamera(tipo: string): void {
    this.tipoRegistro = tipo;
    this.modalVisible = true;
  }
  fecharObsModal(): void {
    this.modalObsVisible = false;
  }
  onLogout(): void {
    this.authService.logout().then(() => {
      console.log('Usuário desconectado com sucesso.');
    });
  }

  private async verificarRegistroDoDia(): Promise<void> {
    const dados = await this.usuarioService.verificarRegistroDoDia(this.idUsuario);
    if (!dados) return;

    // Atualizar o estado do componente com os dados retornados
    this.pontoId = dados.pontoId;
    this.pausaId = dados.pausaId;
    this.timestamps = dados.timestamps;

    // Se existe registro de fim de expediente, desabilita todos os botões
    if (this.timestamps['fim']) {
      this.disabled = [true, true, true, true];
      this.registroExistente = true;
      this.mensagemRegistroExistente = 'Expediente finalizado. Volte amanhã para iniciar um novo expediente.';
      return;
    }

    this.disabled = dados.disabled;

    // Se existe timestamp de início de pausa, mas não tem inicioPausaTime no localStorage
    if (this.timestamps['almoco-inicio'] && !localStorage.getItem('inicioPausaTime')) {
      // Converte o timestamp para o formato ISO
      const inicioPausaDate = new Date();
      const [hours, minutes] = this.timestamps['almoco-inicio'].split(' ')[0].split(':');
      inicioPausaDate.setHours(parseInt(hours), parseInt(minutes), 0);
      localStorage.setItem('inicioPausaTime', inicioPausaDate.toISOString());
    }

    // Atualizar também o estado dos botões de observação
    this.obsDesabilitada = {
      inicio: !!this.timestamps['inicio'],
      'almoco-inicio': !!this.timestamps['almoco-inicio'],
      'almoco-fim': !!this.timestamps['almoco-fim'],
      fim: !!this.timestamps['fim']
    };

    // Salvar no localStorage
    const dadosExpediente = {
      pontoIdExpediente: this.pontoId,
      pontoIdPausa: this.pausaId,
      timestamps: this.timestamps,
      disabled: this.disabled,
      inicioPausaTime: localStorage.getItem('inicioPausaTime')
    };

    this.servicoArmazenamento.salvarDadosExpediente(dadosExpediente);
  }

  private async verificarExpedienteAtivo(): Promise<void> {
    this.expedienteAtivo = await this.usuarioService.verificarExpedienteAtivo(this.idUsuario);
  }

  private verificarEstadoPausa(): void {
    const dadosExpediente = localStorage.getItem('dadosExpediente');
    if (dadosExpediente) {
      const dados = JSON.parse(dadosExpediente);
      
      // Verifica se tem início de pausa mas não tem fim
      if (dados.timestamps['almoco-inicio'] && !dados.timestamps['almoco-fim']) {
        this.pausaAtiva = true;
      } else {
        this.pausaAtiva = false;
      }
    }
  }

  private verificarEstadoExpediente(): void {
    const dadosExpediente = localStorage.getItem('dadosExpediente');
    if (dadosExpediente) {
      const dados = JSON.parse(dadosExpediente);
      
      // Expediente está ativo se tem início mas não tem fim
      if (dados.timestamps['inicio'] && !dados.timestamps['fim']) {
        this.expedienteAtivo = true;
      } else {
        this.expedienteAtivo = false;
      }
    }
  }
}