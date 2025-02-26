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
  cliente?: ClienteResponseDto; // Se ainda usar o campo `cliente`
  observacoesReparo: string;
  dataEHoraInicioServico: string | null;
  clienteData?: ClienteResponseDto | null; // Adicionando clienteData como opcional e com tipo específico
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
        this.statusOrdem = 'Concluída';
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
        // Obter a data atual (sem horário para comparação)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zera horas, minutos, segundos e milissegundos
  
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
            dataEHoraInicioServico: ordem.dataEHoraInicioServico || null
          }))
          .filter(ordem => {
            // Converter dataEHoraInicioServico para Date, tratando diferentes formatos e null
            let dataOrdem: Date | null = null;
            if (ordem.dataEHoraInicioServico) {
              if (typeof ordem.dataEHoraInicioServico === 'string') {
                // Tenta parsear no formato ISO (YYYY-MM-DDTHH:mm:ssZ) ou simplesmente YYYY-MM-DD
                dataOrdem = new Date(ordem.dataEHoraInicioServico);
                if (isNaN(dataOrdem.getTime())) {
                  // Tenta parsear no formato DD/MM/YYYY
                  const partes = ordem.dataEHoraInicioServico.split('/');
                  if (partes.length === 3) {
                    dataOrdem = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
                  } else {
                    // Tenta parsear no formato MM/DD/YYYY (caso o backend use este formato)
                    const partes2 = ordem.dataEHoraInicioServico.split('-');
                    if (partes2.length === 3) {
                      dataOrdem = new Date(ordem.dataEHoraInicioServico);
                    }
                  }
                }
                if (isNaN(dataOrdem.getTime())) {
                  console.error('Formato de data inválido, ignorando ordem:', ordem.dataEHoraInicioServico, 'Ordem:', ordem);
                  return false; // Pula ordens com data inválida
                }
              }
            }
  
            if (dataOrdem) {
              dataOrdem.setHours(0, 0, 0, 0); // Zera horário para comparação
            }
  
            // Filtrar por status, data atual e se está atribuída
            const dataCorrespondente = dataOrdem ? dataOrdem.getTime() === hoje.getTime() : true; // Considera null como válido para o dia atual
            const ordemAtribuida = ordem.atribuida === true;
            const statusCorreto = ordem.statusOrdem === this.statusOrdem;
  
            console.log('Ordem filtrada:', {
              dataCorrespondente,
              ordemAtribuida,
              statusCorreto,
              ordem
            });
  
            return statusCorreto && ordemAtribuida && dataCorrespondente;
          });
  
        // Carregar dados do cliente para cada ordem filtrada
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
          `Encontradas ${this.ordensFiltradas.length} ordens para o dia atual, status ${this.statusOrdem} e atribuídas:`,
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

  iniciarOrdemServico(ordemId: string) {
    if (this.pausaAtiva) {
      console.warn('Não é possível iniciar ordem durante uma pausa ativa');
      return;
    }

    if (!this.usuarioId) {
      console.error('ID do usuário não encontrado');
      return;
    }

    if (!ordemId) {
      console.error('ID da ordem não fornecido');
      return;
    }

    // Primeiro obtém a localização atual
    this.obterLocalizacaoAtual()
      .then((position: GeolocationPosition) => {
        // Validar coordenadas
        if (!position?.coords?.latitude || !position?.coords?.longitude) {
          throw new Error('Coordenadas inválidas');
        }

        const request: IniciarTrajetoRequestDto = {
          latitudeInicioTrajeto: position.coords.latitude.toString(),
          longitudeInicioTrajeto: position.coords.longitude.toString()
        };

        console.log('Iniciando trajeto com dados:', {
          ordemId,
          usuarioId: this.usuarioId,
          request
        });

        // Inicia o trajeto com as coordenadas
        this.vibeService.iniciarTrajeto(ordemId, this.usuarioId!, request)
          .pipe(
            tap(response => console.log('Resposta do serviço:', response)),
            catchError(error => {
              console.error('Detalhes do erro:', {
                status: error.status,
                message: error.message,
                error: error.error
              });
              throw error;
            })
          )
          .subscribe({
            next: (response: IniciarTrajetoResponseDto) => {
              if (!response?.trajetoId) {
                throw new Error('TrajetoId não recebido na resposta');
              }

              // Salva todos os dados importantes no localStorage
              localStorage.setItem('trajetoId', response.trajetoId);
              localStorage.setItem('latitudeInicioTrajeto', request.latitudeInicioTrajeto!);
              localStorage.setItem('longitudeInicioTrajeto', request.longitudeInicioTrajeto!);
              localStorage.setItem('osEmAndamento', 'true');
              localStorage.setItem('osIniciada', 'false');

              this.router.navigate(['/pages/ordem-servico-exec', this.usuarioId], {
                queryParams: { codigo: ordemId }
              });
            },
            error: (error) => {
              let errorMessage = 'Erro ao iniciar trajeto: ';
              if (error.status === 400) {
                errorMessage += 'Dados inválidos fornecidos';
              } else if (error.status === 404) {
                errorMessage += 'Ordem de serviço ou usuário não encontrado';
              } else {
                errorMessage += error.message || 'Erro desconhecido';
              }
              console.error(errorMessage, error);
              // Aqui você pode adicionar uma notificação visual para o usuário
            }
          });
      })
      .catch(error => {
        console.error('Erro ao obter localização:', error);
        // Adicione uma notificação visual para o usuário
      });
  }

  verificarOrdemEmAndamento(): boolean {
    return localStorage.getItem('osEmAndamento') === 'true';
  }

  formatarDataHora(data: string | null): string {
    if (!data) return 'Data/Hora não disponível';
    try {
      const date = new Date(data);
      return date.toISOString(); // Retorna "2025-02-25T20:11:00.000Z"
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
