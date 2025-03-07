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
  empresas: Map<string, Empresa> = new Map(); // Mapa para armazenar dados das empresas
  hoje: Date = new Date(); // Data atual para comparação

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

    // Define a data atual sem a parte de horário para comparação
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
          // Determina se a O.S. é "Agendada" com base na data
          if (os.dataHoraCadastro) {
            const dataOs = new Date(os.dataHoraCadastro);
            dataOs.setHours(0, 0, 0, 0); // Ignora a hora para comparação
            if (dataOs > this.hoje) {
              os.statusOrdem = 'Agendada';
            }
          }
          return os;
        });

        // Buscar informações das empresas
        this.carregarDadosEmpresas();
      },
      error: (error) => {
        console.error('Erro ao carregar dados:', error);
        this.cdr.markForCheck();
      }
    });
  }

  // Método para carregar dados das empresas
  carregarDadosEmpresas(): void {
    // Obter lista única de IDs de empresas dos usuários
    const empresaIds = new Set<string>();
    
    // Coletar todos os IDs de empresa dos usuários
    this.usuarios.forEach(usuario => {
      if (usuario.empresaId) {
        empresaIds.add(usuario.empresaId);
        console.log('Adicionando empresaId do usuário para busca:', usuario.empresaId);
      }
    });
    
    console.log('Total de empresas para buscar:', empresaIds.size);

    // Se não houver empresas para buscar, apenas aplica os filtros
    if (empresaIds.size === 0) {
      console.log('Nenhuma empresa para buscar, aplicando filtros diretamente');
      this.aplicarFiltros();
      this.cdr.markForCheck();
      return;
    }

    // Buscar cada empresa individualmente para garantir que todas sejam processadas
    empresaIds.forEach(id => {
      console.log('Buscando empresa com ID:', id);
      this.ControllAppService.buscarEmpresasPorId(id).subscribe({
        next: (empresa) => {
          console.log('Resposta da API para empresa ID', id, ':', empresa);
          
          // Verifica a estrutura da resposta
          if (empresa) {
            this.empresas.set(id, {
              empresaId: id,
              nomeDaEmpresa: empresa.nomeDaEmpresa || empresa.nomeDaEmpresa || 'Nome não disponível'
            });
            
            console.log('Empresa adicionada ao mapa:', id, this.empresas.get(id));
            this.cdr.markForCheck(); // Atualiza a view após cada empresa carregada
          } else {
            console.error('Resposta da API para empresa inválida:', empresa);
          }
        },
        error: (error) => {
          console.error(`Erro ao buscar empresa ${id}:`, error);
        },
        complete: () => {
          console.log(`Busca de empresa ${id} concluída`);
        }
      });
    });

    // Aplica os filtros depois de um curto delay para dar tempo de carregar as empresas
    setTimeout(() => {
      console.log('Empresas carregadas:', [...this.empresas.entries()]);
      this.aplicarFiltros();
      this.cdr.markForCheck();
    }, 1000);
  }

  aplicarFiltros() {
    const filtros = this.filtroForm.value;

    this.ordensServicoFiltradas = this.ordensServico.filter(os => {
      const dataInicioMatch = !filtros.dataInicio || 
        (os.dataHoraCadastro && new Date(os.dataHoraCadastro) >= new Date(filtros.dataInicio));
      
      const dataFimMatch = !filtros.dataFim || 
        (os.dataHoraCadastro && new Date(os.dataHoraCadastro) <= new Date(filtros.dataFim));
      
      // Obter empresaId do usuário relacionado à ordem de serviço
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

  // Método para obter o nome da empresa pelo ID da empresa diretamente
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

  // Método para obter o nome da empresa pelo ID do usuário na ordem de serviço
  getEmpresaNome(usuarioId?: string): string {
    if (!usuarioId) {
      return 'Usuário não informado';
    }
    
    // Buscar o usuário para encontrar o empresaId
    const usuario = this.usuarios.get(usuarioId);
    if (!usuario) {
      return 'Usuário não encontrado';
    }
    
    // Usar o empresaId do usuário para buscar o nome da empresa
    return this.getEmpresaNomeByEmpresaId(usuario.empresaId);
  }

  // Método para normalizar o status para uso em classes CSS
  normalizeStatus(status?: string): string {
    if (!status) return '';
    return status
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
  }
}