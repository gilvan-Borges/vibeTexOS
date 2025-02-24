import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';
import { ControllAppService } from '../../../services/controllApp.service';
import { UsuarioResponseDto } from '../../../models/control-app/usuario.response.dto';
import { LatLngTuple } from 'leaflet';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-historico-tecnico',
  standalone: true,
  imports: [CommonModule, FormsModule], // Import CommonModule para usar pipes do Angular, como 'date'
  templateUrl: './historico-tecnico.component.html',
  styleUrls: ['./historico-tecnico.component.css']
})
export class HistoricoTecnicoComponent implements OnInit {
  colaboradorId: string | null = null;
  userLocation: { latitude: string, longitude: string } | null = null;
  shiftLocation: { latitude: string, longitude: string } | null = null;
  nomeUsuario: string = '';
  horaInicioExpediente: string | null = null;
  horaFimExpediente: string | null = null;
  dataHoraAutenticacao: string = '';
  isOnline: boolean = false;
  trajetos: any[] = [];
  trajetosFiltrados: any[] = [];
  dataSelecionada: string = new Date().toISOString().split('T')[0]; // Data atual
  mensagemSemDados: string = '';
  hoje: string = new Date().toISOString().split('T')[0];

  private mapUserLocation: L.Map | null = null;
  private mapShiftLocation: L.Map | null = null;

  // Localização padrão (São Paulo, Brasil)
  private defaultLocation: { latitude: string, longitude: string } = {
    latitude: '-23.5505', // Latitude de São Paulo
    longitude: '-46.6333' // Longitude de São Paulo
  };

  constructor(
    private route: ActivatedRoute,
    private controllAppService: ControllAppService
  ) {}

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

    // Obtém o ID do colaborador da rota
    this.colaboradorId = this.route.snapshot.paramMap.get('id');

