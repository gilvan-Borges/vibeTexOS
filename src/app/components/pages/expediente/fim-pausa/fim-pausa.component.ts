import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { ServicoLocalizacao } from '../../../../services/localizacao.service';
import { RegistroExpedienteService } from '../../../../services/registro-expediente.service';
import { RegistrarPontoService } from '../../../../services/registrar.ponto.service';
import { RegistrarFimPausaRequestDto } from '../../../../models/control-app/registrar.fim.pausa.request';

@Component({
  selector: 'app-fim-pausa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fim-pausa.component.html',
  styleUrls: ['./fim-pausa.component.css']
})
export class FimPausaComponent implements OnInit, OnDestroy {
  @Input() idUsuario: string = '';
  @Output() registroRealizado = new EventEmitter<void>();
  
  mensagemPausa$: Observable<string> = new Observable<string>();
  observacoes: string = '';
  mostrarAlertaPausaLiberada: boolean = false;
  private pausaLiberadaSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private servicoLocalizacao: ServicoLocalizacao,
    public registroExpediente: RegistroExpedienteService,
    private registrarPontoService: RegistrarPontoService,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    // Verificar o tempo de pausa ao inicializar o componente
    this.verificarTempoDecorrido();
    
    // Obter a mensagem de tempo restante da pausa
    this.mensagemPausa$ = this.registroExpediente.obterMensagemTempoPausa();

    // Assinar o evento de pausa liberada
    this.pausaLiberadaSubscription = this.registroExpediente.pausaLiberada$.subscribe(() => {
      console.log('Recebido evento de pausa liberada');
      this.mostrarAlertaPausaLiberada = true;
      
      // Mostrar um alerta nativo
      alert('Pausa finalizada! Você já pode registrar o fim da sua pausa.');
      
      // Ocultar o alerta visual após 10 segundos
      setTimeout(() => {
        this.mostrarAlertaPausaLiberada = false;
      }, 10000);
    });
  }

  ngOnDestroy(): void {
    if (this.pausaLiberadaSubscription) {
      this.pausaLiberadaSubscription.unsubscribe();
    }
  }

  // Reproduz um som para alertar o usuário
  private reproduzirSom(): void {
    try {
      const audio = new Audio('assets/sounds/notification.mp3');
      audio.play();
    } catch (error) {
      console.error('Erro ao reproduzir som de notificação:', error);
    }
  }

  finalizarPausa(): void {
    if (!this.registroExpediente.verificarPodeFinalizarPausa()) {
      alert('Ainda não é possível finalizar a pausa. Aguarde o tempo mínimo necessário.');
      return;
    }

    // Mostrar spinner enquanto processa
    this.spinner.show();
    
    this.servicoLocalizacao.capturarCoordenadas()
      .then(({ latitude, longitude }) => {
        const dataAtual = new Date().toISOString();
        this.registrarFimPausa(dataAtual, latitude, longitude);
      })
      .catch((error) => {
        this.spinner.hide();
        console.error("Erro ao obter localização:", error);
        alert("Erro ao capturar localização. Verifique as permissões de localização.");
      });
  }

  private registrarFimPausa(data: string, latitude: string, longitude: string): void {
    const pontoIdPausa = localStorage.getItem('pontoIdPausa');
    
    if (!pontoIdPausa) {
      this.spinner.hide();
      console.error('Erro: PontoId da pausa não encontrado');
      alert('É necessário registrar o início da pausa primeiro.');
      return;
    }

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

    console.log('Registrando fim de pausa com pontoId:', pontoIdPausa, 'e usuarioId:', this.idUsuario);

    const request: RegistrarFimPausaRequestDto = {
      fimPausa: data,
      latitude: latitude,
      longitude: longitude,
      observacoes: this.observacoes || '',
    };

    // Usar console.log para verificar os parâmetros antes de chamar o serviço
    console.log(`Chamando registrarFimPausa - usuarioId: "${this.idUsuario}", pontoId: "${pontoIdPausa}"`);

    this.registrarPontoService.registrarFimPausa(
      this.idUsuario,
      pontoIdPausa,
      request
    ).subscribe({
      next: (response) => {
        this.spinner.hide();
        console.log('✅ Fim da pausa registrado com sucesso:', response);
        
        // Limpa os dados da pausa do localStorage
        localStorage.removeItem('pontoIdPausa');
        localStorage.removeItem('inicioPausaTime');
        const timerId = localStorage.getItem('pausaTimer');
        if (timerId) {
          clearTimeout(parseInt(timerId));
          localStorage.removeItem('pausaTimer');
        }
        
        this.registroRealizado.emit();
        
        // Redirecionamento para a página de ordens pendentes e forçar atualização da página
        const url = `/pages/ordem-servico/pendentes/${this.idUsuario}`;
        window.location.href = url; // Usar window.location.href para forçar uma atualização completa
        window.location.reload();
      },
      error: (err) => {
        this.spinner.hide();
        console.error('❌ Erro ao registrar fim da pausa:', err);
        alert('Erro ao registrar o fim da pausa. Tente novamente.');
      }
    });
  }

  // Verifica o tempo decorrido desde o início da pausa
  private verificarTempoDecorrido(): void {
    const inicioPausaTime = localStorage.getItem('inicioPausaTime');
    if (!inicioPausaTime) {
      console.warn('Horário de início da pausa não encontrado');
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
      
      const now = new Date().getTime();
      const diffMs = now - inicioPausaTimestamp;
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // Se já passou 1 hora, mostra o alerta de pausa liberada
      if (diffHours >= 1) {
        this.mostrarAlertaPausaLiberada = true;
      }
    } catch (error) {
      console.error('Erro ao verificar tempo decorrido da pausa:', error);
    }
  }
}
