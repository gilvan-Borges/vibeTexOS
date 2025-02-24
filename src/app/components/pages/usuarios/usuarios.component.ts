import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ControllAppService } from '../../../services/controllApp.service';
import { UsuarioService } from '../../../services/usuario.service';
import { environment } from '../../../../environments/environment.development';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  colaboradores: any[] = [];
  colaboradorSelecionado: any = null;

  constructor(
    private controllAppService: ControllAppService,
    private usuarioService: UsuarioService
  ) {}

  ngOnInit() {
    this.carregarTodosColaboradores();
  }

  carregarTodosColaboradores(): void {
    this.usuarioService.carregarTodosColaboradores().subscribe({
      next: (colaboradores) => {
        this.colaboradores = colaboradores.map(colaborador => {
          const fotoUrlCompleta = colaborador.fotoUrl ? 
            `${environment.mediaUrl}/${colaborador.fotoUrl.split('/').pop()}` : 
            'https://via.placeholder.com/40x40';
          
          return {
            ...colaborador,
            fotoUrl: fotoUrlCompleta
          };
        });
      },
      error: (err) => {
        console.error('Erro ao carregar colaboradores:', err);
      }
    });
  }

  abrirModalExclusao(colaborador: any): void {
    this.colaboradorSelecionado = colaborador;
  }
  
  fecharModalExclusao(): void {
    this.colaboradorSelecionado = null;
  }
  
  excluirColaborador(): void {
    if (!this.colaboradorSelecionado) return;
  
    const usuarioId = this.colaboradorSelecionado.usuarioId || this.colaboradorSelecionado.id;
    if (!usuarioId) {
      alert("Erro ao excluir: ID do colaborador não encontrado.");
      return;
    }
  
    this.controllAppService.deleteById(usuarioId).subscribe({
      next: () => {
        this.colaboradores = this.colaboradores.filter(c => 
          c.usuarioId !== usuarioId && c.id !== usuarioId
        );
        this.colaboradorSelecionado = null;
        setTimeout(() => this.carregarTodosColaboradores(), 500);
      },
      error: (err) => {
        let errorMessage = 'Erro inesperado ao excluir colaborador.';
        if (err.status === 403) errorMessage = 'Permissão negada para excluir este colaborador.';
        if (err.status === 404) errorMessage = 'Colaborador não encontrado.';
        if (err.status === 500) errorMessage = 'Erro interno do servidor.';
        alert(errorMessage);
      }
    });
  }
}
