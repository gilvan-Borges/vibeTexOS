import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, NgZone, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { forkJoin, interval, Subscription } from 'rxjs';
import { ControllAppService } from '../../../services/controllApp.service';
import { UsuarioService } from '../../../services/usuario.service';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { environment } from '../../../../environments/environment.development';
import { OrdemServicoService } from '../../../services/ordem.servico.service';

export interface Usuario {
  usuarioId: string;
  nome: string;
  userName: string;
  email: string;
  senha: string;
  cpf: string;
  role: string;
  horaEntrada: string;
  horaSaida: string;
  horaAlmocoInicio: string;
  horaAlmocoFim: string;
  fotoUrl?: string;
  isOnline: boolean;
  latitudeAtual: string;
  longitudeAtual: string;
  dataHoraUltimaAutenticacao: Date;
}

export interface DesempenhoColaborador {
  usuarioId: string;
  nome: string;
  fotoUrl: string; // URL da foto de perfil
  osAtribuidas: number; // O.S. vinculadas ao usuarioId
  osRealizadas: number; // O.S. concluídas
  osPendentes: number; // O.S. não concluídas
  tempoMedio: string; // Tempo médio de execução das O.S. (ex.: "1h 30m")
  empresa: string; // Empresa que o colaborador trabalha
  eficiencia: number; // Percentual de eficiência (0-100)
  jornada: string; // Horário de trabalho (ex.: "8h/diárias, 9h-18h")
  status: string; // Status do colaborador ("Online" ou "Offline")
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink,
    FormsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private map: any;
  colaboradoresEmServico: any[] = [];
  colaboradores: any[] = [];
  totalUsersCount: number = 0;
  activeUsersCount: number = 0;
  totalServices: number = 0;
  servicesInProgress: number = 0;
  servicesCompleted: number = 0;
  totalServicesOverall: number = 0;
  servicesCompletedOverall: number = 0;
  colaboradoresOnlineCount: number = 0;
  efficiencyGeneral: number = 0;
  percentualTrabalhado: number = 0;
  colaboradorSelecionado: any = null; 

  availableYears: number[] = [];  // Lista de anos disponíveis
  selectedYear: number = new Date().getFullYear();  // Ano selecionado inicialmente

  formulario: FormGroup;

  // Métricas do dashboard (mockadas)
  periodoSelecionado: string = 'hoje';
  dataInicial: string = '';
  dataFinal: string = '';

  totalOS: number = 35; // Mockado com valores da sua solicitação
  osRealizadas: number = 28;
  osNaoAtribuidas: number = 0;
  osNaoRealizadas: number = 7;
  mapaFiltro: string = 'todos';
  colaboradoresDesempenho: DesempenhoColaborador[] = [];

  constructor(
    private controllAppService: ControllAppService,
    private usuarioService: UsuarioService,
    private ordemServicoService: OrdemServicoService,
    private ngZone: NgZone 
  ) {
    this.formulario = new FormGroup({
      nome: new FormControl('', [Validators.required, Validators.minLength(8)]),
      userName: new FormControl('', [Validators.required, Validators.minLength(5)]),
      cpf: new FormControl('', [Validators.required, Validators.pattern(/^\d{11}$/)]),
      email: new FormControl('', [Validators.required, Validators.email]),
      role: new FormControl('', [Validators.required]),
      horaInicio: new FormControl('', [Validators.required]),
      horaAlmocoInicio: new FormControl('', [Validators.required]),
      horaAlmocoFim: new FormControl('', [Validators.required]),
      horaFim: new FormControl('', [Validators.required]),
      senha: new FormControl('', [Validators.required, Validators.minLength(6)]),
      senhaConfirmacao: new FormControl('', [Validators.required, Validators.minLength(6)])
    });
  }

