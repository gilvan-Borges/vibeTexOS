import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, OnDestroy, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { RegistroExpedienteService } from '../../../services/registro-expediente.service';
import { Subscription } from 'rxjs';
import { OrdemServicoService } from '../../../services/ordem.servico.service';

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
  autenticado: boolean = false;
  nomeUsuario: string = '';
  usuarioId: string = '';
  role: string = '';
  expedienteAtivo: boolean = false;
  dropdownOpen = false;
  pausaAtiva: boolean = false;
  osEmAndamento: boolean = false; 
  private expedienteSubscription: Subscription;
  private pausaSubscription: Subscription;
  @Output() sidebarToggle = new EventEmitter<void>();

  isDropdownOpen = false;
  isClientDropdownOpen = false; // Nova variável para o dropdown de clientes

  constructor(
    private router: Router,
    private authService: AuthService,
    private registroExpediente: RegistroExpedienteService,
    private ordemServicoService: OrdemServicoService
  ) {
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
  }

  timestamps: { [key: string]: string } = {};
  
  ngOnInit(): void {

    const usuario = this.authService.getUsuario();
    if (usuario) {
      this.autenticado = true;
      this.nomeUsuario = usuario.nome;
      this.role = usuario.role;
      this.usuarioId = usuario.usuarioId || '';

      const dadosExpediente = localStorage.getItem('dadosExpediente');
      if (dadosExpediente) {
        const dados = JSON.parse(dadosExpediente);
        this.timestamps = dados.timestamps;
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
 
   
  

  verificarOsEmAndamento() {
    const osEmAndamento = localStorage.getItem('osEmAndamento');
    const osIniciada = localStorage.getItem('osIniciada');
    this.osEmAndamento = !!(osEmAndamento && osIniciada === 'true');
    console.log('Status O.S. em andamento:', this.osEmAndamento);
  }

  ngOnDestroy(): void {
    if (this.expedienteSubscription) {
      this.expedienteSubscription.unsubscribe();
    }
    if (this.pausaSubscription) {
      this.pausaSubscription.unsubscribe();
    }
    // Remove o listener quando o componente for destruído
    window.removeEventListener('osStatusChanged', () => {
      this.verificarOsEmAndamento();
    });
  }
  onLogout(): void {
    this.authService.logout().then(() => {
      console.log('Usuário desconectado.');
    });
  }
  
  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  toggleDropdown1(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    // Fecha o outro dropdown se estiver aberto
    if (this.isClientDropdownOpen) {
      this.isClientDropdownOpen = false;
    }
  }


  toggleSidebar(): void {
    this.isSidebarClosed = !this.isSidebarClosed; // Alterna entre aberto e fechado
    this.sidebarToggle.emit();
  }

  fecharSidebarSeMobile(): void {
    if (window.innerWidth <= 768) { // Só fecha se a tela for pequena
      this.isSidebarClosed = true;
    }
  }
  

  async logout(): Promise<void> {
    if (confirm('Deseja realmente sair do sistema?')) {
      await this.authService.logout();
      // Removido o router.navigate pois já está no AuthService
    }
  }

  private verificarEstadoPausa(): void {
    const inicioPausaTime = localStorage.getItem('inicioPausaTime');
    const fimPausaTime = localStorage.getItem('fimPausaTime');

    if (inicioPausaTime && !fimPausaTime) {
      const now = new Date().getTime();
      const pauseStart = new Date(inicioPausaTime).getTime();
      this.pausaAtiva = (now - pauseStart) < 3600000; // Menos de 1 hora
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