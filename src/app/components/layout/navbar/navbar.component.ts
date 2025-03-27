import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, OnDestroy, Output, ElementRef, ViewChild, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { RegistroExpedienteService } from '../../../services/registro-expediente.service';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { VibeService } from '../../../services/vibe.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isMenuOpen: boolean = false;
  isSidebarClosed: boolean = false;
  isDropdownOsOpen: boolean = false;
  autenticado: boolean = false;
  nomeUsuario: string = '';
  userName: string = '';
  usuarioId: string = '';
  role: string = '';
  expedienteAtivo: boolean = false;
  dropdownOpen: boolean = false;
  pausaAtiva: boolean = false;
  osEmAndamento: boolean = false;
  expedienteIniciadoHoje: boolean = false; // Nova propriedade para controlar a exibição do link
  private expedienteSubscription: Subscription = new Subscription();
  private pausaSubscription: Subscription = new Subscription();
  private authSubscription: Subscription = new Subscription();
  private osSubscription: Subscription = new Subscription();
  @Output() sidebarToggle = new EventEmitter<void>();
  @ViewChild('sidebarContent') sidebarContent!: ElementRef;

  isDropdownOpen: boolean = false;
  isClientDropdownOpen: boolean = false;
  isDragging: boolean = false;
  startX: number = 0;
  scrollLeft: number = 0;
  nomeDaEmpresa: string = '';

  timestamps: { [key: string]: string } = {};

  constructor(
    private router: Router,
    private authService: AuthService,
    private registroExpediente: RegistroExpedienteService,
    private vibeService: VibeService
  ) {
    this.restaurarEstadoDoLocalStorage();
  }

  ngOnInit(): void {
    const usuario = this.authService.getUsuario();
    if (usuario) {
      this.autenticado = true;
      this.nomeUsuario = usuario.nome;
      this.userName = usuario.userName;
      this.role = usuario.role;
      this.usuarioId = usuario.usuarioId || '';

      // Salvar usuarioId no localStorage
      if (this.usuarioId) {
        localStorage.setItem('usuarioId', this.usuarioId);
      }

      // Verificar registros para controlar exibição dos links no sidebar
      this.verificarRegistrosExpediente();

      // Verificar se o expediente já foi iniciado hoje
      this.verificarExpedienteIniciadoHoje();

      if (this.usuarioId) {
      
        if (usuario.empresa) {
          this.nomeDaEmpresa = usuario.empresa;

        }
        this.vibeService.buscarUsuarioPorId(this.usuarioId).subscribe({
          next: (data) => {
           
            let nomeDaEmpresa = null;
            if (data && data.nomeDaEmpresa && typeof data.nomeDaEmpresa === 'string') {
              nomeDaEmpresa = data.nomeDaEmpresa;
            }
            if (nomeDaEmpresa) {
              this.nomeDaEmpresa = nomeDaEmpresa;
            
            } else if (!this.nomeDaEmpresa) {
              this.nomeDaEmpresa = (data && data.departamento) || '';
             
            }
          },
          error: (err) => console.error('Erro ao buscar dados da empresa:', err)
        });
      }
  
      this.expedienteSubscription = this.registroExpediente.expedienteAtivo$.subscribe(
        ativo => this.expedienteAtivo = ativo
      );
      this.pausaSubscription = this.registroExpediente.tempoRestantePausa$.subscribe(
        minutos => {
          this.pausaAtiva = minutos > 0;
          if (this.pausaAtiva) this.expedienteAtivo = true;
        }
      );
      this.authSubscription = this.authService.expedienteAtivo$.subscribe(expedienteAtivo => {
       
        this.expedienteAtivo = expedienteAtivo;
        this.verificarEstadoPausa();
        this.verificarOsEmAndamento();
      });
      this.osSubscription = this.authService.osEmAndamento$.subscribe(osEmAndamento => {
       
        this.osEmAndamento = osEmAndamento;
      });
  
      const dadosExpediente = localStorage.getItem('dadosExpediente');
      if (dadosExpediente) {
        const dados = JSON.parse(dadosExpediente);
        this.timestamps = dados.timestamps || {};
      }
  
      if (this.role === 'Colaborador') {
        this.verificarOsEmAndamento();
        window.addEventListener('osStatusChanged', () => this.verificarOsEmAndamento());
      }
  
      this.verificarEstadoPausa();
      this.verificarEstadoExpediente();
    }
  }

  restaurarEstadoDoLocalStorage(): void {
    const usuario = this.authService.getUsuario();
    if (usuario) {
      this.autenticado = true;
      this.nomeUsuario = usuario.nome;
      this.role = usuario.role;
      this.usuarioId = usuario.usuarioId || '';

      this.authService.expedienteAtivo$.subscribe({
        next: (ativo) => this.expedienteAtivo = ativo !== null && ativo !== undefined ? ativo : false,
        error: (err) => console.error('Erro ao restaurar estado do expediente:', err)
      }).unsubscribe();

      const inicioPausaTime = localStorage.getItem('inicioPausaTime');
      const fimPausaTime = localStorage.getItem('fimPausaTime');
      this.pausaAtiva = !!inicioPausaTime && !fimPausaTime && (new Date().getTime() - new Date(inicioPausaTime).getTime()) < 3600000;

      this.authService.osEmAndamento$.subscribe({
        next: (ativo) => this.osEmAndamento = ativo !== null && ativo !== undefined ? ativo : false,
        error: (err) => console.error('Erro ao restaurar estado da O.S.:', err)
      }).unsubscribe();

      const dadosExpediente = localStorage.getItem('dadosExpediente');
      if (dadosExpediente) {
        const dados = JSON.parse(dadosExpediente);
        this.timestamps = dados.timestamps || {};
      }
    }
  }

  verificarOsEmAndamento(): void {
    const osEmAndamento = localStorage.getItem('osEmAndamento') === 'true';
    const osIniciada = localStorage.getItem('osIniciada') === 'true';
    const execucaoServicoData = localStorage.getItem('execucaoServico');
    let ordemServicoId = localStorage.getItem('ordemServicoId') || '';
  
    console.log('Verificando osEmAndamento - localStorage:', {
      osEmAndamento,
      osIniciada,
      execucaoServicoData,
      ordemServicoId,
    });
  
    if (execucaoServicoData) {
      try {
        const execucao = JSON.parse(execucaoServicoData);
        if (execucao && execucao.statusExecucao === 'EmAndamento') {
          this.osEmAndamento = true;
          
        }
      } catch (e) {
        console.error('Erro ao analisar execucaoServico:', e);
      }
    }
  
    this.osEmAndamento = this.osEmAndamento || (osEmAndamento && osIniciada);
    this.authService.setOsEmAndamento(this.osEmAndamento);
    console.log('Status O.S. em andamento atualizado:', this.osEmAndamento);
  }

  ngOnDestroy(): void {
    if (this.expedienteSubscription) this.expedienteSubscription.unsubscribe();
    if (this.pausaSubscription) this.pausaSubscription.unsubscribe();
    if (this.authSubscription) this.authSubscription.unsubscribe();
    if (this.osSubscription) this.osSubscription.unsubscribe();
    window.removeEventListener('osStatusChanged', () => this.verificarOsEmAndamento());
  }

  onLogout(): void {
    this.authService.logout();
    console.log('Usuário desconectado.');
  }

  toggleDropdownOs(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation(); // Stop event from bubbling up
    }
    
    // Toggle current dropdown and close the other one
    this.isDropdownOsOpen = !this.isDropdownOsOpen;
    if (this.isDropdownOsOpen) {
      this.isDropdownOpen = false;
    }
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  toggleDropdown1(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation(); // Stop event from bubbling up
    }
    
    // Toggle current dropdown and close the other one
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.isDropdownOsOpen = false;
    }
  }

  toggleSidebar(): void {
    this.isSidebarClosed = !this.isSidebarClosed;
    this.sidebarToggle.emit();
  }

  fecharSidebarSeMobile(): void {
    if (window.innerWidth <= 768) this.isSidebarClosed = true;
  }

  async logout(): Promise<void> {
    if (confirm('Deseja realmente sair do sistema?')) await this.authService.logout();
  }

  continuarOsEmAndamento(): void {
    const osEmAndamento = localStorage.getItem('osEmAndamento') === 'true';
    const execucaoServicoData = localStorage.getItem('execucaoServico');
    const ordemServicoData = localStorage.getItem('ordemServico');
    let ordemServicoId = localStorage.getItem('ordemServicoId') || '';

    if (!ordemServicoId && execucaoServicoData) {
      try {
        const execucao = JSON.parse(execucaoServicoData);
        if (execucao && execucao.ordemDeServicoId) ordemServicoId = execucao.ordemDeServicoId;
      } catch (e) {
        console.error('Erro ao analisar execucaoServico:', e);
      }
    }

    if (!ordemServicoId && ordemServicoData) {
      try {
        const ordem = JSON.parse(ordemServicoData);
        if (ordem && ordem.ordemDeServicoId) ordemServicoId = ordem.ordemDeServicoId;
      } catch (e) {
        console.error('Erro ao analisar ordemServico:', e);
      }
    }

    const trajetoId = localStorage.getItem('trajetoId');

    if (!osEmAndamento || (!ordemServicoId && !trajetoId)) {
      console.error('Nenhuma ordem de serviço em andamento ou ID não encontrado no localStorage');
      alert('Não foi possível encontrar os dados da ordem de serviço em andamento');
      return;
    }

    const idParaNavegacao = ordemServicoId || trajetoId;
    console.log('Continuando O.S. em andamento com ID:', idParaNavegacao);

    this.router.navigate(['/pages/ordem-servico-exec', this.usuarioId], {
      queryParams: { codigo: idParaNavegacao }
    }).then(() => {
      // Após a navegação, força a verificação do estado
      this.verificarOsEmAndamento();
    });
  }

  private verificarEstadoPausa(): void {
    const inicioPausaTime = localStorage.getItem('inicioPausaTime');
    const fimPausaTime = localStorage.getItem('fimPausaTime');
    if (inicioPausaTime && !fimPausaTime) {
      const now = new Date().getTime();
      const pauseStart = new Date(inicioPausaTime).getTime();
      this.pausaAtiva = (now - pauseStart) < 3600000;
    } else this.pausaAtiva = false;
  }

  private verificarEstadoExpediente(): void {
    const pontoIdExpediente = localStorage.getItem('pontoIdExpediente');
    const fimExpedienteTime = localStorage.getItem('fimExpedienteTime');
    this.expedienteAtivo = !!pontoIdExpediente && !fimExpedienteTime;
  }

  private verificarExpedienteIniciadoHoje(): void {
  this.expedienteIniciadoHoje = false; // valor padrão
  const registroExpedienteStr = localStorage.getItem('registroExpediente');
  if (!registroExpedienteStr) return;

  try {
    const registro = JSON.parse(registroExpedienteStr);

    // Se existir dataRegistro, comparar apenas a data (YYYY-MM-DD) com hoje
    if (registro.dataRegistro) {
      const dataRegistro = new Date(registro.dataRegistro);
      const hoje = new Date();
      if (
        dataRegistro.getFullYear() === hoje.getFullYear() &&
        dataRegistro.getMonth() === hoje.getMonth() &&
        dataRegistro.getDate() === hoje.getDate()
      ) {
        this.expedienteIniciadoHoje = true;
      }
    }
  } catch (e) {
    console.error('Erro ao processar registroExpediente:', e);
    this.expedienteIniciadoHoje = false;
  }
}


  private verificarRegistrosExpediente(): void {
    const dadosExpediente = localStorage.getItem('dadosExpediente');
    if (dadosExpediente) {
      try {
        const dados = JSON.parse(dadosExpediente);
        console.log('Dados de expediente encontrados:', dados);
        
        // Verificar se há registro de início de expediente hoje
        const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        let inicioHoje = false;
        
        if (dados.timestamps?.inicio) {
          // Tenta determinar a data de hoje de qualquer formato
          try {
            // Tenta converter diretamente
            if (!isNaN(Date.parse(dados.timestamps.inicio))) {
              const dataInicio = new Date(dados.timestamps.inicio).toISOString().split('T')[0];
              inicioHoje = dataInicio === hoje;
            } 
            // Se tiver formato "HH:MM hrs", considera que é hoje
            else if (dados.timestamps.inicio.includes(':')) {
              inicioHoje = true;
            }
          } catch (e) {
            console.warn('Erro ao verificar data de início:', e);
            // Se houver erro, assume pelo menos que tem registro
            inicioHoje = true;
          }
        }
        
        this.expedienteIniciadoHoje = inicioHoje;
        
        // Verificar se há pausa ativa (tem início mas não tem fim)
        this.pausaAtiva = !!dados.timestamps?.['almoco-inicio'] && !dados.timestamps?.['almoco-fim'];
        
        // Verificar se expediente está ativo (tem pelo menos início)
        this.expedienteAtivo = !!dados.timestamps?.inicio && !dados.timestamps?.fim;
        
        console.log('Estados atualizados:', {
          expedienteIniciadoHoje: this.expedienteIniciadoHoje,
          pausaAtiva: this.pausaAtiva,
          expedienteAtivo: this.expedienteAtivo
        });
      } catch (e) {
        console.error('Erro ao processar dados do expediente:', e);
        this.expedienteIniciadoHoje = false;
        this.pausaAtiva = false;
        this.expedienteAtivo = false;
      }
    } else {
      this.expedienteIniciadoHoje = false;
      this.pausaAtiva = false;
      this.expedienteAtivo = false;
    }
  }

  onMouseDown(event: MouseEvent): void {
    if (this.sidebarContent) {
      this.isDragging = true;
      this.startX = event.pageX - this.sidebarContent.nativeElement.offsetLeft;
      this.scrollLeft = this.sidebarContent.nativeElement.scrollLeft;
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (this.isDragging && this.sidebarContent) {
      const x = event.pageX - this.sidebarContent.nativeElement.offsetLeft;
      const walk = (x - this.startX) * 2;
      this.sidebarContent.nativeElement.scrollLeft = this.scrollLeft - walk;
    }
  }

  onMouseUp(): void {
    this.isDragging = false;
  }

  onMouseLeave(): void {
    this.isDragging = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Get the clicked element
    const clickedElement = event.target as HTMLElement;
    
    // Check if the click was inside a dropdown or its toggle button
    const isDropdownToggle = clickedElement.closest('.nav-link.w-100') !== null;
    const isInsideDropdown = clickedElement.closest('.dropdown-content') !== null;
    
    // Close the dropdowns if the click was outside
    if (!isDropdownToggle && !isInsideDropdown) {
      this.isDropdownOpen = false;
      this.isDropdownOsOpen = false;
    }
  }

  closeDropdowns(): void {
    this.isDropdownOpen = false;
    this.isDropdownOsOpen = false;
  }
}