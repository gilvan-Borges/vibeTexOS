
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
      return of(true); // Permite acesso à tela de login se não houver usuário logado
    }

    const usuario = JSON.parse(data);
    const role = usuario?.usuario?.role?.trim().toLowerCase() || '';

    // Se for administrador ou roteirizador, redireciona para dashboard
    if (role === 'administrador' || role === 'roteirizador') {
      this.router.navigate(['/pages/dashboard']);
      return of(false);
    } 
    // Se for colaborador, redireciona para expediente
    else if (role === 'colaborador') {
      this.router.navigate(['/pages/expediente']);
      return of(false);
    } 
    // Caso contrário, deixa passar (ou trate como preferir)
    else {
      console.error('Role inválido ou não reconhecido:', role);
      return of(true); // Se o role for inválido, permite acesso à tela de login
    }
  }
}
