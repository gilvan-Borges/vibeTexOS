import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
    private vibeService: VibeService,
    private cdr: ChangeDetectorRef // Adiciona ChangeDetectorRef
  ) {
    // Inicializa formulário
    this.serviceForm = this.fb.group({
      codigoOS: [{ value: '', disabled: true }, [Validators.required]],
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
  // Dentro do método carregarOrdensServico
  carregarOrdensServico() {
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
            } else {
              colaboradorNome = 'Não atribuído';
            }

            // Valida e formata dataHoraCadastro
            let dataHoraCadastroFormatada: string = '';
            if (ordem.dataHoraCadastro) {
              const dataHora = new Date(ordem.dataHoraCadastro);
              if (!isNaN(dataHora.getTime())) {
                dataHoraCadastroFormatada = dataHora.toISOString();
              }
            }

            return {
              id: ordem.id || undefined,
              ordemDeServicoId: ordem.ordemDeServicoId,
              numeroOrdemDeServico: ordem.numeroOrdemDeServico,
              codigoOS: ordem.numeroOrdemDeServico,
              cliente: ordem.cliente?.nomeCliente || 'Cliente não identificado',
              clienteId: ordem.clienteId,
              tipoServico: ordem.tipoServico,
              dataHoraCadastro: dataHoraCadastroFormatada,
              status: ordem.statusOrdem,
              endereco: ordem.cliente?.endereco
                ? `${ordem.cliente.endereco.logradouro}, ${ordem.cliente.endereco.bairro}`
                : 'Endereço não disponível',
              usuarioId: ordem.usuarioId,
              colaborador: colaboradorNome, // Pode ser null ou o nome do colaborador
              atribuida: ordem.atribuida === true || !!ordem.usuarioId
            };
          });

          // Filtra ordens com data válida
          this.ordensServico = this.ordensServico.filter(ordem => ordem.dataHoraCadastro);

          // Filtra ordens do dia e agendadas
          const hojeStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

          // Ordens de hoje
          this.ordensDoDia = this.ordensServico.filter(ordem => {
            if (!ordem.dataHoraCadastro) return false;
            const dataOrdemStr = new Date(ordem.dataHoraCadastro).toISOString().slice(0, 10);
            return dataOrdemStr === hojeStr;
          });

          // Ordens agendadas (futuras)
          this.ordensAgendadas = this.ordensServico.filter(ordem => {
            if (!ordem.dataHoraCadastro) return false;
            const dataOrdemStr = new Date(ordem.dataHoraCadastro).toISOString().slice(0, 10);
            return dataOrdemStr > hojeStr;
          });

          // Depuração para verificar o valor de colaborador
          this.ordensDoDia.forEach(ordem => {
            console.log(`Ordem ${ordem.codigoOS}: colaborador = ${ordem.colaborador}, !colaborador = ${!ordem.colaborador}`);
          });

          console.log('Ordens do dia:', this.ordensDoDia);
          console.log('Ordens agendadas:', this.ordensAgendadas);

          // Força a detecção de mudanças
          this.cdr.detectChanges();

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

  onSubmit() {
    if (this.serviceForm.invalid) {
      this.serviceForm.markAllAsTouched();
      console.log('Formulário inválido:', this.serviceForm.errors);
      return;
    }

    const clienteId = this.serviceForm.get('cliente')?.value;
    const tipoServico = this.serviceForm.get('tipoServico')?.value;
    const colaboradorId = this.serviceForm.get('colaborador')?.value;
    const data = this.serviceForm.get('data')?.value;
    const hora = this.serviceForm.get('hora')?.value;
    const dataHora = `${data}T${hora}:00.000Z`;

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
              next: (despachoResponse) => {
                this.salvarNoLocalStorage(response.ordemDeServicoId, despachoResponse.despachoId || 'ID_Despacho_Gerado');
                this.resetFormAndRefresh();
              },
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
              next: (despachoResponse) => {
                this.salvarNoLocalStorage(response.ordemDeServicoId, despachoResponse.despachoId || 'ID_Despacho_Gerado');
                this.resetFormAndRefresh();
              },
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

  // Novo método para salvar no localStorage
  private salvarNoLocalStorage(ordemServicoId: string, despachoId: string) {
    const despachoData = {
      ordemServicoId: ordemServicoId,
      despachoId: despachoId,
      timestamp: new Date().toISOString() // Opcional: para rastrear quando foi salvo
    };

    // Salva no localStorage (pode sobrescrever ou adicionar em uma lista, dependendo do que você quer)
    localStorage.setItem('ultimoDespacho', JSON.stringify(despachoData));
    console.log('Dados salvos no localStorage:', despachoData);
  }

  normalizeStatus(status: string): string {
    const normalized = status
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

    // Handle EmAndamento specifically
    if (normalized === 'emandamento') {
      return 'emandamento';
    }

    return normalized;
  }

  // Cancelar (resetar) o form
  onCancel() {
    this.serviceForm.reset();
    this.editandoOrdemId = null;
    this.serviceForm.get('codigoOS')?.disable();
  }

  atualizarOrdem(ordem: OrdemServico) {
    const novoTipoServico = this.serviceForm.get('tipoServico')?.value;
    const novaData = this.serviceForm.get('data')?.value;
    const novaHora = this.serviceForm.get('hora')?.value;

    let novaDataHoraCadastro: string;
    if (novaData && novaHora) {
      const dataHora = new Date(`${novaData}T${novaHora}:00.000Z`);
      novaDataHoraCadastro = !isNaN(dataHora.getTime()) && novaData !== "0001-01-01"
        ? dataHora.toISOString()
        : new Date().toISOString();
    } else {
      novaDataHoraCadastro = new Date().toISOString();
    }

    const requestData: CriarOrdemDeServicoRequestDto = {
      tipoServico: novoTipoServico,
      dataHoraCadastro: novaDataHoraCadastro
    };

    console.log('Payload enviado para atualização:', requestData);

    this.vibeService.atualizarOrdemServico(ordem.ordemDeServicoId, requestData)
      .subscribe({
        next: (response: CriarOrdemDeServicoResponseDto) => {
          console.log('Ordem atualizada com sucesso:', response);
          this.serviceForm.patchValue({
            codigoOS: response.numeroOrdemDeServico,
            cliente: response.clienteId,
            tipoServico: response.tipoServico,
            data: response.dataHoraCadastro?.split('T')[0],
            hora: response.dataHoraCadastro?.split('T')[1].substring(0, 5),
          });
          this.editandoOrdemId = response.ordemDeServicoId;
          this.carregarOrdensServico();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (error) => {
          console.error('Erro ao atualizar ordem:', error);
        }
      });
  }

  editarOrdem(ordem: OrdemServico) {
    // Habilita o campo 'codigoOS', se necessário
    this.serviceForm.get('codigoOS')?.enable();

    // Formata a data e hora corretamente
    let dataFormatada = '';
    let horaFormatada = '';

    // Verifica se a data é válida
    if (ordem.dataHoraCadastro && ordem.dataHoraCadastro !== "0001-01-01T00:00:00") {
      const dataHora = new Date(ordem.dataHoraCadastro);
      if (!isNaN(dataHora.getTime())) {
        dataFormatada = dataHora.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        horaFormatada = dataHora.toISOString().split('T')[1].substring(0, 5); // Formato HH:mm
      }
    }

    // Se a data não for válida, usa a data atual como padrão
    if (!dataFormatada) {
      const hoje = new Date();
      dataFormatada = hoje.toISOString().split('T')[0];
      horaFormatada = hoje.toISOString().split('T')[1].substring(0, 5);
      console.warn('Data inválida ou ausente na ordem, usando data atual como padrão:', {
        dataFormatada,
        horaFormatada,
        dataHoraCadastroOriginal: ordem.dataHoraCadastro
      });
    }

    // Preenche o formulário com os dados da ordem
    this.serviceForm.patchValue({
      codigoOS: ordem.numeroOrdemDeServico,
      cliente: ordem.clienteId,
      tipoServico: ordem.tipoServico,
      colaborador: ordem.usuarioId || '',
      data: dataFormatada,
      hora: horaFormatada,
      endereco: ordem.endereco
    });

    // Define qual ordem está sendo editada
    this.editandoOrdemId = ordem.ordemDeServicoId;

    // Log para depuração
    console.log('Formulário preenchido com valores:', this.serviceForm.value);

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

  excluirOrdem(ordem: OrdemServico) {
    if (confirm('Tem certeza que deseja excluir esta ordem de serviço?')) {
      this.isLoading = true;
      this.vibeService.deletarOrdemServico(ordem.ordemDeServicoId).subscribe({
        next: (response) => {
          // Recarrega a lista de ordens para refletir a exclusão
          this.carregarOrdensServico();
          console.log('Ordem excluída com sucesso', response);
          alert('Ordem de serviço excluída com sucesso!');
          // Rola para o topo após a exclusão
          window.scrollTo({ top: 0, behavior: 'smooth' });
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erro ao excluir ordem de serviço:', error);
          alert('Erro ao excluir ordem de serviço!');
          this.isLoading = false;
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