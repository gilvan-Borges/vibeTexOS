import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WebcamImage, WebcamInitError, WebcamModule } from 'ngx-webcam';
import { Subject, throwError, Subscription } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ServicoFoto } from '../../../services/foto.service';
import { ServicoLocalizacao } from '../../../services/localizacao.service';
import { ExecucaoResponseDto } from '../../../models/vibe-service/execucao.response.Dto';
import { ExecucaoFimResponseDto } from '../../../models/vibe-service/execucao.Fim.Response.Dto';
import { FormsModule, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { VibeService } from '../../../services/vibe.service';
import SignaturePad from 'signature_pad';
import { FormularioService } from '../../../services/formulario.service';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

interface Coordenadas {
  latitude: number;
  longitude: number;
}

interface OrdemServico {
  ordemDeServicoId: string;
  despachoid: string;
  numeroOrdemDeServico: string;
  cliente: {
    nome: string;
    cpf: string;
    telefone: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
  statusOrdem?: string;
  clienteId?: string;
  tipoServico?: string;
  observacoesReparo?: string;
  dataEHoraInicioServico?: string;
  dataEHoraFimServico?: string;
  execucoes?: ExecucaoDto[];
  trajetos?: TrajetoDto[];
}

interface TrajetoDto {
  trajetoId: string;
  statusTrajeto: string;
  dataEHoraIncioTrajeto: string;
}

interface Usuario {
  usuarioId: string;
  nome: string;
}

type ExecucaoDto = ExecucaoResponseDto | ExecucaoFimResponseDto;

// Interface temporária para corrigir o type mismatch
type ExecucaoDtoExtended = (ExecucaoResponseDto | ExecucaoFimResponseDto) & {
  dataEHoraInicioExecucao: string;
  dataEHoraFimExecucao?: string;
};

@Component({
  selector: 'app-ordem-servico-exec',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    WebcamModule,
    ReactiveFormsModule,
    NgxMaskDirective,
  ],
  providers: [provideNgxMask()],
  templateUrl: './ordem-servico-exec.component.html',
  styleUrls: ['./ordem-servico-exec.component.css'],
})
export class OrdemServicoExecComponent implements OnInit {
  codigoOS: string = 'O.S. número 001';
  private codigoOSId: string = '';
  disabled: [boolean, boolean, boolean] = [false, true, true];
  mostrarFormulario: boolean = false;

  modalVisible: boolean = false;
  webcamImage: WebcamImage | null = null;
  errors: WebcamInitError[] = [];
  trigger: Subject<void> = new Subject<void>();
  tipoRegistro: 'inicio' | 'fim' | 'cancelamento' | '' = '';

  motivoCancelamento: string = '';
  outrosMotivo: string = '';
  mostrarCampoOutros: boolean = false;
  motivosCancelamento: string[] = ['Cliente ausente', 'Cliente não autorizou', 'Outros'];

  execucao: ExecucaoDto | null = null;

  formularioServico: FormGroup;
  signaturePad: SignaturePad | null = null;
  @ViewChild('signaturePadCanvas') signaturePadCanvas!: ElementRef<HTMLCanvasElement>;

  public formularioService: FormularioService;

  private readonly BASE_URL: string = 'http://localhost:5030';

  // Adicionar propriedades para o sistema de notificações
  notificationVisible: boolean = false;
  notificationMessage: string = '';
  notificationType: 'success' | 'error' | 'info' | 'warning' = 'info';
  private autoSaveSubscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private servicoFoto: ServicoFoto,
    private servicoLocalizacao: ServicoLocalizacao,
    private vibeService: VibeService,
    formularioService: FormularioService
  ) {
    this.formularioServico = formularioService.criarFormulario();
    this.formularioService = formularioService;
  }

  ngOnInit(): void {
    console.log('Iniciando componente de execução de ordem de serviço');
    
    // Verificar imediatamente se existe um formulário para restaurar
    this.verificarFormularioSalvo();
    
    // Continuar com inicialização padrão
    localStorage.removeItem('execucaoServico');
    this.carregarOrdemServico();
  }

  // Método para verificar se existe um formulário salvo
  private verificarFormularioSalvo(): void {
    const formularioAberto = localStorage.getItem('formularioAberto');
    const execucaoConcluida = localStorage.getItem('execucaoConcluida');
    const formularioData = localStorage.getItem('formularioData');
    
    console.log('Verificando formulário salvo:', {
      formularioAberto,
      execucaoConcluida,
      temDadosFormulario: !!formularioData
    });
    
    if (formularioAberto === 'true' && execucaoConcluida === 'true' && formularioData) {
      console.log('Restaurando formulário salvo');
      
      this.mostrarFormulario = true;
      this.disabled = [true, true, true]; // Desabilita todos os botões quando mostra o formulário
      
      // Aguardar um momento para garantir que os componentes do angular foram inicializados
      setTimeout(() => {
        this.restaurarFormulario();
      }, 500);
    }
  }
  
  private restaurarFormulario(): void {
    try {
      const formularioData = localStorage.getItem('formularioData');
      if (!formularioData) return;
      
      const dados = JSON.parse(formularioData);
      console.log('Dados do formulário restaurados:', dados);
      
      // Preencher o formulário com os dados salvos
      this.formularioServico.patchValue(dados);
      
      // Registrar-se para alterações no formulário para salvar automaticamente
      this.configurarAutoSave();
      
      // Se tiver canvas de assinatura disponível, inicializá-lo
      setTimeout(() => {
        if (this.signaturePadCanvas && this.signaturePadCanvas.nativeElement) {
          this.signaturePad = new SignaturePad(this.signaturePadCanvas.nativeElement);
        }
      }, 200);
    } catch (error) {
      console.error('Erro ao restaurar formulário:', error);
    }
  }

  private carregarOrdemServico(): void {
    this.route.queryParams.subscribe(params => {
      const codigo = params['codigo'];
      this.codigoOSId = codigo || '';
      this.codigoOS = codigo ? `O.S. número ${codigo}` : 'O.S. número 001';
      if (codigo) {
        localStorage.setItem('ordemServicoId', codigo);
      }

      const usuarioData = localStorage.getItem('usuario');
      const usuarioId = usuarioData ? (JSON.parse(usuarioData) as Usuario).usuarioId : null;

      if (!usuarioId) {
        console.error('ID do usuário não encontrado no localStorage');
        this.salvarOrdemServicoPadrao();
        return;
      }

      console.log('Carregando O.S. com codigoOSId:', this.codigoOSId);
      console.log('Dados atuais do localStorage (execucaoServico):', localStorage.getItem('execucaoServico'));

      this.vibeService.buscarOrdemServicoUsuarioId(usuarioId).pipe(
        tap((response: OrdemServico[]) => {
          console.log('Resposta completa da API (buscarOrdemServicoUsuarioId):', response);
          if (response?.length > 0) {
            const ordemServico = response.find(os =>
              os.ordemDeServicoId === this.codigoOSId || os.despachoid === this.codigoOSId
            );
            if (ordemServico?.numeroOrdemDeServico) {
              const numeroOS = parseInt(ordemServico.numeroOrdemDeServico, 10);
              if (!isNaN(numeroOS)) {
                this.codigoOS = `O.S. número ${numeroOS.toString().padStart(3, '0')}`;
              } else {
                this.codigoOS = `O.S. número ${ordemServico.ordemDeServicoId || ordemServico.despachoid}`;
              }
              localStorage.setItem('ordemServico', JSON.stringify(ordemServico));
              console.log('Ordem de serviço encontrada:', ordemServico);

              if (ordemServico.execucoes && ordemServico.execucoes.length > 0) {
                const execucaoAtiva = ordemServico.execucoes
                  .filter(exec => exec.statusExecucao === 'EmAndamento' || exec.statusExecucao === 'Iniciada')
                  .sort((a, b) => {
                    const dateA = (a as ExecucaoDtoExtended).dataEHoraInicioExecucao || '1970-01-01T00:00:00';
                    const dateB = (b as ExecucaoDtoExtended).dataEHoraInicioExecucao || '1970-01-01T00:00:00';
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                  })[0];

                if (execucaoAtiva) {
                  this.execucao = execucaoAtiva;
                  localStorage.setItem('execucaoServico', JSON.stringify(this.execucao));
                  console.log('Execução ativa encontrada no backend e atualizada:', this.execucao);
                  if (this.execucao.statusExecucao === 'EmAndamento' || this.execucao.statusExecucao === 'Iniciada') {
                    this.disabled = [true, false, false];
                  }
                } else {
                  const ultimaExecucao = ordemServico.execucoes.sort((a, b) => {
                    const dateA = (a as ExecucaoDtoExtended).dataEHoraInicioExecucao || '1970-01-01T00:00:00';
                    const dateB = (b as ExecucaoDtoExtended).dataEHoraInicioExecucao || '1970-01-01T00:00:00';
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                  })[0];
                  this.execucao = ultimaExecucao;
                  localStorage.setItem('execucaoServico', JSON.stringify(this.execucao));
                  console.log('Nenhuma execução ativa encontrada. Última execução:', this.execucao);
                  if (this.execucao.statusExecucao === 'Cancelada' || this.execucao.statusExecucao === 'Concluida') {
                    this.disabled = [true, true, true];
                  }
                }

                if (ordemServico.trajetos && ordemServico.trajetos.length > 0) {
                  const ultimoTrajeto = ordemServico.trajetos.sort(
                    (a, b) => new Date(b.dataEHoraIncioTrajeto).getTime() - new Date(a.dataEHoraIncioTrajeto).getTime()
                  )[0];
                  localStorage.setItem('trajetoId', ultimoTrajeto.trajetoId);
                  if (ultimoTrajeto.statusTrajeto === 'Finalizado') {
                    localStorage.setItem('trajetoIdFinalizado', ultimoTrajeto.trajetoId);
                  }
                }
              } else {
                console.warn('Nenhuma execução encontrada no backend para esta ordem de serviço. Limpando dados locais.');
                this.execucao = null;
                localStorage.removeItem('execucaoServico');
                this.disabled = [false, true, true];
              }
            } else {
              console.error('O.S. específica não encontrada na resposta para o código:', this.codigoOSId);
              console.log('Ordens disponíveis na resposta:', response);
              this.salvarOrdemServicoPadrao();
              alert('Ordem de serviço não encontrada. Uma O.S. padrão será criada.');
              this.router.navigate(['/']);
            }
          } else {
            console.error('Nenhuma O.S. encontrada na resposta para o usuário');
            this.salvarOrdemServicoPadrao();
            alert('Nenhuma ordem de serviço encontrada. Uma O.S. padrão será criada.');
            this.router.navigate(['/']);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Erro ao buscar a O.S. do usuário:', error);
          this.salvarOrdemServicoPadrao();
          alert('Erro ao buscar ordens de serviço. Uma O.S. padrão será criada.');
          this.router.navigate(['/']);
          return throwError(() => error);
        })
      ).subscribe();
    });
  }

  private salvarOrdemServicoPadrao(): void {
    this.codigoOS = 'O.S. número 001';
    this.codigoOSId = '001';
    const ordemPadrao: OrdemServico = {
      ordemDeServicoId: '001',
      despachoid: '001',
      numeroOrdemDeServico: '001',
      cliente: {
        nome: '',
        cpf: '',
        telefone: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
      },
    };
    localStorage.setItem('ordemServico', JSON.stringify(ordemPadrao));
    localStorage.setItem('usuario', JSON.stringify({ usuarioId: 'default-user', nome: 'Colaborador Desconhecido' }));
  }

  iniciarOS(): void {
    this.tipoRegistro = 'inicio';
    this.abrirModal();
  }

  cancelarOS(): void {
    if (!this.execucao || !this.execucao.execucaoServicoId) {
      alert('Nenhuma execução de serviço iniciada. Por favor, inicie a O.S. antes de cancelar.');
      return;
    }
    if (this.execucao.statusExecucao !== 'EmAndamento' && this.execucao.statusExecucao !== 'Iniciada') {
      alert('A ordem de serviço não pode ser cancelada. Estado atual: ' + (this.execucao.statusExecucao || 'desconhecido'));
      return;
    }
    if (confirm('Tem certeza que deseja cancelar esta O.S.?')) {
      this.tipoRegistro = 'cancelamento';
      this.motivoCancelamento = '';
      this.outrosMotivo = '';
      this.mostrarCampoOutros = false;
      this.abrirModal();
    }
  }

  async finalizarOS(): Promise<void> {
    this.tipoRegistro = 'fim';
    this.abrirModal();
  }

  abrirModal(): void {
    this.modalVisible = true;
    this.webcamImage = null;
    this.errors = [];
  }

  fecharModal(): void {
    this.modalVisible = false;
    this.webcamImage = null;
    this.motivoCancelamento = '';
    this.outrosMotivo = '';
    this.mostrarCampoOutros = false;
  }

  triggerCapture(): void {
    this.trigger.next();
  }

  get triggerObservable(): Subject<void> {
    return this.trigger;
  }

  async handleImage(webcamImage: WebcamImage): Promise<void> {
    console.log('Imagem capturada - processando...', {
      base64: webcamImage.imageAsDataUrl.substring(0, 50) + '...',
      width: webcamImage.imageData?.width,
      height: webcamImage.imageData?.height,
    });

    if (!webcamImage || !webcamImage.imageAsBase64) {
      console.error('Imagem não capturada corretamente');
      alert('Erro ao capturar imagem. Tente novamente.');
      return;
    }

    this.webcamImage = webcamImage;
    const imagemComData = await this.servicoFoto.adicionarDataHoraImagem(webcamImage.imageAsBase64);
    const dataUrl = `data:image/jpeg;base64,${imagemComData}`;
    const tempImage = new Image();

    tempImage.onload = () => {
      const imageData = new ImageData(tempImage.width, tempImage.height);
      this.webcamImage = new WebcamImage(dataUrl, 'image/jpeg', imageData);

      // Processar a ação de forma assíncrona para evitar bloqueio
      setTimeout(() => {
        if (this.tipoRegistro === 'cancelamento') {
          this.enviarCancelamento();
        } else if (this.tipoRegistro === 'inicio' || this.tipoRegistro === 'fim') {
          this.registrarAcao();
        }
      }, 0);
    };
    tempImage.src = dataUrl;
  }

  public handleInitError(error: WebcamInitError): void {
    console.error('🚨 Erro ao inicializar a webcam:', error);
    this.errors.push(error);
  }

  private async enviarCancelamento(): Promise<void> {
    try {
      if (!this.execucao || !this.execucao.execucaoServicoId) {
        throw new Error('Nenhuma execução de serviço iniciada. Por favor, inicie a O.S. antes de cancelar.');
      }
  
      const usuarioId = this.obterUsuarioId();
      const response = await this.vibeService.buscarOrdemServicoUsuarioId(usuarioId)
        .pipe(
          tap((response: OrdemServico[]) => {
            console.log('Resposta da API ao sincronizar (buscarOrdemServicoUsuarioId):', response);
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('Erro ao sincronizar os dados com o backend:', error);
            throw new Error('Não foi possível verificar o estado da ordem de serviço. Tente novamente.');
          })
        )
        .toPromise();
  
      const ordemServico = response?.find(os =>
        os.ordemDeServicoId === this.codigoOSId || os.despachoid === this.codigoOSId
      );
  
      if (!ordemServico) {
        throw new Error('Ordem de serviço não encontrada no backend. Por favor, recarregue a página.');
      }
  
      if (ordemServico.execucoes && ordemServico.execucoes.length > 0) {
        const execucaoAtiva = ordemServico.execucoes
          .filter(exec => exec.statusExecucao === 'EmAndamento' || exec.statusExecucao === 'Iniciada')
          .sort((a, b) => {
            const dateA = (a as ExecucaoDtoExtended).dataEHoraInicioExecucao || '1970-01-01T00:00:00';
            const dateB = (b as ExecucaoDtoExtended).dataEHoraInicioExecucao || '1970-01-01T00:00:00';
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          })[0];
  
        if (execucaoAtiva) {
          this.execucao = execucaoAtiva;
          localStorage.setItem('execucaoServico', JSON.stringify(this.execucao));
          console.log('Execução ativa atualizada com os dados mais recentes do backend:', this.execucao);
        } else {
          const ultimaExecucao = ordemServico.execucoes.sort((a, b) => {
            const dateA = (a as ExecucaoDtoExtended).dataEHoraInicioExecucao || '1970-01-01T00:00:00';
            const dateB = (b as ExecucaoDtoExtended).dataEHoraInicioExecucao || '1970-01-01T00:00:00';
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          })[0];
          this.execucao = ultimaExecucao;
          localStorage.setItem('execucaoServico', JSON.stringify(this.execucao));
          console.log('Nenhuma execução ativa encontrada. Última execução:', this.execucao);
          if (this.execucao.statusExecucao === 'Cancelada' || this.execucao.statusExecucao === 'Concluida') {
            this.disabled = [true, true, true];
            throw new Error('A ordem de serviço já foi concluída ou cancelada.');
          }
        }
      } else {
        console.warn('Nenhuma execução encontrada no backend para esta ordem de serviço. Limpando dados locais.');
        this.execucao = null;
        localStorage.removeItem('execucaoServico');
        this.disabled = [false, true, true];
        throw new Error('Nenhuma execução de serviço encontrada para esta ordem de serviço.');
      }
  
      if (this.execucao.statusExecucao !== 'EmAndamento' && this.execucao.statusExecucao !== 'Iniciada') {
        throw new Error(
          'A execução de serviço não está em andamento e não pode ser cancelada. Estado atual: ' +
            (this.execucao.statusExecucao || 'desconhecido')
        );
      }
  
      console.log('Tentando cancelar execução:', {
        execucaoServicoId: this.execucao.execucaoServicoId,
        statusExecucao: this.execucao.statusExecucao,
        execucaoCompleta: this.execucao,
      });
  
      const coordenadas = await this.obterCoordenadas();
      const fotoProcessada = await this.validarEFotoProcessada();
      const motivoFinal = this.validarMotivoCancelamento();
      const ordemDeServicoId = ordemServico.ordemDeServicoId;
  
      // 1. Cancelar a execução
      const formDataExecucao = new FormData();
      const blob = this.convertBase64ToBlob(fotoProcessada.fotoFormatada);
      formDataExecucao.append('FotoCancelamento', blob, 'fotoCancelamento.jpg');
      formDataExecucao.append('LatitudeCancelaExecucao', coordenadas.latitude.toString());
      formDataExecucao.append('LongitudeCancelaExecucao', coordenadas.longitude.toString());
      formDataExecucao.append('ObservacaoCancelamento', motivoFinal);
  
      console.log('Dados enviados para cancelamento da execução:', {
        FotoCancelamento: 'Arquivo (Blob)',
        LatitudeCancelaExecucao: coordenadas.latitude.toString(),
        LongitudeCancelaExecucao: coordenadas.longitude.toString(),
        ObservacaoCancelamento: motivoFinal,
      });
  
      const execucaoResponse = await this.vibeService.cancelarExecucaoServico(
        this.execucao.execucaoServicoId,
        usuarioId,
        formDataExecucao
      )
        .pipe(
          tap((response: ExecucaoResponseDto) => {
            if (!response) {
              throw new Error('Resposta vazia ao cancelar execução');
            }
          }),
          catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'cancelar execução'))
        )
        .toPromise();
  
      console.log('Execução cancelada com sucesso:', execucaoResponse);
      this.execucao = execucaoResponse || null;
      if (this.execucao) {
        this.execucao.statusExecucao = 'Cancelada';
        localStorage.setItem('execucaoServico', JSON.stringify(this.execucao));
      }
      localStorage.setItem('osFotoCancelamento', this.webcamImage?.imageAsDataUrl || '');
  
      // 2. Atualizar o status da ordem de serviço para "Cancelado" no backend
      const updateData = {
        numeroOrdemDeServico: ordemServico.numeroOrdemDeServico || '',
        clienteId: ordemServico.clienteId || '',
        tipoServico: ordemServico.tipoServico || '',
        statusOrdem: 'Cancelado',
        observacoesReparo: motivoFinal, // Usar o motivo de cancelamento como observação
        dataEHoraInicioServico: ordemServico.dataEHoraInicioServico || '',
        dataEHoraFimServico: ordemServico.dataEHoraFimServico || new Date().toISOString(),
      };
  
      const ordemResponse = await this.vibeService.atualizarOrdemServico(ordemDeServicoId, updateData)
        .pipe(
          tap((response) => {
            console.log('Status da ordem de serviço atualizado para "Cancelado" no backend:', response);
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('Erro ao atualizar o status da ordem de serviço no backend:', error);
            throw new Error('Erro ao atualizar o status da ordem de serviço no backend.');
          })
        )
        .toPromise();
  
      // 3. Atualizar localmente
      this.atualizarStatusOrdem('Cancelado');
      this.limparLocalStorageAposCancelamento();
      this.disabled = [false, true, true];
  
      alert('Ordem de serviço cancelada com sucesso.');
      this.fecharModal();
      
      // Substituir o redirecionamento para a página de ordens pendentes
      this.router.navigate([`/pages/ordem-servico/pendentes/${usuarioId}`]);
      
    } catch (error: any) {
      console.error('Erro ao enviar cancelamento:', error);
      alert(error.message || 'Não foi possível processar o cancelamento.');
      if (!this.execucao) {
        this.disabled = [false, true, true];
      }
    }
  }

  private async registrarAcao(): Promise<void> {
    try {
      const coordenadas = await this.obterCoordenadas();
      const latitudeNum = coordenadas.latitude;
      const longitudeNum = coordenadas.longitude;

      const fotoProcessada = await this.validarEFotoProcessada();
      const usuarioId = this.obterUsuarioId();

      if (this.tipoRegistro === 'inicio') {
        await this.registrarInicioExecucao(usuarioId, fotoProcessada.fotoFormatada, latitudeNum, longitudeNum);
      } else if (this.tipoRegistro === 'fim') {
        await this.registrarFimExecucao(usuarioId, fotoProcessada.fotoFormatada, latitudeNum, longitudeNum);
      }
    } catch (error: any) {
      console.error('Erro ao registrar ação:', error);
      alert(error.message || 'Não foi possível registrar a ação.');
    }
  }

  private async registrarInicioExecucao(
    usuarioId: string,
    fotoBase64: string,
    latitudeNum: number,
    longitudeNum: number
  ): Promise<void> {
    const trajetoId = localStorage.getItem('trajetoId');
    if (!trajetoId) {
      throw new Error('Trajeto não iniciado. Inicie o trajeto antes de iniciar a O.S.');
    }

    const dataFinalizacao = {
      LatitudeFimTrajeto: latitudeNum.toFixed(6),
      LongitudeFimTrajeto: longitudeNum.toFixed(6),
      dataHoraFim: new Date().toISOString(),
    };

    try {
      const finalizarResponse = await this.vibeService.finalizarTrajeto(trajetoId, usuarioId, dataFinalizacao)
        .pipe(
          tap(response => {
            if (!response) {
              throw new Error('Resposta vazia ao finalizar trajeto');
            }
          }),
          catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'finalizar trajeto'))
        )
        .toPromise();

      console.log('Trajeto finalizado com sucesso. Trajeto ID finalizado:', trajetoId);
      localStorage.setItem('trajetoIdFinalizado', trajetoId);

      const formData = new FormData();
      const blob = this.convertBase64ToBlob(fotoBase64);
      formData.append('FotoInicioServico', blob, 'fotoInicio.jpg');
      formData.append('LatitudeInicioExecucaoServico', latitudeNum.toFixed(6));
      formData.append('LongitudeInicioExecucaoServico', longitudeNum.toFixed(6));
      formData.append('FotoInicio', '');

      console.log('FormData entries:', Array.from(formData.entries()));
      console.log('Dados enviados para iniciar execução:', {
        FotoInicioServico: 'Arquivo (Blob)',
        LatitudeInicioExecucaoServico: latitudeNum.toFixed(6),
        LongitudeInicioExecucaoServico: longitudeNum.toFixed(6),
        FotoInicio: '',
      });

      const execucaoResponse = await this.vibeService.iniciarExecucaoServico(trajetoId, usuarioId, formData)
        .pipe(
          tap(response => {
            if (!response) {
              throw new Error('Resposta vazia ao iniciar execução');
            }
          }),
          catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'iniciar execução'))
        )
        .toPromise();

      if (!execucaoResponse) {
        throw new Error('Resposta vazia ao iniciar execução');
      }

      console.log('Execução iniciada com sucesso:', execucaoResponse);
      this.execucao = execucaoResponse;

      const execucaoServicoId = execucaoResponse?.execucaoServicoId || '';
      if (execucaoServicoId) {
        localStorage.setItem('execucaoServicoId', execucaoServicoId);
      } else {
        console.error('execucaoServicoId não retornado pelo iniciarExecucaoServico:', execucaoResponse);
      }

      localStorage.setItem('execucaoServico', JSON.stringify(execucaoResponse));
      localStorage.setItem('osIniciada', 'true');
      const fotoInicioStored = this.webcamImage?.imageAsDataUrl || '';
      localStorage.setItem('osFotoInicio', fotoInicioStored);
      console.log('Foto de início armazenada (base64 para exibição local):', fotoInicioStored);

      this.disabled = [true, false, false];
      this.fecharModal();
    } catch (error) {
      console.error('Erro ao iniciar execução:', error);
      throw error;
    }
  }

  private async registrarFimExecucao(
    usuarioId: string,
    fotoBase64: string,
    latitudeNum: number,
    longitudeNum: number
  ): Promise<void> {
    if (!this.execucao?.execucaoServicoId) {
      const execucaoData = localStorage.getItem('execucaoServico');
      if (execucaoData) {
        this.execucao = JSON.parse(execucaoData) as ExecucaoResponseDto;
      }
      if (!this.execucao?.execucaoServicoId) {
        throw new Error('Execução não iniciada. Inicie a O.S. primeiro.');
      }
    }

    const formData = new FormData();
    const blob = this.convertBase64ToBlob(fotoBase64);
    formData.append('FotoFimServico', blob, 'fotoFim.jpg');
    formData.append('LatitudeFimExecucaoServico', latitudeNum.toFixed(6));
    formData.append('LongitudeFimExecucaoServico', longitudeNum.toFixed(6));

    console.log('Dados para finalização:', {
      execucaoServicoId: this.execucao.execucaoServicoId,
      usuarioId,
      latitude: latitudeNum.toFixed(6),
      longitude: latitudeNum.toFixed(6),
      fotoFimServico: 'Arquivo (Blob)',
    });

    try {
      const response = await this.vibeService.finalizarExecucaoServico(this.execucao.execucaoServicoId, usuarioId, formData)
        .pipe(
          catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'finalizar execução'))
        )
        .toPromise();

      if (!response) {
        throw new Error('Resposta vazia ao finalizar execução');
      }

      console.log('Execução finalizada com sucesso:', response);
      this.execucao = response as ExecucaoFimResponseDto;

      const execucaoServicoId = response.execucaoServicoId;
      if (execucaoServicoId) {
        localStorage.setItem('execucaoServicoId', execucaoServicoId);
      } else {
        console.error('execucaoServicoId não retornado pelo finalizarExecucaoServico:', response);
      }

      localStorage.setItem('execucaoServico', JSON.stringify(response));
      const fotoFim = this.webcamImage?.imageAsDataUrl || '';
      localStorage.setItem('osFotoFim', fotoFim);
      console.log('Foto de fim armazenada (base64 para exibição local):', fotoFim);

      this.disabled = [false, true, true];
      this.mostrarFormulario = true;
      
      // Marcar que a execução foi concluída e o formulário está aberto
      localStorage.setItem('formularioAberto', 'true');
      localStorage.setItem('execucaoConcluida', 'true');
      
      this.fecharModal();
      
      // Inicializar formulário e configurar auto-save
      await this.inicializarFormulario();
      
      // Salvar dados iniciais do formulário imediatamente
      const valoresFormulario = this.formularioServico.value;
      localStorage.setItem('formularioData', JSON.stringify(valoresFormulario));
      console.log('Dados do formulário salvos inicialmente:', valoresFormulario);
    } catch (error) {
      console.error('Erro ao finalizar execução:', error);
      throw error;
    }
  }

  private async inicializarFormulario(): Promise<void> {
    try {
      const dadosAutomaticos = await this.formularioService.preencherDadosAutomaticos();
      console.log('Dados automáticos recuperados:', dadosAutomaticos);

      // Tentar restaurar dados do formulário do localStorage
      const formularioData = localStorage.getItem('formularioData');
      let dadosSalvos = null;
      
      if (formularioData) {
        try {
          dadosSalvos = JSON.parse(formularioData);
          console.log('Dados do formulário restaurados do localStorage:', dadosSalvos);
        } catch (e) {
          console.error('Erro ao parsear dados do formulário:', e);
        }
      }

      const execucaoData = localStorage.getItem('execucaoServico');
      let fotoInicioUrl: string = '';
      let fotoFimUrl: string = '';

      if (execucaoData) {
        const execucao = JSON.parse(execucaoData) as ExecucaoDto;
        if ('fotoInicioServico' in execucao && typeof execucao.fotoInicioServico === 'string' && execucao.fotoInicioServico) {
          fotoInicioUrl = this.construirUrlImagem(execucao.fotoInicioServico);
        }
        if ('fotoFimServico' in execucao && typeof execucao.fotoFimServico === 'string' && execucao.fotoFimServico) {
          fotoFimUrl = this.construirUrlImagem(execucao.fotoFimServico);
        }
      }

      const fotoInicioStored = localStorage.getItem('osFotoInicio') || dadosAutomaticos.fotoInicio || '';
      const fotoFimStored = localStorage.getItem('osFotoFim') || dadosAutomaticos.fotoFim || '';

      this.formularioServico.patchValue({
        codigoOS: dadosSalvos?.codigoOS || dadosAutomaticos.codigoOS || '',
        nomeColaborador: dadosSalvos?.nomeColaborador || dadosAutomaticos.nomeColaborador || '',
        empresaColaborador: dadosSalvos?.empresaColaborador || dadosAutomaticos.empresaColaborador || 'VIBETEX',
        nomeCliente: dadosSalvos?.nomeCliente || dadosAutomaticos.nomeCliente || '',
        cpf: dadosSalvos?.cpf || dadosAutomaticos.cpf || '',
        telefone: dadosSalvos?.telefone || this.formularioService.formatarTelefone(dadosAutomaticos.telefone || ''),
        cep: dadosSalvos?.cep || dadosAutomaticos.cep || '',
        logradouro: dadosSalvos?.logradouro || dadosAutomaticos.logradouro || '',
        numero: dadosSalvos?.numero || dadosAutomaticos.numero || '',
        complemento: dadosSalvos?.complemento || dadosAutomaticos.complemento || '',
        bairro: dadosSalvos?.bairro || dadosAutomaticos.bairro || '',
        cidade: dadosSalvos?.cidade || dadosAutomaticos.cidade || '',
        estado: dadosSalvos?.estado || dadosAutomaticos.estado || '',
        fotoInicio: dadosSalvos?.fotoInicio || fotoInicioUrl || fotoInicioStored,
        fotoFim: dadosSalvos?.fotoFim || fotoFimUrl || fotoFimStored,
        observacoes: dadosSalvos?.observacoes || '',
      });

      const cep = this.formularioServico.get('cep')?.value;
      if (cep && cep.length === 8) {
        try {
          const dadosCep = await this.formularioService.buscarCep(cep);
          if (dadosCep && !dadosCep.erro) {
            this.formularioServico.patchValue({
              logradouro: dadosCep.logradouro || this.formularioServico.get('logradouro')?.value,
              bairro: dadosCep.bairro || this.formularioServico.get('bairro')?.value,
              cidade: dadosCep.localidade || this.formularioServico.get('cidade')?.value,
              estado: dadosCep.uf || this.formularioServico.get('estado')?.value,
            });
          } else {
            console.warn('CEP não encontrado:', cep);
          }
        } catch (error) {
          console.error('Erro ao buscar CEP:', error);
        }
      }

      setTimeout(() => {
        if (this.signaturePadCanvas) {
          this.signaturePad = new SignaturePad(this.signaturePadCanvas.nativeElement);
        } else {
          console.error('Canvas para assinatura não encontrado');
        }
      }, 0);

      // Configurar o listener para salvar alterações no formulário
      this.configurarAutoSave();

    } catch (error) {
      console.error('Erro ao preencher dados automáticos:', error);
      alert('Erro ao carregar dados do formulário.');
    }
  }

  // Método para configurar o auto-save do formulário
  private configurarAutoSave(): void {
    // Desinscrever de assinaturas anteriores, se houver
    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
    }
    
    // Registrar para mudanças no formulário
    this.autoSaveSubscription = this.formularioServico.valueChanges.subscribe(valores => {
      localStorage.setItem('formularioData', JSON.stringify(valores));
      console.log('AutoSave: Dados do formulário atualizados');
    });
  }

  limparAssinatura(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.formularioServico.valid || !this.signaturePad || this.signaturePad.isEmpty()) {
      this.showNotification('Por favor, preencha todos os campos obrigatórios e forneça uma assinatura.', 'error');
      return;
    }

    const formData = this.formularioServico.value;
    const assinaturaBase64 = this.signaturePad.toDataURL('image/png');
    const base64Data = assinaturaBase64.split(',')[1];

    const formDataApi = new FormData();
    formDataApi.append('AssinaturaCliente', base64Data);
    formDataApi.append('ObservacoesReparo', formData.observacoes || '');

    const execucaoData = localStorage.getItem('execucaoServico');
    const usuarioId = this.obterUsuarioId();
    const ordemDeServicoId = localStorage.getItem('ordemServicoId') || '';

    if (!execucaoData || !usuarioId || !ordemDeServicoId) {
      this.showNotification('Execução, usuário ou ordem de serviço não encontrados.', 'error');
      return;
    }

    console.log('Enviando dados para a API:', Array.from(formDataApi.entries()));
    try {
      const response = await this.vibeService.enviarFormularioServico(ordemDeServicoId, formDataApi)
        .pipe(
          catchError((error: HttpErrorResponse) => this.handleHttpError(error, 'enviar formulário'))
        )
        .toPromise();

      console.log('Resposta da API:', response);
      await this.atualizarStatusOrdemConcluida(formData.observacoes);

      this.showNotification('Formulário enviado com sucesso! Obrigado por utilizar nosso sistema.', 'success');
      
      // Limpar todos os dados do formulário
      this.limparTodosDadosFormulario();
      this.limparLocalStorageAposConclusao();
      
      this.formularioServico.reset();
      this.limparAssinatura();
      this.mostrarFormulario = false;
      
      // Redirecionar para a página de ordens pendentes após o envio bem-sucedido
      this.router.navigate([`/pages/ordem-servico/pendentes/${usuarioId}`]);
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      this.showNotification('Erro ao enviar formulário. Por favor, tente novamente.', 'error');
    }
  }

  // Método para limpar dados do formulário no localStorage
  private limparTodosDadosFormulario(): void {
    localStorage.removeItem('formularioAberto');
    localStorage.removeItem('execucaoConcluida');
    localStorage.removeItem('formularioData');
    
    // Cancelar a assinatura do autoSave
    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
      this.autoSaveSubscription = null;
    }
  }

  atualizarMotivo(): void {
    this.mostrarCampoOutros = this.motivoCancelamento === 'Outros';
    if (!this.mostrarCampoOutros) {
      this.outrosMotivo = '';
    }
    setTimeout(() => {
      this.modalVisible = false;
      this.modalVisible = true;
    }, 100);
  }

  async buscarCepHandler(): Promise<void> {
    try {
      const cep = this.formularioServico.get('cep')?.value;
      if (cep) {
        const data = await this.formularioService.buscarCep(cep);
        if (data && !data.erro) {
          this.formularioServico.patchValue({
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf,
          });
        } else {
          alert('CEP não encontrado');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      alert('Erro ao buscar CEP. Tente novamente.');
    }
  }

  private async obterCoordenadas(): Promise<Coordenadas> {
    const { latitude, longitude } = await this.servicoLocalizacao.capturarCoordenadas();
    const latitudeNum = parseFloat(latitude.toString());
    const longitudeNum = parseFloat(longitude.toString());

    if (!latitude || !longitude || isNaN(latitudeNum) || isNaN(longitudeNum)) {
      throw new Error('Coordenadas inválidas ou indisponíveis. Por favor, habilite a geolocalização.');
    }

    console.log('Coordenadas capturadas (números):', { latitude: latitudeNum, longitude: longitudeNum });
    return { latitude: latitudeNum, longitude: longitudeNum };
  }

  private async validarEFotoProcessada(): Promise<{ fotoFormatada: string }> {
    if (!this.webcamImage) {
      throw new Error('Por favor, capture uma foto antes de prosseguir.');
    }

    const fotoProcessada = await this.servicoFoto.prepararFotoParaEnvio(this.webcamImage);
    if (!fotoProcessada || !fotoProcessada.fotoFormatada) {
      throw new Error('Erro ao processar a foto');
    }

    return fotoProcessada;
  }

  private obterUsuarioId(): string {
    const usuarioData = localStorage.getItem('usuario');
    const usuarioId = usuarioData ? (JSON.parse(usuarioData) as Usuario).usuarioId : null;
    if (!usuarioId) {
      throw new Error('ID do usuário não encontrado no localStorage');
    }
    return usuarioId;
  }

  private validarMotivoCancelamento(): string {
    if (!this.motivoCancelamento) {
      throw new Error('Por favor, selecione um motivo de cancelamento.');
    }

    if (this.motivoCancelamento === 'Outros' && !this.outrosMotivo.trim()) {
      throw new Error('Por favor, informe o motivo detalhado para "Outros".');
    }

    return this.motivoCancelamento === 'Outros' ? this.outrosMotivo.trim() : this.motivoCancelamento;
  }

  private convertBase64ToBlob(base64: string): Blob {
    let base64Data = base64;
    if (base64Data.startsWith('data:image/jpeg;base64,')) {
      base64Data = base64Data.split(',')[1];
    }

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
  }

  private construirUrlImagem(caminho: string): string {
    if (!caminho) {
      return '';
    }
    if (caminho.startsWith('data:image/') || caminho.startsWith('http')) {
      return caminho;
    }
    return `${this.BASE_URL}${caminho}`;
  }

  private atualizarStatusOrdem(status: string): void {
    const ordemData = localStorage.getItem('ordemServico');
    if (ordemData) {
      const ordem: OrdemServico = JSON.parse(ordemData);
      ordem.statusOrdem = status;
      localStorage.setItem('ordemServico', JSON.stringify(ordem));
    }
  }

  private async atualizarStatusOrdemConcluida(observacoes: string): Promise<void> {
    const ordemData = localStorage.getItem('ordemServico');
    const ordemDeServicoId = localStorage.getItem('ordemServicoId') || '';
    const execucaoData = localStorage.getItem('execucaoServico');

    if (!ordemData || !ordemDeServicoId) {
      console.error('Dados da ordem de serviço ou ID não encontrados.');
      return;
    }

    const ordem: OrdemServico = JSON.parse(ordemData);
    
    // Obter os dados de início da execução
    let dataInicio = ordem.dataEHoraInicioServico;
    let dataFim = new Date().toISOString();
    
    if (execucaoData) {
      const execucao = JSON.parse(execucaoData) as ExecucaoDto;
      
      // Verificar se temos datas disponíveis na execução
      if ('dataEHoraInicioExecucao' in execucao && execucao.dataEHoraInicioExecucao) {
        dataInicio = execucao.dataEHoraInicioExecucao;
      }
      
      if ('dataEHoraFimExecucao' in execucao && execucao.dataEHoraFimExecucao) {
        dataFim = execucao.dataEHoraFimExecucao instanceof Date 
          ? execucao.dataEHoraFimExecucao.toISOString() 
          : execucao.dataEHoraFimExecucao;
      } else if ('dataHoraFim' in execucao && execucao.dataHoraFim) {
    
        dataFim = typeof execucao.dataHoraFim === 'string' ? execucao.dataHoraFim : new Date().toISOString();
      }
    }
    
    // Se ainda não tivermos data de início, use a atual
    if (!dataInicio) {
      dataInicio = ordem.dataEHoraInicioServico || dataFim;
    }

    console.log('Atualizando ordem com datas:', {
      dataInicio,
      dataFim,
      execucaoData: execucaoData ? JSON.parse(execucaoData) : null
    });

    const updateData = {
      numeroOrdemDeServico: ordem.numeroOrdemDeServico || '',
      clienteId: ordem.clienteId || '',
      tipoServico: ordem.tipoServico || '',
      statusOrdem: 'Concluído',
      observacoesReparo: observacoes || ordem.observacoesReparo || '',
      dataEHoraInicioServico: dataInicio,
      dataEHoraFimServico: dataFim,
    };

    try {
      const response = await this.vibeService.atualizarOrdemServico(ordemDeServicoId, updateData)
        .pipe(
          catchError((error: HttpErrorResponse) => {
            console.error('Erro ao atualizar o status no backend:', error);
            this.showNotification('Erro ao atualizar o status da ordem de serviço no backend.', 'error');
            return throwError(() => error);
          })
        )
        .toPromise();

      console.log('Status da ordem de serviço atualizado no backend:', response);
      ordem.statusOrdem = 'Concluído';
      ordem.dataEHoraInicioServico = dataInicio;
      ordem.dataEHoraFimServico = dataFim;
      localStorage.setItem('ordemServico', JSON.stringify(ordem));
    } catch (error) {
      console.error('Erro ao atualizar status da ordem:', error);
    }
  }

  private limparLocalStorageAposCancelamento(): void {
    this.limparTodosDadosFormulario();
    localStorage.removeItem('osEmAndamento');
    localStorage.removeItem('osIniciada');
    localStorage.removeItem('osFotoInicio');
    localStorage.removeItem('osFotoFim');
    localStorage.removeItem('execucaoServico');
    localStorage.removeItem('execucaoServicoId');
  }

  private limparLocalStorageAposConclusao(): void {
    this.limparTodosDadosFormulario();
    localStorage.removeItem('execucaoServico');
    localStorage.removeItem('execucaoServicoId');
    localStorage.removeItem('osFotoInicio');
    localStorage.removeItem('osFotoFim');
    localStorage.removeItem('osIniciada');
  }

  private handleHttpError(error: HttpErrorResponse, contexto: string) {
    console.error(`Erro detalhado ao ${contexto}:`, error);
    let mensagem = `Erro ao ${contexto}: `;
    if (error.status === 400) {
      mensagem += error.error?.message || error.error || 'Dados inválidos fornecidos';
      if (error.error?.innerException) {
        mensagem += ' Detalhes: ' + error.error.innerException;
      } else if (error.error?.errors) {
        mensagem += ' Erros: ' + JSON.stringify(error.error.errors);
      }
    } else if (error.status === 404) {
      mensagem += contexto.includes('finalizar') ? 'Execução não encontrada' : 'Trajeto ou usuário não encontrado';
    } else {
      mensagem += error.message || 'Erro na comunicação com o servidor';
    }
    alert(mensagem);
    return throwError(() => error);
  }

  // Método para exibir notificações
  showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    this.notificationMessage = message;
    this.notificationType = type;
    this.notificationVisible = true;
    
    // Auto-esconder após 5 segundos
    setTimeout(() => {
      this.hideNotification();
    }, 5000);
  }
  
  hideNotification(): void {
    this.notificationVisible = false;
  }

  // Implementar um método para destruição do componente
  ngOnDestroy(): void {
    // Garantir que a assinatura é cancelada quando o componente é destruído
    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
    }
  }
}