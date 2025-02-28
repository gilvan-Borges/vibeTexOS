import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RegistroExpedienteService } from '../../../services/registro-expediente.service';
import { VibeService } from '../../../services/vibe.service';
import { CriarOrdemDeServicoResponseDto } from '../../../models/vibe-service/criarOrdemDeServicoResponseDto';
import { ClienteResponseDto } from '../../../models/vibe-service/clienteResponseDto';
import { EnderecoDto } from '../../../models/vibe-service/EnderecoDto';
import { IniciarTrajetoRequestDto } from '../../../models/vibe-service/iniciarTrajetoRequestDto';
import { IniciarTrajetoResponseDto } from '../../../models/vibe-service/iniciarTrajetoResponseDto';
import { tap, catchError } from 'rxjs/operators';

interface OrdemServico {
  ordemDeServicoId: string;
  usuarioId: string;
  clienteId: string;
  tipoServico: string;
  statusOrdem: string;
  numeroOrdemDeServico: string;
  atribuida: boolean;
  cliente?: ClienteResponseDto;
  observacoesReparo: string;
  dataEHoraInicioServico: string | null;
  dataHoraCadastro: string; // Campo da API para filtrar o dia atual
  clienteData?: ClienteResponseDto | null;
  despachoId?: string;
}

@Component({
  selector: 'app-ordem-servico',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ordem-servico.component.html',
  styleUrls: ['./ordem-servico.component.css']
})
export class OrdemServicoComponent implements OnInit {
  ordensFiltradas: OrdemServico[] = [];
  statusOrdem: string = 'Pendente';
  pausaAtiva: boolean = false;
  usuarioId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private registroExpediente: RegistroExpedienteService,
    private vibeService: VibeService
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
      } else if (segment === 'realizadas') {
        this.statusOrdem = 'Concluida';
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
        hoje.setHours(0, 0, 0, 0); // Define a data atual apenas até o início do dia
  
        console.log('Resposta bruta do serviço:', response);
  
        this.ordensFiltradas = response
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
            dataHoraCadastro: ordem.dataHoraCadastro || '', // Mapeia o campo da API
            clienteData: null, // Inicializa como null, será preenchido abaixo
            despachoId: ordem.despachoId
          }))
          .filter(ordem => {
            let dataOrdem: Date | null = null;
            if (ordem.dataHoraCadastro && ordem.dataHoraCadastro.trim() !== '') {
              dataOrdem = new Date(ordem.dataHoraCadastro);
              if (isNaN(dataOrdem.getTime())) {
                console.error('Formato de dataHoraCadastro inválido, ignorando ordem:', ordem.dataHoraCadastro, 'Ordem:', ordem);
                return false;
              }
              dataOrdem.setHours(0, 0, 0, 0); // Normaliza para o início do dia
            } else {
              console.warn('dataHoraCadastro ausente ou vazio para ordem:', ordem);
              return false; // Rejeita ordens sem dataHoraCadastro válida
            }

            // Apenas inclui ordens do dia atual e do usuarioId logado
            const dataCorrespondente = dataOrdem.getTime() === hoje.getTime();
            const ordemAtribuida = ordem.atribuida === true;
            const statusCorreto = ordem.statusOrdem === this.statusOrdem;
            const usuarioCorreto = ordem.usuarioId === this.usuarioId;

            console.log('Ordem filtrada:', {
              dataCorrespondente,
              ordemAtribuida,
              statusCorreto,
              usuarioCorreto,
              ordem
            });

            return statusCorreto && ordemAtribuida && dataCorrespondente && usuarioCorreto;
          });

        this.ordensFiltradas.forEach(ordem => {
          this.vibeService.buscarClientesPorId(ordem.clienteId).subscribe({
            next: (clienteData) => {
              ordem.clienteData = clienteData;
            },
            error: (erro) => {
              console.error('Erro ao carregar dados do cliente:', erro);
            }
          });
        });

        console.log(
          `Encontradas ${this.ordensFiltradas.length} ordens para o dia atual, status ${this.statusOrdem}, atribuídas e do usuário ${this.usuarioId}:`,
          this.ordensFiltradas
        );
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

    if (!this.usuarioId) {
      alert('ID do usuário não encontrado');
      return;
    }

    if (!ordem.ordemDeServicoId || !ordem.despachoId) {
      alert('ID da Ordem de Serviço ou Despacho não fornecido');
      return;
    }

    // Aqui, usamos non-null assertion (!) pois já verificamos que despachoId não é undefined
    const despachoId = ordem.despachoId!;

    // Aqui, ordemDeServicoId já foi verificado como não nulo/undefined, então é seguro tratar como string
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
          despachoId: despachoId,
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
              if (!response?.trajetoId) {
                throw new Error('TrajetoId não recebido na resposta');
              }

              localStorage.setItem('trajetoId', response.trajetoId);
              localStorage.setItem('latitudeInicioTrajeto', request.latitudeInicioTrajeto!);
              localStorage.setItem('longitudeInicioTrajeto', request.longitudeInicioTrajeto!);
              localStorage.setItem('osEmAndamento', 'true');
              localStorage.setItem('osIniciada', 'false');

              // Navega usando ordemDeServicoId como codigo
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