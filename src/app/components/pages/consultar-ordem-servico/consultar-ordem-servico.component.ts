import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { FormBuilder, FormGroup } from '@angular/forms';
import { VibeService } from '../../../services/vibe.service';
import { ControllAppService } from '../../../services/controllApp.service';
import { Observable, forkJoin, of } from 'rxjs';
import { mergeMap, catchError } from 'rxjs/operators';

// Interface para tipar os dados das ordens de serviço
interface OrdemServico {
  usuarioId?: string;
  numeroOrdemDeServico?: string;
  dataEHoraInicioServico?: string;
  dataHoraCadastro?: string;
  empresa?: { nome: string } | null;
  empresaId?: string;
  statusOrdem?: string;
  observacoesReparo?: string;
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
  styleUrl: './consultar-ordem-servico.component.css',
  providers: [VibeService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsultarOrdemServicoComponent implements OnInit {
  filtroForm: FormGroup;
  ordensServico: OrdemServico[] = [];
  ordensServicoFiltradas: OrdemServico[] = [];
  usuarios: Map<string, Usuario> = new Map();
  empresas: Map<string, Empresa> = new Map();
  hoje: Date = new Date();

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
      status: ['']
    });

    this.hoje.setHours(0, 0, 0, 0);
  }

  ngOnInit(): void {
    forkJoin({
      usuarios: this.vibeService.buscarUsuario(),
      ordens: this.vibeService.buscarOrdemServico()
    }).subscribe({
      next: ({ usuarios, ordens }) => {
        console.log('Dados dos usuários recebidos:', usuarios);
        usuarios.forEach((usuario: any) => {
          this.usuarios.set(usuario.usuarioId, {
            usuarioId: usuario.usuarioId,
            empresaId: usuario.empresaId,
            nome: usuario.nome,
            fotoUrl: usuario.fotoUrl
          });
        });

        console.log('Dados das ordens recebidos:', ordens);
        console.dir(ordens);
        this.ordensServico = ordens.map((os: OrdemServico) => {
          if (os.dataHoraCadastro) {
            const dataOs = new Date(os.dataHoraCadastro);
            dataOs.setHours(0, 0, 0, 0);
            if (dataOs > this.hoje) {
              os.statusOrdem = 'Agendada';
            }
          }
          return os;
        });

        this.carregarDadosEmpresas();
      },
      error: (error) => {
        console.error('Erro ao carregar dados:', error);
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
      this.cdr.markForCheck();
    }, 1000);
  }

  aplicarFiltros() {
    const filtros = this.filtroForm.value;

    this.ordensServicoFiltradas = this.ordensServico.filter(os => {
      console.log('Status original:', os.statusOrdem);
      console.log('Status normalizado:', this.normalizeStatus(os.statusOrdem));

      const dataInicioMatch = !filtros.dataInicio || 
        (os.dataHoraCadastro && new Date(os.dataHoraCadastro) >= new Date(filtros.dataInicio));
      
      const dataFimMatch = !filtros.dataFim || 
        (os.dataHoraCadastro && new Date(os.dataHoraCadastro) <= new Date(filtros.dataFim));
      
      const usuario = os.usuarioId ? this.usuarios.get(os.usuarioId) : null;
      const nomeEmpresa = usuario?.empresaId ? this.getEmpresaNomeByEmpresaId(usuario.empresaId) : 'N/A';
      
      const empresaMatch = !filtros.nomeEmpresa || 
        (nomeEmpresa.toLowerCase()).includes(filtros.nomeEmpresa.toLowerCase());
      
      const statusMatch = !filtros.status || 
        os.statusOrdem === filtros.status;

      return dataInicioMatch && dataFimMatch && empresaMatch && statusMatch;
    });

    this.cdr.markForCheck();
  }

  limparFiltros() {
    this.filtroForm.reset({
      dataInicio: '',
      dataFim: '',
      nomeDaEmpresa: '',
      status: ''
    });
    this.aplicarFiltros();
    this.cdr.markForCheck();
  }

  getColaboradorFoto(colaborador?: string): string {
    console.log('Buscando foto para colaborador:', colaborador);
    if (colaborador && this.usuarios.has(colaborador)) {
      const usuario = this.usuarios.get(colaborador);
      console.log('Usuário encontrado:', usuario);
      if (usuario?.fotoUrl) {
        const fotoUrl = usuario.fotoUrl;
        console.log('URL final da foto:', fotoUrl);
        return fotoUrl;
      }
    }
    console.log('Usuário não encontrado ou sem foto para colaborador:', colaborador);
    return '';
  }

  getColaboradorNome(colaborador?: string): string {
    if (colaborador && this.usuarios.has(colaborador)) {
      const usuario = this.usuarios.get(colaborador);
      console.log('Usuário encontrado:', usuario);
      return usuario?.nome || 'Colaborador Não Atribuído';
    }
    console.log('Usuário não encontrado para colaborador:', colaborador);
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
}