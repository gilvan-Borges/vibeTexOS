import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, OnDestroy, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { RegistroExpedienteService } from '../../../services/registro-expediente.service';
import { Subscription } from 'rxjs';


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
  isDropdownOsOpen = false;
  autenticado: boolean = false;
  nomeUsuario: string = '';
  usuarioId: string = '';
  role: string = '';
  expedienteAtivo: boolean = false;
  dropdownOpen = false;
  pausaAtiva: boolean = false;
  osEmAndamento: boolean = false; 
  private expedienteSubscription: Subscription = new Subscription();
  private pausaSubscription: Subscription = new Subscription();
  private authSubscription: Subscription = new Subscription();
  private osSubscription: Subscription = new Subscription(); // Nova subscrição para O.S.
  @Output() sidebarToggle = new EventEmitter<void>();

  isDropdownOpen = false;
  isClientDropdownOpen = false; // Nova variável para o dropdown de clientes

  constructor(
    private router: Router,
    private authService: AuthService,
    private registroExpediente: RegistroExpedienteService,

  ) {
    this.restaurarEstadoDoLocalStorage(); // Restaura o estado ao iniciar
  }

  timestamps: { [key: string]: string } = {};
  
  ngOnInit(): void {
    const usuario = this.authService.getUsuario();
    if (usuario) {
      this.autenticado = true;
      this.nomeUsuario = usuario.nome;
      this.role = usuario.role;
      this.usuarioId = usuario.usuarioId || '';

      this.expedienteSubscription = this.registroExpediente.expedienteAtivo$.subscribe(
        ativo => this.expedienteAtivo = ativo
      );
      
      this.pausaSubscription = this.registroExpediente.tempoRestantePausa$.subscribe(
        minutos => {
          this.pausaAtiva = minutos > 0;
          if (this.pausaAtiva) {
            this.expedienteAtivo = true;
          }
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
        window.addEventListener('osStatusChanged', () => {
          this.verificarOsEmAndamento();
        });
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

      // Restaurar expediente ativo usando o Observable
      this.authService.expedienteAtivo$.subscribe({
        next: (ativo) => this.expedienteAtivo = ativo !== null && ativo !== undefined ? ativo : false,
        error: (err) => console.error('Erro ao restaurar estado do expediente:', err)
      }).unsubscribe(); // Obtém apenas o valor atual

      // Restaurar pausa ativa
      const inicioPausaTime = localStorage.getItem('inicioPausaTime');
      const fimPausaTime = localStorage.getItem('fimPausaTime');
      this.pausaAtiva = !!inicioPausaTime && !fimPausaTime && 
                        (new Date().getTime() - new Date(inicioPausaTime).getTime()) < 3600000;

      // Restaurar O.S. em andamento usando o Observable
      this.authService.osEmAndamento$.subscribe({
        next: (ativo) => this.osEmAndamento = ativo !== null && ativo !== undefined ? ativo : false,
        error: (err) => console.error('Erro ao restaurar estado da O.S.:', err)
      }).unsubscribe(); // Obtém apenas o valor atual

      const dadosExpediente = localStorage.getItem('dadosExpediente');
      if (dadosExpediente) {
        const dados = JSON.parse(dadosExpediente);
        this.timestamps = dados.timestamps || {};
      }
    }
  }

  verificarOsEmAndamento() {
    const osEmAndamento = localStorage.getItem('osEmAndamento');
    const osIniciada = localStorage.getItem('osIniciada');
    this.osEmAndamento = !!(osEmAndamento && osIniciada === 'true');
    this.authService.setOsEmAndamento(this.osEmAndamento); // Sincroniza com o AuthService
    console.log('Status O.S. em andamento:', this.osEmAndamento);
  }

  ngOnDestroy(): void {
    if (this.expedienteSubscription) {
      this.expedienteSubscription.unsubscribe();
    }
    if (this.pausaSubscription) {
      this.pausaSubscription.unsubscribe();
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.osSubscription) {
      this.osSubscription.unsubscribe();
    }
    window.removeEventListener('osStatusChanged', () => {
      this.verificarOsEmAndamento();
    });
  }

  onLogout(): void {
    this.authService.logout().then(() => {
      console.log('Usuário desconectado.');
    });
  }

  toggleDropdownOs(): void {
    this.isDropdownOsOpen = !this.isDropdownOsOpen;
    // Fecha outros dropdowns se necessário
    if (this.isDropdownOpen) {
      this.isDropdownOpen = false;
    }
    if (this.isClientDropdownOpen) {
      this.isClientDropdownOpen = false;
    }
  }
  
  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  toggleDropdown1(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isClientDropdownOpen) {
      this.isClientDropdownOpen = false;
    }
  }

  toggleSidebar(): void {
    this.isSidebarClosed = !this.isSidebarClosed;
    this.sidebarToggle.emit();
  }

  fecharSidebarSeMobile(): void {
    if (window.innerWidth <= 768) {
      this.isSidebarClosed = true;
    }
  }

  async logout(): Promise<void> {
    if (confirm('Deseja realmente sair do sistema?')) {
      await this.authService.logout();
    }
  }

  private verificarEstadoPausa(): void {
    const inicioPausaTime = localStorage.getItem('inicioPausaTime');
    const fimPausaTime = localStorage.getItem('fimPausaTime');

    if (inicioPausaTime && !fimPausaTime) {
      const now = new Date().getTime();
      const pauseStart = new Date(inicioPausaTime).getTime();
      this.pausaAtiva = (now - pauseStart) < 3600000;
    } else {
      this.pausaAtiva = false;
    }
  }

  private verificarEstadoExpediente(): void {
    const pontoIdExpediente = localStorage.getItem('pontoIdExpediente');
    const fimExpedienteTime = localStorage.getItem('fimExpedienteTime');

    if (pontoIdExpediente && !fimExpedienteTime) {
      this.expedienteAtivo = true;
    } else {
      this.expedienteAtivo = false;
    }
  }
}