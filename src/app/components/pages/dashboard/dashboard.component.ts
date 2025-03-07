import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, NgModule, NgZone, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { ServicoLocalizacao } from '../../../services/localizacao.service';
import { VibeService } from '../../../services/vibe.service';
import { UsuarioService } from '../../../services/usuario.service';
import { ControllAppService } from '../../../services/controllApp.service';
import { Pipe, PipeTransform } from '@angular/core';

export interface OrdemServico {
  ordemDeServicoId: string;
  usuarioId: string;
  clienteId: string;
  tipoServico: string;
  statusOrdem: string;
  numeroOrdemDeServico: string;
  dataHoraCadastro: string;
  atribuida: boolean;
}

export interface DesempenhoColaborador {
  usuarioId: string;
  empresa: string;
  nome: string;
  osAtribuidas: number;
  osRealizadas: number;
  osPendentes: number;
  tempoMedio: string;
  eficiencia: number;
  jornada: string;
  fotoUrl?: string;
  isOnline?: boolean; // adicionado
}

export interface Colaborador {
  usuarioId: string;
  nome: string;
  empresa: string;
  horaEntrada: string;
  horaSaida: string;
  latitudeAtual?: string;
  longitudeAtual?: string;
  dataHoraUltimaAutenticacao?: Date;
  fotoUrl?: string;
  isOnline?: boolean;
}



