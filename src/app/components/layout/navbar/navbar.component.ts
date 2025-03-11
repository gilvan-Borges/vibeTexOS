import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, OnDestroy, Output, ElementRef, ViewChild } from '@angular/core';
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
  
      if (this.usuarioId) {
        console.log('Buscando dados da empresa para usuarioId:', this.usuarioId);
        if (usuario.empresa) {
          this.nomeDaEmpresa = usuario.empresa;
          console.log('Nome da empresa obtido do usuário:', this.nomeDaEmpresa);
        }
        this.vibeService.buscarUsuarioPorId(this.usuarioId).subscribe({
          next: (data) => {
            console.log('Resposta completa da API (estrutura):', Object.keys(data || {}));
            let nomeDaEmpresa = null;
            if (data && data.nomeDaEmpresa && typeof data.nomeDaEmpresa === 'string') {
              nomeDaEmpresa = data.nomeDaEmpresa;
            }
            if (nomeDaEmpresa) {
              this.nomeDaEmpresa = nomeDaEmpresa;
              console.log('Nome da empresa encontrado na API:', this.nomeDaEmpresa);
            } else if (!this.nomeDaEmpresa) {
              this.nomeDaEmpresa = (data && data.departamento) || '';
              console.log('Nome da empresa não encontrado. Usando alternativa:', this.nomeDaEmpresa);
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
        console.log('Estado do expediente atualizado no Navbar:', expedienteAtivo);
        this.expedienteAtivo = expedienteAtivo;
        this.verificarEstadoPausa();
        this.verificarOsEmAndamento();
      });
      this.osSubscription = this.authService.osEmAndamento$.subscribe(osEmAndamento => {
        console.log('Estado da O.S. atualizado no Navbar:', osEmAndamento);
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
          console.log('Definido osEmAndamento como true devido a execução em andamento');
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

  toggleDropdownOs(): void {
    this.isDropdownOsOpen = !this.isDropdownOsOpen;
    if (this.isDropdownOpen) this.isDropdownOpen = false;
    if (this.isClientDropdownOpen) this.isClientDropdownOpen = false;
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  toggleDropdown1(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isClientDropdownOpen) this.isClientDropdownOpen = false;
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
}