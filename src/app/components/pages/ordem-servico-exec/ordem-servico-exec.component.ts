import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WebcamImage, WebcamInitError, WebcamModule } from 'ngx-webcam';
import { Subject } from 'rxjs';
import { ServicoFoto } from '../../../services/foto.service';
import { ServicoLocalizacao } from '../../../services/localizacao.service';
import { ServicoArmazenamento } from '../../../services/armazenamento.service';
import { FormularioServicoComponent } from '../formulario-servico/formulario-servico.component';
import { VibeService } from '../../../services/vibe.service';
import { ExecucaoResponseDto } from '../../../models/vibe-service/execucao.response.Dto';
import { ExecucaoRequestDto } from '../../../models/vibe-service/execucao.request.Dto';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-ordem-servico-exec',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    WebcamModule,
    FormularioServicoComponent
  ],
  templateUrl: './ordem-servico-exec.component.html',
  styleUrls: ['./ordem-servico-exec.component.css']
})
export class OrdemServicoExecComponent implements OnInit {
  codigoOS: string = 'OS-0000';
  disabled: boolean[] = [false, true, true]; // [Iniciar, Cancelar, Finalizar]
  mostrarFormulario = false; // Flag para exibir/ocultar o formulário na mesma página

  // Webcam
  modalVisible = false;
  webcamImage: WebcamImage | null = null;
  errors: WebcamInitError[] = [];
  trigger: Subject<void> = new Subject<void>();
  tipoRegistro: 'inicio' | 'fim' | 'cancelamento' | '' = '';

  // Estado do cancelamento
  motivoCancelamento: string = '';
  outrosMotivo: string = '';
  mostrarCampoOutros: boolean = false;
  motivosCancelamento: string[] = ['Cliente ausente', 'Cliente não autorizou', 'Outros'];

