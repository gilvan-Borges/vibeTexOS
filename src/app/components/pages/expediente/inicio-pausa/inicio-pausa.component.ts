import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { ServicoLocalizacao } from '../../../../services/localizacao.service';
import { ServicoFormatacao } from '../../../../services/formatacao.service';
import { RegistroExpedienteService } from '../../../../services/registro-expediente.service';
import { RegistrarPontoService } from '../../../../services/registrar.ponto.service';
import { RegistrarPausaInicioRequestDto } from '../../../../models/control-app/registrar.pausa.inicio.request';
import { AuthService } from '../../../../services/auth.service';
import { interval, Observable } from 'rxjs';
import { map, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-inicio-pausa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inicio-pausa.component.html',
  styleUrls: ['./inicio-pausa.component.css']
})
export class InicioPausaComponent {
  @Input() idUsuario: string = '';
  @Input() disabled: boolean = false;
  @Output() registroRealizado = new EventEmitter<void>();
  
  observacoes: string = '';
  mensagemContagem$: Observable<string> = new Observable<string>();

  constructor(
    private router: Router,
    private servicoLocalizacao: ServicoLocalizacao,
    private servicoFormatacao: ServicoFormatacao,
    private registroExpediente: RegistroExpedienteService,
    private registrarPontoService: RegistrarPontoService,
    private spinner: NgxSpinnerService,
    private authService: AuthService  // <-- new injection
  ) {}

  iniciarPausa(): void {
    // Mostrar spinner enquanto processa
    this.spinner.show();
    
    this.servicoLocalizacao.capturarCoordenadas()
      .then(({ latitude, longitude }) => {
        const dataAtual = new Date().toISOString();
        this.registrarInicioPausa(dataAtual, latitude, longitude);

        // Iniciar contagem regressiva de 1 hora
        this.iniciarContagemRegressiva();
      })
      .catch((error) => {
        this.spinner.hide();
        console.error("Erro ao obter localização:", error);
        alert("Erro ao capturar localização. Verifique as permissões de localização.");
      });
  }

  private iniciarContagemRegressiva(): void {
    const tempoTotal = 60 * 60; // 1 hora em segundos
    this.mensagemContagem$ = interval(1000).pipe(
      map(segundos => tempoTotal - segundos),
      takeWhile(tempoRestante => tempoRestante >= 0),
      map(tempoRestante => {
        const minutos = Math.floor(tempoRestante / 60);
        const segundos = tempoRestante % 60;
        return `Faltam ${minutos}m ${segundos}s para liberar o botão de finalizar pausa.`;
      })
    );
  }

  private registrarInicioPausa(data: string, latitude: string, longitude: string): void {
    const request: RegistrarPausaInicioRequestDto = {
      inicioPausa: data,
      latitude: latitude,
      longitude: longitude,
      observacoes: this.observacoes,
    };

    // Use the Input idUsuario, or fallback to the authenticated user's ID
    const usuarioId = this.idUsuario || (this.authService.getUsuario()?.usuarioId || '');
    if (!usuarioId) {
      this.spinner.hide();
      alert('Usuário não encontrado');
      return;
    }
      
    this.registrarPontoService.registrarInicioPausa(usuarioId, request)
      .subscribe({
        next: (response) => {
          this.spinner.hide();
          console.log('✅ Início da pausa registrado com sucesso:', response);
          if (response && response.pontoId) {
            localStorage.setItem('pontoIdPausa', response.pontoId);
            console.log('📌 PontoId da pausa salvo:', response.pontoId);
          }
          const horaAtual = new Date().toISOString();
          localStorage.setItem('inicioPausaTime', horaAtual);
          const timer = setTimeout(() => {
            console.log('⏰ Botão de fim de pausa desbloqueado após 1 hora');
          }, 3600000);
          localStorage.setItem('pausaTimer', timer.toString());
          this.registroRealizado.emit();
          
          // Redirecionar para a página de expediente com ID do usuário e forçar atualização da página
          const url = `/pages/expediente/fim-pausa/${usuarioId}`;
          window.location.href = url; // Usar window.location.href para forçar uma atualização completa
        },
        error: (err) => {
          this.spinner.hide();
          console.error('❌ Erro ao registrar início da pausa:', err);
          alert('Erro ao registrar o início da pausa. Tente novamente.');
        }
      });
  }
}
