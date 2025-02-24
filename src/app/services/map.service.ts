import { Injectable, NgZone } from '@angular/core';
import * as L from 'leaflet';
import { Usuario } from '../components/pages/dashboard/dashboard.component';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];

  constructor(private ngZone: NgZone) {}

  initMap(elementId: string, defaultCenter: [number, number] = [-23.00086859737168, -43.39591349462687], defaultZoom: number = 5): L.Map {
    if (this.map) {
      return this.map;
    }

    this.map = L.map(elementId, {
      center: defaultCenter,
      zoom: defaultZoom
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    return this.map;
  }

  // No seu MapService
updateMap(colaboradores: any[], map: L.Map): void {
  if (!map) return;

  // Limpa os marcadores existentes
  this.clearMarkers(map);

  // Para cada colaborador, obtemos o endereço e atualizamos
  colaboradores.forEach(async (colaborador) => {
    const lat = parseFloat(colaborador.latitude || colaborador.latitudeAtual || '');
    const lng = parseFloat(colaborador.longitude || colaborador.longitudeAtual || '');

    if (!isNaN(lat) && !isNaN(lng)) {
      try {
        // Chama buscarEndereco (ou use NominatimService.getEndereco) para obter o endereço
        const coordenadaString = `${lat},${lng}`;
        const endereco = await this.buscarEndereco(coordenadaString);

        // Guarda o endereço dentro do próprio colaborador
        colaborador.endereco = endereco;

        // Agora adiciona o marcador no mapa
        this.addMarker(map, lat, lng, colaborador);
      } catch (error) {
        // Se falhar, pelo menos deixe algo no objeto
        colaborador.endereco = 'Erro ao buscar endereço';
        console.error(error);
      }
    } else {
      console.warn('Invalid coordinates for colaborador:', colaborador.nomeUsuario || 'Unknown');
    }
  });

  // Ajusta o mapa para abranger todos os colaboradores
  this.fitMapToBounds(map, colaboradores);
}


  private addMarker(map: L.Map, lat: number, lng: number, colaborador: any): void {
    const customIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34]
    });

    const marker = L.marker([lat, lng], { icon: customIcon })
      .addTo(map)
      .bindPopup(
        `<strong>Colaborador</strong><br>
         Nome: ${colaborador.nomeUsuario}<br>
         Hora de Login: ${colaborador.dataHoraUltimaAutenticacao}<br>`
      );

    this.markers.push(marker);
  }

  private clearMarkers(map: L.Map): void {
    this.markers.forEach(marker => map.removeLayer(marker));
    this.markers = [];
  }

  private fitMapToBounds(map: L.Map, colaboradores: any[]): void {
    const validCoordinates = colaboradores
      .filter(c => c.latitude && c.longitude)
      .map(c => {
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        return !isNaN(lat) && !isNaN(lng) && 
               lat >= -90 && lat <= 90 && 
               lng >= -180 && lng <= 180 ? [lat, lng] : null;
      })
      .filter((coord): coord is [number, number] => coord !== null);

    if (validCoordinates.length > 0) {
      try {
        const bounds = L.latLngBounds(validCoordinates);
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (error) {
        console.warn('Error fitting bounds:', error);
        // If fitting bounds fails, center on the first valid coordinate
        const firstCoord = validCoordinates[0];
        map.setView(firstCoord, 13);
      }
    }
  }

  async buscarEndereco(coordenada: string): Promise<string> {
    if (!coordenada || !coordenada.includes(',')) {
      return "Coordenadas inválidas";
    }

    const [latitude, longitude] = coordenada.split(',').map(coord => coord.trim());

    if (!latitude || !longitude || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
      return "Coordenadas inválidas";
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();

      if (data && data.address) {
        const rua = data.address.road || "Rua não encontrada";
        const bairro = data.address.suburb || data.address.neighbourhood || "Bairro não encontrado";
        return `${rua}, ${bairro}`;
      }
      return "Endereço não encontrado";
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
      return "Erro ao buscar endereço";
    }
  }

  // Método para atualizar a localização de um colaborador específico
  updateColaboradorLocation(map: L.Map, colaborador: Usuario): void {
    if (!map || !colaborador.latitudeAtual || !colaborador.longitudeAtual) return;

    const lat = parseFloat(colaborador.latitudeAtual);
    const lng = parseFloat(colaborador.longitudeAtual);

    if (!isNaN(lat) && !isNaN(lng)) {
      // Remove o marcador antigo se existir
      this.markers = this.markers.filter(marker => {
        const markerData = marker.getPopup()?.getContent();
        const markerContent = typeof markerData === 'string' ? markerData : markerData?.toString() || '';
        if (markerContent.includes(colaborador.nome)) {
          map.removeLayer(marker);
          return false;
        }
        return true;
      });

      // Adiciona o novo marcador
      this.addMarker(map, lat, lng, {
        nomeUsuario: colaborador.nome,
        dataHoraUltimaAutenticacao: colaborador.dataHoraUltimaAutenticacao
      });
    }
  }
}