import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface OrdemServico {
  id: string;
  codigo: string;
  dataAbertura: Date;
  dataFinalizacao?: Date;
  tipo: 'Instalação' | 'Manutenção' | 'Reparo' | 'Vistoria';
  status: 'Pendente' | 'Em Andamento' | 'Concluída' | 'Cancelada';
  endereco: string;
  descricao: string;
  tecnicoId?: string;
  tecnicoNome?: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  tempoEstimado: number; // em minutos
  tempoReal?: number; // em minutos
}

export interface DesempenhoTecnico {
  tecnicoId: string;
  tecnicoNome: string;
  metricas: {
    osRealizadas: number;
    tempoMedioAtendimento: number;
    satisfacaoCliente: number;
    taxaConclusao: number;
    eficiencia: number;
  };
  historicoDiario: {
    data: string;
    osRealizadas: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class MockOrdemServicoService {
  private ordens: OrdemServico[] = [];

  constructor() {
    this.gerarOrdensMock();
  }

  private gerarOrdensMock(): void {
    const tipos = ['Instalação', 'Manutenção', 'Reparo', 'Vistoria'];
    const status = ['Pendente', 'Em Andamento', 'Concluída', 'Cancelada'];
    const prioridades = ['Baixa', 'Média', 'Alta', 'Urgente'];

    // Gera 50 ordens de serviço aleatórias
    for (let i = 1; i <= 50; i++) {
      const dataAbertura = new Date();
      dataAbertura.setDate(dataAbertura.getDate() - Math.floor(Math.random() * 30));

      const ordem: OrdemServico = {
        id: `OS${i.toString().padStart(5, '0')}`,
        codigo: `2024${i.toString().padStart(6, '0')}`,
        dataAbertura: dataAbertura,
        tipo: tipos[Math.floor(Math.random() * tipos.length)] as any,
        status: status[Math.floor(Math.random() * status.length)] as any,
        endereco: `Rua ${Math.floor(Math.random() * 100)}, Bairro ${Math.floor(Math.random() * 10)}`,
        descricao: `Descrição da ordem de serviço ${i}`,
        prioridade: prioridades[Math.floor(Math.random() * prioridades.length)] as any,
        tempoEstimado: Math.floor(Math.random() * 180) + 30, // 30 a 210 minutos
      };

      if (ordem.status === 'Concluída') {
        ordem.dataFinalizacao = new Date(dataAbertura.getTime() + Math.random() * 86400000);
        ordem.tempoReal = Math.floor(Math.random() * ordem.tempoEstimado * 1.5);
        ordem.tecnicoId = `TEC${Math.floor(Math.random() * 10 + 1)}`;
        ordem.tecnicoNome = `Técnico ${Math.floor(Math.random() * 10 + 1)}`;
      } else if (ordem.status === 'Em Andamento') {
        ordem.tecnicoId = `TEC${Math.floor(Math.random() * 10 + 1)}`;
        ordem.tecnicoNome = `Técnico ${Math.floor(Math.random() * 10 + 1)}`;
      }

      this.ordens.push(ordem);
    }
  }

  getOrdensServico(): Observable<OrdemServico[]> {
    return of(this.ordens);
  }

  getOrdensPorPeriodo(dataInicial: Date, dataFinal: Date): Observable<OrdemServico[]> {
    const ordensFiltradas = this.ordens.filter(ordem => 
      ordem.dataAbertura >= dataInicial && ordem.dataAbertura <= dataFinal
    );
    return of(ordensFiltradas);
  }

  getEstatisticas() {
    const total = this.ordens.length;
    const realizadas = this.ordens.filter(o => o.status === 'Concluída').length;
    const naoAtribuidas = this.ordens.filter(o => !o.tecnicoId).length;
    const naoRealizadas = this.ordens.filter(o => o.status === 'Cancelada').length;
    const emAndamento = this.ordens.filter(o => o.status === 'Em Andamento').length;

    const eficienciaPorTecnico = this.calcularEficienciaPorTecnico();

    return of({
      total,
      realizadas,
      naoAtribuidas,
      naoRealizadas,
      emAndamento,
      eficienciaPorTecnico
    });
  }

  private calcularEficienciaPorTecnico() {
    const tecnicos = new Map<string, { total: number; concluidas: number; tempoMedio: number }>();

    this.ordens.forEach(ordem => {
      if (ordem.tecnicoId) {
        if (!tecnicos.has(ordem.tecnicoId)) {
          tecnicos.set(ordem.tecnicoId, { total: 0, concluidas: 0, tempoMedio: 0 });
        }

        const stats = tecnicos.get(ordem.tecnicoId)!;
        stats.total++;

        if (ordem.status === 'Concluída') {
          stats.concluidas++;
          stats.tempoMedio = (stats.tempoMedio * (stats.concluidas - 1) + ordem.tempoReal!) / stats.concluidas;
        }
      }
    });

    return Array.from(tecnicos.entries()).map(([tecnicoId, stats]) => ({
      tecnicoId,
      tecnicoNome: this.ordens.find(o => o.tecnicoId === tecnicoId)?.tecnicoNome,
      eficiencia: (stats.concluidas / stats.total) * 100,
      tempoMedio: stats.tempoMedio,
      totalOrdens: stats.total,
      ordensConcluidas: stats.concluidas
    }));
  }

  getDesempenhoTecnicos(): Observable<DesempenhoTecnico[]> {
    const tecnicos = [
      'João Silva', 'Maria Santos', 'Pedro Oliveira', 
      'Ana Costa', 'Carlos Souza'
    ];

    const desempenhos = tecnicos.map((nome, index) => ({
      tecnicoId: `TEC${index + 1}`,
      tecnicoNome: nome,
      metricas: {
        osRealizadas: Math.floor(Math.random() * 50) + 20,
        tempoMedioAtendimento: Math.floor(Math.random() * 120) + 30,
        satisfacaoCliente: Math.floor(Math.random() * 30) + 70,
        taxaConclusao: Math.floor(Math.random() * 30) + 70,
        eficiencia: Math.floor(Math.random() * 30) + 70
      },
      historicoDiario: this.gerarHistoricoDiario()
    }));

    return of(desempenhos);
  }

  private gerarHistoricoDiario(): { data: string; osRealizadas: number }[] {
    const historico = [];
    const hoje = new Date();

    for (let i = 6; i >= 0; i--) {
      const data = new Date();
      data.setDate(hoje.getDate() - i);
      historico.push({
        data: data.toISOString().split('T')[0],
        osRealizadas: Math.floor(Math.random() * 8) + 1
      });
    }

    return historico;
  }
}
