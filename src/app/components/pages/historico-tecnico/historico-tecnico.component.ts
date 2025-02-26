import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormularioOS, MockOrdemServicoService, OrdemServico } from '../../../services/mock/mock-ordem-servico.service';

@Component({
  selector: 'app-historico-tecnico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historico-tecnico.component.html',
  styleUrls: ['./historico-tecnico.component.css']
})
export class HistoricoTecnicoComponent implements OnInit, OnDestroy {
  // Dados do usuário mockados (GILVAN BORGES, Barra da Tijuca, Rio de Janeiro)
  nomeUsuario: string = 'GILVAN BORGES';
  isOnline: boolean = true;
  horaInicioExpediente: string | null = '09:21:06'; // Exemplo da imagem
  horaFimExpediente: string | null = null; // Em andamento
  dataHoraAutenticacao: string = new Date().toLocaleString();
  userLocation: { latitude: string, longitude: string } = {
    latitude: '-22.9975824', // Coordenadas aproximadas de Barra da Tijuca, RJ
    longitude: '-43.4142322'
  };
  shiftLocation: { latitude: string, longitude: string } = {
    latitude: '-22.9975824', // Mesma localização inicial para teste
    longitude: '-43.4142322'
  };

  // Trajetos baseados nas ordens de serviço mockadas
  trajetos: any[] = [];
  trajetosFiltrados: any[] = [];
  dataSelecionada: string = new Date().toISOString().split('T')[0]; // Data atual
  mensagemSemDados: string = '';
  hoje: string = new Date().toISOString().split('T')[0];
  formulariosAbertos: { [key: string]: boolean } = {};
  formularioSelecionado: FormularioOS | null = null;

  private mapUserLocation: L.Map | null = null;
  private mapShiftLocation: L.Map | null = null;

  constructor(private mockService: MockOrdemServicoService) {}

  ngOnInit(): void {
    // Corrige o problema dos ícones do Leaflet
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
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;

    // Carrega os trajetos baseados nas ordens de serviço mockadas
    this.carregarTrajetos();
    this.initMaps();
  }

  ngOnDestroy(): void {
    if (this.mapUserLocation) {
      this.mapUserLocation.remove();
    }
    if (this.mapShiftLocation) {
      this.mapShiftLocation.remove();
    }
  }

  /**
   * Inicializa os mapas com as localizações mockadas.
   */
  private initMaps(): void {
    this.initUserMap(
      'mapUserLocation',
      this.userLocation,
      'Localização Atual',
      this.nomeUsuario,
      this.dataHoraAutenticacao
    );
    this.initShiftMap(
      'mapShiftLocation',
      this.shiftLocation,
      'Local de Início do Expediente',
      this.nomeUsuario,
      new Date().toLocaleString()
    );
  }

