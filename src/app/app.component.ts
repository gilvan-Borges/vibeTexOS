import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NavbarComponent } from "./components/layout/navbar/navbar.component";
import { AuthService } from './services/auth.service'; // Importa o serviço de autenticação
import { CommonModule } from '@angular/common';
import { NgxSpinnerModule } from 'ngx-spinner';

@Component({
  selector: 'app-root',
  standalone: true, // Se estiver usando standalone components
  imports: [RouterOutlet, NavbarComponent, CommonModule, NgxSpinnerModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'vibetexweb';
  isSidebarClosed: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Verifica o estado salvo do sidebar no localStorage
    const savedState = localStorage.getItem('sidebarState');
    this.isSidebarClosed = savedState === 'closed';

    // Verifica se o usuário está logado na inicialização
    if (!localStorage.getItem('usuario')) {
      this.authService.logout();
    }
  }
  
  toggleSidebar(): void {
    this.isSidebarClosed = !this.isSidebarClosed;
    // Salva o estado atual no localStorage
    localStorage.setItem('sidebarState', this.isSidebarClosed ? 'closed' : 'open');
  }

  // Método para verificar autenticação
  isAuthenticated(): boolean {
    return this.authService.isLoggedIn();
  }
}
