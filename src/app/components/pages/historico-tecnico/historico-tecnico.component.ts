import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { VibeService } from '../../../services/vibe.service';
import { ControllAppService } from '../../../services/controllApp.service';
import { FormularioService } from '../../../services/formulario.service';

// Interface para tipar os dados do usuário
interface UserData {
  nome: string;
  isOnline: boolean;
  fotoUrl: string;
  latitudeAtual: string | null | undefined;
  longitudeAtual: string | null | undefined;
  dataHoraUltimaAutenticacao: string;
  nomeDaEmpresa: string;
}

// Interface para tipar os dados de trajeto e execução
interface Trajeto {
  nome: string;
  latitudeInicio: number;
  longitudeInicio: number;
  latitudeFim: number;
  longitudeFim: number;
  enderecoInicio: string;
  enderecoFim: string;
  horaInicio: string;
  horaFim: string | null;
  inicio: string;
  ordemServico: string;
  status: string;
  tipoServico: string;
  formularioId: string;
  latitudeInicioExecucaoServico: string;
  longitudeInicioExecucaoServico: string;
  latitudeFimExecucaoServico: string;
  longitudeFimExecucaoServico: string;
  nomeCliente: string;
  hasTrajetoCoordenadas: boolean;
  hasExecucaoCoordenadas: boolean;
  assinaturaCliente?: string;
  cpfCliente?: string;
  telefoneCliente?: string;
  cepCliente?: string;
  logradouroCliente?: string;
  numeroCliente?: string;
  complementoCliente?: string;
  bairroCliente?: string;
  cidadeCliente?: string;
  estadoCliente?: string;
  fotoInicio?: string;
  fotoFim?: string;
  observacoes?: string;
}

@Component({
  selector: 'app-historico-tecnico',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './historico-tecnico.component.html',
  styleUrls: ['./historico-tecnico.component.css']
})
export class HistoricoTecnicoComponent implements OnInit, OnDestroy {
  nomeUsuario: string = '';
  isOnline: boolean = false;
  horaInicioExpediente: string | null = null;
  horaFimExpediente: string | null = null;
  dataHoraAutenticacao: string = '';
  fotoPerfilUrl: string = '';
  nomeDaEmpresa: string = '';
  userLocation: { latitude: string; longitude: string } = {
    latitude: '',
    longitude: '',
  };

  trajetos: Trajeto[] = [];
  trajetosFiltrados: Trajeto[] = [];
  dataSelecionada: string = new Date().toISOString().split('T')[0];
  mensagemSemDados: string = '';
  hoje: string = new Date().toISOString().split('T')[0];

  private mapUserLocation: L.Map | null = null;
  private mapShiftLocation: L.Map | null = null;
  private usuarioId: string = '';
  private readonly BASE_URL: string = 'http://localhost:5030';

  mostrarFormulario: boolean = false;
  formularioServico: FormGroup;
  trajetoSelecionado: Trajeto | null = null;

  constructor(
    private route: ActivatedRoute,
    private vibeService: VibeService,
    private controllAppService: ControllAppService,
    private formularioService: FormularioService
  ) {
    this.formularioServico = this.formularioService.criarFormulario();
  }

  ngOnInit(): void {
    this.initLeafletIcons();
    this.usuarioId = this.route.snapshot.params['id'];
    this.carregarDadosUsuario();
    this.carregarPontos();
    this.carregarOrdensServico();
  }

