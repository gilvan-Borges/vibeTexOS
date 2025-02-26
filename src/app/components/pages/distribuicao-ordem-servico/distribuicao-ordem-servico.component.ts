import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { UsuarioService } from '../../../services/usuario.service';
import { VibeService } from '../../../services/vibe.service';
import { OrdemServico } from '../../../interfaces/ordem-servico.interface';
import { CriarOrdemDeServicoRequestDto } from '../../../models/vibe-service/criarOrdemDeServicoRequestDto';
import { CriarOrdemDeServicoResponseDto } from '../../../models/vibe-service/criarOrdemDeServicoResponseDto';

interface Cliente {
  id: string;  
  nome: string;
  endereco: string;
  enderecoCompleto?: any;
}

interface Colaborador {
  id: string; 
  nome: string;
}

// Validador para impedir datas anteriores ao dia atual
function dataMinimaAtual(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: boolean } | null => {
    if (!control.value) return null;
    
    const dataSelecionada = new Date(control.value + 'T00:00:00');
    const hoje = new Date();
    const dataSelecionadaStr = dataSelecionada.toISOString().split('T')[0];
    const hojeStr = hoje.toISOString().split('T')[0];
    
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
  ordensDoDia: OrdemServico[] = [];
  ordensAgendadas: OrdemServico[] = [];
  isLoading: boolean = false;
  editandoOrdemId: string | null = null;
  minDate: string = '';
  tipoServico: string[] = [
    'Manutenção Preventiva',
    'Manutenção Corretiva',
    'Instalação de Equipamentos'
  ];

  constructor(
    private fb: FormBuilder, 
    private usuarioService: UsuarioService,
    private vibeService: VibeService
  ) {
    // Inicializa formulário
    this.serviceForm = this.fb.group({
      codigoOS: [{value: '', disabled: true}, [Validators.required]],
      cliente: ['', Validators.required],
      tipoServico: ['', Validators.required],
      colaborador: [''],
      data: ['', [Validators.required, dataMinimaAtual()]],
      endereco: [{ value: '', disabled: true }, Validators.required],
      hora: ['', Validators.required]
    });

    // Quando o cliente muda, atualiza o campo "endereco"
    this.serviceForm.get('cliente')?.valueChanges.subscribe(clienteId => {
      const cliente = this.clientes.find(c => c.id === clienteId);
      if (cliente) {
        const enderecoCompleto = cliente.enderecoCompleto;
        const endereco = enderecoCompleto
          ? `${enderecoCompleto.logradouro}, ${enderecoCompleto.bairro}, ${enderecoCompleto.localidade} - ${enderecoCompleto.uf}, CEP: ${enderecoCompleto.cep}`
          : cliente.endereco;
        this.serviceForm.patchValue({ endereco: endereco });
      } else {
        this.serviceForm.patchValue({ endereco: '' });
      }
    });
  }

  ngOnInit() {
    // Data mínima (hoje) no formato yyyy-MM-dd
    const hoje = new Date();
    this.minDate = hoje.toISOString().split('T')[0];
    this.loadClientes();
    this.loadColaboradores();
    this.carregarOrdensServico();
  }

  // Carrega clientes
  async loadClientes() {
    try {
      this.isLoading = true;
      this.vibeService.buscarClientes().subscribe({
        next: (response) => {
          this.clientes = response.map((cliente: any) => ({
            id: cliente.clienteId,
            nome: cliente.nomeCliente,
            endereco: `${cliente.endereco.logradouro}, ${cliente.endereco.bairro}, ${cliente.endereco.localidade}`,
            enderecoCompleto: cliente.endereco
          }));
        },
        error: (error) => {
          console.error('Erro ao carregar clientes:', error);
          this.clientes = [];
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.clientes = [];
      this.isLoading = false;
    }
  }

  // Carrega colaboradores
  loadColaboradores(): void {
    this.isLoading = true;
    this.usuarioService.carregarTodosColaboradores().subscribe({
      next: (colaboradores) => {
        this.colaboradores = colaboradores.map(colaborador => ({
          id: colaborador.id,
          nome: colaborador.nome
        }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erro ao carregar colaboradores:', error);
        this.colaboradores = [];
        this.isLoading = false;
      }
    });
  }

  // Carrega ordens de serviço e filtra apenas as que têm "ativo = true"
  async carregarOrdensServico() {
    try {
      this.isLoading = true;
      this.vibeService.buscarOrdemServico().subscribe({
        next: (response: any[]) => {
          // Filtra somente as ordens ativas
          const ordensAtivas = response;
  
          // Mapeia para o seu formato interno
          this.ordensServico = ordensAtivas.map(ordem => {
            let colaboradorNome = 'Não atribuído';
            if (ordem.usuarioId && this.colaboradores.length > 0) {
              const colaborador = this.colaboradores.find(c => c.id === ordem.usuarioId);
              colaboradorNome = colaborador ? colaborador.nome : 'Não atribuído';
            }
            return {
              id: ordem.id || undefined,
              ordemDeServicoId: ordem.ordemDeServicoId,
              numeroOrdemDeServico: ordem.numeroOrdemDeServico,
              codigoOS: ordem.numeroOrdemDeServico,
              cliente: ordem.cliente?.nomeCliente || 'Cliente não identificado',
              clienteId: ordem.clienteId,
              tipoServico: ordem.tipoServico,
              dataHoraCadastro: ordem.dataHoraCadastro,
              status: ordem.statusOrdem,
              endereco: ordem.cliente?.endereco 
                ? `${ordem.cliente.endereco.logradouro}, ${ordem.cliente.endereco.bairro}`
                : 'Endereço não disponível',
              usuarioId: ordem.usuarioId,
              colaborador: colaboradorNome,
              // Se quiser marcar atribuída como true quando tem colaborador:
              atribuida: ordem.atribuida === true || !!ordem.usuarioId
            };
          });
  
          // Aqui entra a nova forma de filtrar pela data
          const hojeStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  
          // Ordens de hoje
          this.ordensDoDia = this.ordensServico.filter(ordem => {
            if (!ordem.dataHoraCadastro) return false;
            const dataOrdemStr = new Date(ordem.dataHoraCadastro).toISOString().slice(0, 10);
            return dataOrdemStr === hojeStr; // igual ao dia de hoje
          });
  
          // Ordens agendadas (futuras)
          this.ordensAgendadas = this.ordensServico.filter(ordem => {
            if (!ordem.dataHoraCadastro) return false;
            const dataOrdemStr = new Date(ordem.dataHoraCadastro).toISOString().slice(0, 10);
            return dataOrdemStr > hojeStr; // depois de hoje
          });
  
          console.log('Ordens do dia:', this.ordensDoDia);
          console.log('Ordens agendadas:', this.ordensAgendadas);
  
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erro ao carregar ordens:', error);
          this.ordensServico = [];
          this.ordensDoDia = [];
          this.ordensAgendadas = [];
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
    } finally {
      this.isLoading = false;
    }
  }
  

  // Criação de nova ordem
  onSubmit() {
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      return;
    }
  
    const clienteId = this.serviceForm.get('cliente')?.value;
    const tipoServico = this.serviceForm.get('tipoServico')?.value;
    const colaboradorId = this.serviceForm.get('colaborador')?.value;
    const data = this.serviceForm.get('data')?.value;
    const hora = this.serviceForm.get('hora')?.value;
    const dataHora = `${data}T${hora}:00.000Z`;
  
    // Cria o objeto de requisição
    const requestData: CriarOrdemDeServicoRequestDto = {
      tipoServico: tipoServico,
      dataHoraCadastro: dataHora
    };
  
    if (this.editandoOrdemId) {
      // Modo de edição: atualiza a ordem existente
      this.vibeService.atualizarOrdemServico(this.editandoOrdemId, requestData).subscribe({
        next: (response) => {
          if (colaboradorId) {
            this.vibeService.atualizarOrdemServicoDespacho(response.ordemDeServicoId, colaboradorId).subscribe({
              next: () => this.resetFormAndRefresh(),
              error: (err) => {
                console.error('Erro ao despachar ordem:', err);
                this.resetFormAndRefresh();
              }
            });
          } else {
            this.resetFormAndRefresh();
          }
        },
        error: (error) => {
          console.error('Erro ao atualizar ordem de serviço:', error);
        }
      });
    } else {
      // Modo de criação: cria uma nova ordem de serviço
      this.vibeService.cadastrarOrdemServico(clienteId, requestData).subscribe({
        next: (response: CriarOrdemDeServicoResponseDto) => {
          if (colaboradorId) {
            this.vibeService.atualizarOrdemServicoDespacho(response.ordemDeServicoId, colaboradorId).subscribe({
              next: () => this.resetFormAndRefresh(),
              error: (err) => {
                console.error('Erro ao despachar ordem:', err);
                this.resetFormAndRefresh();
              }
            });
          } else {
            this.resetFormAndRefresh();
          }
        },
        error: (error) => {
          console.error('Erro ao criar ordem de serviço:', error);
        }
      });
    }
  }
  

  // Cancelar (resetar) o form
  onCancel() {
    this.serviceForm.reset();
    this.editandoOrdemId = null;
    this.serviceForm.get('codigoOS')?.disable();
  }

  atualizarOrdem(ordem: OrdemServico) {
    // Obtenha o ID da ordem
    const ordemDeServicoId = ordem.ordemDeServicoId;
  
    // Leia os novos valores do formulário
    const novoTipoServico = this.serviceForm.get('tipoServico')?.value;
    const novaData = this.serviceForm.get('data')?.value;
    const novaHora = this.serviceForm.get('hora')?.value;
    const novaDataHoraCadastro = `${novaData}T${novaHora}:00.000Z`;
  
    // Monte o objeto de requisição com os dados atualizados
    const requestData: CriarOrdemDeServicoRequestDto = {
      tipoServico: novoTipoServico,
      dataHoraCadastro: novaDataHoraCadastro
    };
  
    // Chama o endpoint de atualização (PUT)
    this.vibeService.atualizarOrdemServico(ordemDeServicoId, requestData)
      .subscribe({
        next: (response: CriarOrdemDeServicoResponseDto) => {
          console.log('Ordem atualizada com sucesso:', response);
  
          // Atualize os campos do formulário com os dados retornados
          this.serviceForm.patchValue({
            codigoOS: response.numeroOrdemDeServico,
            cliente: response.clienteId,
            tipoServico: response.tipoServico,
            data: response.dataHoraCadastro.split('T')[0],
            hora: response.dataHoraCadastro.split('T')[1].substring(0, 5),
            // Se houver outros campos para atualizar, inclua-os aqui
          });
  
          // Atualize o estado de edição, se necessário
          this.editandoOrdemId = response.ordemDeServicoId;
  
          // Opcional: role para o topo ou recarregue a lista de ordens
          window.scrollTo({ top: 0, behavior: 'smooth' });
          // this.carregarOrdensServico(); // se desejar atualizar a lista
        },
        error: (error) => {
          console.error('Erro ao atualizar ordem:', error);
        }
      });
  }
  
  editarOrdem(ordem: OrdemServico) {
    // Habilita o campo 'codigoOS', se necessário
    this.serviceForm.get('codigoOS')?.enable();
  
    // Preenche o formulário com os dados da ordem
    this.serviceForm.patchValue({
      codigoOS: ordem.numeroOrdemDeServico,
      cliente: ordem.clienteId,
      tipoServico: ordem.tipoServico,
      colaborador: ordem.usuarioId || '', // Se não houver colaborador, deixa em branco
      // Verifica se dataHoraCadastro existe e está no formato ISO esperado
      data: ordem.dataHoraCadastro ? ordem.dataHoraCadastro.split('T')[0] : '',
      hora: ordem.dataHoraCadastro && ordem.dataHoraCadastro.split('T')[1] 
              ? ordem.dataHoraCadastro.split('T')[1].substring(0, 5) 
              : '',
      endereco: ordem.endereco
    });
  
    // Define qual ordem está sendo editada
    this.editandoOrdemId = ordem.ordemDeServicoId;
  
    // Role para o topo para que o usuário veja o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  

  // Cancelar ordem localmente (mudar status para 'cancelado') -- apenas exemplo
  cancelarOrdem(ordem: OrdemServico) {
    if (confirm('Tem certeza que deseja cancelar esta ordem de serviço?')) {
      const index = this.ordensServico.findIndex(o => o.id === ordem.id);
      if (index !== -1) {
        this.ordensServico[index].status = 'cancelado';
      }
      // Recarrega para refletir no front (se a API não persistir esse status, ele voltará ao recarregar)
      this.carregarOrdensServico();
    }
  }

  // Excluir (inativar) chamando o endpoint
  excluirOrdem(ordem: OrdemServico) {
    if (confirm('Tem certeza que deseja excluir esta ordem de serviço?')) {
      this.vibeService.deletarOrdemServico(ordem.ordemDeServicoId).subscribe({
        next: (response) => {
          console.log('Ordem inativada/excluída:', response);
          // Após inativar, recarrega a listagem (somente "ativo = true" virá)
          this.carregarOrdensServico();
        },
        error: (error) => {
          console.error('Erro ao excluir ordem de serviço:', error);
        }
      });
    }
  }

  // Reseta o form e recarrega
  private resetFormAndRefresh() {
    this.serviceForm.reset();
    this.editandoOrdemId = null;
    this.serviceForm.get('codigoOS')?.disable();
    this.carregarOrdensServico();
  }

  // Mensagens de erro
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
