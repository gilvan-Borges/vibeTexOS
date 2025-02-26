import { Injectable } from '@angular/core';
import { interval, map, Observable, Subject, Subscription } from 'rxjs';
import { ControllAppService } from './controllApp.service';
import { HttpClient } from '@angular/common/http';

export interface Coordenadas {
  latitude: string;
  longitude: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServicoLocalizacao {
  private atualizacaoSubscription: Subscription | null = null;
  private coordenadasSubject = new Subject<Coordenadas>();
  coordenadas$ = this.coordenadasSubject.asObservable();
  public readonly nominatimUrl = 'https://nominatim.openstreetmap.org/reverse?format=json';

  constructor(private controllAppService: ControllAppService,
    private http: HttpClient
  ) { }

  capturarCoordenadas(): Promise<Coordenadas> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Coordenadas brutas do GPS:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy // Precisão em metros
          });

          const coordenadas = {
            latitude: position.coords.latitude.toFixed(7),
            longitude: position.coords.longitude.toFixed(7)
          };
          console.log('Coordenadas formatadas antes de enviar:', coordenadas);
          this.coordenadasSubject.next(coordenadas);
          resolve(coordenadas);
        },
        (error) => {
          console.error('❌ Erro ao obter localização:', error);
          reject('Erro ao capturar localização. Verifique as permissões de localização.');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  // Função para calcular a distância entre duas coordenadas (em metros)
  private calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180; // Converte latitude para radianos
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distância em metros
  }

  iniciarAtualizacaoAutomatica(idUsuario: string): Subscription {
    this.pararAtualizacaoAutomatica();

    this.atualizacaoSubscription = interval(30000).subscribe(() => {
      this.capturarCoordenadas()
        .then(coordenadas => {
          console.log('📍 Coordenadas capturadas e prontas para enviar à API:', coordenadas);

          // Obtém as coordenadas atuais do localStorage para comparar
          const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
          let coordenadasAntigas: Coordenadas = {
            latitude: usuarioData.latitudeAtual || '-23.0013040', // Valor padrão
            longitude: usuarioData.longitudeAtual || '-43.3958987' // Valor padrão
          };

          // Converte strings para números para calcular a distância
          const latAtual = parseFloat(coordenadas.latitude);
          const lonAtual = parseFloat(coordenadas.longitude);
          const latAntiga = parseFloat(coordenadasAntigas.latitude);
          const lonAntiga = parseFloat(coordenadasAntigas.longitude);

          // Calcula a distância entre as coordenadas novas e antigas (em metros)
          const distancia = this.calcularDistancia(latAtual, lonAtual, latAntiga, lonAntiga);
          console.log('Distância entre as coordenadas novas e antigas:', distancia, 'metros');

          // Atualiza apenas se a distância for significativa (por exemplo, maior que 10 metros)
          const LIMITE_DISTANCIA = 10; // 10 metros como limite
          if (distancia > LIMITE_DISTANCIA || !usuarioData.latitudeAtual || !usuarioData.longitudeAtual) {
            this.atualizarCoordenadas(idUsuario, coordenadas.latitude, coordenadas.longitude);
          } else {
            console.log('Mudança de coordenadas insignificante (menos de 10 metros), ignorando atualização.');
          }
        })
        .catch(error => console.error('❌ Erro na atualização automática:', error));
    });

    return this.atualizacaoSubscription;
  }

  pararAtualizacaoAutomatica(): void {
    if (this.atualizacaoSubscription) {
      this.atualizacaoSubscription.unsubscribe();
      this.atualizacaoSubscription = null;
    }
  }

  getEndereco(lat: string, lon: string): Observable<string> {
    return this.http.get<any>(`${this.nominatimUrl}&lat=${lat}&lon=${lon}&addressdetails=1`)
      .pipe(
        map(response => {
          if (response && response.address) {
            const address = response.address;
            const rua = address.road || address.street || '';
            const numero = address.house_number ? `, ${address.house_number}` : '';
            const bairro = address.suburb || address.neighbourhood || '';
            const cidade = address.city || address.town || '';

            let enderecoFormatado = '';
            if (rua) enderecoFormatado += `${rua}${numero}`;
            if (bairro) enderecoFormatado += enderecoFormatado ? ` - ${bairro}` : bairro;
            if (cidade) enderecoFormatado += enderecoFormatado ? `, ${cidade}` : cidade;

            return enderecoFormatado;
          }
          return 'Endereço não encontrado';
        })
      );
  }

  atualizarCoordenadas(idUsuario: string, latitude: string, longitude: string): void {
    console.log('📤 Coordenadas enviadas para a API:', { idUsuario, latitude, longitude });

    // Atualiza as coordenadas no localStorage antes de enviá-las para a API
    const usuarioData = JSON.parse(localStorage.getItem('usuario') || '{}');
    if (usuarioData && usuarioData.usuarioId === idUsuario) {
      usuarioData.latitudeAtual = latitude;
      usuarioData.longitudeAtual = longitude;
      console.log('Coordenadas atualizadas no localStorage:', { latitude, longitude });
      localStorage.setItem('usuario', JSON.stringify(usuarioData));
    }

    this.controllAppService.atualizarCoordenadasUsuario(idUsuario, latitude, longitude)
      .subscribe({
        next: () => console.log('✅ Coordenadas atualizadas com sucesso na API.'),
        error: (err) => console.error('❌ Erro ao atualizar coordenadas na API:', err)
      });
  }

  obterUltimaLocalizacao(): Promise<Coordenadas> {
    return new Promise((resolve, reject) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude.toFixed(7),
              longitude: position.coords.longitude.toFixed(7)
            });
          },
          (error) => {
            console.error('Erro ao obter última localização:', error);
            reject('Não foi possível obter a localização atual.');
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 60000
          }
        );
      } else {
        reject('Geolocalização não suportada neste dispositivo.');
      }
    });
  }

  verificarDisponibilidadeLocalizacao(): Promise<boolean> {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.permissions.query({ name: 'geolocation' })
          .then((result) => {
            resolve(result.state === 'granted');
          })
          .catch(() => {
            resolve(false);
          });
      } else {
        resolve(false);
      }
    });
  }
}