  private initLeafletIcons(): void {
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';
    const iconDefault = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41],
    });
    L.Marker.prototype.options.icon = iconDefault;
  }

  private carregarDadosUsuario(): void {
    this.vibeService.buscarUsuarioPorId(this.usuarioId).subscribe({
      next: (usuario: UserData) => {
        this.nomeUsuario = usuario.nome;
        this.isOnline = usuario.isOnline;
        this.fotoPerfilUrl = usuario.fotoUrl;
        this.dataHoraAutenticacao = usuario.dataHoraUltimaAutenticacao;
        this.nomeDaEmpresa = usuario.nomeDaEmpresa;

        this.userLocation = {
          latitude: usuario.latitudeAtual ?? '',
          longitude: usuario.longitudeAtual ?? '',
        };

        this.initMaps();
      },
      error: (error) => console.error('Erro ao carregar dados do usuário:', error),
    });
  }

  private carregarPontos(): void {
    this.controllAppService.PontoGetAll().subscribe({
      next: (pontos) => {
        const pontosUsuario = pontos.filter((ponto: any) => ponto.usuarioId === this.usuarioId);
        if (pontosUsuario.length > 0) {
          const ultimoPonto = pontosUsuario[pontosUsuario.length - 1];
          if (ultimoPonto.inicioExpediente) {
            const dataInicio = new Date(ultimoPonto.inicioExpediente);
            this.horaInicioExpediente = dataInicio.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
          }
          if (ultimoPonto.fimExpediente) {
            const dataFim = new Date(ultimoPonto.fimExpediente);
            this.horaFimExpediente = dataFim.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
          }
        }
      },
      error: (error) => console.error('Erro ao carregar horários do expediente:', error),
    });
  }

  private carregarOrdensServico(): void {
    this.vibeService.buscarOrdemServicoUsuarioId(this.usuarioId).subscribe({
      next: (ordens: any[]) => {
        console.log('Ordens de serviço retornadas:', ordens);

        const trajetosAgrupados = new Map<string, any[]>();
        ordens.forEach((ordem: any) => {
          if (ordem.trajetos && ordem.trajetos.length > 0) {
            trajetosAgrupados.set(ordem.numeroOrdemDeServico, ordem.trajetos);
          }
        });

        this.trajetos = Array.from(trajetosAgrupados.entries()).map(([ordemServico, trajetos]) => {
          const trajeto = trajetos[0];

          // Convert string coordinates to numbers, handling null or undefined values
          const parseCoordinate = (value: string | null | undefined): number => {
            if (!value || value === 'string') return 0;
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
          };

          // Extract trajectory coordinates using correct property names from API
          const latitudeInicio = parseCoordinate(trajeto.latitudeInicioTrajeto);
          const longitudeInicio = parseCoordinate(trajeto.longitudeInicioTrajeto);
          const latitudeFim = parseCoordinate(trajeto.latitudeFimTrajeto);
          const longitudeFim = parseCoordinate(trajeto.longitudeFimTrajeto);

          let dataHoraInicio = trajeto.dataEHoraIncioTrajeto || trajeto.dataHoraInicio;
          let inicioDate: Date;

          if (!dataHoraInicio || typeof dataHoraInicio !== 'string') {
            console.warn(`DataHoraInicio inválida para a ordem ${ordemServico}:`, dataHoraInicio);
            inicioDate = new Date();
            dataHoraInicio = inicioDate.toISOString();
          } else {
            inicioDate = new Date(dataHoraInicio);
            if (isNaN(inicioDate.getTime())) {
              console.warn(`DataHoraInicio não pôde ser convertida para uma data válida para a ordem ${ordemServico}:`, dataHoraInicio);
              inicioDate = new Date();
              dataHoraInicio = inicioDate.toISOString();
            }
          }

          let horaFim: string | null = null;
          if (trajeto.dataEHoraFimDoTrajeto || trajeto.dataHoraFim) {
            const fimDate = new Date(trajeto.dataEHoraFimDoTrajeto || trajeto.dataHoraFim);
            if (isNaN(fimDate.getTime())) {
              console.warn(`DataHoraFim não pôde ser convertida para uma data válida para a ordem ${ordemServico}:`, trajeto.dataHoraFim);
            } else {
              horaFim = fimDate.toLocaleTimeString('pt-BR');
            }
          }

          const ordem = ordens.find(o => o.numeroOrdemDeServico === ordemServico);

          const execucao = ordem?.execucoes && ordem.execucoes.length > 0 ? ordem.execucoes[0] : {};

          const latitudeInicioExecucao = typeof execucao.latitudeInicioExecucaoServico === 'string' && execucao.latitudeInicioExecucaoServico !== 'string' ? execucao.latitudeInicioExecucaoServico : '';
          const longitudeInicioExecucao = typeof execucao.longitudeInicioExecucaoServico === 'string' && execucao.longitudeInicioExecucaoServico !== 'string' ? execucao.longitudeInicioExecucaoServico : '';
          const latitudeFimExecucao = typeof execucao.latitudeFimExecucaoServico === 'string' && execucao.latitudeFimExecucaoServico !== 'string' ? execucao.latitudeFimExecucaoServico : '';
          const longitudeFimExecucao = typeof execucao.longitudeFimExecucaoServico === 'string' && execucao.longitudeFimExecucaoServico !== 'string' ? execucao.longitudeFimExecucaoServico : '';

          // Update hasTrajetoCoordenadas to check the parsed values
          const hasTrajetoCoordenadas = latitudeInicio !== 0 && longitudeInicio !== 0 && latitudeFim !== 0 && longitudeFim !== 0;
          const hasExecucaoCoordenadas = !!latitudeInicioExecucao && !!longitudeInicioExecucao && !!latitudeFimExecucao && !!longitudeFimExecucao;

          // Usar ordem.cliente para obter os dados do cliente
          const cliente = ordem?.cliente || {};
          
          // Simplificar endereço para mostrar apenas o bairro quando disponível
          const bairro = cliente.endereco?.bairro || '';
          
          // Usar apenas o bairro como endereço principal para exibição
          const enderecoFinal = bairro ? 
            bairro : 
            (execucao.enderecoInicioExecucao || trajeto.enderecoCliente || 'Endereço não disponível');

          // Manter o endereço completo para o formulário detalhado
          const logradouro = cliente.endereco?.logradouro || '';
          const numero = cliente.endereco?.numero || '';
          const complemento = cliente.endereco?.complemento ? `, ${cliente.endereco?.complemento}` : '';
          const cidade = cliente.endereco?.localidade ? `, ${cliente.endereco?.localidade}` : '';
          const estado = cliente.endereco?.uf ? `-${cliente.endereco?.uf}` : '';
          
          // Endereço completo para uso no formulário detalhado
          const enderecoCompleto = `${logradouro} ${numero}${complemento}${cidade}${estado}`;

          const fotoInicio = execucao.fotoInicioServico ? `${this.BASE_URL}${execucao.fotoInicioServico}` : '';
          const fotoFim = execucao.fotoFimServico ? `${this.BASE_URL}${execucao.fotoFimServico}` : '';
          const assinaturaCliente = ordem?.assinaturaCliente ? `${this.BASE_URL}${ordem.assinaturaCliente}` : '';

          return {
            nome: this.nomeUsuario,
            latitudeInicio, // Use the parsed value
            longitudeInicio, // Use the parsed value
            latitudeFim, // Use the parsed value
            longitudeFim, // Use the parsed value
            enderecoInicio: enderecoFinal, // Apenas o bairro para exibição na tabela
            enderecoCompleto: enderecoCompleto, // Endereço completo para uso no formulário
            enderecoFim: execucao.enderecoFimExecucao || enderecoFinal,
            horaInicio: inicioDate.toLocaleTimeString('pt-BR'),
            horaFim,
            inicio: dataHoraInicio,
            ordemServico,
            status: ordem?.statusOrdem || 'Desconhecido',
            tipoServico: ordem?.tipoServico || 'Desconhecido',
            formularioId: ordem?.ordemDeServicoId || '',
            latitudeInicioExecucaoServico: latitudeInicioExecucao,
            longitudeInicioExecucaoServico: longitudeInicioExecucao,
            latitudeFimExecucaoServico: latitudeFimExecucao,
            longitudeFimExecucaoServico: longitudeFimExecucao,
            nomeCliente: cliente.nomeCliente || 'Cliente não disponível',
            hasTrajetoCoordenadas,
            hasExecucaoCoordenadas,
            assinaturaCliente,
            cpfCliente: cliente.cpfCliente || '',
            telefoneCliente: cliente.telefoneCliente || '',
            cepCliente: cliente.endereco?.cep || '',
            logradouroCliente: cliente.endereco?.logradouro || '',
            numeroCliente: cliente.endereco?.numero || '',
            complementoCliente: cliente.endereco?.complemento || '',
            bairroCliente: cliente.endereco?.bairro || '',
            cidadeCliente: cliente.endereco?.localidade || '',
            estadoCliente: cliente.endereco?.uf || '',
            fotoInicio,
            fotoFim
          };
        });
        this.filtrarPorData();
      },
      error: (error) => console.error('Erro ao carregar ordens de serviço:', error),
    });
  }

  // Método para formatar o código O.S com zeros à esquerda
  formatarCodigoOS(codigo: string): string {
    if (!codigo) return '000';
    
    // Converte para número e de volta para string para remover zeros à esquerda existentes
    const codigoNumerico = parseInt(codigo, 10);
    if (isNaN(codigoNumerico)) return codigo;
    
    // Adiciona zeros à esquerda para garantir 3 dígitos
    return codigoNumerico.toString().padStart(3, '0');
  }

  filtrarPorData(): void {
    this.mensagemSemDados = '';

    const dataSelecionadaDate = new Date(this.dataSelecionada);
    const dataFormatada = dataSelecionadaDate.toISOString().split('T')[0];

    this.trajetosFiltrados = this.trajetos.filter((trajeto) => {
      if (!trajeto.inicio) {
        console.warn('Trajeto sem data de início:', trajeto);
        const dataAtual = new Date().toISOString().split('T')[0];
        return dataAtual === dataFormatada;
      }

      const dataTrajetoDate = new Date(trajeto.inicio);
      if (isNaN(dataTrajetoDate.getTime())) {
        console.warn('Data de início inválida no trajeto:', trajeto.inicio);
        const dataAtual = new Date().toISOString().split('T')[0];
        return dataAtual === dataFormatada;
      }

      const dataTrajeto = dataTrajetoDate.toISOString().split('T')[0];
      console.log(`Comparando data do trajeto ${dataTrajeto} com data selecionada ${dataFormatada}`);
      return dataTrajeto === dataFormatada;
    });

    if (this.trajetosFiltrados.length === 0) {
      const [ano, mes, dia] = this.dataSelecionada.split('-');
      const dataFormatadaExibicao = `${dia}/${mes}/${ano}`;
      this.mensagemSemDados = `Não há registros para o dia ${dataFormatadaExibicao}`;
    } else {
      console.log('Trajetos filtrados:', this.trajetosFiltrados);
    }

    this.initMaps();
  }

  private initMaps(): void {
    this.initUserMap(
      'mapUserLocation',
      this.userLocation,
      'Localização Atual',
      this.nomeUsuario,
      this.dataHoraAutenticacao
    );
    this.initExecutionStartMap('mapShiftLocation', this.nomeUsuario);
  }

  private initUserMap(
    mapId: string,
    location: { latitude: string; longitude: string },
    popupTitle: string,
    nomeUsuario: string,
    dataHoraAutenticacao: string
  ): void {
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);

    if (this.mapUserLocation) {
      this.mapUserLocation.remove();
    }

    if (isNaN(lat) || isNaN(lng)) {
      console.error('❌ Coordenadas inválidas para o mapa do usuário', location);

      this.mapUserLocation = L.map(mapId).setView([-23.0, -43.0], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(this.mapUserLocation);

      L.marker([-23.0, -43.0])
        .addTo(this.mapUserLocation!)
        .bindPopup('Localização do usuário indisponível no momento.')
        .openPopup();
      return;
    }

    this.mapUserLocation = L.map(mapId).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.mapUserLocation);

    const statusText = this.isOnline ? 'Localização Atual' : 'Última Localização';
    const horaText = this.isOnline ? 'Hora de Login' : 'Horário de Encerramento';
    
    // Criar ícone colorido baseado na empresa
    const iconColor = this.determinarCorIcone(this.nomeDaEmpresa);
    const customIcon = L.icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${iconColor}.png`,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    if (this.mapUserLocation) {
      L.marker([lat, lng], { icon: customIcon })
        .addTo(this.mapUserLocation)
        .bindPopup(
          `${statusText}<br>
           Nome: ${nomeUsuario}<br>
           ${horaText}: ${dataHoraAutenticacao}`
        )
        .openPopup();
    }
  }

  private initExecutionStartMap(mapId: string, nomeUsuario: string): void {
    if (this.mapShiftLocation) {
      this.mapShiftLocation.remove();
    }

    this.mapShiftLocation = L.map(mapId).setView([-23.0, -43.0], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.mapShiftLocation);

    const markers: L.Marker[] = [];
    
    // Criar ícone colorido baseado na empresa
    const iconColor = this.determinarCorIcone(this.nomeDaEmpresa);
    const customIcon = L.icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${iconColor}.png`,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    this.trajetosFiltrados.forEach((trajeto, index) => {
      const lat = parseFloat(trajeto.latitudeInicioExecucaoServico);
      const lng = parseFloat(trajeto.longitudeInicioExecucaoServico);

      if (!isNaN(lat) && !isNaN(lng)) {
        const marker = L.marker([lat, lng], { icon: customIcon })
          .addTo(this.mapShiftLocation as L.Map)
          .bindPopup(
            `Início da Execução (${index + 1})<br>
             Ordem de Serviço: ${trajeto.ordemServico}<br>
             Nome: ${nomeUsuario}<br>
             Data/Hora: ${trajeto.horaInicio}`
          );
        markers.push(marker);
      }
    });

    if (markers.length > 0) {
      const group = new L.FeatureGroup(markers);
      if (this.mapShiftLocation) {
        this.mapShiftLocation.fitBounds(group.getBounds(), {
          padding: [50, 50],
        });
      }
    } else {
      L.marker([-23.0, -43.0], { icon: customIcon })
        .addTo(this.mapShiftLocation as L.Map)
        .bindPopup('Nenhum ponto de início de execução disponível para o dia selecionado.')
        .openPopup();
    }
  }

  mostrarRotaNoMapa(trajeto: Trajeto, tipoRota: 'trajeto' | 'execucao'): void {
    let inicioLat: number,
      inicioLng: number,
      fimLat: number,
      fimLng: number,
      popupInicio: string,
      popupFim: string;

    if (tipoRota === 'trajeto') {
      // Handle trajectory coordinates, converting if necessary
      const rawLat = trajeto.latitudeInicio;
      const rawLng = trajeto.longitudeInicio;
      const rawLatFim = trajeto.latitudeFim;
      const rawLngFim = trajeto.longitudeFim;

      // Only divide by 1e7 if the values are large, indicating they need conversion
      inicioLat = Math.abs(rawLat) > 100 ? rawLat / 1e7 : rawLat;
      inicioLng = Math.abs(rawLng) > 100 ? rawLng / 1e7 : rawLng;
      fimLat = Math.abs(rawLatFim) > 100 ? rawLatFim / 1e7 : rawLatFim;
      fimLng = Math.abs(rawLngFim) > 100 ? rawLngFim / 1e7 : rawLngFim;
      
      popupInicio = 'Início do Trajeto';
      popupFim = 'Fim do Trajeto';
      console.log('Coordenadas do trajeto:', { inicioLat, inicioLng, fimLat, fimLng });
    } else {
      // Handle execution coordinates
      inicioLat = parseFloat(trajeto.latitudeInicioExecucaoServico);
      inicioLng = parseFloat(trajeto.longitudeInicioExecucaoServico);
      fimLat = parseFloat(trajeto.latitudeFimExecucaoServico);
      fimLng = parseFloat(trajeto.longitudeFimExecucaoServico);
      popupInicio = 'Início da Execução';
      popupFim = 'Fim da Execução';
      console.log('Coordenadas da execução:', { inicioLat, inicioLng, fimLat, fimLng });
    }

    if (isNaN(inicioLat) || isNaN(inicioLng) || isNaN(fimLat) || isNaN(fimLng)) {
      console.error('❌ Coordenadas inválidas para a rota', {
        inicioLat,
        inicioLng,
        fimLat,
        fimLng,
      });

      if (this.mapUserLocation) {
        this.mapUserLocation.remove();
      }
      this.mapUserLocation = L.map('mapUserLocation').setView([-23.0, -43.0], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(this.mapUserLocation);

      L.marker([-23.0, -43.0])
        .addTo(this.mapUserLocation!)
        .bindPopup('Coordenadas indisponíveis para exibir a rota.')
        .openPopup();
      return;
    }

    if (this.mapUserLocation) {
      this.mapUserLocation.remove();
    }

    this.mapUserLocation = L.map('mapUserLocation').setView([inicioLat, inicioLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.mapUserLocation);

    // Criar ícone colorido baseado na empresa
    const iconColor = this.determinarCorIcone(this.nomeDaEmpresa);
    const customIcon = L.icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${iconColor}.png`,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    if (this.mapUserLocation) {
      L.marker([inicioLat, inicioLng], { icon: customIcon })
        .addTo(this.mapUserLocation)
        .bindPopup(popupInicio)
        .openPopup();

      L.marker([fimLat, fimLng], { icon: customIcon })
        .addTo(this.mapUserLocation)
        .bindPopup(popupFim);

      this.calcularERenderizarRota(inicioLat, inicioLng, fimLat, fimLng);
    } else {
      console.error('MapUserLocation não inicializado corretamente.');
    }
  }

  private async calcularERenderizarRota(
    inicioLat: number,
    inicioLng: number,
    fimLat: number,
    fimLng: number
  ): Promise<void> {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${inicioLng},${inicioLat};${fimLng},${fimLat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const coordinates = data.routes[0].geometry.coordinates;
        const latLngs = coordinates.map((coord: number[]) => [coord[1], coord[0]]);

        const polyline = L.polyline(latLngs, {
          color: '#007bff',
          weight: 4,
          opacity: 0.8,
        });

        if (this.mapUserLocation) {
          polyline.addTo(this.mapUserLocation);
          this.mapUserLocation.fitBounds(polyline.getBounds(), {
            padding: [50, 50],
          });
        }
      }
    } catch (error) {
      console.error('❌ Erro ao calcular rota:', error);
      const latlngs: L.LatLngTuple[] = [
        [inicioLat, inicioLng],
        [fimLat, fimLng],
      ];
      const polyline = L.polyline(latlngs, {
        color: '#007bff',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10',
      });

      if (this.mapUserLocation) {
        polyline.addTo(this.mapUserLocation);
        this.mapUserLocation.fitBounds(polyline.getBounds());
      }
    }
  }

  verMinhaLocalizacao(): void {
    const lat = parseFloat(this.userLocation.latitude);
    const lng = parseFloat(this.userLocation.longitude);

    if (this.mapUserLocation) {
      this.mapUserLocation.remove();
    }

    if (isNaN(lat) || isNaN(lng)) {
      this.mapUserLocation = L.map('mapUserLocation').setView([-23.0, -43.0], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(this.mapUserLocation);

      L.marker([-23.0, -43.0])
        .addTo(this.mapUserLocation!)
        .bindPopup('Localização do usuário indisponível no momento.')
        .openPopup();
      return;
    }

    this.mapUserLocation = L.map('mapUserLocation').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(this.mapUserLocation);

    const popupContent = `
      <div style="padding: 8px;">
        <strong>Última Localização</strong><br>
        Nome: ${this.nomeUsuario}<br>
        Horário de Encerramento: ${this.horaFimExpediente || 'Em andamento'}
      </div>
    `;

    // Criar ícone colorido baseado na empresa
    const iconColor = this.determinarCorIcone(this.nomeDaEmpresa);
    const customIcon = L.icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${iconColor}.png`,
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    if (this.mapUserLocation) {
      L.marker([lat, lng], { icon: customIcon })
        .addTo(this.mapUserLocation)
        .bindPopup(popupContent)
        .openPopup();
    }
  }

  ordenarPor(campo: keyof Trajeto): void {
    this.trajetosFiltrados.sort((a, b) => {
      const valorA = a[campo];
      const valorB = b[campo];

      if (valorA == null && valorB == null) return 0;
      if (valorA == null) return 1;
      if (valorB == null) return -1;

      if (typeof valorA === 'string' && typeof valorB === 'string') {
        return valorA.localeCompare(valorB);
      }

      if (typeof valorA === 'number' && typeof valorB === 'number') {
        return valorA - valorB;
      }

      return String(valorA).localeCompare(String(valorB));
    });
  }

  abrirGoogleMapsComCoordenadas(latitude: number, longitude: number): void {
    // Modify this method to handle coordinates properly
    const lat = typeof latitude === 'number' ? latitude : parseFloat(String(latitude));
    const lng = typeof longitude === 'number' ? longitude : parseFloat(String(longitude));
    
    // Only divide by 1e7 if the values are large, indicating they need conversion
    const finalLat = Math.abs(lat) > 100 ? lat / 1e7 : lat;
    const finalLng = Math.abs(lng) > 100 ? lng / 1e7 : lng;
    
    const url = `https://www.google.com/maps?q=${finalLat},${finalLng}`;
    window.open(url, '_blank');
  }

  abrirFormulario(trajeto: Trajeto): void {
    if (trajeto.formularioId) {
      this.trajetoSelecionado = trajeto;
      this.mostrarFormulario = true;
      this.inicializarFormulario(trajeto);
    }
  }

  fecharFormulario(): void {
    this.mostrarFormulario = false;
    this.trajetoSelecionado = null;
    this.formularioServico.reset();
  }

  private async inicializarFormulario(trajeto: Trajeto): Promise<void> {
    try {
      const dados = {
        codigoOS: this.formatarCodigoOS(trajeto.ordemServico) || 'N/A',
        nomeColaborador: this.nomeUsuario || 'Não informado',
        empresaColaborador: this.nomeDaEmpresa || 'VIBETEX', // Usando a empresa do colaborador
        nomeCliente: trajeto.nomeCliente || 'Não informado',
        cpf: trajeto.cpfCliente || 'Não informado',
        telefone: trajeto.telefoneCliente || 'Não informado',
        cep: trajeto.cepCliente || 'Não informado',
        logradouro: trajeto.logradouroCliente || 'Não informado',
        numero: trajeto.numeroCliente || 'Não informado',
        complemento: trajeto.complementoCliente || '',
        bairro: trajeto.bairroCliente || 'Não informado',
        cidade: trajeto.cidadeCliente || 'Não informado',
        estado: trajeto.estadoCliente || 'Não informado',
        observacoes: trajeto.observacoes || 'N/A',
        fotoInicio: trajeto.fotoInicio || '',
        fotoFim: trajeto.fotoFim || '',
        assinatura: trajeto.assinaturaCliente || ''
      };
  
      console.log('Dados do formulário antes de preencher:', dados);
      this.formularioServico.patchValue(dados);
      console.log('Formulário após preenchimento:', this.formularioServico.value);
  
      // Forçar a validação do formulário
      this.formularioServico.markAllAsTouched();
      if (!this.formularioServico.valid) {
        console.warn('Formulário inválido após preenchimento:', this.formularioServico.errors);
        Object.keys(this.formularioServico.controls).forEach(key => {
          const control = this.formularioServico.get(key);
          if (control?.invalid) {
            console.warn(`Campo ${key} está inválido:`, control.errors);
          }
        });
      }
    } catch (error) {
      console.error('Erro ao inicializar formulário:', error);
      alert('Erro ao carregar o formulário.');
    }
  }

  gerarPDF(): void {
    if (!this.formularioServico.valid) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      const formData = this.formularioServico.value;
      console.log('Dados enviados para gerarPDF:', formData);
      
      const assinaturaBase64 = formData.assinatura || '';
      
      // Mostrar indicador de carregamento
      alert('Gerando PDF, por favor aguarde...');
      
      this.formularioService.gerarPDF(formData, assinaturaBase64)
        .catch(error => {
          console.error('Erro ao gerar PDF:', error);
          alert('Ocorreu um erro ao gerar o PDF, mas um PDF parcial pode ter sido criado.');
        });
    } catch (error) {
      console.error('Erro ao preparar dados para o PDF:', error);
      alert('Erro ao gerar PDF. Verifique o console para mais informações.');
    }
  }

  ngOnDestroy(): void {
    if (this.mapUserLocation) this.mapUserLocation.remove();
    if (this.mapShiftLocation) this.mapShiftLocation.remove();
  }

  // Método auxiliar para determinar a cor do ícone baseado na empresa
  private determinarCorIcone(empresa: string): string {
    if (!empresa) return 'blue';
    
    const empresaNormalizada = empresa.toLowerCase().trim();
    
    if (empresaNormalizada.includes('flamengo')) {
      return 'red';
    } else if (empresaNormalizada.includes('figth') || 
              empresaNormalizada.includes('fight')) {
      return 'blue';
    } else if (empresaNormalizada.includes('vibetex')) {
      return 'green';
    } else if (empresaNormalizada.includes('nexus')) {
      return 'orange';
    }
    
    return 'blue'; // cor padrão
  }
}