  /**
   * Inicializa o mapa de localização do usuário (mapUserLocation).
   */
  private initUserMap(
    mapId: string,
    location: { latitude: string, longitude: string },
    popupTitle: string,
    nomeUsuario: string,
    dataHoraAutenticacao: string
  ): void {
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      console.error('❌ Coordenadas inválidas para o mapa do usuário', location);
      return;
    }
    if (this.mapUserLocation) {
      this.mapUserLocation.remove();
    }
    this.mapUserLocation = L.map(mapId).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.mapUserLocation);

    const statusText = this.isOnline ? 'Localização Atual' : 'Última Localização';
    const horaText = this.isOnline ? 'Hora de Login' : 'Horário de Encerramento';

    L.marker([lat, lng])
      .addTo(this.mapUserLocation)
      .bindPopup(
        `${statusText}<br>
         Nome: ${nomeUsuario}<br>
         ${horaText}: ${dataHoraAutenticacao}
        `
      )
      .openPopup();
  }

  /**
   * Inicializa o mapa do início do expediente (mapShiftLocation).
   */
  private initShiftMap(
    mapId: string,
    location: { latitude: string, longitude: string },
    popupTitle: string,
    nomeUsuario: string,
    dataHoraAutenticacao: string
  ): void {
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      console.error('❌ Coordenadas inválidas para o mapa do expediente', location);
      return;
    }
    if (this.mapShiftLocation) {
      this.mapShiftLocation.remove();
    }
    this.mapShiftLocation = L.map(mapId).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.mapShiftLocation);

    L.marker([lat, lng])
      .addTo(this.mapShiftLocation)
      .bindPopup(
        `${popupTitle}<br>
         Nome: ${nomeUsuario}<br>
         Hora de Login: ${dataHoraAutenticacao}
        `
      )
      .openPopup();
  }

  /**
   * Carrega os trajetos baseados nas ordens de serviço mockadas.
   */
  private carregarTrajetos(): void {
    this.mockService.getOrdensServico().subscribe((ordens: OrdemServico[]) => {
      this.trajetos = ordens.map((ordem, index) => ({
        nome: this.nomeUsuario,
        latitudeInicio: -22.9975824 * 1e7, // Barra da Tijuca, RJ
        longitudeInicio: -43.4142322 * 1e7,
        latitudeFim: this.gerarCoordenadaAleatoria(-22.9975824, 0.01) * 1e7, // Fim próximo
        longitudeFim: this.gerarCoordenadaAleatoria(-43.4142322, 0.01) * 1e7,
        enderecoInicio: 'Avenida Malibu, Barra da Tijuca, Rio de Janeiro',
        enderecoFim: 'Endereço não disponível',
        horaInicio: '09:21:06',
        horaFim: null,
        inicio: new Date(ordem.dataAbertura).toISOString(),
        ordemServico: ordem.codigo,
        formularioId: `FORM${index + 1}`
      }));

      console.log('📍 Trajetos mapeados com endereços:', this.trajetos);
      this.filtrarPorData(); // Atualiza a lista filtrada após carregar
    });
  }

  /**
   * Gera uma coordenada aleatória próxima a uma posição base.
   */
  private gerarCoordenadaAleatoria(base: number, variacao: number): number {
    return base + (Math.random() * 2 - 1) * variacao;
  }

  /**
   * Exibe no mapa o trajeto (início/fim) selecionado na tabela.
   */
  verNoMapa(trajeto: any): void {
    const inicioLat = trajeto.latitudeInicio / 1e7;
    const inicioLng = trajeto.longitudeInicio / 1e7;
    const fimLat = trajeto.latitudeFim / 1e7;
    const fimLng = trajeto.longitudeFim / 1e7;

    if (this.mapUserLocation) {
      this.mapUserLocation.remove();
    }

    this.mapUserLocation = L.map('mapUserLocation').setView([inicioLat, inicioLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.mapUserLocation);

    L.marker([inicioLat, inicioLng])
      .addTo(this.mapUserLocation)
      .bindPopup('Início do Trajeto')
      .openPopup();

    L.marker([fimLat, fimLng])
      .addTo(this.mapUserLocation)
      .bindPopup('Fim do Trajeto');

    this.calcularERenderizarRota(inicioLat, inicioLng, fimLat, fimLng);
  }

  /**
   * Chama o OSRM para obter a rota entre os pontos e desenha no mapa.
   */
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
          opacity: 0.8
        });

        if (this.mapUserLocation) {
          polyline.addTo(this.mapUserLocation);
          this.mapUserLocation.fitBounds(polyline.getBounds(), {
            padding: [50, 50]
          });
        }
      }
    } catch (error) {
      console.error('❌ Erro ao calcular rota:', error);
      const latlngs: L.LatLngTuple[] = [
        [inicioLat, inicioLng],
        [fimLat, fimLng]
      ];
      const polyline = L.polyline(latlngs, {
        color: '#007bff',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 10'
      });

      if (this.mapUserLocation) {
        polyline.addTo(this.mapUserLocation);
        this.mapUserLocation.fitBounds(polyline.getBounds());
      }
    }
  }

  /**
   * Exibe a última localização do usuário no mapa (botão "Ver Minha Localização").
   */
  verMinhaLocalizacao(): void {
    const lat = parseFloat(this.userLocation.latitude);
    const lng = parseFloat(this.userLocation.longitude);

    if (this.mapUserLocation) {
      this.mapUserLocation.remove();
    }

    this.mapUserLocation = L.map('mapUserLocation').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.mapUserLocation);

    const popupContent = `
      <div style="padding: 8px;">
        <strong>Última Localização</strong><br>
        Nome: ${this.nomeUsuario}<br>
        Horário de Encerramento: ${this.horaFimExpediente || 'Em andamento'}
      </div>
    `;

    L.marker([lat, lng])
      .addTo(this.mapUserLocation)
      .bindPopup(popupContent)
      .openPopup();
  }

  /**
   * Filtra os trajetos locais pela data selecionada (sem recarregar do servidor).
   */
  filtrarPorData(): void {
    this.mensagemSemDados = '';
    const dataFormatada = new Date(this.dataSelecionada).toISOString().split('T')[0];

    this.trajetosFiltrados = this.trajetos.filter((trajeto) => {
      if (!trajeto.inicio) return false;
      const dataTrajeto = new Date(trajeto.inicio).toISOString().split('T')[0];
      return dataTrajeto === dataFormatada;
    });

    if (this.trajetosFiltrados.length === 0) {
      this.mensagemSemDados = `Não há registros para o dia ${new Date(this.dataSelecionada).toLocaleDateString()}`;
    }
  }

  /**
   * Ordena a lista filtrada por algum campo (ex: horaInicio).
   */
  ordenarPor(campo: string): void {
    this.trajetosFiltrados.sort((a, b) => {
      if (a[campo] < b[campo]) return -1;
      if (a[campo] > b[campo]) return 1;
      return 0;
    });
  }

  /**
   * Abre o Google Maps em outra aba com as coordenadas fornecidas.
   */
  abrirGoogleMapsComCoordenadas(latitude: number, longitude: number): void {
    const url = `https://www.google.com/maps?q=${latitude / 1e7},${longitude / 1e7}`;
    window.open(url, '_blank');
  }

  async verFormulario(trajeto: any): Promise<void> {
    this.formulariosAbertos[trajeto.formularioId] = !this.formulariosAbertos[trajeto.formularioId];
    
    if (this.formulariosAbertos[trajeto.formularioId]) {
      // Usa o método público do MockOrdemServicoService
      this.mockService.getFormularioMock(trajeto.formularioId).subscribe((formulario: FormularioOS) => {
        this.formularioSelecionado = formulario;

        // Scroll suave até o formulário
        setTimeout(() => {
          const element = document.getElementById(`formulario-${trajeto.formularioId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      });
    } else {
      this.formularioSelecionado = null;
    }
  }
}