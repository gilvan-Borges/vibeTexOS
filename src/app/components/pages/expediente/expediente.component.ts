import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, Observable, of } from 'rxjs';
import { WebcamImage, WebcamInitError, WebcamModule } from 'ngx-webcam';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ServicoFoto } from '../../../services/foto.service';
import { ServicoLocalizacao } from '../../../services/localizacao.service';
import { ServicoArmazenamento } from '../../../services/armazenamento.service';
import { ServicoFormatacao } from '../../../services/formatacao.service';
import { UsuarioService } from '../../../services/usuario.service';
import { RegistroExpedienteService } from '../../../services/registro-expediente.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { RegistrarPontoService } from '../../../services/registrar.ponto.service';

// Importar os novos componentes
import { InicioExpedienteComponent } from './inicio-expediente/inicio-expediente.component';
import { InicioPausaComponent } from './inicio-pausa/inicio-pausa.component';
import { FimPausaComponent } from './fim-pausa/fim-pausa.component';
import { FimExpedienteComponent } from './fim-expediente/fim-expediente.component';

@Component({
  selector: 'app-expediente',
  imports: [
    WebcamModule,
    CommonModule,
    HttpClientModule,
    FormsModule,
    RouterModule,
    // Componentes específicos
    InicioExpedienteComponent,
    InicioPausaComponent,
    FimPausaComponent,
    FimExpedienteComponent
  ],
  templateUrl: './expediente.component.html',
  styleUrls: ['./expediente.component.css'],
})
export class ExpedienteComponent implements OnInit, OnDestroy {
  // Propriedades básicas mantidas
  switchCamera = of(true);
  modalVisible = false;
  modalObsVisible = false;
  tipoRegistro: string = '';
  idUsuario: string = '';
  webcamImage: WebcamImage | null = null;
  observacoes: string = '';
  pontoId: string = '';
  pausaId: string = '';
  errors: WebcamInitError[] = [];
  trigger: Subject<void> = new Subject<void>();

  private locationUpdateSubscription: Subscription | undefined;
  usuarioId: string = '';
  disabled: boolean[] = [false, true, true, true];
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

