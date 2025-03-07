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
   
    const savedState = localStorage.getItem('sidebarState');
    this.isSidebarClosed = savedState === 'closed';

    
    if (!localStorage.getItem('usuario')) {
      this.authService.logout();
    }
  }
  
  toggleSidebar(): void {
    this.isSidebarClosed = !this.isSidebarClosed;
    
    localStorage.setItem('sidebarState', this.isSidebarClosed ? 'closed' : 'open');
  }


  isAuthenticated(): boolean {
    return this.authService.isLoggedIn();
  }
}