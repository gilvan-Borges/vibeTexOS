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
  isLoading: boolean = false; // Loading indicator
  sortColumn: string = ''; // Current sort column
  sortDirection: string = 'asc'; // Current sort direction

  // Adicionar variáveis de paginação
  paginaAtual: number = 1;
  itensPorPagina: number = 10;
  totalColaboradores: number = 0;
  totalPaginas: number = 0;
  Math = Math; // Para usar Math.min no template

  constructor(
    private controllAppService: ControllAppService,
    private usuarioService: UsuarioService
  ) {}

  ngOnInit() {
    this.carregarTodosColaboradores();
  }

  carregarTodosColaboradores(): void {
    this.isLoading = true;
    this.usuarioService.carregarTodosColaboradores().subscribe({
      next: (colaboradores) => {
        this.colaboradores = colaboradores.map(colaborador => {
          // Extract image filename or use the full URL if needed
          let imageUrl = 'https://via.placeholder.com/40x40';
          
          if (colaborador.fotoUrl) {
            // Check if fotoUrl already contains the full URL
            if (colaborador.fotoUrl.includes(`${environment.mediaUrl}/images/`)) {
              imageUrl = colaborador.fotoUrl;
            } else {
              // Extract just the filename if it's a path
              const filename = colaborador.fotoUrl.split('/').pop();
              // Construct the full URL using environment.mediaUrl
              imageUrl = `${environment.mediaUrl}/images/${filename}`;
            }
          }
          
          return {
            ...colaborador,
            fotoUrl: imageUrl,
            jornada: this.formatJornada(colaborador.jornada)
          };
        });
        
        // Atualizar contagem total e calcular páginas
        this.totalColaboradores = this.colaboradores.length;
        this.totalPaginas = Math.ceil(this.totalColaboradores / this.itensPorPagina);
        
        // Aplicar filtros iniciais (que também aplicará a paginação)
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Erro ao carregar colaboradores:', err);
        this.isLoading = false;
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

  /**
   * Formata o CPF para o padrão 000.000.000-00
   */
  formatarCPF(cpf: string): string {
    if (!cpf) return '';
    
    // Remove caracteres não numéricos
    const numerosCPF = cpf.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos
    if (numerosCPF.length !== 11) return cpf;
    
    // Formata para 000.000.000-00
    return numerosCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  applyFilter(): void {
    // Aplicar filtros
    const filtered = this.colaboradores.filter(colaborador => {
      const value = colaborador[this.filterType]?.toString().toLowerCase() || '';
      return value.includes(this.searchTerm.toLowerCase());
    });
    
    // Manter a ordenação se anteriormente aplicada
    if (this.sortColumn) {
      filtered.sort((a, b) => {
        const valueA = a[this.sortColumn] !== undefined && a[this.sortColumn] !== null ? a[this.sortColumn].toString().toLowerCase() : '';
        const valueB = b[this.sortColumn] !== undefined && b[this.sortColumn] !== null ? b[this.sortColumn].toString().toLowerCase() : '';
        
        if (valueA < valueB) {
          return this.sortDirection === 'asc' ? -1 : 1;
        }
        if (valueA > valueB) {
          return this.sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    // Atualizar total de colaboradores filtrados e páginas
    this.totalColaboradores = filtered.length;
    this.totalPaginas = Math.ceil(this.totalColaboradores / this.itensPorPagina);
    
    // Ajustar página atual se necessário
    if (this.paginaAtual > this.totalPaginas && this.totalPaginas > 0) {
      this.paginaAtual = this.totalPaginas;
    }
    
    // Aplicar paginação
    const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
    const fim = inicio + this.itensPorPagina;
    this.filteredColaboradores = filtered.slice(inicio, fim);
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

  // Método para ordenar a tabela
  sortTable(column: string): void {
    // If clicking the same column, toggle direction
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }

    this.filteredColaboradores.sort((a, b) => {
      const valueA = a[column] !== undefined && a[column] !== null ? a[column].toString().toLowerCase() : '';
      const valueB = b[column] !== undefined && b[column] !== null ? b[column].toString().toLowerCase() : '';
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
  
  // Método para obter a classe de ícone de ordenação
  getSortIconClass(column: string): string {
    if (this.sortColumn !== column) {
      return 'fa fa-sort text-muted';
    }
    return this.sortDirection === 'asc' ? 'fa fa-sort-up' : 'fa fa-sort-down';
  }
  
  // Reset all filters and sorting
  resetFilters(): void {
    this.filterType = 'nome';
    this.searchTerm = '';
    this.sortColumn = '';
    this.sortDirection = 'asc';
    this.filteredColaboradores = [...this.colaboradores];
  }

  // Métodos de paginação
  mudarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaAtual = pagina;
      this.applyFilter();
    }
  }
  
  mudarItensPorPagina(): void {
    this.paginaAtual = 1; // Voltar para a primeira página
    this.applyFilter();
  }
  
  paginasVisiveis(): number[] {
    const paginasArray: number[] = [];
    let inicio = Math.max(1, this.paginaAtual - 2);
    let fim = Math.min(this.totalPaginas, inicio + 4);
    
    // Ajustar início se necessário
    if (fim - inicio < 4) {
      inicio = Math.max(1, fim - 4);
    }
    
    for (let i = inicio; i <= fim; i++) {
      paginasArray.push(i);
    }
    
    return paginasArray;
  }
}