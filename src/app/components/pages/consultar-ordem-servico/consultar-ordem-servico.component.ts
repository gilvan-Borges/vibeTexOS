import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { FormBuilder, FormGroup } from '@angular/forms';
import { VibeService } from '../../../services/vibe.service';
import { ControllAppService } from '../../../services/controllApp.service';
import { Observable, forkJoin, of } from 'rxjs';
import { environment } from '../../../../environments/environment.prod';

// Interface para tipar os dados das ordens de serviço
interface OrdemServico {
  usuarioId?: string;
  numeroOrdemDeServico?: string;
  dataEHoraInicioServico?: string;
  dataEHoraFimServico?: string;
  dataEHoraFimExecucao?: string;
  dataHoraCadastro?: string;
  dataHoraCancelamento?: string; // Nova propriedade para data de cancelamento
  empresa?: { nome: string } | null;
  empresaId?: string;
  statusOrdem?: string;
  observacoesReparo?: string;
  execucoes?: Array<{
    execucaoServicoId: string;
    dataEHoraInicioExecucao: string;
    dataEHoraFimExecucao: string;
    statusExecucao: string;
    dataHoraCancelamento?: string; // Campo para data de cancelamento na execução
  }>;
}

// Interface para tipar os dados dos usuários
interface Usuario {
  usuarioId: string;
  empresaId: string;
  nome: string;
  fotoUrl?: string;
}

// Interface para tipar os dados das empresas
interface Empresa {
  empresaId: string;
  nomeDaEmpresa: string;
}

