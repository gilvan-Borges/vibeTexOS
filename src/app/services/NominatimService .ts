import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NominatimService {
  private url = 'https://nominatim.openstreetmap.org/reverse';

  constructor(private http: HttpClient) {}

  getEndereco(lat: number, lon: number): Observable<string> {
    return this.http
      .get<any>(`${this.url}?lat=${lat}&lon=${lon}&format=json`)
      .pipe(
        map((data) => {
          const { road, suburb, city, state } = data.address;
          return `${road || ''}, ${suburb || ''}, ${city || ''}, ${state || ''}`;
        })
      );
  }
}
