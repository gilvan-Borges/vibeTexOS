import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class LoginGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): Observable<boolean> {
    const data = localStorage.getItem('usuario');
    if (!data) {
      return of(true);  // Permite acesso à tela de login se não houver um usuário logado
    }
  
    const usuario = JSON.parse(data);
    const role = usuario?.usuario?.role?.trim().toLowerCase() || '';
  
    if (role === 'administrador') {
      this.router.navigate(['/pages/dashboard']);
      return of(false);
    } else if (role === 'colaborador') {
      this.router.navigate(['/pages/expediente']);
      return of(false);
    } else {
      console.error('Role inválido ou não reconhecido:', role);
      return of(true);  // Se o role for inválido, permite acesso à tela de login
    }
  }
  
}
