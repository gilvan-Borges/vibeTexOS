import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, NgZone, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Observable } from 'rxjs';
import { ServicoLocalizacao } from '../../../services/localizacao.service';
import { VibeService } from '../../../services/vibe.service';
import { UsuarioService } from '../../../services/usuario.service';
import { environment } from '../../../../environments/environment.development';
import { ControllAppService } from '../../../services/controllApp.service';
import { RegisterRequestDto } from '../../../models/control-app/register.request,dto';

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
  usuarioId: string; // Add this line
  empresa: string;
  nome: string;
  osAtribuidas: number;
  osRealizadas: number;
  osPendentes: number;
  tempoMedio: string;
  eficiencia: number;
  jornada: string;
}

export interface Colaborador {
  usuarioId: string;
  nome: string;
  empresa: string;
  horaEntrada: string;
  horaSaida: string;
  latitudeAtual?: string; // Opcional, usado no mapa
  longitudeAtual?: string; // Opcional, usado no mapa
  dataHoraUltimaAutenticacao?: Date; // Opcional, usado no mapa
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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

  constructor(
    private ngZone: NgZone,
    private servicoLocalizacao: ServicoLocalizacao,
    private vibeService: VibeService,
    private usuarioService: UsuarioService,
    private controllAppService: ControllAppService
  ) {}

  ngOnInit() {
    this.initMap();
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
    this.controllAppService.usuarioGetAll({} as RegisterRequestDto).subscribe({
      next: (response: any[]) => {
        const colaboradores = response.map(colab => ({
          usuarioId: colab.usuarioId,
          nome: colab.nome,
          empresa: colab.empresa || 'N/A',
          horaEntrada: colab.horaEntrada || '00:00',
          horaSaida: colab.horaSaida || '00:00',
          latitudeAtual: colab.latitudeAtual,
          longitudeAtual: colab.longitudeAtual,
          dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ? new Date(colab.dataHoraUltimaAutenticacao) : undefined
        } as Colaborador));
        const colaboradoresOnline = colaboradores.filter(u =>
          u.latitudeAtual && u.longitudeAtual
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
        const customIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
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
            Último login: ${dataLogin}`
          );
      }
    });

    if (colaboradoresOnline.length > 0) {
      // Garantir que o array passado para L.latLngBounds seja um array de LatLngTuple ([number, number][])
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
    this.carregarColaboradoresAtivos(); // Nova função separada
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

    this.usuarioService.usuarioGetAll({ role: 'Colaborador' }).subscribe({
      next: (colaboradores: any[]) => {
        if (!colaboradores || colaboradores.length === 0) {
          this.colaboradoresDesempenho = [];
          this.colaboradores = [];
          return;
        }

        // Filtra apenas colaboradores online e ativos hoje
        this.colaboradores = colaboradores
          .filter(colab => 
            colab.role === 'Colaborador' && 
            colab.isOnline === true
          )
          .map(colab => ({
            usuarioId: colab.usuarioId,
            nome: colab.nome,
            empresa: colab.empresa || 'VibeTex Soluções',
            horaEntrada: colab.horaEntrada || '08:00',
            horaSaida: colab.horaSaida || '18:00',
            latitudeAtual: colab.latitudeAtual || '',
            longitudeAtual: colab.longitudeAtual || '',
            dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ? 
              new Date(colab.dataHoraUltimaAutenticacao) : undefined
          }));

        // Busca as ordens de serviço apenas do dia atual
        this.vibeService.buscarOrdemServico().subscribe({
          next: (ordens: OrdemServico[]) => {
            const ordensHoje = ordens.filter(ordem => {
              const dataOrdem = new Date(ordem.dataHoraCadastro);
              return dataOrdem >= hoje;
            });

            this.atualizarDesempenhoColaboradores(this.colaboradores, ordensHoje);
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

      return {
        usuarioId: colaborador.usuarioId,
        empresa: colaborador.empresa,
        nome: colaborador.nome,
        osAtribuidas: ordensDoColaborador.length,
        osRealizadas: ordensFinalizadas.length,
        osPendentes: ordensDoColaborador.length - ordensFinalizadas.length,
        tempoMedio: this.calcularTempoMedio(ordensFinalizadas),
        eficiencia: ordensDoColaborador.length ? 
          Math.round((ordensFinalizadas.length / ordensDoColaborador.length) * 100) : 0,
        jornada: `${this.calcularPercentualJornada()}%`
      };
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
    
    // Realizadas: check for all possible concluded status variations
    this.osRealizadas = ordens.filter(o => {
      const status = o.statusOrdem?.toLowerCase().trim() || '';
      return ['concluído', 'concluido', 'concluída', 'concluida', 'finalizado', 'finalizada']
        .includes(status);
    }).length;
    
    // Não Atribuídas: contar apenas ordens onde atribuida === false
    this.osNaoAtribuidas = ordens.filter(o => o.atribuida === false).length;
    
    // Não Realizadas: check for all possible canceled status variations
    this.osNaoRealizadas = ordens.filter(o => {
      const status = o.statusOrdem?.toLowerCase().trim() || '';
      return ['cancelado', 'cancelada'].includes(status);
    }).length;
    
    this.efficiencyGeneral = this.totalOS > 0 ? 
      Math.round((this.osRealizadas / this.totalOS) * 100) : 0;

    // Debug logging
    console.log('📊 Métricas atualizadas:', {
      total: this.totalOS,
      naoAtribuidas: this.osNaoAtribuidas,
      realizadas: this.osRealizadas,
      naoRealizadas: this.osNaoRealizadas,
      eficiencia: this.efficiencyGeneral
    });
  }

  private buscarDadosColaboradores(ordens: OrdemServico[]) {
    this.usuarioService.usuarioGetAll({ role: 'Colaborador' }).subscribe({
      next: (colaboradores: any[]) => {
        if (!colaboradores || colaboradores.length === 0) {
          console.warn('Nenhum colaborador encontrado');
          this.colaboradoresDesempenho = [];
          this.colaboradores = [];
          return;
        }

        this.colaboradores = colaboradores
          .filter(colab => colab.role === 'Colaborador')
          .map(colab => ({
            usuarioId: colab.usuarioId,
            nome: colab.nome,
            empresa: colab.empresa || 'VibeTex Soluções',
            horaEntrada: colab.horaEntrada || '08:00',
            horaSaida: colab.horaSaida || '18:00',
            latitudeAtual: colab.latitudeAtual || '',
            longitudeAtual: colab.longitudeAtual || '',
            dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ? new Date(colab.dataHoraUltimaAutenticacao) : undefined
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
          const jornada = this.calcularPercentualJornada();

          return {
            usuarioId: colaborador.usuarioId, // Add this line
            empresa: colaborador.empresa,
            nome: colaborador.nome,
            osAtribuidas,
            osRealizadas,
            osPendentes,
            tempoMedio,
            eficiencia,
            jornada: `${jornada}%`
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

  private calcularPercentualJornada(): number {
    const horaInicio = new Date();
    horaInicio.setHours(8, 0, 0, 0); // Início do expediente comercial: 08:00
    const horaFim = new Date();
    horaFim.setHours(18, 0, 0, 0); // Fim do expediente comercial: 18:00

    const agora = new Date();
    if (agora < horaInicio) return 0;
    if (agora > horaFim) return 100;

    const totalExpedienteMs = horaFim.getTime() - horaInicio.getTime();
    const tempoDecorridoMs = agora.getTime() - horaInicio.getTime();
    const percentual = (tempoDecorridoMs / totalExpedienteMs) * 100;

    return Math.round(percentual);
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
}