  ngOnInit() {
    this.initMap();

    const usuarioData = localStorage.getItem('usuario');
    if (usuarioData) {
      const usuario = JSON.parse(usuarioData).usuario;
      if (usuario?.usuarioId) {
        console.log('Atualizando status do usuário com ID:', usuario.usuarioId);
        this.controllAppService.atualizarStatusUsuario(usuario.usuarioId, true).subscribe({
          next: () => console.log('Status atualizado com sucesso.'),
          error: (err) => console.error('Erro ao atualizar status do usuário:', err)
        });
      }
    }

    this.loadAvailableYears();
    this.loadHorasTrabalhadas();
    this.carregarServicosDia();
    this.obterColaboradoresEmServico();
    this.carregarTodosColaboradores();
    this.carregarServicosGerais();
    this.iniciarAtualizacaoAutomatica();

    // Mock de dados para o desempenho detalhado (mantendo o fornecido)
    this.colaboradoresDesempenho = [
      {
        usuarioId: '1',
        nome: 'João Silva',
        fotoUrl: 'https://gilvandev.com/img/logo_vibetex.png', // Mock de foto
        osAtribuidas: 20,
        osRealizadas: 18,
        osPendentes: 2,
        tempoMedio: '1h 30m',
        empresa: 'VibeTex Soluções',
        eficiencia: 90, // 90% de eficiência
        jornada: '8h/diárias, 9h-18h',
        status: 'Online'
      },
      {
        usuarioId: '2',
        nome: 'Maria Santos',
        fotoUrl: 'https://gilvandev.com/img/Avatar.png', // Mock de foto
        osAtribuidas: 15,
        osRealizadas: 10,
        osPendentes: 5,
        tempoMedio: '2h 10m',
        empresa: 'VibeTex Soluções',
        eficiencia: 67, // 67% de eficiência
        jornada: '8h/diárias, 9h-18h',
        status: 'Offline'
      }
    ].filter(colaborador => colaborador.status === 'Online'); // Filtra apenas online

    // Calcula eficiência geral com base nos mocks
    this.efficiencyGeneral = Math.round((this.osRealizadas / this.totalOS) * 100) || 0;
  }

  private obterColaboradoresEmServico(): void {
    this.controllAppService.PontoGetAll().subscribe({
      next: (response) => {
        if (!response || !Array.isArray(response)) {
          this.colaboradoresEmServico = [];
          return;
        }

        const hoje = new Date().toISOString().split('T')[0];
        const pontosFiltrados = response.filter((ponto) => {
          const dataExpediente = ponto.inicioExpediente ? new Date(ponto.inicioExpediente).toISOString().split('T')[0] : null;
          return dataExpediente === hoje && !ponto.fimExpediente && ponto.usuarioId;
        });

        if (pontosFiltrados.length === 0) {
          this.colaboradoresEmServico = [];
          return;
        }

        const requisicoesUsuarios = pontosFiltrados.map((ponto) =>
          this.controllAppService.usuarioGetById(ponto.usuarioId)
        );

        forkJoin(requisicoesUsuarios).subscribe({
          next: (usuarios) => {
            console.log('Usuários obtidos:', usuarios);
            
            this.colaboradoresEmServico = pontosFiltrados.map((ponto, index) => {
              const usuario = usuarios[index];
              console.log('Processando usuário:', usuario);
              console.log('Foto original do usuário:', usuario?.fotoUrl);
              
              const fotoUrlCompleta = usuario?.fotoUrl ? 
                `${environment.mediaUrl}/${usuario.fotoUrl.split('/').pop()}` : 
                "https://via.placeholder.com/40x40";
              console.log('Foto URL completa:', fotoUrlCompleta);
              
              const colaborador = {
                usuarioId: usuario?.usuarioId || null,
                nome: usuario?.nome || "Nome não encontrado",
                fotoUrl: fotoUrlCompleta,
                inicioExpediente: this.formatarHora(ponto.inicioExpediente),
                inicioPausa: this.formatarHora(ponto.inicioPausa),
                retornoPausa: this.formatarHora(ponto.retornoPausa),
                fimExpediente: this.formatarHora(ponto.fimExpediente, true),
                status: usuario?.isOnline ? "Online" : "Offline",
                endereco: "Buscando...",
                latitude: usuario?.latitudeAtual,
                longitude: usuario?.longitudeAtual
              };

              // Buscar endereço se tiver coordenadas
              if (usuario?.latitudeAtual && usuario?.longitudeAtual) {
                this.buscarEndereco(`${usuario.latitudeAtual},${usuario.longitudeAtual}`)
                  .then(endereco => {
                    this.ngZone.run(() => {
                      const index = this.colaboradoresEmServico.findIndex(c => c.usuarioId === colaborador.usuarioId);
                      if (index !== -1) {
                        this.colaboradoresEmServico[index].endereco = endereco;
                      }
                    });
                  })
                  .catch(error => {
                    console.error('Erro ao buscar endereço:', error);
                    colaborador.endereco = 'Erro ao buscar endereço';
                  });
              } else {
                colaborador.endereco = 'Coordenadas não disponíveis';
              }

              return colaborador;
            });
          },
          error: (err) => {
            console.error('Erro ao obter usuários:', err);
            this.colaboradoresEmServico = [];
          }
        });
      },
      error: (err) => {
        console.error('Erro ao obter pontos:', err);
        this.colaboradoresEmServico = [];
      }
    });
  }

