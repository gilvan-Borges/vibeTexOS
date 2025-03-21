import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WebcamImage, WebcamInitError, WebcamModule } from 'ngx-webcam';
import { Observable, Subject } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { ServicoLocalizacao } from '../../../../services/localizacao.service';
import { ServicoFormatacao } from '../../../../services/formatacao.service';
import { RegistroExpedienteService } from '../../../../services/registro-expediente.service';
import { ServicoFoto } from '../../../../services/foto.service';

@Component({
  selector: 'app-fim-expediente',
  standalone: true,
  imports: [CommonModule, WebcamModule, FormsModule],
  templateUrl: './fim-expediente.component.html',
  styleUrls: ['./fim-expediente.component.css']
})
export class FimExpedienteComponent {
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
          this.registrarFimExpediente();
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

  private registrarFimExpediente(): void {
    // Mostrar spinner enquanto processa
    this.spinner.show();
    
    this.servicoLocalizacao.capturarCoordenadas()
      .then(({ latitude, longitude }) => {
        const dataAtual = this.servicoFormatacao.formatarDataAtual();
        
        // Garantir que o ID do usuário esteja definido
        if (!this.idUsuario) {
          this.idUsuario = localStorage.getItem('usuarioId') || '';
          if (!this.idUsuario) {
            this.spinner.hide();
            console.error('Erro: ID do usuário não encontrado');
            alert('ID do usuário não encontrado. Tente fazer login novamente.');
            return;
          }
        }
        
        console.log('Registrando fim de expediente para usuário:', this.idUsuario);
        
        this.registroExpediente.registrarFimExpediente(
          this.idUsuario,
          dataAtual,
          latitude,
          longitude,
          this.webcamImage,
          this.observacoes
        ).then(() => {
          this.spinner.hide();
          this.registroRealizado.emit();
          this.fecharModal();
          
          // Mostrar mensagem de sucesso
          alert('Expediente finalizado com sucesso! Volte amanhã para iniciar um novo expediente.');
          
          // Redirecionar para a página de ordens realizadas e forçar atualização da página
          const url = `/pages/ordem-servico/realizadas/${this.idUsuario}`;
          window.location.href = url; // Usar window.location.href para forçar uma atualização completa
        }).catch(error => {
          this.spinner.hide();
          console.error('Erro ao finalizar expediente:', error);
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
