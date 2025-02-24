import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ServicoFormatacao {
  
  formatarHora(data: string | null, isFim: boolean = false): string {
    if (!data) {
      return isFim ? 'Em andamento' : 'Aguardando registro...';
    }

    const date = new Date(data);
    if (isNaN(date.getTime())) {
      return isFim ? 'Em andamento' : 'Aguardando registro...';
    }

    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }) + ' hrs';
  }

  formatarDataAtual(): string {
    return new Date().toISOString();
  }

  formatarDataParaExibicao(data: Date): string {
    return data.toLocaleDateString('pt-BR') + ' ' + 
           data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
} 