    // Se tiver ID, carrega os dados para a data atual
    if (this.colaboradorId) {
      this.carregarDadosPorData(this.dataSelecionada);
    } else {
      // Se não houver ID, inicializa os mapas com a localização padrão
      this.initUserMap(
        'mapUserLocation',
        this.defaultLocation,
        'Localização Padrão',
        'Sem usuário',
        'Sem horário'
      );
      this.initShiftMap(
        'mapShiftLocation',
        this.defaultLocation,
        'Localização Padrão',
        'Sem usuário',
        'Sem horário'
      );
    }
  }

  /**
   * Carrega os dados do usuário e seus pontos para a data especificada.
   */
  public async carregarDadosPorData(data: string): Promise<void> {
    try {
      // 1) Carrega os dados do usuário
      const usuario = await this.controllAppService
        .usuarioGetById(this.colaboradorId as string)
        .toPromise();
      this.nomeUsuario = usuario?.nome || 'Usuário não identificado';
      this.isOnline = usuario?.isOnline || false;

      // 2) Carrega os pontos do usuário
      const pontos = await this.controllAppService
        .PontoGetByUsuarioId(this.colaboradorId as string)
        .toPromise();

      // 3) Filtra os pontos pela data selecionada
      const dataFormatada = new Date(data).toISOString().split('T')[0];
      const pontosDoDia = (pontos || []).filter((ponto) => {
        const dataPonto = new Date(ponto.inicioExpediente)
          .toISOString()
          .split('T')[0];
        return dataPonto === dataFormatada;
      });

      // 4) Atualiza dados de expediente (horários e mapas)
      if (pontosDoDia.length > 0) {
        const ultimoPonto = pontosDoDia[pontosDoDia.length - 1];

        // Horário de início/fim do expediente
        this.horaInicioExpediente = ultimoPonto.inicioExpediente
          ? new Date(ultimoPonto.inicioExpediente).toLocaleTimeString()
          : null;
        this.horaFimExpediente = ultimoPonto.fimExpediente
          ? new Date(ultimoPonto.fimExpediente).toLocaleTimeString()
          : null;

        // Mapa do local de início do expediente
        if (
          ultimoPonto.latitudeInicioExpediente &&
          ultimoPonto.longitudeInicioExpediente
        ) {
          const lat = ultimoPonto.latitudeInicioExpediente / 1e7;
          const lng = ultimoPonto.longitudeInicioExpediente / 1e7;
          this.shiftLocation = { latitude: lat.toString(), longitude: lng.toString() };

          this.initShiftMap(
            'mapShiftLocation',
            this.shiftLocation,
            'Local de Início do Expediente',
            this.nomeUsuario,
            new Date(ultimoPonto.inicioExpediente).toLocaleString()
          );
        }

        // Mapa da localização atual (somente se for hoje)
        if (
          dataFormatada === this.hoje &&
          usuario?.latitudeAtual &&
          usuario?.longitudeAtual
        ) {
          this.userLocation = {
            latitude: usuario.latitudeAtual,
            longitude: usuario.longitudeAtual
          };
          this.initUserMap(
            'mapUserLocation',
            this.userLocation,
            'Localização Atual',
            this.nomeUsuario,
            new Date().toLocaleString()
          );
        }
      } else {
        // Se não houver registros para a data
        this.horaInicioExpediente = null;
        this.horaFimExpediente = null;
        this.mensagemSemDados = `Não há registros para o dia ${new Date(
          data
        ).toLocaleDateString()}`;

        // Inicializa os mapas com localização padrão
        this.initUserMap(
          'mapUserLocation',
          this.defaultLocation,
          'Sem registros',
          this.nomeUsuario,
          'Sem horário'
        );
        this.initShiftMap(
          'mapShiftLocation',
          this.defaultLocation,
          'Sem registros',
          this.nomeUsuario,
          'Sem horário'
        );
      }

      // 5) Atualiza os trajetos e filtra localmente
      await this.carregarTrajetos();
      this.filtrarPorData();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.mensagemSemDados = 'Erro ao carregar os dados. Tente novamente.';
    }
  }

  /**
   * Carrega a localização atual do usuário (API).
   */
  loadUserLocation(): void {
    if (!this.colaboradorId) {
      console.error('❌ ID do técnico não fornecido');
      // Inicializa o mapa com a localização padrão
      this.initUserMap(
        'mapUserLocation',
        this.defaultLocation,
        'Localização Padrão',
        'Sem usuário',
        'Sem horário'
      );
      return;
    }

    this.controllAppService.usuarioGetById(this.colaboradorId).subscribe({
      next: (response: any) => {
        console.log('✅ Resposta completa da API:', response);
        this.isOnline = response?.isOnline || false;

        if (response?.latitudeAtual && response?.longitudeAtual) {
          this.userLocation = {
            latitude: response.latitudeAtual,
            longitude: response.longitudeAtual
          };
          const nomeUsuario = response.nome || 'Nome não disponível';
          const dataHoraAutenticacao = response.dataHoraUltimaAutenticacao
            ? new Date(response.dataHoraUltimaAutenticacao).toLocaleString()
            : 'Horário não disponível';
          console.log('📍 Coordenadas encontradas:', this.userLocation);

          this.initUserMap(
            'mapUserLocation',
            this.userLocation,
            'Localização Atual',
            nomeUsuario,
            dataHoraAutenticacao
          );
        } else {
          console.warn('⚠️ Coordenadas não encontradas para o usuário:', {
            id: this.colaboradorId,
            lat: response?.latitudeAtual,
            lng: response?.longitudeAtual,
            response: response
          });
          this.initUserMap(
            'mapUserLocation',
            this.defaultLocation,
            'Localização Padrão',
            'Sem usuário',
            'Sem horário'
          );
        }
      },
      error: (err) => {
        console.error('❌ Erro ao buscar localização do usuário:', err);
        this.initUserMap(
          'mapUserLocation',
          this.defaultLocation,
          'Localização Padrão',
          'Sem usuário',
          'Sem horário'
        );
      }
    });
  }

  /**
   * Carrega a localização de início de expediente (API).
   */
  loadShiftEndLocation(): void {
    console.log(
      '📡 Buscando localização do fim do expediente para ID:',
      this.colaboradorId
    );
    if (!this.colaboradorId) {
      console.warn('⚠️ Nenhum ID de colaborador foi fornecido!');
      this.initShiftMap(
        'mapShiftLocation',
        this.defaultLocation,
        'Localização Padrão',
        'Usuário não identificado',
        'Sem horário'
      );
      return;
    }

    // Primeiro, buscar os dados do usuário para obter o nome
    this.controllAppService.usuarioGetById(this.colaboradorId as string).subscribe({
      next: (usuario: UsuarioResponseDto) => {
        this.nomeUsuario = usuario?.nome || 'Usuário não identificado';

        // Depois, buscar os dados do ponto
        this.controllAppService
          .PontoGetByUsuarioId(this.colaboradorId as string)
          .subscribe({
            next: (data) => {
              console.log('✅ Resposta da API - PontoGetByUsuarioId:', data);
              const pontosFiltrados = data.filter(
                (ponto) => ponto.tipoPonto === 'Expediente'
              );
              if (pontosFiltrados.length > 0) {
                const ultimoPonto = pontosFiltrados[pontosFiltrados.length - 1];

                this.horaInicioExpediente = ultimoPonto.inicioExpediente
                  ? new Date(ultimoPonto.inicioExpediente).toLocaleTimeString()
                  : 'Usuário não iniciou o expediente';

                this.horaFimExpediente = ultimoPonto.fimExpediente
                  ? new Date(ultimoPonto.fimExpediente).toLocaleTimeString()
                  : this.horaInicioExpediente !==
                    'Usuário não iniciou o expediente'
                  ? 'Em andamento'
                  : 'Usuário não iniciou o expediente';

                const lat = ultimoPonto.latitudeInicioExpediente / 1e7;
                const lng = ultimoPonto.longitudeInicioExpediente / 1e7;

                if (isNaN(lat) || isNaN(lng)) {
                  console.warn(
                    '⚠️ Coordenadas inválidas, não exibindo o mapa do início do expediente.'
                  );
                  this.initShiftMap(
                    'mapShiftLocation',
                    this.defaultLocation,
                    'Localização Padrão',
                    this.nomeUsuario,
                    'Sem horário'
                  );
                  return;
                }

                this.shiftLocation = {
                  latitude: lat.toString(),
                  longitude: lng.toString()
                };
                console.log(
                  '📍 Exibindo somente as coordenadas do início do expediente:',
                  this.shiftLocation
                );

                const dataHora = ultimoPonto.inicioExpediente
                  ? new Date(ultimoPonto.inicioExpediente).toLocaleString()
                  : new Date().toLocaleString();

                this.initShiftMap(
                  'mapShiftLocation',
                  this.shiftLocation,
                  'Local de Início do Expediente',
                  this.nomeUsuario,
                  dataHora
                );
              } else {
                console.warn(
                  '⚠️ Nenhum registro de ponto encontrado para o usuário.'
                );
                this.horaInicioExpediente = 'Usuário não iniciou o expediente';
                this.horaFimExpediente = 'Usuário não iniciou o expediente';
                this.initShiftMap(
                  'mapShiftLocation',
                  this.defaultLocation,
                  'Localização Padrão',
                  this.nomeUsuario,
                  'Usuário não iniciou o expediente'
                );
              }
            },
            error: (err) => {
              console.error('❌ Erro ao buscar localização de fim do expediente:', err);
              this.initShiftMap(
                'mapShiftLocation',
                this.defaultLocation,
                'Localização Padrão',
                this.nomeUsuario,
                'Sem horário'
              );
            }
          });
      },
      error: (err) => {
        console.error('❌ Erro ao buscar dados do usuário:', err);
        this.initShiftMap(
          'mapShiftLocation',
          this.defaultLocation,
          'Localização Padrão',
          'N/A',
          'Sem horário'
        );
      }
    });
  }

  /**
   * Inicializa o mapa de localização do usuário (mapUserLocation).
   */
  initUserMap(
    mapId: string,
    location: { latitude: string; longitude: string },
    popupTitle: string,
    nomeUsuario: string,
    dataHoraAutenticacao: string
  ): void {
    console.log(
      `🗺️ Criando mapa ${mapId} com as coordenadas do início do expediente:`,
      location
    );
    if (!location || !location.latitude || !location.longitude) {
      console.error(`❌ Erro: Coordenadas inválidas para ${mapId}`, location);
      return;
    }
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      console.error(
        `❌ Erro: Coordenadas não são números válidos para ${mapId}`,
        location
      );
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

    // Ajusta o texto do popup baseado no status online
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
    location: { latitude: string; longitude: string },
    popupTitle: string,
    nomeUsuario: string,
    dataHoraAutenticacao: string
  ): void {
    console.log(`🗺️ Criando mapa ${mapId} com as coordenadas:`, location);
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      console.error(`❌ Erro: Coordenadas inválidas para ${mapId}`, location);
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

    console.log('📍 Coordenadas para inicialização do mapa:', this.shiftLocation);
  }

  /**
   * Converte as coordenadas para um formato de exibição (até 6 casas decimais).
   */
  convertCoordinates(value: number | string | null): string {
    if (value == null) return 'Sem coordenadas';
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    const result = numericValue / 1e7;
    return isNaN(result) ? 'Sem coordenadas' : result.toFixed(6);
  }

  /**
   * Obtém o endereço de lat/lon usando Nominatim (OpenStreetMap).
   */
  private async obterEndereco(lat: number, lon: number): Promise<string> {
    try {
      // Delay de 300ms para evitar muitas requisições seguidas
      await new Promise(resolve => setTimeout(resolve, 300));
  
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
      );
  
      if (!response.ok) {
        throw new Error('Falha ao obter endereço');
      }
  
      const data = await response.json();
  
      // Monta o endereço a partir dos dados retornados
      const address = data.address;
      const partes: string[] = [];
  
      if (address.road || address.street) {
        partes.push(address.road || address.street);
      }
      if (address.house_number) {
        partes.push(address.house_number);
      }
      if (address.suburb || address.neighbourhood || address.district) {
        partes.push(address.suburb || address.neighbourhood || address.district);
      }
      if (address.city || address.town) {
        partes.push(address.city || address.town);
      }
  
      const enderecoFinal = partes.join(', ');
      return enderecoFinal || 'Endereço não encontrado';
    } catch (error) {
      console.error('❌ Erro ao obter endereço:', error);
      return 'Endereço não encontrado';
    }
  }
  

  /**
   * Carrega todos os pontos do usuário (trajetos), obtém endereços e salva no array `this.trajetos`.
   */
  private async carregarTrajetos(): Promise<void> {
    if (!this.colaboradorId) {
      console.warn('⚠️ Nenhum ID de colaborador foi fornecido!');
      return;
    }

    try {
      const data = await this.controllAppService
        .PontoGetByUsuarioId(this.colaboradorId as string)
        .toPromise();
      console.log('✅ Dados brutos retornados pela API:', data);

      if (!data || !Array.isArray(data)) {
        console.warn('⚠️ Nenhum trajeto foi retornado pela API.');
        return;
      }

      // Mapeia os dados do ponto para o formato de trajetos
      this.trajetos = await Promise.all(
        data.map(async (ponto) => {
          let enderecoInicio = 'Endereço não disponível';
          let enderecoFim = 'Endereço não disponível';

          // Coordenadas de início
          if (ponto.latitudeInicioExpediente && ponto.longitudeInicioExpediente) {
            const latInicio = ponto.latitudeInicioExpediente / 1e7;
            const lonInicio = ponto.longitudeInicioExpediente / 1e7;
            if (!isNaN(latInicio) && !isNaN(lonInicio)) {
              try {
                enderecoInicio = await this.obterEndereco(latInicio, lonInicio);
              } catch (error) {
                console.error('Erro ao obter endereço de início:', error);
              }
            }
          }

          // Coordenadas de fim
          if (ponto.latitudeFimExpediente && ponto.longitudeFimExpediente) {
            const latFim = ponto.latitudeFimExpediente / 1e7;
            const lonFim = ponto.longitudeFimExpediente / 1e7;
            if (!isNaN(latFim) && !isNaN(lonFim)) {
              try {
                enderecoFim = await this.obterEndereco(latFim, lonFim);
              } catch (error) {
                console.error('Erro ao obter endereço de fim:', error);
              }
            }
          }

          return {
            nome: this.nomeUsuario,
            latitudeInicio: ponto.latitudeInicioExpediente,
            longitudeInicio: ponto.longitudeInicioExpediente,
            latitudeFim: ponto.latitudeFimExpediente,
            longitudeFim: ponto.longitudeFimExpediente,
            enderecoInicio,
            enderecoFim,
            horaInicio: ponto.inicioExpediente
              ? new Date(ponto.inicioExpediente).toLocaleTimeString()
              : 'N/A',
            horaFim: ponto.fimExpediente
              ? new Date(ponto.fimExpediente).toLocaleTimeString()
              : 'N/A',
            inicio: ponto.inicioExpediente
          };
        })
      );

      console.log('📍 Trajetos mapeados com endereços:', this.trajetos);
    } catch (err) {
      console.error('❌ Erro ao carregar trajetos:', err);
    }
  }

  /**
   * Exibe no mapa o trajeto (início/fim) selecionado na tabela.
   */
  verNoMapa(trajeto: any): void {
    if (
      !trajeto.latitudeInicio ||
      !trajeto.longitudeInicio ||
      !trajeto.latitudeFim ||
      !trajeto.longitudeFim
    ) {
      console.error('❌ Coordenadas do trajeto inválidas:', trajeto);
      return;
    }

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

    // Marcadores de início e fim
    L.marker([inicioLat, inicioLng])
      .addTo(this.mapUserLocation)
      .bindPopup('Início do Trajeto')
      .openPopup();

    L.marker([fimLat, fimLng])
      .addTo(this.mapUserLocation)
      .bindPopup('Fim do Trajeto');

    // Desenha a rota
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
        // OSRM retorna [lng, lat], Leaflet usa [lat, lng]
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
      // Em caso de erro, desenha uma linha reta entre os pontos
      const latlngs: LatLngTuple[] = [
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
    if (!this.userLocation) {
      console.warn('⚠️ Localização do usuário não disponível');
      return;
    }

    if (this.mapUserLocation) {
      this.mapUserLocation.remove();
    }

    const lat = parseFloat(this.userLocation.latitude);
    const lng = parseFloat(this.userLocation.longitude);

    this.mapUserLocation = L.map('mapUserLocation').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.mapUserLocation);

    // Conteúdo do popup
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
}
