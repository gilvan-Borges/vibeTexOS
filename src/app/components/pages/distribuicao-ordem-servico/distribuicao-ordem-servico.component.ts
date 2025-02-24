// src/app/components/pages/distribuicao-ordem-servico/distribuicao-ordem-servico.component.ts
import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { OrdemServico } from '../../../interfaces/ordem-servico.interface';
import { UsuarioService } from '../../../services/usuario.service';


interface Cliente {
  id: number;
  nome: string;
  endereco: string;
}

interface Colaborador {
  id: string; // Mantém como string para UUIDs
  nome: string;
}

// Validador personalizado para impedir datas anteriores ao dia atual (permite a data atual)
function dataMinimaAtual(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: boolean } | null => {
    if (!control.value) return null;
    
    const dataSelecionada = new Date(control.value + 'T00:00:00'); // Adiciona horário zero
    const hoje = new Date();
    
    // Normaliza as datas para comparação apenas da data (sem horário)
    const dataSelecionadaStr = dataSelecionada.toISOString().split('T')[0];
    const hojeStr = hoje.toISOString().split('T')[0];
    
    console.log('Data selecionada normalizada:', dataSelecionadaStr);
    console.log('Data atual normalizada:', hojeStr);
    
    // Compara as strings das datas
    return dataSelecionadaStr >= hojeStr ? null : { 'dataAnterior': true };
  };
}

@Component({
  selector: 'app-distribuicao-ordem-servico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './distribuicao-ordem-servico.component.html',
  styleUrls: ['./distribuicao-ordem-servico.component.css']
})
export class DistribuicaoOrdemServicoComponent implements OnInit {
  serviceForm: FormGroup;
  clientes: Cliente[] = [];
  colaboradores: Colaborador[] = [];
  ordensServico: OrdemServico[] = [];
  isLoading: boolean = false;
  editandoOrdemId: number | null = null;
  minDate: string = ''; // Declaração explícita da propriedade minDate

  constructor(private fb: FormBuilder, private usuarioService: UsuarioService) {
    this.serviceForm = this.fb.group({
      codigoOS: ['', [Validators.required, Validators.minLength(3)]],
      cliente: ['', Validators.required],
      tipoServico: ['', Validators.required],
      colaborador: [''],
      data: ['', [Validators.required, dataMinimaAtual()]], // Adiciona o validador personalizado
      endereco: [{ value: '', disabled: true }, Validators.required]
    });

    this.serviceForm.get('cliente')?.valueChanges.subscribe(clienteId => {
      const clienteIdNum = Number(clienteId); // Garante que clienteId é um número
      const cliente = this.clientes.find(c => c.id === clienteIdNum);
      this.serviceForm.patchValue({ endereco: cliente ? cliente.endereco : '' });
    });
  }

  ngOnInit() {
    // Calcula a data mínima (hoje) no formato yyyy-MM-dd
    const hoje = new Date();
    this.minDate = hoje.toISOString().split('T')[0]; // Formato "yyyy-MM-dd" (ex.: "2025-02-21")
    console.log('minDate calculada:', this.minDate); // Para depuração
    this.loadClientes();
    this.loadColaboradores();
    this.carregarOrdensServico();
  }

  async loadClientes() {
    try {
      this.isLoading = true;
      this.clientes = [
        { id: 1, nome: 'Empresa ABC', endereco: 'Rua A, 123' },
        { id: 2, nome: 'Cliente XYZ', endereco: 'Av. B, 456' }
      ];
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      this.isLoading = false;
    }
  }

  loadColaboradores(): void {
    this.isLoading = true;
    this.usuarioService.carregarTodosColaboradores().subscribe({
      next: (colaboradores) => {
        this.colaboradores = colaboradores.map(colaborador => ({
          id: colaborador.id, // Mantém como string (UUID)
          nome: colaborador.nome
        }));
        console.log('Colaboradores carregados:', this.colaboradores); // Para depuração
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar colaboradores:', error);
        this.colaboradores = []; // Define como array vazio em caso de erro
        this.isLoading = false;
      }
    });
  }

