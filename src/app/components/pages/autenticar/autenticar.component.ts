import { Component } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ControllAppService } from '../../../services/controllApp.service';
import { AuthService } from '../../../services/auth.service';
import { interval, Subscription } from 'rxjs';
import { ServicoLocalizacao } from '../../../services/localizacao.service';


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
    private authService: AuthService,
    private servicoLocalizacao: ServicoLocalizacao
  ) {}

  formulario = new FormGroup({
    userName: new FormControl('', [Validators.required, Validators.minLength(3)]),

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
    const senha = this.formulario.get('senha')?.value ?? '';

    this.authService.login(userName, senha);
  }

  logout() {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

    if (usuario && usuario.usuarioId) {
      this.controllAppService.atualizarStatusUsuario(usuario.usuarioId, false).subscribe({
        next: () => {
          console.log('Status atualizado para offline.');
          localStorage.clear();
          this.router.navigate(['/pages/usuarios/autenticar']);
          this.pararAtualizacaoLocalizacao(); // Para a atualização automática ao deslogar
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

    // Salva o usuário no localStorage
    localStorage.setItem('usuario', JSON.stringify(response));

    // Inicia a atualização de localização imediatamente
    this.idUsuario = usuario.usuarioId;
    this.iniciarAtualizacaoLocalizacao();

    // Redireciona baseado no role do usuário (sem reload)
    if (usuario.role?.toLowerCase() === 'colaborador') {
      this.router.navigate([`/pages/expediente/${usuario.usuarioId}`]);
    } else if (usuario.role?.toLowerCase() === 'administrador') {
       usuario.role?.toLowerCase() === 'administrador' ||
        usuario.role?.toLowerCase() === 'roteirizador'
    }

    // Atualiza o status do usuário e verifica o expediente e O.S.
    this.controllAppService.atualizarStatusUsuario(usuario.usuarioId, true).subscribe({
      next: () => {
        console.log('Status atualizado com sucesso.');
        this.authService.verificarEstadoExpedienteEOS(usuario.usuarioId).subscribe();
      },
      error: (err) => console.error('Erro ao atualizar status:', err)
    });
  }

  iniciarAtualizacaoLocalizacao(): void {
    // Inicia a atualização automática usando o ServicoLocalizacao
    this.locationUpdateSubscription = this.servicoLocalizacao.iniciarAtualizacaoAutomatica(this.idUsuario);
  }

  pararAtualizacaoLocalizacao(): void {
    // Para a atualização automática usando o ServicoLocalizacao
    if (this.locationUpdateSubscription) {
      this.servicoLocalizacao.pararAtualizacaoAutomatica();
      this.locationUpdateSubscription.unsubscribe();
      this.locationUpdateSubscription = undefined;
    }
  }

  ngOnDestroy(): void {
    this.pararAtualizacaoLocalizacao(); // Garante que a atualização seja parada ao destruir o componente
  }
}