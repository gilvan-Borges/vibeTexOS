import { Injectable } from '@angular/core';

interface DadosExpediente {
  pontoIdExpediente: string | null;
  pontoIdPausa: string | null;
  timestamps: { [key: string]: string };
  disabled: boolean[];
  inicioPausaTime?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ServicoArmazenamento {
  
  salvarDadosExpediente(dados: DadosExpediente): void {
    console.log("📌 Salvando dados no localStorage:", dados);
    localStorage.setItem('dadosExpediente', JSON.stringify(dados));
    
    // Garante que o inicioPausaTime seja salvo separadamente também
    if (dados.inicioPausaTime) {
      localStorage.setItem('inicioPausaTime', dados.inicioPausaTime);
    }
  }

  carregarDadosExpediente(): DadosExpediente | null {
    const dadosSalvos = localStorage.getItem('dadosExpediente');
    if (!dadosSalvos) return null;

    const dados = JSON.parse(dadosSalvos);
    
    // Recupera o inicioPausaTime do localStorage
    dados.inicioPausaTime = localStorage.getItem('inicioPausaTime');
    
    console.log("🔄 Dados carregados do localStorage:", dados);
    return dados;
  }

  salvarPontoId(tipo: 'expediente' | 'pausa', id: string): void {
    const chave = tipo === 'expediente' ? 'pontoIdExpediente' : 'pontoIdPausa';
    localStorage.setItem(chave, id);
    console.log(`📌 ${chave} salvo:`, id);
  }

  obterPontoId(tipo: 'expediente' | 'pausa'): string | null {
    const chave = tipo === 'expediente' ? 'pontoIdExpediente' : 'pontoIdPausa';
    return localStorage.getItem(chave);
  }

  removerPontoId(tipo: 'expediente' | 'pausa'): void {
    const chave = tipo === 'expediente' ? 'pontoIdExpediente' : 'pontoIdPausa';
    localStorage.removeItem(chave);
  }

  limparDadosPausa(): void {
    localStorage.removeItem('pontoIdPausa');
    localStorage.removeItem('inicioPausaTime');
    localStorage.removeItem('pausaTimer');
  }
} 