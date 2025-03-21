import { Injectable } from '@angular/core';
import { CanActivate, Router, Routes } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { HorasTrabalhadasComponent } from '../components/pages/horas-trabalhadas/horas-trabalhadas.component';
import { AutenticarComponent } from '../components/pages/autenticar/autenticar.component';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    console.log('Verificando se o usuário está autenticado:', this.authService.isLoggedIn());
  
    if (this.authService.isLoggedIn()) {
      return true;
    } else {
      this.router.navigate(['/pages/usuarios/autenticar']);
      return false;
    }
  }
}  
  
const routes: Routes = [
  { path: 'horas-trabalhadas', component: HorasTrabalhadasComponent, canActivate: [AuthGuard] },
  { path: 'autenticar', component: AutenticarComponent },
  { path: '**', redirectTo: 'autenticar' },
];