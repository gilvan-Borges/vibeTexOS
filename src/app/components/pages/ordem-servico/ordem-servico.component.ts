import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RegistroExpedienteService } from '../../../services/registro-expediente.service';
import { VibeService } from '../../../services/vibe.service';
import { CriarOrdemDeServicoResponseDto } from '../../../models/vibe-service/criarOrdemDeServicoResponseDto';
import { EnderecoDto } from '../../../models/vibe-service/EnderecoDto';
import { IniciarTrajetoRequestDto } from '../../../models/vibe-service/iniciarTrajetoRequestDto';
import { IniciarTrajetoResponseDto } from '../../../models/vibe-service/iniciarTrajetoResponseDto';
import { tap, catchError } from 'rxjs/operators';
import { OrdemServicoService } from '../../../services/ordemServico.service';
import { throwError } from 'rxjs';

export interface OrdemServico {
  id?: string;
  ordemDeServicoId: string;
  despachoId?: string;
  numeroOrdemDeServico: string;
  codigoOS: string;
  cliente: string;
  clienteId: string;
  tipoServico: string;
  dataHoraCadastro: string;
  status: string;
  statusOrdem?: string; // Adicionado para compatibilidade
  endereco: string;
  usuarioId: string;
  colaborador: string;
  atribuida: boolean;
  clienteData?: any; 
  observacoesReparo?: string;
  dataEHoraInicioServico?: string | null;
  dataEHoraFimServico?: string | null;
  execucoes: any[]; // Adicionado para suportar a lista de execuções
  botaoDesativado: boolean; // Adicionado para controlar o botão
}

