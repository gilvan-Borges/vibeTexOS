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
          // Log das coordenadas brutas antes de qualquer formatação
          console.log('Coordenadas brutas do GPS:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy // Precisão em metros
          });

          const coordenadas = {
            latitude: position.coords.latitude.toFixed(7), // Mantém 7 casas decimais para precisão
            longitude: position.coords.longitude.toFixed(7) // Mantém 7 casas decimais para precisão
          };
          console.log('Coordenadas formatadas:', coordenadas);
          this.coordenadasSubject.next(coordenadas);
          resolve(coordenadas);
        },
        (error) => {
          console.error('❌ Erro ao obter localização:', error);
          reject('Erro ao capturar localização. Verifique as permissões de localização.');
        },
        {
          enableHighAccuracy: true, // Força alta precisão (GPS, se disponível)
          timeout: 10000, // Aumenta o tempo limite para 10 segundos
          maximumAge: 0 // Não usa posições armazenadas
        }
      );
    });
  }

  iniciarAtualizacaoAutomatica(idUsuario: string): Subscription {
    // Cancela qualquer atualização anterior
    this.pararAtualizacaoAutomatica();

    // Inicia nova atualização
    this.atualizacaoSubscription = interval(30000).subscribe(() => {
      this.capturarCoordenadas()
        .then(coordenadas => {
          console.log('📍 Coordenadas capturadas:', coordenadas);
          this.atualizarCoordenadas(idUsuario, coordenadas.latitude, coordenadas.longitude);
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

            // Monta o endereço formatado
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
    console.log('📤 Enviando coordenadas para a API:', { idUsuario, latitude, longitude });

    this.controllAppService.atualizarCoordenadasUsuario(idUsuario, latitude, longitude)
      .subscribe({
        next: () => console.log('✅ Coordenadas atualizadas com sucesso.'),
        error: (err) => console.error('❌ Erro ao atualizar coordenadas:', err)
      });
  }

  // Método para obter a última localização conhecida
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
            maximumAge: 60000 // Aceita uma posição de até 1 minuto atrás
          }
        );
      } else {
        reject('Geolocalização não suportada neste dispositivo.');
      }
    });
  }

  // Método para verificar se o serviço de localização está disponível
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