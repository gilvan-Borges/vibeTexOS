import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WebcamImage, WebcamInitError, WebcamModule } from 'ngx-webcam';
import { Subject } from 'rxjs';

// Services (exemplo)
import { ServicoFoto } from '../../../services/foto.service';
import { ServicoLocalizacao } from '../../../services/localizacao.service';
import { ServicoArmazenamento } from '../../../services/armazenamento.service';
import { FormularioServicoComponent } from '../formulario-servico/formulario-servico.component';



@Component({
  selector: 'app-ordem-servico-exec',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    WebcamModule,
    FormularioServicoComponent // Importamos o componente do formulário
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
  tipoRegistro: 'inicio' | 'fim' | '' = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private servicoFoto: ServicoFoto,
    private servicoLocalizacao: ServicoLocalizacao,
    private servicoArmazenamento: ServicoArmazenamento
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.codigoOS = params['codigo'] || 'OS-0000';
    });
  }

  // === Botões ===
  iniciarOS(): void {
    this.tipoRegistro = 'inicio';
    this.abrirModal();
  }

  cancelarOS(): void {
    if (confirm('Tem certeza que deseja cancelar esta O.S.?')) {
      // Lógica de cancelamento...
      this.disabled = [true, true, true];
      localStorage.removeItem('osEmAndamento');
      localStorage.removeItem('osIniciada');
      localStorage.removeItem('osFotoInicio');
      // ...
    }
  }

  finalizarOS(): void {
    // Ao clicar em Finalizar, apenas capturamos foto de fim e, depois, mostramos o formulário
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

  private async registrarAcao(): Promise<void> {
    try {
      const { latitude, longitude } = await this.servicoLocalizacao.capturarCoordenadas();
      if (!latitude || !longitude) {
        throw new Error('Localização indisponível');
      }

      if (this.tipoRegistro === 'inicio' && this.webcamImage) {
        localStorage.setItem('osIniciada', 'true');
        localStorage.setItem('osFotoInicio', this.webcamImage.imageAsBase64);
        this.disabled = [true, false, false];
      } else if (this.tipoRegistro === 'fim' && this.webcamImage) {
        localStorage.setItem('osFotoFim', this.webcamImage.imageAsBase64);
        
        // **Aqui está a diferença**: em vez de navegar para outra rota,
        // apenas exibimos o formulário na mesma tela:
        this.mostrarFormulario = true;
      }

      this.fecharModal();
    } catch (erro) {
      console.error('Erro ao capturar imagem/localização:', erro);
      alert('Não foi possível obter localização ou foto.');
    }
  }
}