@Component({
  selector: 'app-ordem-servico',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ordem-servico.component.html',
  styleUrls: ['./ordem-servico.component.css'],
})
export class OrdemServicoComponent implements OnInit {
  ordensFiltradas: OrdemServico[] = [];
  ordensAndamento: OrdemServico[] = [];
  statusOrdem: string = 'Pendente';
  pausaAtiva: boolean = false;
  usuarioId: string | null = null;
  mostrarAndamento: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private registroExpediente: RegistroExpedienteService,
    private vibeService: VibeService,
    private ordemServicoService: OrdemServicoService,
    private cdr: ChangeDetectorRef
  ) {
    this.registroExpediente.tempoRestantePausa$.subscribe((minutos: number) => {
      this.pausaAtiva = minutos > 0;
      console.log('Pausa ativa atualizada:', this.pausaAtiva);
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const urlSegments = this.route.snapshot.url.map(segment => segment.path);
      console.log('Segmentos da URL:', urlSegments);

      if (urlSegments.includes('emAndamento')) {
        this.statusOrdem = 'EmAndamento';
      } else if (urlSegments.includes('pendentes')) {
        this.statusOrdem = 'Pendente';
      } else if (urlSegments.includes('realizadas')) {
        this.statusOrdem = 'Concluído';
      } else if (urlSegments.includes('canceladas')) {
        this.statusOrdem = 'Cancelado';
      } else {
        console.warn('Rota não reconhecida, usando status padrão:', urlSegments);
        this.statusOrdem = 'Pendente';
      }

      this.usuarioId = params.get('usuarioId') || localStorage.getItem('usuarioId') || '';
      console.log('UsuarioId extraído:', this.usuarioId, 'para statusOrdem:', this.statusOrdem);

      if (!this.usuarioId) {
        console.error('UsuarioId não encontrado na rota ou no localStorage');
        return;
      }

      // Verificar O.S. em andamento apenas para atualizar o estado, sem redirecionamento
      this.verificarOrdemEmAndamentoNaAPI();

      this.carregarOrdens();
    });

    setInterval(() => {
      if (this.usuarioId) {
        console.log('Atualização automática de ordens para usuarioId:', this.usuarioId);
        this.carregarOrdens();
      }
    }, 30000);
  }

  carregarOrdens(): void {
    if (!this.usuarioId) {
      console.error('ID do usuário não encontrado');
      return;
    }

    // Carregar ordens reabertas do localStorage
    const ordensReabertasStr = localStorage.getItem('ordensReabertas') || '[]';
    const ordensReabertas = JSON.parse(ordensReabertasStr);

    console.log('Carregando ordens para status:', this.statusOrdem, 'e usuarioId:', this.usuarioId);

    this.vibeService.buscarOrdemServicoUsuarioId(this.usuarioId).subscribe({
      next: (response: CriarOrdemDeServicoResponseDto[]) => {
        console.log('Ordens retornadas do backend:', response);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        console.log('Data atual (hoje):', hoje);

        const todasOrdens = response.map((ordem) => ({
          ordemDeServicoId: ordem.ordemDeServicoId,
          usuarioId: ordem.usuarioId || '',
          clienteId: ordem.clienteId || '',
          tipoServico: ordem.tipoServico || '',
          statusOrdem: ordem.statusOrdem || '',
          numeroOrdemDeServico: ordem.numeroOrdemDeServico || '',
          atribuida: ordem.atribuida === true,
          observacoesReparo: ordem.observacoesReparo || '',
          dataEHoraInicioServico: ordem.dataEHoraInicioServico || null,
          dataEHoraFimServico: ordem.dataEHoraFimServico || null,
          dataHoraCadastro: ordem.dataHoraCadastro || '',
          clienteData: null,
          despachoId: ordem.despachoId,
          codigoOS: ordem.codigoOS || '',
          cliente: ordem.cliente || '',
          endereco: ordem.endereco || '',
          colaborador: ordem.colaborador || '',
          status: ordem.statusOrdem || '',
          execucoes: ordem.execucoes || [],
          botaoDesativado: ordensReabertas.includes(ordem.ordemDeServicoId) || 
                          (ordem.numeroOrdemDeServico && ordem.numeroOrdemDeServico.endsWith('.1')),
        }));

        this.ordensAndamento = todasOrdens.filter(
          (ordem) => ordem.statusOrdem === 'EmAndamento' && ordem.usuarioId === this.usuarioId
        );
        console.log('OrdensAndamento após filtragem:', this.ordensAndamento);

        if (this.statusOrdem === 'Concluído') {
          this.ordensFiltradas = todasOrdens.filter((ordem) => {
            const statusConcluido = ordem.statusOrdem === 'Concluído';
            const usuarioCorreto = ordem.usuarioId === this.usuarioId;
            const naoEmAndamento = ordem.statusOrdem !== 'EmAndamento';

            if (statusConcluido && usuarioCorreto && naoEmAndamento) {
              if (ordem.dataHoraCadastro) {
                const dataCadastro = new Date(ordem.dataHoraCadastro);
                if (!isNaN(dataCadastro.getTime())) {
                  const dataCadastroSemHora = new Date(dataCadastro);
                  dataCadastroSemHora.setHours(0, 0, 0, 0);
                  return dataCadastroSemHora.getTime() === hoje.getTime();
                }
              }
            }
            return false;
          });
          console.log(`Encontradas ${this.ordensFiltradas.length} ordens concluídas hoje`);
        } else if (this.statusOrdem === 'Pendente') {
          this.ordensFiltradas = todasOrdens.filter((ordem) => {
            const statusPendente = ordem.statusOrdem === 'Pendente';
            const usuarioCorreto = ordem.usuarioId === this.usuarioId;
            const atribuida = ordem.atribuida === true;
            const naoEmAndamento = ordem.statusOrdem !== 'EmAndamento';

            if (statusPendente && usuarioCorreto && atribuida && naoEmAndamento && ordem.dataHoraCadastro) {
              const dataCadastro = new Date(ordem.dataHoraCadastro);
              if (!isNaN(dataCadastro.getTime())) {
                const dataCadastroSemHora = new Date(dataCadastro);
                dataCadastroSemHora.setHours(0, 0, 0, 0);
                return dataCadastroSemHora.getTime() === hoje.getTime();
              }
            }
            return false;
          });
          console.log(`Encontradas ${this.ordensFiltradas.length} ordens pendentes para hoje`);
        } else if (this.statusOrdem === 'EmAndamento') {
          this.ordensFiltradas = this.ordensAndamento;
          console.log('OrdensFiltradas definidas como ordensAndamento:', this.ordensFiltradas);
        } else if (this.statusOrdem === 'Cancelado') {
          this.ordensFiltradas = todasOrdens.filter((ordem) => {
            const statusCancelado = ordem.statusOrdem === 'Cancelado';
            const usuarioCorreto = ordem.usuarioId === this.usuarioId;
            const naoEmAndamento = ordem.statusOrdem !== 'EmAndamento';

            if (statusCancelado && usuarioCorreto && naoEmAndamento) {
              // Verifica se o número da ordem termina com .1
              if (ordem.numeroOrdemDeServico && ordem.numeroOrdemDeServico.endsWith('.1')) {
                ordem.botaoDesativado = true;
              } else {
                ordem.botaoDesativado = ordensReabertas.includes(ordem.ordemDeServicoId);
              }
              
              // Continua com a lógica existente
              if (ordem.dataHoraCadastro) {
                const dataCadastro = new Date(ordem.dataHoraCadastro);
                if (!isNaN(dataCadastro.getTime())) {
                  const dataCadastroSemHora = new Date(dataCadastro);
                  dataCadastroSemHora.setHours(0, 0, 0, 0);
                  ordem.botaoDesativado = ordensReabertas.includes(ordem.ordemDeServicoId);
                  return dataCadastroSemHora.getTime() === hoje.getTime();
                }
              }
            }
            return false;
          });
          
          // Aplicar verificação adicional para versões
          this.verificarOrdensComVersao(this.ordensFiltradas);
          
          console.log(`Encontradas ${this.ordensFiltradas.length} ordens canceladas hoje`);
        } else {
          console.warn('StatusOrdem não reconhecido:', this.statusOrdem);
          this.ordensFiltradas = [];
        }

        const buscarDadosCliente = (ordens: OrdemServico[]): void => {
          ordens.forEach((ordem) => {
            if (ordem.clienteId) {
              this.vibeService.buscarClientesPorId(ordem.clienteId).subscribe({
                next: (clienteData) => {
                  ordem.clienteData = clienteData;
                  console.log(`Dados do cliente carregados para ordem ${ordem.ordemDeServicoId}:`, clienteData);
                },
                error: (error) => {
                  console.error('Erro ao carregar dados do cliente:', error);
                },
              });
            }
          });
        };

        buscarDadosCliente(this.ordensFiltradas);
        buscarDadosCliente(this.ordensAndamento);

        console.log('OrdensFiltradas finais:', this.ordensFiltradas);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erro ao carregar ordens:', error);
      },
    });
  }
  // Método para verificar ordens com versão .1
  verificarOrdensComVersao(ordens: any[]): void {
    ordens.forEach((ordem) => {
      if (ordem.numeroOrdemDeServico && ordem.numeroOrdemDeServico.endsWith('.1')) {
        ordem.botaoDesativado = true;
        console.log(`Botão desativado para ordem ${ordem.numeroOrdemDeServico} (termina com .1)`);
        return;
      }
      
      const numeroOriginal = ordem.numeroOrdemDeServico?.replace(/\.\d+$/, ''); // Remove .1, .2, etc.
      const temVersao = ordens.some(
        (outraOrdem) =>
          outraOrdem.numeroOrdemDeServico === `${numeroOriginal}.1` &&
          outraOrdem.ordemDeServicoId !== ordem.ordemDeServicoId
      );
      if (temVersao) {
        ordem.botaoDesativado = true;
        console.log(`Botão desativado para ordem ${ordem.numeroOrdemDeServico} (tem versão .1)`);
      }
    });
  }

