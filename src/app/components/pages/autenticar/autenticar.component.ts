import { Component } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ControllAppService } from '../../../services/controllApp.service';
import { AuthService } from '../../../services/auth.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-autenticar',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './autenticar.component.html',
  styleUrls: ['./autenticar.component.css'],
})
export class AutenticarComponent {
  mensagem: string = '';
  coordenadas: string = '';
  idUsuario: string = '';
  private locationUpdateSubscription: Subscription | undefined;

  constructor(
    private controllAppService: ControllAppService,
    private router: Router,
    private authService: AuthService // ✅ Agora injetado corretamente
  ) { }

  formulario = new FormGroup({
    userName: new FormControl('', [Validators.required, Validators.minLength(3)]),
    cpf: new FormControl('', [Validators.pattern(/^\d{11}$/)]),
    senha: new FormControl('', [Validators.required, Validators.minLength(5)]),
  });

  ngOnInit(): void {
    // Limpa dados antigos do localStorage para evitar coordenadas incorretas
    localStorage.removeItem('usuario');
  }

  autenticarUsuario() {
    if (this.formulario.invalid) {
      this.mensagem = 'Preencha os campos corretamente.';
      return;
    }

    const userName = this.formulario.get('userName')?.value ?? '';
    const cpf = this.formulario.get('cpf')?.value ?? '';
    const senha = this.formulario.get('senha')?.value ?? '';

    // Use AuthService login instead of direct authentication
    this.authService.login(userName, cpf, senha);
  }

  logout() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    if (usuario && usuario.usuarioId) {
      this.controllAppService.atualizarStatusUsuario(usuario.usuarioId, false).subscribe({
        next: () => {
          console.log('Status atualizado para offline.');
          localStorage.clear();
          this.router.navigate(['/pages/usuarios/autenticar']);
        },
        error: (err) => console.error('Erro ao atualizar status de logout:', err)
      });
    } else {
      console.error('Usuário não encontrado para logout.');
      this.router.navigate(['/login']);
    }
  }


  private handleAuthentication(response: any): void {
    const usuario = response.usuario;
    if (!usuario || !usuario.usuarioId) {
      console.error('Erro: usuário ou ID do usuário não encontrado.');
      return;
    }
    console.log('Redirecionando o usuário com ID:', usuario.usuarioId);

    // Redireciona baseado no role do usuário
    if (usuario.role?.toLowerCase() === 'colaborador') {
      this.router.navigate([`/pages/expediente/${usuario.usuarioId}`]).then(() => {
        window.location.reload();
      });
    } else if (usuario.role?.toLowerCase() === 'administrador') {
      this.router.navigate(['/pages/dashboard']).then(() => {
        window.location.reload();
      });
    }

    // Atualiza o status do usuário em segundo plano
    this.controllAppService.atualizarStatusUsuario(usuario.usuarioId, true).subscribe({
      next: () => {
        console.log('Status atualizado com sucesso.');
      },
      error: (err) => console.error('Erro ao atualizar status:', err)
    });
  }


  iniciarAtualizacaoDeLocalizacao(): void {
    this.locationUpdateSubscription = interval(30000).subscribe(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Coordenadas brutas do GPS:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy // Precisão em metros
          });

          const latitudeStr = position.coords.latitude.toFixed(7); // Garante 7 casas decimais
          const longitudeStr = position.coords.longitude.toFixed(7); // Garante 7 casas decimais
          this.coordenadas = `${latitudeStr}, ${longitudeStr}`;
          console.log('Coordenadas capturadas e enviadas:', this.coordenadas);
          this.enviarCoordenadasParaApi(latitudeStr, longitudeStr);
        },
        (error) => {
          console.error('Erro ao obter coordenadas:', error);
          alert('Erro ao capturar coordenadas. Verifique as permissões de localização.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  private enviarCoordenadasParaApi(latitude: string, longitude: string): void {
    const coordenadasAtualizadas = {
      usuarioId: this.idUsuario,
      latitudeAtual: latitude,
      longitudeAtual: longitude
    };

    console.log('📡 Enviando coordenadas para a API:', coordenadasAtualizadas);

    this.controllAppService.atualizarCoordenadasUsuario(
      this.idUsuario,
      latitude,
      longitude
    ).subscribe({
      next: () => console.log('✅ Coordenadas atualizadas com sucesso.'),
      error: (err) => console.error('❌ Erro ao atualizar coordenadas:', err)
    });
  }

  ngOnDestroy(): void {
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
    }
  }

}
