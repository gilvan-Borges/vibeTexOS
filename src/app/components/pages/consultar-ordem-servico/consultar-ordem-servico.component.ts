import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { FormBuilder, FormGroup } from '@angular/forms';
import { VibeService } from '../../../services/vibe.service';
import { Observable, forkJoin } from 'rxjs';

// Interface para tipar os dados das ordens de serviço
interface OrdemServico {
  usuarioId?: string; // Ajustado para refletir o campo correto
  numeroOrdemDeServico?: string;
  dataEHoraInicioServico?: string;
  dataHoraCadastro?: string; // Adicionado para capturar a data de cadastro da O.S.
  empresa?: { nome: string } | null;
  statusOrdem?: string;
  observacoesReparo?: string;
}

// Interface para tipar os dados dos usuários
interface Usuario {
  usuarioId: string; // Alterado de usuarioid para usuarioId
  nome: string;
  fotoUrl?: string; // Alterado de fotourl para fotoUrl
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

  constructor(
    private fb: FormBuilder,
    private vibeService: VibeService,
    private cdr: ChangeDetectorRef
  ) {
    this.filtroForm = this.fb.group({
      dataInicio: [''],
      dataFim: [''],
      nomeEmpresa: [''],
      status: ['']
    });
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
            usuarioId: usuario.usuarioId, // Alterado de usuarioid para usuarioId
            nome: usuario.nome,
            fotoUrl: usuario.fotoUrl // Alterado de fotourl para fotoUrl
          });
        });

        console.log('Dados das ordens recebidos:', ordens);
        console.dir(ordens);
        this.ordensServico = ordens;
        this.aplicarFiltros();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erro ao carregar dados:', error);
        this.cdr.markForCheck();
      }
    });
  }

  aplicarFiltros() {
    const filtros = this.filtroForm.value;

    this.ordensServicoFiltradas = this.ordensServico.filter(os => {
      const dataInicioMatch = !filtros.dataInicio || 
        (os.dataHoraCadastro && new Date(os.dataHoraCadastro) >= new Date(filtros.dataInicio));
      
      const dataFimMatch = !filtros.dataFim || 
        (os.dataHoraCadastro && new Date(os.dataHoraCadastro) <= new Date(filtros.dataFim));
      
      const empresaMatch = !filtros.nomeEmpresa || 
        (os.empresa?.nome?.toLowerCase() || '').includes(filtros.nomeEmpresa.toLowerCase());
      
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
      nomeEmpresa: '',
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
      if (usuario?.fotoUrl) { // Alterado de fotourl para fotoUrl
        const fotoUrl = usuario.fotoUrl; // Alterado de fotourl para fotoUrl
        console.log('URL final da foto:', fotoUrl);
        return fotoUrl;
      }
    }
    console.log('Usuário não encontrado ou sem foto para colaborador:', colaborador);
    return '';
  }

  getColaboradorNome(colaborador?: string): string {
    console.log('Buscando nome para colaborador:', colaborador);
    if (colaborador && this.usuarios.has(colaborador)) {
      const usuario = this.usuarios.get(colaborador);
      console.log('Usuário encontrado:', usuario);
      return usuario?.nome || 'Colaborador Desconhecido';
    }
    console.log('Usuário não encontrado para colaborador:', colaborador);
    return colaborador || 'Colaborador Desconhecido';
  }
}