  private buscarEndereco(coordenada: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!coordenada || !coordenada.includes(',')) {
        return resolve("Coordenadas inválidas");
      }
  
      const [latitude, longitude] = coordenada.split(',').map(coord => coord.trim());
  
      if (!latitude || !longitude || isNaN(Number(latitude))) {
        return resolve("Coordenadas inválidas");
      }
  
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
  
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('Erro na resposta do servidor');
          return response.json();
        })
        .then(data => {
          if (data && data.address) {
            // Pegando apenas a rua e o bairro
            const rua = data.address.road || "Rua não encontrada";
            const bairro = data.address.suburb || data.address.neighbourhood || "Bairro não encontrado";
  
            return resolve(`${rua}, ${bairro}`);
          }
          return resolve("Endereço não encontrado");
        })
        .catch(() => resolve("Erro ao buscar endereço"));
    });
  }
  

  formatarHora(data: string | null, isFim: boolean = false): string {
    if (!data) {
      return isFim ? 'Em andamento' : 'Não disponível';
    }

    const date = new Date(data);
    if (isNaN(date.getTime())) {
      return isFim ? 'Em andamento' : 'Não disponível';
    }

    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // Atualiza o gráfico ao mudar o ano no dropdown
  onYearChange(event: any) {
    this.selectedYear = parseInt(event.target.value, 10);
  }

  private coordenadasSubscription!: Subscription;

  private enviarCoordenadasParaApi() {
    const usuarioLogado = JSON.parse(localStorage.getItem('usuario') || '{}');

    // Verifica se o usuário tem o role correto e as coordenadas definidas
    if (
      usuarioLogado.usuarioId &&
      usuarioLogado.role === 'Colaborador' &&
      usuarioLogado.latitudeAtual &&
      usuarioLogado.longitudeAtual
    ) {
      this.controllAppService.atualizarCoordenadasUsuario(
        usuarioLogado.usuarioId,
        usuarioLogado.latitudeAtual,
        usuarioLogado.longitudeAtual
      ).subscribe({
        next: () => console.log('Coordenadas atualizadas com sucesso.'),
        error: (err) => console.error('Erro ao atualizar coordenadas:', err)
      });
    }
  }

  private iniciarAtualizacaoAutomatica() {
    this.coordenadasSubscription = interval(10000).subscribe(() => {
      this.enviarCoordenadasParaApi();
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  
    // Aguarda o mapa estar inicializado e carrega os colaboradores online
    setTimeout(() => {
      if (this.map) {
        this.carregarColaboradoresOnlineNoMapa();
        
        // Inicia atualização periódica (a cada 30 segundos, como já está)
        setInterval(() => {
          if (this.map) {
            this.carregarColaboradoresOnlineNoMapa();
          }
        }, 30000);
      }
    }, 1000);
  }

  private carregarColaboradoresOnlineNoMapa(): void {
    this.usuarioService.usuarioGetAll({ role: 'Colaborador' }).subscribe({
      next: (usuarios: Usuario[]) => {
        const colaboradoresOnline = usuarios.filter(u =>
          u.isOnline &&
          u.role === 'Colaborador' &&
          u.latitudeAtual &&
          u.longitudeAtual
        );
        this.processarColaboradoresOnline(colaboradoresOnline);
      },
      error: (error) => {
        console.error('Erro ao carregar colaboradores:', error);
      }
    });
  }

  private processarColaboradoresOnline(colaboradoresOnline: Usuario[]): void {
    console.log('Colaboradores online recebidos:', colaboradoresOnline);
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        this.map.removeLayer(layer);
      }
    });
  
    colaboradoresOnline.forEach(colaborador => {
      console.log('Coordenadas do colaborador:', {
        latitude: colaborador.latitudeAtual,
        longitude: colaborador.longitudeAtual
      });
      const lat = parseFloat(colaborador.latitudeAtual);
      const lng = parseFloat(colaborador.longitudeAtual);
  
      if (!isNaN(lat) && !isNaN(lng)) {
        const customIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });
  
        let dataLogin = '-';
        if (colaborador.dataHoraUltimaAutenticacao) {
          const data = new Date(colaborador.dataHoraUltimaAutenticacao);
          if (!isNaN(data.getTime())) {
            dataLogin = data.toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short'
            });
          }
        }
  
        L.marker([lat, lng], { icon: customIcon })
          .addTo(this.map)
          .bindPopup(
            `<strong>Colaborador</strong><br>
            Nome: ${colaborador.nome}<br>
            Último login: ${dataLogin}`
          );
      }
    });
  
    if (colaboradoresOnline.length > 0) {
      const bounds = L.latLngBounds(
        colaboradoresOnline.map(c => [parseFloat(c.latitudeAtual), parseFloat(c.longitudeAtual)])
      );
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  
    this.colaboradoresOnlineCount = colaboradoresOnline.length;
  }

  // Inicializa o mapa
  private initMap(): void {
    if (this.map) {
      return;  // Evita inicialização duplicada
    }

    this.map = L.map('map', {
      center: [-22.6378335427398, -43.041989248970395],
      zoom: 5
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    this.map.whenReady(() => {
      console.log('Mapa inicializado com sucesso.');
      this.atualizarMapa();  // Adiciona os primeiros marcadores
    });
  }

  private atualizarMapa(): void {
    if (!this.map) {
      console.warn('Mapa não está inicializado.');
      return;
    }

    console.log("🌍 Atualizando mapa com os seguintes dados:");
    console.log("📍 Colaboradores em serviço:", this.colaboradoresEmServico);

    try {
      // Remove os marcadores existentes
      this.map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) {
          this.map.removeLayer(layer);
        }
      });

      // Verifica se já existe algum TileLayer
      let hasTileLayer = false;
      this.map.eachLayer((layer: any) => {
        if (layer instanceof L.TileLayer) {
          hasTileLayer = true;
        }
      });

      if (!hasTileLayer) {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(this.map);
      }

      // Adiciona novos marcadores
      this.colaboradoresEmServico.forEach(colaborador => {
        if (colaborador.latitude && colaborador.longitude) {
          const lat = parseFloat(colaborador.latitude);
          const lng = parseFloat(colaborador.longitude);

          if (!isNaN(lat) && !isNaN(lng)) {
            const customIcon = L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
              shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34]
            });

            L.marker([lat, lng])
              .addTo(this.map)
              .bindPopup(
                `<strong>Colaborador</strong><br>
                    Nome: ${colaborador.nomeUsuario}<br>
                    Hora de Login: ${colaborador.dataHoraUltimaAutenticacao}<br>
                    `
              );
          }
        }
      });

      console.log('Mapa atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar mapa:', error);
    }
  }

  // Carrega os anos disponíveis dinamicamente
  private loadAvailableYears() {
    const usuarioData = localStorage.getItem('usuario');
    const usuarioId = usuarioData ? JSON.parse(usuarioData).usuario?.usuarioId : null;
    
    if (!usuarioId) {
      console.error('ID do usuário não encontrado no localStorage');
      return;
    }
  
    this.controllAppService.getHorasTrabalhadas(usuarioId).subscribe({
      next: (horas) => {
        if (!horas || !Array.isArray(horas)) {
          console.warn('Dados inválidos retornados pela API.');
          return;
        }

        const yearsSet = new Set<number>();

        horas.forEach((h) => {
          if (h.data && typeof h.data === 'string') {
            const dataFormatada = this.converterTimeSpanParaData(h.data);
            if (dataFormatada) {
              const ano = new Date(dataFormatada).getFullYear();
              yearsSet.add(ano);
            } else {
              console.warn('Data inválida no registro:', h);
            }
          }
        });

        this.availableYears = Array.from(yearsSet).sort();
      },
      error: (err) => {
        console.error('Erro ao carregar anos disponíveis:', err);
      }
    });
  }

  /**
   * Função para converter TimeSpan (HH:mm:ss ou dias:HH:mm:ss) em uma data válida.
   */
  private converterTimeSpanParaData(timeSpan: string): string | null {
    try {
      // Assume que o TimeSpan vem no formato HH:mm:ss ou d.HH:mm:ss
      const timeParts = timeSpan.split(':');

      // Se for d.HH:mm:ss (dias incluídos), trate isso
      if (timeParts.length === 3 || timeParts.length === 4) {
        let dias = 0, horas = 0, minutos = 0, segundos = 0;

        if (timeParts.length === 4) {
          dias = parseInt(timeParts[0], 10);
          horas = parseInt(timeParts[1], 10);
          minutos = parseInt(timeParts[2], 10);
          segundos = parseInt(timeParts[3], 10);
        } else {
          horas = parseInt(timeParts[0], 10);
          minutos = parseInt(timeParts[1], 10);
          segundos = parseInt(timeParts[2], 10);
        }

        // Data base: hoje ou uma data fixa (por exemplo, 1970-01-01)
        const dataBase = new Date();
        dataBase.setHours(horas);
        dataBase.setMinutes(minutos);
        dataBase.setSeconds(segundos);
        dataBase.setDate(dataBase.getDate() + dias);  // Adiciona dias se aplicável

        // Formata para o padrão yyyy-MM-dd
        return dataBase.toISOString().split('T')[0];
      }

      return null;
    } catch (error) {
      console.error('Erro ao converter TimeSpan:', error);
      return null;
    }
  }
  
  private formatarData(data: any): string {
    if (!data) return '-';

    // Se data for uma string válida, converta para Date
    const date = typeof data === 'string' ? new Date(data) : data;

    // Se não for uma data válida, retorna um valor padrão
    if (isNaN(date.getTime())) {
      return '-';
    }

    // Formata no estilo brasileiro
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  // Carrega os dados de horas trabalhadas
  private loadHorasTrabalhadas() {
    const usuarioData = localStorage.getItem('usuario');
    const usuarioId = usuarioData ? JSON.parse(usuarioData).usuario?.usuarioId : null;
    
    if (!usuarioId) {
      console.error('ID do usuário não encontrado no localStorage');
      return;
    }
  
    this.controllAppService.getHorasTrabalhadas(usuarioId).subscribe({
      next: (horas) => {
        if (!horas || !Array.isArray(horas)) {
          console.error('Erro: Os dados retornados não são válidos.');
          return;
        }

        // Apenas executa o código se os dados forem válidos
        this.totalServicesOverall = horas.length;
        this.servicesCompletedOverall = horas.filter(s => s.fim).length;
      },
      error: (err) => {
        console.error('Erro ao carregar horas trabalhadas:', err);
      }
    });
  }

  // Prepara os dados para o gráfico no formato necessário
  private prepareSeriesData(monthlyData: { [month: number]: { [extraHours: number]: number } }) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return Object.keys(monthlyData).map(month => {
      const monthData = monthlyData[parseInt(month, 10)];
      return {
        name: monthNames[parseInt(month, 10)],
        data: Object.keys(monthData).map(extraHours => ({
          name: `${extraHours}h`,
          y: monthData[parseInt(extraHours, 10)]
        }))
      };
    });
  }

  carregarTodosColaboradores(): void {
    this.usuarioService.carregarTodosColaboradores().subscribe({
      next: (colaboradores) => {
        console.log('Dados brutos dos colaboradores:', colaboradores);
        console.log('URL base da API:', environment.controllApp);
        
        this.colaboradores = colaboradores.map(colaborador => {
          const fotoUrlCompleta = colaborador.fotoUrl ? 
            `${environment.mediaUrl}/${colaborador.fotoUrl.split('/').pop()}` : 
            'https://via.placeholder.com/40x40';
          console.log('Foto original:', colaborador.fotoUrl);
          console.log('Foto URL completa:', fotoUrlCompleta);
          
          return {
            ...colaborador,
            fotoUrl: fotoUrlCompleta
          };
        });
        
        console.log('Colaboradores processados:', this.colaboradores);
        this.colaboradoresOnlineCount = colaboradores.filter(colab => colab.status === 'Online').length;
      },
      error: (err) => {
        console.error('Erro ao carregar colaboradores:', err);
      }
    });
  }

  // Função para contar os usuários
  contarUsuarios(usuarios: any[]): number {
    if (!usuarios || !Array.isArray(usuarios)) {
      console.warn('Lista de usuários inválida ou vazia.');
      return 0;
    }

    return usuarios.length;
  }

  private carregarServicosDia() {
    const dataAtual = new Date().toISOString().split('T')[0]; // Data no formato: YYYY-MM-DD

    this.controllAppService.PontoGetAll().subscribe({
      next: (servicos) => {
        if (!servicos || !Array.isArray(servicos)) {
          console.warn('Nenhum serviço encontrado.');
          return;
        }

        // Corrige e filtra os serviços com base na data atual
        const servicosDoDia = servicos.filter(servico => {
          if (!servico.inicioExpediente || isNaN(new Date(servico.inicioExpediente).getTime())) {
            console.warn('Data inválida em:', servico);
            return false;
          }
          return new Date(servico.inicioExpediente).toISOString().split('T')[0] === dataAtual;
        });

        // Atualiza os contadores (mantém os mocks, mas respeita a API se houver dados)
        this.totalServices = servicosDoDia.length;
        this.servicesInProgress = servicosDoDia.filter(s => !s.fimExpediente).length;
        this.servicesCompleted = servicosDoDia.filter(s => s.fimExpediente).length;

        console.log('Serviços do dia carregados:', servicosDoDia);
      },
      error: (err) => {
        console.error('Erro ao carregar serviços do dia:', err);
      }
    });
  }

  private carregarServicosGerais(): void {
    this.controllAppService.PontoGetAll().subscribe({
      next: (pontos) => {
        this.totalServicesOverall = pontos.length;
        this.servicesCompletedOverall = pontos.filter(ponto => ponto.fimExpediente).length;

        // Calcular eficiência geral (mantém o mock se não houver API)
        this.calcularEficienciaGeral();
      },
      error: (err) => {
        console.error('Erro ao carregar serviços gerais:', err);
      }
    });
  }

  private calcularEficienciaGeral(): void {
    if (this.totalServicesOverall === 0) {
      this.efficiencyGeneral = 0;
    } else {
      this.efficiencyGeneral = Math.round((this.servicesCompletedOverall / this.totalServicesOverall) * 100);
    }
  }

  getProgressBarClass(percentual: number): string {
    if (percentual <= 30) {
      return 'progress-0-30';
    } else if (percentual <= 60) {
      return 'progress-31-60';
    } else {
      return 'progress-61-100';
    }
  }

  private atualizarProgresso(): void {
    this.colaboradoresEmServico.forEach((colaborador) => {
      colaborador.percentualTrabalhado = this.calcularPercentualTrabalhado(colaborador.inicioExpediente);
    });
  }

  public calcularPercentualTrabalhado(horaInicio: string): number {
    if (!horaInicio) return 0;

    const inicio = new Date(`${new Date().toLocaleDateString('pt-BR').split('/').reverse().join('-')}T${horaInicio}`);
    const agora = new Date();
    const horasDecorridas = (agora.getTime() - inicio.getTime()) / (1000 * 60 * 60);

    return Math.min(100, parseFloat(((horasDecorridas / 8) * 100).toFixed(2)));
  }

  public formatarPercentual(percentual: number): string {
    return percentual.toFixed(2).replace('.', ',') + '%';
  }

  abrirModalExclusao(colaborador: any): void {
    this.colaboradorSelecionado = colaborador;
    console.log("📌 Modal de exclusão aberto para:", colaborador);
  }
  
  fecharModalExclusao(): void {
    this.colaboradorSelecionado = null;
    console.log("❌ Modal de exclusão fechado.");
  }
  
  excluirColaborador(): void {
    if (!this.colaboradorSelecionado) {
      console.warn('⚠️ Nenhum colaborador selecionado para exclusão.');
      return;
    }
  
    const usuarioId = this.colaboradorSelecionado.usuarioId || this.colaboradorSelecionado.id;
    if (!usuarioId) {
      console.error("❌ ID do colaborador está indefinido!");
      alert("Erro ao excluir: ID do colaborador não encontrado.");
      return;
    }
  
    console.log(`🗑️ Tentando excluir colaborador ID: ${usuarioId}`);
  
    this.controllAppService.deleteById(usuarioId).subscribe({
      next: () => {
        console.log(`✅ Colaborador ${this.colaboradorSelecionado.nome} excluído com sucesso.`);
  
        this.colaboradores = this.colaboradores.filter(c => c.usuarioId !== usuarioId && c.id !== usuarioId);
        this.colaboradorSelecionado = null;
  
        setTimeout(() => {
          this.carregarTodosColaboradores();
        }, 500);
      },
      error: (err) => {
        console.error('❌ Erro ao excluir colaborador:', err);
  
        let errorMessage = 'Erro inesperado ao excluir colaborador.';
        if (err.status === 403) {
          errorMessage = '🚫 Permissão negada para excluir este colaborador.';
        } else if (err.status === 404) {
          errorMessage = '⚠️ Colaborador não encontrado.';
        } else if (err.status === 500) {
          errorMessage = '⚠️ Erro interno do servidor.';
        }
  
        alert(errorMessage);
      }
    });
  }
  
  confirmarExclusao(colaborador: any): void {
    this.abrirModalExclusao(colaborador);
  }

  private calcularDataInicial(periodo: string): Date {
    const hoje = new Date();
    switch (periodo) {
      case 'hoje':
        return new Date(hoje.setHours(0, 0, 0, 0));
      case 'semana':
        return new Date(hoje.setDate(hoje.getDate() - 7));
      case 'mes':
        return new Date(hoje.setMonth(hoje.getMonth() - 1));
      case 'ano':
        return new Date(hoje.setFullYear(hoje.getFullYear() - 1));
      default:
        return new Date(hoje.setHours(0, 0, 0, 0));
    }
  }

  // Desabilitar temporariamente para evitar resetar os mocks
  atualizarDados() {
    // Manter os valores mockados, ignorando chamadas à API por enquanto
    // Se quiser integrar com a API, descomente e ajuste abaixo:
    /*
    const dataInicial = this.periodoSelecionado === 'custom' ? new Date(this.dataInicial) : 
                       this.calcularDataInicial(this.periodoSelecionado);
    const dataFinal = this.periodoSelecionado === 'custom' ? new Date(this.dataFinal) : new Date();

    this.ordemServicoService.getOrdensPorPeriodo(dataInicial, dataFinal).subscribe(ordens => {
      this.totalOS = ordens.length;
      this.osRealizadas = ordens.filter(o => o.status === 'Concluída').length;
      this.osNaoAtribuidas = ordens.filter(o => !o.tecnicoId).length;
      this.osNaoRealizadas = ordens.filter(o => o.status === 'Cancelada').length;

      this.controllAppService.usuarioGetAll({ role: 'Colaborador' }).subscribe(tecnicos => {
        this.colaboradoresDesempenho = tecnicos.map(tecnico => {
          const ordensDoTecnico = ordens.filter(o => o.tecnicoId === tecnico.usuarioId);
          const ordensFinalizadas = ordensDoTecnico.filter(o => o.status === 'Concluída');

          const tempoMedio = ordensFinalizadas.reduce((acc, ordem) => {
            return acc + (ordem.tempoReal || 0);
          }, 0) / (ordensFinalizadas.length || 1);

          const eficiencia = ordensDoTecnico.length ? 
            (ordensFinalizadas.length / ordensDoTecnico.length) * 100 : 0;

          return {
            usuarioId: tecnico.usuarioId,
            nome: tecnico.nome,
            fotoUrl: tecnico.fotoUrl || 'assets/default-user.png',
            osAtribuidas: ordensDoTecnico.length,
            osRealizadas: ordensFinalizadas.length,
            osPendentes: ordensDoTecnico.length - ordensFinalizadas.length,
            tempoMedio: `${Math.round(tempoMedio)} min`,
            empresa: 'VibeTex Soluções',
            eficiencia: Math.round(eficiencia),
            jornada: '8h/diárias, 9h-18h',
            status: this.calcularStatusColaborador(tecnico)
          };
        }).filter(colaborador => colaborador.status === 'Online'); // Filtra apenas online
      });
    });
    */
  }

  private calcularStatusColaborador(colaborador: any): string {
    if (colaborador.isOnline) {
      const ultimaAtividade = new Date(colaborador.dataHoraUltimaAutenticacao);
      const agora = new Date();
      const diferencaMinutos = (agora.getTime() - ultimaAtividade.getTime()) / (1000 * 60);

      if (diferencaMinutos < 30) return 'Online';
      if (diferencaMinutos < 60) return 'Busy';
    }
    return 'Offline';
  }
}