  async carregarOrdensServico() {
    try {
      this.isLoading = true;
      this.ordensServico = [
        {
          id: 1,
          codigoOS: '0002',
          cliente: 'Empresa ABC',
          tipoServico: 'Pintura',
          colaborador: null,
          endereco: 'Rua A, 123',
          data: new Date('2025-02-21'),
          status: 'pendente'
        },
        {
          id: 2,
          codigoOS: '25264-155',
          cliente: 'Cliente XYZ',
          tipoServico: 'Manutenção',
          colaborador: 'ana maria',
          endereco: 'Av. B, 456',
          data: new Date('2025-02-28'),
          status: 'pendente'
        }
      ];
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSubmit() {
    console.log('Data selecionada:', this.serviceForm.get('data')?.value); // Para depuração
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      return;
    }

    const clienteId = Number(this.serviceForm.get('cliente')?.value); // Garante que clienteId é um número
    const cliente = this.clientes.find(c => c.id === clienteId);
    const colaboradorId = this.serviceForm.get('colaborador')?.value as string; // Trata como string (UUID)
    const colaboradorNome = colaboradorId ? this.colaboradores.find(c => c.id === colaboradorId)?.nome || null : null;

    const novaOuAtualizadaOrdem: OrdemServico = {
      id: this.editandoOrdemId || this.ordensServico.length + 1,
      codigoOS: this.serviceForm.get('codigoOS')?.value,
      cliente: cliente ? cliente.nome : '', // Garante que cliente é preenchido
      tipoServico: this.serviceForm.get('tipoServico')?.value,
      colaborador: colaboradorNome,
      endereco: cliente ? cliente.endereco : '', // Garante que endereco é preenchido
      data: this.serviceForm.get('data')?.value,
      status: 'pendente'
    };
    console.log('Nova/Atualizada Ordem:', novaOuAtualizadaOrdem); // Para depuração

    if (this.editandoOrdemId) {
      const index = this.ordensServico.findIndex(o => o.id === this.editandoOrdemId);
      if (index !== -1) {
        this.ordensServico[index] = novaOuAtualizadaOrdem;
        this.ordensServico = [...this.ordensServico]; // Força a atualização do binding
      }
      this.editandoOrdemId = null;
    } else {
      this.ordensServico.push(novaOuAtualizadaOrdem);
    }

    this.serviceForm.reset();
  }

  onCancel() {
    this.serviceForm.reset();
    this.editandoOrdemId = null;
  }

  atualizarOrdem(ordem: OrdemServico) {
    console.log('Atualizar:', ordem);
    const clienteId = this.clientes.find(c => c.nome === ordem.cliente)?.id;
    const colaboradorId = ordem.colaborador ? this.colaboradores.find(c => c.nome === ordem.colaborador)?.id : '';
    this.serviceForm.patchValue({
      codigoOS: ordem.codigoOS,
      cliente: clienteId,
      tipoServico: ordem.tipoServico,
      colaborador: colaboradorId,
      data: ordem.data,
      endereco: ordem.endereco
    });
    this.editandoOrdemId = ordem.id;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarOrdem(ordem: OrdemServico) {
    if (confirm('Tem certeza que deseja cancelar esta ordem de serviço?')) {
      console.log('Cancelar:', ordem);
      const index = this.ordensServico.findIndex(o => o.id === ordem.id);
      if (index !== -1) {
        this.ordensServico[index].status = 'cancelado';
        this.ordensServico = [...this.ordensServico];
      }
    }
  }

  excluirOrdem(ordem: OrdemServico) {
    if (confirm('Tem certeza que deseja excluir esta ordem de serviço?')) {
      console.log('Excluir:', ordem);
      this.ordensServico = this.ordensServico.filter(o => o.id !== ordem.id);
    }
  }

  getErrorMessage(controlName: string): string {
    const control = this.serviceForm.get(controlName);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return 'Campo obrigatório';
      if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
      if (control.errors['dataAnterior']) return 'A data não pode ser anterior ao dia atual';
    }
    return '';
  }
}