import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkWithHref } from '@angular/router';
import { ControllAppService } from '../../../services/controllApp.service';
import { UsuarioService } from '../../../services/usuario.service';
import { environment } from '../../../../environments/environment.development';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  colaboradores: any[] = [];
  filteredColaboradores: any[] = [];
  colaboradorSelecionado: any = null;
  filterType: string = 'nome'; // Default filter type
  searchTerm: string = ''; // Search term for filtering

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
        this.colaboradores = colaboradores.map(colaborador => ({
          ...colaborador,
          fotoUrl: colaborador.fotoUrl
            ? `${environment.mediaUrl}/${colaborador.fotoUrl.split('/').pop()}`
            : 'https://via.placeholder.com/40x40',
          jornada: this.formatJornada(colaborador.jornada)
        }));
        this.filteredColaboradores = [...this.colaboradores]; // Initialize filtered list
      },
      error: (err) => {
        console.error('Erro ao carregar colaboradores:', err);
      }
    });
  }

  // Método para formatar a jornada no formato HH:MM - HH:MM
  formatJornada(jornada: string): string {
    if (!jornada) return '00:00 - 00:00';
    const [inicio, fim] = jornada.split(' - ');
    if (!inicio || !fim) return '00:00 - 00:00';
    return `${inicio.substring(0, 5)} - ${fim.substring(0, 5)}`;
  }

  applyFilter(): void {
    this.filteredColaboradores = this.colaboradores.filter(colaborador => {
      const value = colaborador[this.filterType]?.toString().toLowerCase() || '';
      return value.includes(this.searchTerm.toLowerCase());
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
      alert('Erro ao excluir: ID do colaborador não encontrado.');
      return;
    }
  
    this.controllAppService.deleteById(usuarioId).subscribe({
      next: () => {
        this.colaboradores = this.colaboradores.filter(c => 
          c.usuarioId !== usuarioId && c.id !== usuarioId
        );
        this.applyFilter(); // Reapply filter after deletion
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