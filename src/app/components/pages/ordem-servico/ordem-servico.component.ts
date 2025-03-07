import { Component, OnInit } from '@angular/core';
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
import { OrdemServico } from '../../../interfaces/ordem-servico.interface';

@Component({
  selector: 'app-ordem-servico',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ordem-servico.component.html',
  styleUrls: ['./ordem-servico.component.css']
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
    private ordemServicoService: OrdemServicoService
  ) {
    this.registroExpediente.tempoRestantePausa$.subscribe(minutos => {
      this.pausaAtiva = minutos > 0;
    });
  }

  ngOnInit() {
    this.route.url.subscribe(urlSegments => {
      const segment = urlSegments[0]?.path;
      if (segment === 'Pendente') {
        this.statusOrdem = 'Pendente';
        this.mostrarAndamento = true; 
      } else if (segment === 'Andamento') {
        this.statusOrdem = 'EmAndamento';
        this.mostrarAndamento = false; 
      } else if (segment === 'realizadas') {
        this.statusOrdem = 'Concluida';
        this.mostrarAndamento = false; 
      }
      console.log('Segmento de URL:', segment);
      console.log('Status definido:', this.statusOrdem);
      this.carregarOrdens();
    });

    this.route.params.subscribe(params => {
      this.usuarioId = params['usuarioId'];
      if (this.usuarioId) {
        console.log('ID do usuário encontrado na rota:', this.usuarioId);
        this.carregarOrdens();
      } else {
        console.error('ID do usuário não encontrado na rota');
      }
    });

    setInterval(() => {
      this.carregarOrdens();
    }, 30000);
  }

  carregarOrdens() {
    if (!this.usuarioId) {
      console.error('ID do usuário não encontrado');
      return;
    }
  
    console.log('Carregando ordens para status:', this.statusOrdem, 'e usuarioId:', this.usuarioId);
  
    this.vibeService.buscarOrdemServicoUsuarioId(this.usuarioId).subscribe({
      next: (response: CriarOrdemDeServicoResponseDto[]) => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
  
        console.log('Resposta bruta do serviço:', response);
        
        // Processa todas as ordens
        const todasOrdens = response
          .map(ordem => ({
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
            status: ordem.statusOrdem || ''
          }))
          .filter(ordem => {
            // Verifica atribuição ao usuário
            const usuarioCorreto = ordem.usuarioId === this.usuarioId;
            
            // Para ordens concluídas, aceitamos mesmo que não estejam atribuídas
            const statusConcluido = ordem.statusOrdem === 'Concluído' || ordem.statusOrdem === 'Concluida';
            const ordemAtribuida = ordem.atribuida === true;
            
            // Se usuário não for o correto, rejeita
            if (!usuarioCorreto) {
              return false;
            }
            
            // Para ordens concluídas, inclui mesmo se não estiverem atribuídas
            if (this.statusOrdem === 'Concluida') {
              if (statusConcluido) {
                return true; // Incluir todas as ordens concluídas deste usuário
              }
              
              // Se não tiver status concluído mas tiver data de fim, verifica se foi hoje
              if (ordem.dataEHoraFimServico) {
                const dataFim = new Date(ordem.dataEHoraFimServico);
                if (!isNaN(dataFim.getTime())) {
                  dataFim.setHours(0, 0, 0, 0);
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  return dataFim.getTime() === hoje.getTime();
                }
              }
              return false;
            } else {
              // Para ordens pendentes/em andamento, exige que esteja atribuída
              if (!ordemAtribuida) {
                return false;
              }
              
              // Verifica a data de cadastro
              if (ordem.dataHoraCadastro && ordem.dataHoraCadastro.trim() !== '') {
                const dataOrdem = new Date(ordem.dataHoraCadastro);
                if (!isNaN(dataOrdem.getTime())) {
                  dataOrdem.setHours(0, 0, 0, 0);
                  const hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);
                  return dataOrdem.getTime() === hoje.getTime();
                }
              }
              return false;
            }
          });

        // Ajusta os filtros para separar as ordens
        this.ordensAndamento = todasOrdens.filter(ordem => ordem.statusOrdem === 'EmAndamento');

        // Se estamos na página de ordens concluídas, filtra apenas essas
        if (this.statusOrdem === 'Concluida') {
          this.ordensFiltradas = todasOrdens.filter(ordem => 
            ordem.statusOrdem === 'Concluído' || ordem.statusOrdem === 'Concluida'
          );
        } else {
          this.ordensFiltradas = todasOrdens.filter(ordem => ordem.statusOrdem === 'Pendente');
        }

        // Busca os dados do cliente para cada ordem
        const buscarDadosCliente = (ordens: OrdemServico[]) => {
          ordens.forEach(ordem => {
            this.vibeService.buscarClientesPorId(ordem.clienteId).subscribe({
              next: (clienteData) => {
                ordem.clienteData = clienteData;
              },
              error: (erro) => {
                console.error('Erro ao carregar dados do cliente:', erro);
              }
            });
          });
        };

        buscarDadosCliente(this.ordensFiltradas);
        buscarDadosCliente(this.ordensAndamento);

        console.log('Ordens pendentes:', this.ordensFiltradas);
        console.log('Ordens em andamento:', this.ordensAndamento);
      },
      error: (erro) => {
        console.error('Erro ao carregar ordens:', erro);
      }
    });
  }

  private obterLocalizacaoAtual(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    });
  }

  iniciarOrdemServico(ordem: OrdemServico) {
    if (this.pausaAtiva) {
      alert('Não é possível iniciar ordem durante uma pausa ativa');
      return;
    }
  
    if (!ordem.ordemDeServicoId || !ordem.despachoId) {
      alert('ID da Ordem de Serviço ou Despacho não fornecido');
      return;
    }
  
    const despachoId = ordem.despachoId;
  
    this.obterLocalizacaoAtual()
      .then((position: GeolocationPosition) => {
        if (!position?.coords?.latitude || !position?.coords?.longitude) {
          throw new Error('Coordenadas inválidas');
        }
  
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
  
        const request: IniciarTrajetoRequestDto = {
          latitudeInicioTrajeto: latitude,
          longitudeInicioTrajeto: longitude
        };
  
        console.log('Iniciando trajeto com dados:', {
          ordemDeServicoId: ordem.ordemDeServicoId,
          despachoId,
          usuarioId: this.usuarioId,
          request
        });
  
        return this.vibeService.iniciarTrajeto(despachoId, this.usuarioId!, request)
          .pipe(
            tap(response => {
              console.log('Resposta do serviço:', response);
              if (!response) {
                throw new Error('Resposta vazia do servidor');
              }
            }),
            catchError(error => {
              console.error('Erro detalhado:', error);
              let mensagem = 'Erro ao iniciar trajeto: ';
              if (error.status === 400) {
                mensagem += error.error?.message || 'Dados inválidos fornecidos';
              } else if (error.status === 404) {
                mensagem += 'Ordem de serviço ou usuário não encontrado';
              } else {
                mensagem += error.message || 'Erro na comunicação com o servidor';
              }
              alert(mensagem);
              throw error;
            })
          )
          .subscribe({
            next: (response: IniciarTrajetoResponseDto) => {
              console.log('Resposta completa da API:', response);
              if (!response?.trajetoId) {
                throw new Error('TrajetoId não recebido na resposta');
              }
            
              // Validação e conversão para string
              const latitudeInicio = request.latitudeInicioTrajeto || '';
              const longitudeInicio = request.longitudeInicioTrajeto || '';
            
              localStorage.setItem('trajetoId', response.trajetoId);
              localStorage.setItem('latitudeInicioTrajeto', latitudeInicio);
              localStorage.setItem('longitudeInicioTrajeto', longitudeInicio);
              localStorage.setItem('osEmAndamento', 'true');
              localStorage.setItem('osIniciada', 'false');
            
              this.router.navigate(['/pages/ordem-servico-exec', this.usuarioId], {
                queryParams: { codigo: ordem.ordemDeServicoId }
              });
            },
            error: (error) => {
              console.error('Erro ao iniciar trajeto:', error);
            }
          });
      })
      .catch(error => {
        console.error('Erro ao obter localização:', error);
        alert('Não foi possível obter sua localização. Por favor, verifique se o GPS está ativado.');
      });
  }

  // Método para continuar uma ordem em andamento
  continuarOrdemServico(ordem: OrdemServico) {
    if (this.pausaAtiva) {
      alert('Não é possível continuar ordem durante uma pausa ativa');
      return;
    }
    
    if (!ordem.ordemDeServicoId) {
      alert('ID da Ordem de Serviço não fornecido');
      return;
    }
    
    console.log('Continuando ordem:', ordem);
    
    // Navega para a tela de execução usando o ID da ordem como código
    this.router.navigate(['/pages/ordem-servico-exec', this.usuarioId], {
      queryParams: { codigo: ordem.ordemDeServicoId }
    });
  }

  // Método para visualizar detalhes da ordem
  verDetalhesOrdem(ordem: OrdemServico) {
    console.log('Visualizando detalhes da ordem:', ordem);
    
    // Navega para a tela de detalhes
    this.router.navigate(['/pages/ordem-servico-detalhes', this.usuarioId], {
      queryParams: { codigo: ordem.ordemDeServicoId }
    });
  }

  verificarOrdemEmAndamento(): boolean {
    return localStorage.getItem('osEmAndamento') === 'true';
  }

  formatarDataHora(data: string | null): string {
    if (!data) return 'Data/Hora não disponível';
    try {
      const date = new Date(data);
      return date.toISOString(); 
    } catch (erro) {
      console.error('Erro ao formatar data e hora:', erro);
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

  abrirRota(endereco: string) {
    if (!endereco) return;
    const enderecoFormatado = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${enderecoFormatado}`, '_blank');
  }
}