  // Estado da execução
  execucao: ExecucaoResponseDto | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private servicoFoto: ServicoFoto,
    private servicoLocalizacao: ServicoLocalizacao,
    private servicoArmazenamento: ServicoArmazenamento,
    private vibeService: VibeService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.codigoOS = params['codigo'] || 'OS-0000';
    });

    // Carrega o estado da execução, se houver
    const execucaoData = localStorage.getItem('execucaoServico');
    if (execucaoData) {
      this.execucao = JSON.parse(execucaoData) as ExecucaoResponseDto;
      if (this.execucao?.statusExecucao === 'Iniciada') { // Usamos ? para evitar null
        this.disabled = [true, false, false]; // O.S. iniciada, permite cancelar e finalizar
      }
    }
  }

  // === Botões ===
  iniciarOS(): void {
    this.tipoRegistro = 'inicio';
    this.abrirModal();
  }

  cancelarOS(): void {
    if (confirm('Tem certeza que deseja cancelar esta O.S.?')) {
      this.tipoRegistro = 'cancelamento';
      this.motivoCancelamento = '';
      this.outrosMotivo = '';
      this.mostrarCampoOutros = false;
      this.abrirModal();
    }
  }

  finalizarOS(): void {
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

  handleImage(webcamImage: WebcamImage): void {
    this.webcamImage = webcamImage;
    this.registrarAcao();
  }

  onMotivoChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.motivoCancelamento = select.value;
    this.mostrarCampoOutros = this.motivoCancelamento === 'Outros';
    if (!this.mostrarCampoOutros) {
      this.outrosMotivo = '';
    }
  }

  private async registrarAcao(): Promise<void> {
    try {
      const { latitude, longitude } = await this.servicoLocalizacao.capturarCoordenadas();
      if (!latitude || !longitude) {
        throw new Error('Localização indisponível. Por favor, habilite a geolocalização.');
      }
  
      console.log('Latitude capturada:', latitude);
      console.log('Longitude capturada:', longitude);
  
      if (this.tipoRegistro === 'inicio' && this.webcamImage) {
        const file = this.base64ToFile(this.webcamImage.imageAsBase64, 'fotoInicio.jpg');
        
        const request: ExecucaoRequestDto = {
          fotoInicioServico: file,
          latitudeInicioExecucaoServico: latitude.toString(),
          longitudeInicioExecucaoServico: longitude.toString()
        };
  
        const usuarioId = localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')!).usuarioId : null;
        this.vibeService.iniciarExecucaoServico(this.codigoOS, usuarioId, request).subscribe({
          next: (response: ExecucaoResponseDto) => {
            console.log('Execução iniciada com sucesso:', response);
            this.execucao = response;
            localStorage.setItem('execucaoServico', JSON.stringify(response));
            localStorage.setItem('osIniciada', 'true');
            localStorage.setItem('osFotoInicio', this.webcamImage?.imageAsBase64 || '');
            this.disabled = [true, false, false];
          },
          error: (error) => {
            console.error('Erro ao iniciar execução:', error);
            alert('Erro ao iniciar a ordem de serviço. Tente novamente.');
          }
        });
      } else if (this.tipoRegistro === 'fim' && this.webcamImage) {
        if (!this.execucao?.execucaoServicoId) {
          throw new Error('Execução não iniciada. Inicie a O.S. primeiro.');
        }
  
        const file = this.base64ToFile(this.webcamImage.imageAsBase64, 'fotoFim.jpg');
  
        const request: ExecucaoRequestDto = {
          fotoInicioServico: file // Pode ser ajustado para fotoFim, dependendo do backend
        };
  
        this.vibeService.finalizarExecucaoServico(this.execucao.execucaoServicoId, 'usuario123', request).subscribe({
          next: (response: ExecucaoResponseDto) => {
            console.log('Execução finalizada com sucesso:', response);
            this.execucao = response;
            localStorage.setItem('execucaoServico', JSON.stringify(response));
            localStorage.setItem('osFotoFim', this.webcamImage?.imageAsBase64 || '');
            this.disabled = [false, true, true];
            this.mostrarFormulario = true;
          },
          error: (error) => {
            console.error('Erro ao finalizar execução:', error);
            alert('Erro ao finalizar a ordem de serviço. Tente novamente.');
          }
        });
      } else if (this.tipoRegistro === 'cancelamento' && this.webcamImage) {
        if (!this.execucao?.execucaoServicoId) {
          throw new Error('Execução não iniciada. Inicie a O.S. primeiro.');
        }
  
        const file = this.base64ToFile(this.webcamImage.imageAsBase64, 'fotoCancelamento.jpg');
  
        // Valida se um motivo foi selecionado
        if (!this.motivoCancelamento) {
          alert('Por favor, selecione um motivo de cancelamento.');
          return;
        }
  
        let motivoFinal = this.motivoCancelamento;
        if (this.motivoCancelamento === 'Outros' && !this.outrosMotivo.trim()) {
          alert('Por favor, informe o motivo detalhado para "Outros".');
          return;
        }
        if (this.motivoCancelamento === 'Outros') {
          motivoFinal = this.outrosMotivo.trim();
        }
  
        // Atualiza o status localmente e no backend (se houver endpoint)
        this.execucao.statusExecucao = 'Cancelada'; // Atualiza o status local
        localStorage.setItem('execucaoServico', JSON.stringify(this.execucao ?? {}));
        localStorage.setItem('osFotoCancelamento', this.webcamImage.imageAsBase64);
  
        // Simula a atualização do statusOrdem para "Cancelado" (localmente, pois não há endpoint específico)
        const ordemData = localStorage.getItem('ordemServico');
        if (ordemData) {
          const ordem: any = JSON.parse(ordemData);
          ordem.statusOrdem = 'Cancelado';
          localStorage.setItem('ordemServico', JSON.stringify(ordem));
        }
  
        // Limpa os dados da execução
        this.disabled = [false, true, true]; // Volta ao estado inicial
        localStorage.removeItem('osEmAndamento');
        localStorage.removeItem('osIniciada');
        localStorage.removeItem('osFotoInicio');
        localStorage.removeItem('osFotoFim');
  
        console.log('O.S. cancelada com sucesso. Motivo:', motivoFinal);
        alert('Ordem de serviço cancelada com sucesso.');
        this.fecharModal();
      }
  
      this.fecharModal();
    } catch (erro: any) {
      console.error('Erro ao capturar imagem/localização:', erro);
      alert(erro.message || 'Não foi possível obter localização ou foto.');
    }
  }

  // Método auxiliar para converter base64 para File
  private base64ToFile(base64String: string, fileName: string): File {
    // Remove o prefixo 'data:image/...;base64,' se existir
    const base64Match = base64String.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
    let base64Data = base64String;
    if (base64Match && base64Match[1]) {
      base64Data = base64Match[1]; // Extrai apenas a parte base64
    }
  
    // Valida se a string base64 é válida
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
      throw new Error('String base64 inválida. Verifique a imagem capturada.');
    }
  
    try {
      const bstr = atob(base64Data);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
  
      // Determina o tipo MIME a partir da string original, se possível
      const mime = base64Match ? base64Match[0].match(/:(.*?);/)?.[1] || 'image/jpeg' : 'image/jpeg';
      return new File([u8arr], fileName, { type: mime });
    } catch (error) {
      console.error('Erro ao decodificar base64:', error);
      throw new Error('Não foi possível converter a imagem para um arquivo. Verifique a captura.');
    }
  }
}