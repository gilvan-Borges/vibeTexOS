import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WebcamImage, WebcamInitError, WebcamModule } from 'ngx-webcam';
import { Observable, Subject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';
import { ServicoLocalizacao } from '../../../../services/localizacao.service';
import { ServicoFormatacao } from '../../../../services/formatacao.service';
import { RegistroExpedienteService } from '../../../../services/registro-expediente.service';
import { ServicoFoto } from '../../../../services/foto.service';

@Component({
  selector: 'app-inicio-expediente',
  standalone: true,
  imports: [CommonModule, WebcamModule, FormsModule],
  templateUrl: './inicio-expediente.component.html',
  styleUrls: ['./inicio-expediente.component.css']
})
export class InicioExpedienteComponent {
  @Input() idUsuario: string = '';
  @Input() disabled: boolean = false;
  @Output() registroRealizado = new EventEmitter<void>();
  
  modalVisible = false;
  webcamImage: WebcamImage | null = null;
  observacoes: string = '';
  errors: WebcamInitError[] = [];
  trigger: Subject<void> = new Subject<void>();

  constructor(
    private router: Router,
    private servicoLocalizacao: ServicoLocalizacao,
    private servicoFormatacao: ServicoFormatacao,
    private registroExpediente: RegistroExpedienteService,
    private servicoFoto: ServicoFoto,
    private spinner: NgxSpinnerService
  ) {}

  abrirModal(): void {
    this.modalVisible = true;
    this.observacoes = '';
  }

  fecharModal(): void {
    this.modalVisible = false;
    this.observacoes = '';
  }

  public triggerCapture(): void {
    this.trigger.next();
  }

  public get triggerObservable(): Observable<void> {
    return this.trigger.asObservable();
  }

  handleImage(webcamImage: WebcamImage): void {
    if (webcamImage && webcamImage.imageAsBase64) {
      this.webcamImage = webcamImage;
      
      // Adicionar data/hora na imagem
      this.servicoFoto.adicionarDataHoraImagem(webcamImage.imageAsBase64).then(imagemComData => {
        // Criar uma nova imagem com a data/hora
        const dataUrl = `data:image/jpeg;base64,${imagemComData}`;
        
        // Criar uma imagem temporária para obter as dimensões
        const tempImage = new Image();
        tempImage.onload = () => {
          const imageData = new ImageData(tempImage.width, tempImage.height);
          this.webcamImage = new WebcamImage(
            dataUrl,
            'image/jpeg',
            imageData
          );
          this.registrarInicioExpediente();
        };
        tempImage.src = dataUrl;
      });
    } else {
      console.error('Imagem não capturada corretamente');
      alert('Erro ao capturar imagem. Tente novamente.');
    }
  }

  public handleInitError(error: WebcamInitError): void {
    console.error('Erro ao inicializar a webcam:', error);
    this.errors.push(error);
  }

  private registrarInicioExpediente(): void {
    // Mostrar spinner enquanto processa
    this.spinner.show();

    this.servicoLocalizacao.capturarCoordenadas()
      .then(({ latitude, longitude }) => {
        const dataAtual = this.servicoFormatacao.formatarDataAtual();

        // Recuperar idUsuario do localStorage como fallback
        const usuarioId = this.idUsuario || localStorage.getItem('usuarioId') || '';
        if (!usuarioId || usuarioId.trim() === '') {
          this.spinner.hide();
          console.error('Erro: idUsuario está vazio ou inválido.');
          alert('Erro: Usuário não encontrado. Tente novamente.');
          return;
        }

        this.registroExpediente.registrarInicioExpediente(
          usuarioId,
          dataAtual,
          latitude,
          longitude,
          this.webcamImage,
          this.observacoes
        ).then(() => {
          this.spinner.hide();
          this.registroRealizado.emit();
          this.fecharModal();

          // Redirecionar para a página de ordens pendentes e forçar atualização da página
          const url = `/pages/ordem-servico/pendentes/${usuarioId}`;
          window.location.href = url; // Usar window.location.href para forçar uma atualização completa
        }).catch(error => {
          this.spinner.hide();
          console.error('Erro ao registrar início do expediente:', error);
          alert(error);
        });
      })
      .catch((error) => {
        this.spinner.hide();
        console.error("Erro ao obter localização:", error);
        alert("Erro ao capturar localização. Verifique as permissões de localização.");
      });
  }
}