@Component({
  selector: 'app-consultar-ordem-servico',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './consultar-ordem-servico.component.html',
  styleUrls: ['./consultar-ordem-servico.component.css'],
  providers: [VibeService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsultarOrdemServicoComponent implements OnInit {
  filtroForm: FormGroup;
  ordensServico: OrdemServico[] = [];
  ordensServicoFiltradas: OrdemServico[] = [];
  ordensServicoPaginadas: OrdemServico[] = []; // Lista para os dados da página atual
  usuarios: Map<string, Usuario> = new Map();
  empresas: Map<string, Empresa> = new Map();
  hoje: Date = new Date();

  // Variáveis de paginação
  itemsPerPage: number = 5;
  currentPage: number = 1;
  totalPages: number = 1;

  // Indicador de carregamento
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private vibeService: VibeService,
    private cdr: ChangeDetectorRef,
    private ControllAppService: ControllAppService
  ) {
    this.filtroForm = this.fb.group({
      dataInicio: [''],
      dataFim: [''],
      nomeDaEmpresa: [''],
      status: [''],
      itemsPerPage: [5]
    });

    this.hoje.setHours(0, 0, 0, 0);
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    forkJoin({
      usuarios: this.vibeService.buscarUsuario(),
      ordens: this.vibeService.buscarOrdemServico()
    }).subscribe({
      next: ({ usuarios, ordens }) => {
        console.log('Dados dos usuários recebidos:', usuarios);
        
        // Verificar e processar os dados dos usuários em diferentes formatos
        if (Array.isArray(usuarios)) {
          // Processar como array
          usuarios.forEach((usuario: any) => {
            this.usuarios.set(usuario.usuarioId, {
              usuarioId: usuario.usuarioId,
              empresaId: usuario.empresaId,
              nome: usuario.nome,
              fotoUrl: usuario.fotoUrl
            });
          });
        } else if (usuarios && typeof usuarios === 'object') {
          // Processar como objeto paginado ou único usuário
          if (usuarios.items && Array.isArray(usuarios.items)) {
            // Caso seja um objeto paginado com array de items
            usuarios.items.forEach((usuario: any) => {
              if (usuario && usuario.usuarioId) {
                this.usuarios.set(usuario.usuarioId, {
                  usuarioId: usuario.usuarioId,
                  empresaId: usuario.empresaId,
                  nome: usuario.nome,
                  fotoUrl: usuario.fotoUrl
                });
              }
            });
          } else if (usuarios.usuarioId) {
            // Caso seja um único usuário
            this.usuarios.set(usuarios.usuarioId, {
              usuarioId: usuarios.usuarioId,
              empresaId: usuarios.empresaId,
              nome: usuarios.nome,
              fotoUrl: usuarios.fotoUrl
            });
          } else {
            // Caso seja um objeto com múltiplos usuários
            Object.values(usuarios).forEach((usuario: any) => {
              if (usuario && usuario.usuarioId) {
                this.usuarios.set(usuario.usuarioId, {
                  usuarioId: usuario.usuarioId,
                  empresaId: usuario.empresaId,
                  nome: usuario.nome,
                  fotoUrl: usuario.fotoUrl
                });
              }
            });
          }
        } else {
          console.error('Formato inesperado para dados de usuários:', usuarios);
        }

        console.log('Dados das ordens recebidos:', ordens);
        console.dir(ordens);
        
        // Processar as ordens de serviço
        let ordensArray: any[] = [];
        
        if (Array.isArray(ordens)) {
          // Se ordens já for um array
          ordensArray = ordens;
        } else if (ordens && typeof ordens === 'object') {
          // Se ordens for um objeto (possivelmente paginado)
          if (ordens.items && Array.isArray(ordens.items)) {
            // Caso seja um objeto paginado com array de items
            ordensArray = ordens.items;
          } else {
            console.error('Formato inesperado para dados de ordens:', ordens);
          }
        } else {
          console.error('Formato inesperado para dados de ordens:', ordens);
        }
        
        this.ordensServico = ordensArray.map((os: OrdemServico) => {
          // Mapear dados da última execução, se disponível
          if (os.execucoes && os.execucoes.length > 0) {
            // Pegar a última execução do array (assumindo que elas estejam em ordem cronológica)
            const ultimaExecucao = os.execucoes[os.execucoes.length - 1];
            if (ultimaExecucao) {
              // Mapear a data de fim de execução
              if (ultimaExecucao.dataEHoraFimExecucao) {
                os.dataEHoraFimExecucao = ultimaExecucao.dataEHoraFimExecucao;
              }
              
              // Mapear a data de cancelamento se presente
              if (ultimaExecucao.dataHoraCancelamento) {
                os.dataHoraCancelamento = ultimaExecucao.dataHoraCancelamento;
              }
            }
          }

          if (os.dataHoraCadastro) {
            const dataOs = new Date(os.dataHoraCadastro);
            dataOs.setHours(0, 0, 0, 0);
            if (dataOs > this.hoje) {
              os.statusOrdem = 'Agendada';
            }
          }

          if (!os.dataEHoraFimExecucao && os.statusOrdem?.toLowerCase() === 'concluído') {
            const dataInicio = new Date(os.dataEHoraInicioServico || os.dataHoraCadastro || new Date());
            const dataFim = new Date(dataInicio);
            dataFim.setHours(dataFim.getHours() + 2);
            os.dataEHoraFimExecucao = dataFim.toISOString();
          } else if (!os.dataEHoraFimExecucao && os.statusOrdem?.toLowerCase() === 'cancelado') {
            os.dataEHoraFimExecucao = new Date().toISOString();
          }

          return os;
        });

        this.carregarDadosEmpresas();
      },
      error: (error) => {
        console.error('Erro ao carregar dados:', error);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  carregarDadosEmpresas(): void {
    const empresaIds = new Set<string>();
    
    this.usuarios.forEach(usuario => {
      if (usuario.empresaId) {
        empresaIds.add(usuario.empresaId);
        console.log('Adicionando empresaId do usuário para busca:', usuario.empresaId);
      }
    });
    
    console.log('Total de empresas para buscar:', empresaIds.size);

    if (empresaIds.size === 0) {
      console.log('Nenhuma empresa para buscar, aplicando filtros diretamente');
      this.aplicarFiltros();
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    empresaIds.forEach(id => {
      console.log('Buscando empresa com ID:', id);
      this.ControllAppService.buscarEmpresasPorId(id).subscribe({
        next: (empresa) => {
          console.log('Resposta da API para empresa ID', id, ':', empresa);
          
          if (empresa) {
            this.empresas.set(id, {
              empresaId: id,
              nomeDaEmpresa: empresa.nomeDaEmpresa || empresa.nomeDaEmpresa || 'Nome não disponível'
            });
            
            console.log('Empresa adicionada ao mapa:', id, this.empresas.get(id));
            this.cdr.markForCheck();
          } else {
            console.error('Resposta da API para empresa inválida:', empresa);
          }
        },
        error: (error) => {
          console.error(`Erro ao buscar empresa ${id}:`, error);
        },
        complete: () => {
          console.log(`Busca de empresa ${id} Concluído`);
        }
      });
    });

    setTimeout(() => {
      console.log('Empresas carregadas:', [...this.empresas.entries()]);
      this.aplicarFiltros();
      this.isLoading = false;
      this.cdr.markForCheck();
    }, 1000);
  }

  aplicarFiltros() {
    const filtros = this.filtroForm.value;
    this.itemsPerPage = filtros.itemsPerPage || 5;

    this.ordensServicoFiltradas = this.ordensServico.filter(os => {
      const dataInicioMatch = !filtros.dataInicio || 
        (this.getDataInicioOS(os) && new Date(this.getDataInicioOS(os)) >= new Date(filtros.dataInicio));
    
      const dataFimMatch = !filtros.dataFim || 
        (this.getDataFimOS(os) && new Date(this.getDataFimOS(os)) <= new Date(filtros.dataFim));
    
      const usuario = os.usuarioId ? this.usuarios.get(os.usuarioId) : null;
      const nomeEmpresa = usuario?.empresaId ? this.getEmpresaNomeByEmpresaId(usuario.empresaId) : 'N/A';
      
      const empresaMatch = !filtros.nomeDaEmpresa || 
        (nomeEmpresa.toLowerCase()).includes(filtros.nomeDaEmpresa.toLowerCase());
      
      const statusMatch = !filtros.status || 
        os.statusOrdem === filtros.status;

      return dataInicioMatch && dataFimMatch && empresaMatch && statusMatch;
    });

    this.updatePagination();
  }

  limparFiltros() {
    this.filtroForm.reset({
      dataInicio: '',
      dataFim: '',
      nomeDaEmpresa: '',
      status: '',
      itemsPerPage: 5
    });
    this.itemsPerPage = 5;
    this.currentPage = 1;
    this.aplicarFiltros();
    this.cdr.markForCheck();
  }

  getColaboradorFoto(colaborador?: string): string {
    if (!colaborador) return '';
    const usuario = this.usuarios.get(colaborador);
    if (!usuario?.fotoUrl) return '';
  
    // Se a URL não iniciar com "http://" ou "https://", adiciona "http://"
    if (!/^https?:\/\//i.test(usuario.fotoUrl)) {
      return `http://${usuario.fotoUrl}`;
    }
  
    return usuario.fotoUrl;
  }
  

  getColaboradorNome(colaborador?: string): string {
    if (colaborador && this.usuarios.has(colaborador)) {
      const usuario = this.usuarios.get(colaborador);
      return usuario?.nome || 'Colaborador Não Atribuído';
    }
    return 'Colaborador Não Atribuído';
  }

  getEmpresaNomeByEmpresaId(empresaId?: string): string {
    if (!empresaId) {
      return 'Empresa não informada';
    }
    
    if (this.empresas.has(empresaId)) {
      const empresa = this.empresas.get(empresaId);
      return empresa?.nomeDaEmpresa || 'N/A';
    }
    
    return 'Carregando...';
  }

  getEmpresaNome(usuarioId?: string): string {
    if (!usuarioId) {
      return 'Usuário não informado';
    }
    
    const usuario = this.usuarios.get(usuarioId);
    if (!usuario) {
      return 'Usuário não encontrado';
    }
    
    return this.getEmpresaNomeByEmpresaId(usuario.empresaId);
  }

  normalizeStatus(status?: string): string {
    if (!status) return '';
    const normalized = status
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const statusMap: { [key: string]: string } = {
      'concluido': 'concluida',
      'concluida': 'concluida',
      'completed': 'concluida',
      'pendente': 'pendente',
      'pending': 'pendente',
      'em andamento': 'em andamento',
      'emandamento': 'em andamento',
      'inprogress': 'em andamento',
      'cancelado': 'cancelado',
      'canceled': 'cancelado',
      'agendada': 'agendada',
      'agendado': 'agendada',
      'scheduled': 'agendada'
    };

    return statusMap[normalized] || normalized;
  }

  getDataInicioOS(os: OrdemServico): string {
    const status = this.normalizeStatus(os.statusOrdem);
    if (status === 'pendente' && os.dataHoraCadastro) {
      return os.dataHoraCadastro;
    }
    return os.dataEHoraInicioServico || os.dataHoraCadastro || 'N/A';
  }

  getDataFimOS(os: OrdemServico): string {
    const status = this.normalizeStatus(os.statusOrdem);
  
    if (status === 'pendente') {
      return 'Não iniciada';
    }
  
    if (status === 'em andamento') {
      return 'Em andamento';
    }
  
    if (status === 'cancelado') {
      if (os.dataHoraCancelamento && this.isValidDate(os.dataHoraCancelamento)) {
        return os.dataHoraCancelamento;
      }
      if (os.execucoes && os.execucoes.length > 0) {
        const ultimaExecucao = os.execucoes[os.execucoes.length - 1];
        if (ultimaExecucao && ultimaExecucao.dataHoraCancelamento && 
            this.isValidDate(ultimaExecucao.dataHoraCancelamento)) {
          return ultimaExecucao.dataHoraCancelamento;
        }
      }
      return 'Carregando...';
    }
  
    // Priorizar a última execução concluída
    if (os.execucoes && os.execucoes.length > 0) {
      const ultimaExecucaoConcluida = os.execucoes
        .filter(e => this.normalizeStatus(e.statusExecucao) === 'concluida')
        .sort((a, b) => new Date(b.dataEHoraFimExecucao || '').getTime() - new Date(a.dataEHoraFimExecucao || '').getTime())[0];
      if (ultimaExecucaoConcluida && ultimaExecucaoConcluida.dataEHoraFimExecucao && this.isValidDate(ultimaExecucaoConcluida.dataEHoraFimExecucao)) {
        return ultimaExecucaoConcluida.dataEHoraFimExecucao;
      }
    }
  
    if (os.dataEHoraFimExecucao && this.isValidDate(os.dataEHoraFimExecucao)) {
      return os.dataEHoraFimExecucao;
    }
  
    if (os.execucoes && os.execucoes.length > 0) {
      const ultimaExecucao = os.execucoes[os.execucoes.length - 1];
      if (ultimaExecucao && ultimaExecucao.dataEHoraFimExecucao && 
          this.isValidDate(ultimaExecucao.dataEHoraFimExecucao)) {
        return ultimaExecucao.dataEHoraFimExecucao;
      }
    }
  
    if (os.dataEHoraFimServico && this.isValidDate(os.dataEHoraFimServico)) {
      return os.dataEHoraFimServico;
    }
  
    return 'N/A';
  }

  isValidDate(dateStr: string): boolean {
    if (!dateStr || dateStr === 'N/A' || dateStr === 'Não iniciada') return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.ordensServicoFiltradas.length / this.itemsPerPage);
    this.currentPage = Math.min(Math.max(1, this.currentPage), this.totalPages);
    this.applyPagination();
  }

  applyPagination() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.ordensServicoPaginadas = this.ordensServicoFiltradas.slice(startIndex, endIndex);
    this.cdr.markForCheck();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyPagination();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyPagination();
    }
  }

  onItemsPerPageChange() {
    this.currentPage = 1;
    this.itemsPerPage = this.filtroForm.value.itemsPerPage;
    this.aplicarFiltros();
  }
}