reabrirOrdemServico(os: OrdemServico): void {
    if (!os.ordemDeServicoId || !this.usuarioId || os.botaoDesativado) {
      console.error('ID da ordem de serviço ou usuário não encontrado, ou botão desativado');
      return;
    }

    // Desabilitar o botão imediatamente para evitar cliques duplos
    os.botaoDesativado = true;
    
    // Salvar no localStorage para manter o botão desabilitado mesmo após recarga
    const ordensReabertasStr = localStorage.getItem('ordensReabertas') || '[]';
    const ordensReabertas = JSON.parse(ordensReabertasStr);
    ordensReabertas.push(os.ordemDeServicoId);
    localStorage.setItem('ordensReabertas', JSON.stringify(ordensReabertas));

    console.log('Estado inicial de osEmAndamento:', localStorage.getItem('osEmAndamento'));
    console.log('Ordem adicionada às ordens reabertas:', os.ordemDeServicoId);

    // Passo 1: Buscar todas as ordens de serviço do usuário
    this.vibeService.buscarOrdemServicoUsuarioId(this.usuarioId).subscribe({
      next: (ordens: any[]) => {
        // Passo 2: Filtrar a ordem específica pelo ordemDeServicoId
        const ordemEncontrada = ordens.find(
          (ordem) => ordem.ordemDeServicoId === os.ordemDeServicoId
        );

        if (!ordemEncontrada) {
          console.error('Ordem de serviço não encontrada para o ID:', os.ordemDeServicoId);
          alert('Ordem de serviço não encontrada. Contate o suporte.');
          return;
        }

        // Passo 3: Obter o execucaoServicoId da execução mais recente
        let execucaoServicoId: string | undefined;
        if (ordemEncontrada.execucoes && ordemEncontrada.execucoes.length > 0) {
          execucaoServicoId = ordemEncontrada.execucoes[0].execucaoServicoId;
        } else {
          console.error('Nenhuma execução encontrada para a ordem:', os.ordemDeServicoId);
          alert('Nenhuma execução associada à ordem. Contate o suporte.');
          return;
        }

        if (!execucaoServicoId) {
          console.error('execucaoServicoId não encontrado para a ordem:', os.ordemDeServicoId);
          alert('Não foi possível encontrar a execução do serviço. Contate o suporte.');
          return;
        }

        console.log('execucaoServicoId obtido do backend:', execucaoServicoId);
        this.prosseguirComReabertura(execucaoServicoId, os, ordemEncontrada);
      },
      error: (error) => {
        console.error('Erro ao buscar ordens de serviço:', error);
        alert('Erro ao buscar as ordens de serviço no backend. Contate o suporte.');
      },
    });
  }

  private prosseguirComReabertura(execucaoServicoId: string, os: OrdemServico, ordemApi: any): void {
    // Passo 2: Obter as coordenadas atuais
    this.obterLocalizacaoAtual()
      .then((position: GeolocationPosition) => {
        if (!position?.coords?.latitude || !position?.coords?.longitude) {
          throw new Error('Coordenadas inválidas');
        }

        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        // Passo 3: Criar o FormData com as coordenadas e outros dados necessários
        const formData = new FormData();
        formData.append('latitudeReinicioExecucao', latitude);
        formData.append('longitudeReinicioExecucao', longitude);
        formData.append('ordemDeServicoId', os.ordemDeServicoId); // Adicionar ordemDeServicoId
        formData.append('despachoId', ordemApi.despachoId || ''); // Adicionar despachoId (pode ser null)

        // Passo 4: Chamar o endpoint reiniciarExecucaoServico para criar uma nova execução
        this.vibeService
          .reiniciarExecucaoServico(execucaoServicoId, this.usuarioId!, formData)
          .subscribe({
            next: (response) => {
              console.log('Nova execução criada com sucesso:', response);

              // Não atualizamos o status da ordem original para "Em Andamento"
              // A nova execução será tratada como "Em Andamento" pela API

              // Atualizar o localStorage com a ordem em andamento
              localStorage.setItem('osEmAndamento', 'true');
              localStorage.setItem('ordemServicoId', os.ordemDeServicoId);

              // Recarregar as ordens para refletir a nova execução
              this.carregarOrdens();

              console.log('Estado final de osEmAndamento:', localStorage.getItem('osEmAndamento'));

              // Navegar para a tela de ordens em andamento
              this.router.navigate([`/pages/ordem-servico/emAndamento/${this.usuarioId}`]);
            },
            error: (error) => {
              console.error('Erro ao reiniciar execução do serviço:', error);
              alert('Erro ao reiniciar o serviço. Verifique os dados ou contate o suporte.');
            },
          });
      })
      .catch((error) => {
        console.error('Erro ao obter localização:', error);
        alert(
          'Não foi possível obter sua localização. Por favor, verifique se o GPS está ativado.'
        );
      });
  }

  private obterLocalizacaoAtual(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    });
  }

  iniciarOrdemServico(ordem: OrdemServico): void {
    if (this.pausaAtiva) {
      alert('Não é possível iniciar ordem durante uma pausa ativa');
      return;
    }

    if (!ordem.ordemDeServicoId || !ordem.despachoId) {
      alert('ID da Ordem de Serviço ou Despacho não fornecido');
      return;
    }

    const updateData = {
      numeroOrdemDeServico: ordem.numeroOrdemDeServico || '',
      clienteId: ordem.clienteId || '',
      tipoServico: ordem.tipoServico || '',
      statusOrdem: 'EmAndamento',
      observacoesReparo: ordem.observacoesReparo || '',
      dataEHoraInicioServico: new Date().toISOString(),
      dataEHoraFimServico: ordem.dataEHoraFimServico || null,
    };

    this.vibeService
      .atualizarOrdemServico(ordem.ordemDeServicoId, updateData)
      .pipe(
        tap((response) => {
          console.log('Status da ordem atualizado para EmAndamento:', response);
          ordem.statusOrdem = 'EmAndamento';
        }),
        catchError((error) => {
          console.error('Erro ao atualizar status da ordem:', error);
          alert('Erro ao atualizar status da ordem de serviço');
          return throwError(() => error);
        })
      )
      .subscribe(() => {
        this.obterLocalizacaoAtual()
          .then((position: GeolocationPosition) => {
            if (!position?.coords?.latitude || !position?.coords?.longitude) {
              throw new Error('Coordenadas inválidas');
            }

            const latitude = position.coords.latitude.toFixed(6);
            const longitude = position.coords.longitude.toFixed(6);

            const request: IniciarTrajetoRequestDto = {
              latitudeInicioTrajeto: latitude,
              longitudeInicioTrajeto: longitude,
            };

            console.log('Iniciando trajeto com dados:', {
              ordemDeServicoId: ordem.ordemDeServicoId,
              despachoId: ordem.despachoId,
              usuarioId: this.usuarioId,
              request,
            });

            this.vibeService
              .iniciarTrajeto(ordem.despachoId!, this.usuarioId!, request)
              .pipe(
                tap((response) => {
                  console.log('Resposta do serviço iniciarTrajeto:', response);
                  if (!response) {
                    throw new Error('Resposta vazia do servidor');
                  }
                }),
                catchError((error) => {
                  console.error('Erro detalhado ao iniciar trajeto:', error);
                  let mensagem = 'Erro ao iniciar trajeto: ';
                  if (error.status === 400) {
                    mensagem += error.error?.message || 'Dados inválidos fornecidos';
                  } else if (error.status === 404) {
                    mensagem += 'Ordem de serviço ou usuário não encontrado';
                  } else {
                    mensagem += error.message || 'Erro na comunicação com o servidor';
                  }
                  alert(mensagem);
                  return throwError(() => error);
                })
              )
              .subscribe({
                next: (response: IniciarTrajetoResponseDto) => {
                  console.log('Trajeto iniciado com sucesso:', response);
                  if (!response?.trajetoId) {
                    throw new Error('TrajetoId não recebido na resposta');
                  }

                  const latitudeInicio = request.latitudeInicioTrajeto || '';
                  const longitudeInicio = request.longitudeInicioTrajeto || '';

                  localStorage.setItem('trajetoId', response.trajetoId);
                  localStorage.setItem('latitudeInicioTrajeto', latitudeInicio);
                  localStorage.setItem('longitudeInicioTrajeto', longitudeInicio);
                  localStorage.setItem('osEmAndamento', 'true');
                  localStorage.setItem('osIniciada', 'true');
                  localStorage.setItem('ordemServicoId', ordem.ordemDeServicoId);

                  const event = new CustomEvent('osStatusChanged');
                  window.dispatchEvent(event);

                  this.router.navigate(['/pages/ordem-servico/emAndamento', this.usuarioId]).then(() => {
                    console.log('Navegação para emAndamento concluída');
                    setTimeout(() => this.carregarOrdens(), 500);
                  });
                },
                error: (error) => {
                  console.error('Erro ao iniciar trajeto:', error);
                },
              });
          })
          .catch((error) => {
            console.error('Erro ao obter localização:', error);
            alert(
              'Não foi possível obter sua localização. Por favor, verifique se o GPS está ativado.'
            );
          });
      });
  }

  continuarOrdemServico(ordem: OrdemServico): void {
    if (this.pausaAtiva) {
      alert('Não é possível continuar ordem durante uma pausa ativa');
      return;
    }

    if (!ordem.ordemDeServicoId) {
      alert('ID da Ordem de Serviço não fornecido');
      return;
    }

    console.log('Continuando ordem:', ordem);

    this.router.navigate(['/pages/ordem-servico-exec', this.usuarioId], {
      queryParams: { codigo: ordem.ordemDeServicoId },
    });
  }

  verDetalhesOrdem(ordem: OrdemServico): void {
    console.log('Visualizando detalhes da ordem:', ordem);

    this.router.navigate(['/pages/ordem-servico-detalhes', this.usuarioId], {
      queryParams: { codigo: ordem.ordemDeServicoId },
    });
  }

  verificarOrdemEmAndamento(): boolean {
    const emAndamento = localStorage.getItem('osEmAndamento') === 'true';
    console.log('Verificando se há ordem em andamento:', emAndamento);
    return emAndamento;
  }

  verificarOrdemEmAndamentoNaAPI(): void {
    if (!this.usuarioId) {
      console.error('UsuarioId não encontrado para verificar ordem em andamento');
      return;
    }

    console.log('Verificando ordens em andamento na API para usuarioId:', this.usuarioId);

    this.vibeService.buscarOrdemServicoUsuarioId(this.usuarioId).subscribe({
      next: (response: CriarOrdemDeServicoResponseDto[]) => {
        console.log('Resposta da API para ordens:', response);

        const ordemEmAndamento = response.find(
          (ordem) => ordem.statusOrdem === 'EmAndamento' && ordem.usuarioId === this.usuarioId
        );

        if (ordemEmAndamento && this.statusOrdem === 'EmAndamento') {
          console.log('Ordem em andamento encontrada:', ordemEmAndamento);

          const ordemFormatada: OrdemServico = {
            ordemDeServicoId: ordemEmAndamento.ordemDeServicoId,
            usuarioId: ordemEmAndamento.usuarioId || '',
            clienteId: ordemEmAndamento.clienteId || '',
            tipoServico: ordemEmAndamento.tipoServico || '',
            statusOrdem: ordemEmAndamento.statusOrdem || '',
            numeroOrdemDeServico: ordemEmAndamento.numeroOrdemDeServico || '',
            atribuida: ordemEmAndamento.atribuida === true,
            observacoesReparo: ordemEmAndamento.observacoesReparo || '',
            dataEHoraInicioServico: ordemEmAndamento.dataEHoraInicioServico || null,
            dataEHoraFimServico: ordemEmAndamento.dataEHoraFimServico || null,
            dataHoraCadastro: ordemEmAndamento.dataHoraCadastro || '',
            clienteData: null,
            despachoId: ordemEmAndamento.despachoId,
            codigoOS: ordemEmAndamento.codigoOS || '',
            cliente: ordemEmAndamento.cliente || '',
            endereco: ordemEmAndamento.endereco || '',
            colaborador: ordemEmAndamento.colaborador || '',
            status: ordemEmAndamento.statusOrdem || '',
            execucoes: ordemEmAndamento.execucoes || [],
            botaoDesativado: false,
          };

          this.ordensAndamento = [ordemFormatada];
          this.ordensFiltradas = this.ordensAndamento;

          localStorage.setItem('osEmAndamento', 'true');
          localStorage.setItem('ordemServicoId', ordemEmAndamento.ordemDeServicoId || '');

          if (ordemEmAndamento.clienteId) {
            this.vibeService.buscarClientesPorId(ordemEmAndamento.clienteId).subscribe({
              next: (clienteData) => {
                ordemFormatada.clienteData = clienteData;
                console.log(`Dados do cliente carregados para ordem ${ordemEmAndamento.ordemDeServicoId}:`, clienteData);
                this.cdr.detectChanges();
              },
              error: (error) => {
                console.error('Erro ao carregar dados do cliente:', error);
              },
            });
          }
        } else {
          console.log('Nenhuma ordem em andamento encontrada para o usuarioId ou rota não é emAndamento:', this.usuarioId);
          localStorage.setItem('osEmAndamento', 'false');
          this.ordensFiltradas = [];
        }
      },
      error: (error) => {
        console.error('Erro ao verificar ordens em andamento:', error);
        localStorage.setItem('osEmAndamento', 'false');
      },
    });
  }

  formatarDataHora(data: string | null): string {
    if (!data) return 'Data/Hora não disponível';
    try {
      const date = new Date(data);
      return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch (error) {
      console.error('Erro ao formatar data e hora:', error);
      return 'Data/Hora inválida';
    }
  }

  formatarEndereco(endereco?: EnderecoDto): string {
    if (!endereco) return '';
    return `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade} - ${endereco.uf}`;
  }

  formatarEnderecoParaMaps(endereco?: EnderecoDto): string {
    if (!endereco) return '';
    return `${endereco.logradouro}, ${endereco.numero}, ${endereco.cidade}, ${endereco.uf}`;
  }

  abrirRota(endereco: string | undefined): void {
    if (!endereco || typeof endereco !== 'string' || endereco.trim() === '') {
      console.warn('Endereço inválido ou ausente:', endereco);
      alert('Endereço não disponível para abrir a rota.');
      return;
    }

    try {
      const enderecoFormatado = encodeURIComponent(endereco.trim());
      const url = `https://www.google.com/maps/dir/?api=1&destination=${enderecoFormatado}`;
      window.open(url, '_blank');
      console.log('Rota aberta com sucesso:', url);
    } catch (error) {
      console.error('Erro ao abrir rota:', error);
      alert('Erro ao abrir o Google Maps. Verifique sua conexão ou habilite o JavaScript.');
    }
  }
}