  registroExistente: boolean = false;
  mensagemRegistroExistente: string = '';
  expedienteAtivo: boolean = false;
  mensagemPausa$ = new Observable<string>();
  pausaAtiva: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private route: ActivatedRoute,
    private servicoArmazenamento: ServicoArmazenamento,
    private servicoFormatacao: ServicoFormatacao,
    private usuarioService: UsuarioService,
    public registroExpediente: RegistroExpedienteService,
    private spinner: NgxSpinnerService
  ) { }

  ngOnInit(): void {
    const usuario = this.authService.getUsuario();
    if (usuario) {
      console.log('Usuário encontrado:', usuario);
      this.idUsuario = usuario.usuarioId || ''; // Certifique-se de que o idUsuario está sendo atribuído corretamente
      if (!this.idUsuario) {
        console.error('Erro: idUsuario não encontrado no usuário autenticado.');
        this.router.navigate(['/pages/usuarios/autenticar']);
        return;
      }
      // Define timeout para mostrar spinner apenas se demorar
      const timeoutId = setTimeout(() => {
        this.spinner.show();
      }, 1000);

      Promise.all([
        this.verificarRegistroDoDia(),
        this.verificarExpedienteAtivo()
      ]).then(() => {
        clearTimeout(timeoutId); 
        this.spinner.hide();
        this.mensagemPausa$ = this.registroExpediente.obterMensagemTempoPausa();
        this.verificarEstadoPausa();
        this.registroExpediente.iniciarVerificacaoTempoPausa();
        
        // Verificar se a rota contém informação sobre ação específica
        this.route.data.subscribe(data => {
          if (data['acao']) {
            this.focarNaAcao(data['acao']);
          }
        });
      }).catch(error => {
        clearTimeout(timeoutId);
        this.spinner.hide();
        console.error('Erro ao carregar dados:', error);
      });

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
      console.error('Erro: Usuário não autenticado.');
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

  // Métodos para o modal mantidos para compatibilidade
  fecharModal(): void {
    this.modalVisible = false;
    this.observacoes = '';
  }

  // Método para atualizar dados após registro (usado pelos componentes filhos)
  atualizarAposRegistro(): void {
    this.verificarRegistroDoDia();
    this.verificarExpedienteAtivo();
    this.salvarDadosNoLocalStorage();
  }

  // Método para salvar dados no localStorage
  salvarDadosNoLocalStorage(): void {
    const dadosExpediente = {
      pontoIdExpediente: this.servicoArmazenamento.obterPontoId('expediente'),
      pontoIdPausa: this.servicoArmazenamento.obterPontoId('pausa'),
      timestamps: this.timestamps,
      disabled: this.disabled,
      inicioPausaTime: localStorage.getItem('inicioPausaTime')
    };

    this.servicoArmazenamento.salvarDadosExpediente(dadosExpediente);
  }

  private async verificarRegistroDoDia(): Promise<void> {
    try {
      // Primeiro, verifica se já existe no localStorage
      const registrosDoDia = localStorage.getItem('registrosDoDia');
      if (registrosDoDia) {
        const dados = JSON.parse(registrosDoDia);
        this.pontoId = dados.pontoIdExpediente || '';
        this.pausaId = dados.pontoIdPausa || '';
        this.timestamps = {
          inicio: dados.inicioExpediente || '',
          'almoco-inicio': dados.inicioPausa || '',
          'almoco-fim': dados.fimPausa || '',
          fim: dados.fimExpediente || '',
        };
  
        // Atualiza o estado dos botões de observação
        this.obsDesabilitada = {
          inicio: !!this.timestamps['inicio'],
          'almoco-inicio': !!this.timestamps['almoco-inicio'],
          'almoco-fim': !!this.timestamps['almoco-fim'],
          fim: !!this.timestamps['fim'],
        };
  
        console.log('✅ Dados do expediente carregados do localStorage:', dados);
      }
  
      // Busca na API para garantir que os dados estão atualizados
      const response = await this.usuarioService.verificarRegistroDoDia(this.idUsuario);
      if (response) {
        this.pontoId = response.pontoId || '';
        this.pausaId = response.pausaId || '';
        this.timestamps = response.timestamps || {
          inicio: '',
          'almoco-inicio': '',
          'almoco-fim': '',
          fim: '',
        };
  
        // Atualiza o localStorage com os dados mais recentes
        const dadosExpediente = {
          pontoIdExpediente: this.pontoId,
          pontoIdPausa: this.pausaId,
          inicioExpediente: this.timestamps['inicio'],
          inicioPausa: this.timestamps['almoco-inicio'],
          fimPausa: this.timestamps['almoco-fim'],
          fimExpediente: this.timestamps['fim'],
        };
        localStorage.setItem('registrosDoDia', JSON.stringify(dadosExpediente));
  
        // Atualiza o estado dos botões de observação
        this.obsDesabilitada = {
          inicio: !!this.timestamps['inicio'],
          'almoco-inicio': !!this.timestamps['almoco-inicio'],
          'almoco-fim': !!this.timestamps['almoco-fim'],
          fim: !!this.timestamps['fim'],
        };
  
        console.log('✅ Dados do expediente atualizados com sucesso:', dadosExpediente);
      } else {
        console.log('Nenhum registro encontrado para o dia atual.');
        localStorage.removeItem('registrosDoDia');
      }
    } catch (error) {
      console.error('Erro ao verificar registro do dia:', error);
    }
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

  // Método para focar na ação especificada na rota (sem executar automaticamente)
  private focarNaAcao(acao: string): void {
    console.log(`Navegando para ação: ${acao}`);
    
    setTimeout(() => {
      switch(acao) {
        case 'inicio':
          if (!this.expedienteAtivo && !this.registroExistente && !this.disabled[0]) {
            console.log('Destacando botão de início de expediente');
            const inicioComp = document.querySelector('app-inicio-expediente');
            if (inicioComp) {
              const button = inicioComp.querySelector('button');
              if (button) {
                button.classList.add('btn-highlight');
              }
            }
          }
          break;
          
        case 'inicio-pausa':
          if (this.expedienteAtivo && !this.timestamps['almoco-inicio'] && !this.disabled[1]) {
            console.log('Destacando botão de início de pausa');
            const pausaComp = document.querySelector('app-inicio-pausa');
            if (pausaComp) {
              const button = pausaComp.querySelector('button');
              if (button) {
                button.classList.add('btn-highlight');
              }
            }
          }
          break;
          
        case 'fim-pausa':
          if (this.timestamps['almoco-inicio'] && !this.timestamps['almoco-fim']) {
            console.log('Destacando botão de fim de pausa');
            const fimPausaComp = document.querySelector('app-fim-pausa');
            if (fimPausaComp) {
              const button = fimPausaComp.querySelector('button');
              if (button) {
                button.classList.add('btn-highlight');
              }
            }
          }
          break;
          
        case 'fim':
          if (this.timestamps['almoco-fim'] && !this.timestamps['fim'] && !this.disabled[3]) {
            console.log('Destacando botão de fim de expediente');
            const fimComp = document.querySelector('app-fim-expediente');
            if (fimComp) {
              const button = fimComp.querySelector('button');
              if (button) {
                button.classList.add('btn-highlight');
              }
            }
          }
          break;
      }
    }, 500);
  }
}