@Pipe({
  name: 'filter'
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], filter: any): any[] {
    if (!items || !filter) {
      return items;
    }
    return items.filter(item => {
      for (let key in filter) {
        if (item[key] !== filter[key]) {
          return false;
        }
      }
      return true;
    });
  }
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, FilterPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private map: any;

  periodoSelecionado: string = 'hoje';
  dataInicial: string = '';
  dataFinal: string = '';

  totalOS: number = 0;
  osRealizadas: number = 0;
  osNaoAtribuidas: number = 0;
  osNaoRealizadas: number = 0;
  efficiencyGeneral: number = 0;
  colaboradoresDesempenho: DesempenhoColaborador[] = [];
  colaboradores: Colaborador[] = [];
  
  // Propriedade para armazenar apenas colaboradores online
  get colaboradoresOnline(): DesempenhoColaborador[] {
    return this.colaboradoresDesempenho.filter(c => c.isOnline === true);
  }

  constructor(
    private ngZone: NgZone,
    private servicoLocalizacao: ServicoLocalizacao,
    private vibeService: VibeService,
    private usuarioService: UsuarioService,
    private controllAppService: ControllAppService
  ) { }

  ngOnInit() {
    this.carregarDados();
    setInterval(() => {
      this.carregarDados();
    }, 30000);
  }

  ngAfterViewInit(): void {
    this.initMap();
    setTimeout(() => {
      if (this.map) {
        this.carregarColaboradoresOnlineNoMapa();
      }
    }, 1000);
  }

  private initMap(): void {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Elemento com id="map" não encontrado no DOM.');
      return;
    }

    if (this.map) return;

    this.map = L.map('map', {
      center: [-22.6378335427398, -43.041989248970395],
      zoom: 5
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    this.map.whenReady(() => {
      console.log('Mapa inicializado com sucesso.');
      this.carregarColaboradoresOnlineNoMapa();
    });
  }

  private carregarColaboradoresOnlineNoMapa(): void {
    this.vibeService.buscarUsuario().subscribe({
      next: (response: any[]) => {
        const colaboradores = response.map(colab => ({
          usuarioId: colab.usuarioId,
          nome: colab.nome || 'Sem Nome',
          empresa: colab.nomeDaEmpresa || colab.empresa || 'N/A',
          horaEntrada: colab.horaEntrada || '00:00',
          horaSaida: colab.horaSaida || '00:00',
          latitudeAtual: colab.latitudeAtual,
          longitudeAtual: colab.longitudeAtual,
          dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ? new Date(colab.dataHoraUltimaAutenticacao) : undefined,
          fotoUrl: colab.fotoUrl || '/assets/default-profile.png',
          isOnline: colab.isOnline === true  // Garantir que isOnline seja um booleano
        } as Colaborador));
        
        const colaboradoresOnline = colaboradores.filter(u => 
          u.latitudeAtual && u.longitudeAtual && u.isOnline === true
        );
        
        this.processarColaboradoresOnline(colaboradoresOnline);
      },
      error: (error) => {
        console.error('Erro ao carregar colaboradores:', error);
      }
    });
  }

  private processarColaboradoresOnline(colaboradoresOnline: Colaborador[]): void {
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        this.map.removeLayer(layer);
      }
    });

    colaboradoresOnline.forEach(colaborador => {
      const lat = parseFloat(colaborador.latitudeAtual!);
      const lng = parseFloat(colaborador.longitudeAtual!);

      if (!isNaN(lat) && !isNaN(lng)) {
        // Determinar a cor do ícone com base na empresa
        let iconColor = 'blue'; 
        
        if (colaborador.empresa) {
          const empresaNormalizada = colaborador.empresa.toLowerCase().trim();
          
          if (empresaNormalizada.includes('flamengo')) {
            iconColor = 'red';
          } else if (empresaNormalizada.includes('figth') || 
                    empresaNormalizada.includes('fight')) {
            iconColor = 'blue';
          } else if (empresaNormalizada.includes('vibetex')) {
            iconColor = 'green';
          } else if (empresaNormalizada.includes('nexus')) {
            iconColor = 'orange';
          }
        }

        const customIcon = L.icon({
          iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${iconColor}.png`,
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34]
        });

        let dataLogin = '-';
        if (colaborador.dataHoraUltimaAutenticacao) {
          const data = new Date(colaborador.dataHoraUltimaAutenticacao);
          if (!isNaN(data.getTime())) {
            dataLogin = data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
          }
        }

        L.marker([lat, lng], { icon: customIcon })
          .addTo(this.map)
          .bindPopup(
            `<strong>Colaborador</strong><br>
            Nome: ${colaborador.nome}<br>
            Empresa: ${colaborador.empresa}<br>
            Último login: ${dataLogin}`
          );
      }
    });

    if (colaboradoresOnline.length > 0) {
      const boundsCoordinates: [number, number][] = colaboradoresOnline
        .map(c => {
          const lat = parseFloat(c.latitudeAtual!);
          const lng = parseFloat(c.longitudeAtual!);
          return !isNaN(lat) && !isNaN(lng) ? [lat, lng] as [number, number] : null;
        })
        .filter((coord): coord is [number, number] => coord !== null);

      if (boundsCoordinates.length > 0) {
        const bounds = L.latLngBounds(boundsCoordinates);
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }

  private carregarDados() {
    this.carregarMetricasPorPeriodo();
    this.carregarColaboradoresAtivos();
  }

  private carregarMetricasPorPeriodo() {
    console.log('🔄 Iniciando carregamento de métricas por período...');

    this.vibeService.buscarOrdemServico().subscribe({
      next: (ordens: OrdemServico[]) => {
        if (!ordens || ordens.length === 0) {
          this.resetarMetricas();
          return;
        }

        const ordensFiltradas = this.filtrarOrdensPorPeriodo(ordens);
        this.atualizarMetricasGerais(ordensFiltradas);
      },
      error: (err) => console.error('❌ Erro ao carregar ordens:', err)
    });
  }

  private carregarColaboradoresAtivos() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
  
    this.vibeService.buscarUsuario().subscribe({
      next: (colaboradores: any[]) => {
        if (!colaboradores || colaboradores.length === 0) {
          this.colaboradoresDesempenho = [];
          this.colaboradores = [];
          return;
        }
  
        // Usar a propriedade isOnline diretamente da API
        this.colaboradores = colaboradores
          .filter(colab => colab.role === 'Colaborador')
          .map(colab => ({
            usuarioId: colab.usuarioId,
            nome: colab.nome,
            empresa: colab.nomeDaEmpresa || colab.empresa || 'VibeTex Soluções',
            horaEntrada: colab.horaEntrada || '08:00',
            horaSaida: colab.horaSaida || '18:00',
            latitudeAtual: colab.latitudeAtual || '',
            longitudeAtual: colab.longitudeAtual || '',
            dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ?
              new Date(colab.dataHoraUltimaAutenticacao) : undefined,
            fotoUrl: colab.fotoUrl || '/assets/default-profile.png',
            isOnline: colab.isOnline === true // Usar isOnline direto da API
          }));
  
        this.vibeService.buscarOrdemServico().subscribe({
          next: (ordens: OrdemServico[]) => {
            const ordensHoje = ordens.filter(ordem => {
              const dataOrdem = new Date(ordem.dataHoraCadastro);
              return dataOrdem >= hoje;
            });
  
            // Filtrar apenas colaboradores que estão online
            const colaboradoresOnline = this.colaboradores.filter(colab => colab.isOnline === true);
            console.log('Colaboradores online:', colaboradoresOnline.length);
            this.atualizarDesempenhoColaboradores(colaboradoresOnline, ordensHoje);
          },
          error: (err) => console.error('Erro ao carregar ordens do dia:', err)
        });
      },
      error: (err) => console.error('Erro ao carregar colaboradores:', err)
    });
  }

  private atualizarDesempenhoColaboradores(colaboradores: Colaborador[], ordens: OrdemServico[]) {
    this.colaboradoresDesempenho = colaboradores.map(colaborador => {
      const ordensDoColaborador = ordens.filter(o => o.usuarioId === colaborador.usuarioId);
      const ordensFinalizadas = ordensDoColaborador.filter(o =>
        ['concluído', 'concluida', 'concluido', 'finalizada', 'finalizado']
          .includes(o.statusOrdem?.toLowerCase().trim() || '')
      );

      const desempenho: DesempenhoColaborador = {
        usuarioId: colaborador.usuarioId,
        empresa: colaborador.empresa,
        nome: colaborador.nome,
        osAtribuidas: ordensDoColaborador.length,
        osRealizadas: ordensFinalizadas.length,
        osPendentes: ordensDoColaborador.length - ordensFinalizadas.length,
        tempoMedio: this.calcularTempoMedio(ordensFinalizadas),
        eficiencia: ordensDoColaborador.length ?
          Math.round((ordensFinalizadas.length / ordensDoColaborador.length) * 100) : 0,
        jornada: '0%', // Valor inicial
        fotoUrl: colaborador.fotoUrl,
        isOnline: true // adicionado, pois somente colaboradores online chegam aqui
      };

      return desempenho;
    });

    // Atualiza a jornada para cada colaborador
    this.colaboradoresDesempenho.forEach(cd => {
      // Encontra o colaborador na lista original
      const colaborador = this.colaboradores.find(c => c.usuarioId === cd.usuarioId);
      
      if (colaborador) {
        // Obtém horaEntrada e horaSaida do colaborador
        const horaEntradaStr = colaborador.horaEntrada || '08:00'; // Padrão: 08:00
        const horaSaidaStr = colaborador.horaSaida || '17:00'; // Padrão: 17:00

        // Cria a data de início e fim do expediente no dia atual
        const agora = new Date();
        const dataInicioExpediente = new Date(agora);
        const [horaEntrada, minutoEntrada] = horaEntradaStr.split(':').map(Number);
        dataInicioExpediente.setHours(horaEntrada, minutoEntrada, 0, 0);

        const dataFimExpediente = new Date(agora);
        const [horaSaida, minutoSaida] = horaSaidaStr.split(':').map(Number);
        dataFimExpediente.setHours(horaSaida, minutoSaida, 0, 0);

        // Calcula o progresso da jornada
        if (agora < dataInicioExpediente) {
          cd.jornada = '0%';
        } else if (agora > dataFimExpediente) {
          cd.jornada = '100%';
        } else {
          const totalJornadaMs = dataFimExpediente.getTime() - dataInicioExpediente.getTime();
          const decorridoMs = agora.getTime() - dataInicioExpediente.getTime();
          const percentualJornada = Math.round((decorridoMs / totalJornadaMs) * 100);
          cd.jornada = `${percentualJornada}%`;
        }
      } else {
        console.warn(`Colaborador com ID ${cd.usuarioId} não encontrado na lista.`);
        cd.jornada = '0%';
      }
    });
  }

  private resetarMetricas() {
    this.totalOS = 0;
    this.osRealizadas = 0;
    this.osNaoAtribuidas = 0;
    this.osNaoRealizadas = 0;
    this.efficiencyGeneral = 0;
  }

  private atualizarMetricasGerais(ordens: OrdemServico[]) {
    this.totalOS = ordens.length;

    this.osRealizadas = ordens.filter(o => {
      const status = o.statusOrdem?.toLowerCase().trim() || '';
      return ['concluído', 'concluido', 'concluída', 'concluida', 'finalizado', 'finalizada'].includes(status);
    }).length;

    this.osNaoAtribuidas = ordens.filter(o => {
      const status = o.statusOrdem?.toLowerCase().trim() || '';
      return o.atribuida === false && !['concluído', 'concluido', 'concluída', 'concluida', 'finalizado', 'finalizada'].includes(status);
    }).length;

    this.osNaoRealizadas = ordens.filter(o => {
      const status = o.statusOrdem?.toLowerCase().trim() || '';
      return ['cancelado', 'cancelada'].includes(status);
    }).length;

    this.efficiencyGeneral = this.totalOS > 0 ?
      Math.round((this.osRealizadas / this.totalOS) * 100) : 0;

    console.log('📊 Métricas atualizadas:', {
      total: this.totalOS,
      naoAtribuidas: this.osNaoAtribuidas,
      realizadas: this.osRealizadas,
      naoRealizadas: this.osNaoRealizadas,
      eficiencia: this.efficiencyGeneral
    });
  }

  private buscarDadosColaboradores(ordens: OrdemServico[]) {
    this.vibeService.buscarUsuario().subscribe({
      next: (colaboradores: any[]) => {
        if (!colaboradores || colaboradores.length === 0) {
          console.warn('Nenhum colaborador encontrado');
          this.colaboradoresDesempenho = [];
          this.colaboradores = [];
          return;
        }

        this.colaboradores = colaboradores.map(colab => ({
          usuarioId: colab.usuarioId,
          nome: colab.nome,
          empresa: colab.nomeDaEmpresa || colab.empresa || 'N/A',
          horaEntrada: colab.horaEntrada || '08:00',
          horaSaida: colab.horaSaida || '18:00',
          latitudeAtual: colab.latitudeAtual || '',
          longitudeAtual: colab.longitudeAtual || '',
          dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ? new Date(colab.dataHoraUltimaAutenticacao) : undefined,
          fotoUrl: colab.fotoUrl || '/assets/default-profile.png'
        }));

        this.colaboradoresDesempenho = this.colaboradores.map(colaborador => {
          const ordensDoColaborador = ordens.filter(o => o.usuarioId === colaborador.usuarioId);
          const ordensFinalizadas = ordensDoColaborador.filter(o =>
            ['concluída', 'concluida', 'Concluído', 'finalizada', 'finalizado']
              .includes(o.statusOrdem?.toLowerCase().trim() || '')
          );

          const tempoMedio = this.calcularTempoMedio(ordensFinalizadas);
          const osAtribuidas = ordensDoColaborador.length;
          const osRealizadas = ordensFinalizadas.length;
          const osPendentes = osAtribuidas - osRealizadas;
          const eficiencia = osAtribuidas ? Math.round((osRealizadas / osAtribuidas) * 100) : 0;

          return {
            usuarioId: colaborador.usuarioId,
            empresa: colaborador.empresa,
            nome: colaborador.nome,
            osAtribuidas,
            osRealizadas,
            osPendentes,
            tempoMedio,
            eficiencia,
            jornada: '0%', // placeholder
            fotoUrl: colaborador.fotoUrl
          };
        });

        console.log('Desempenho dos colaboradores:', this.colaboradoresDesempenho);
      },
      error: (err) => console.error('Erro ao carregar colaboradores:', err)
    });
  }

  private calcularTempoMedio(ordens: OrdemServico[]): string {
    if (!ordens.length) return '0h 0m';

    const tempoTotalMs = ordens.reduce((acc, ordem) => {
      const inicio = new Date(ordem.dataHoraCadastro).getTime();
      const fim = ordem.statusOrdem?.toLowerCase() === 'concluída' ? new Date().getTime() : inicio;
      return acc + (fim - inicio);
    }, 0);

    const tempoMedioMs = tempoTotalMs / ordens.length;
    const horas = Math.floor(tempoMedioMs / (1000 * 60 * 60));
    const minutos = Math.floor((tempoMedioMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${horas}h ${minutos}m`;
  }

  private filtrarOrdensPorPeriodo(ordens: OrdemServico[]): OrdemServico[] {
    if (!ordens || !Array.isArray(ordens)) {
      console.warn('Lista de ordens inválida');
      return [];
    }

    const hoje = new Date();
    let dataInicial: Date;
    let dataFinal: Date;

    switch (this.periodoSelecionado) {
      case 'hoje':
        dataInicial = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
        dataFinal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        break;
      case 'semana':
        dataFinal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        dataInicial = new Date(dataFinal);
        dataInicial.setDate(dataInicial.getDate() - 7);
        break;
      case 'mes':
        dataFinal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        dataInicial = new Date(dataFinal);
        dataInicial.setMonth(dataInicial.getMonth() - 1);
        break;
      case 'custom':
        if (this.dataInicial && this.dataFinal) {
          dataInicial = new Date(this.dataInicial);
          dataFinal = new Date(this.dataFinal);
          dataFinal.setHours(23, 59, 59);
        } else {
          return ordens;
        }
        break;
      default:
        return ordens;
    }

    console.log('Filtrando ordens:', { dataInicial, dataFinal });

    return ordens.filter(ordem => {
      const dataOrdem = new Date(ordem.dataHoraCadastro);
      return dataOrdem >= dataInicial && dataOrdem <= dataFinal;
    });
  }

  atualizarDados() {
    console.log('Atualizando dados para período:', this.periodoSelecionado);
    this.carregarDados();
  }

  parseJornada(jornada: string): number {
    const valor = parseFloat(jornada.replace('%', '')) || 0;
    return Math.min(valor, 100);
  }

  getProgressWidth(jornada: string): number {
    return Math.min(this.parseJornada(jornada), 100);
  }
}