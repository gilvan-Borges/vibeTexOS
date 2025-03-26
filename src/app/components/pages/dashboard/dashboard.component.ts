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
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../../../environments/environment.development';

export interface OrdemServico {
  ordemDeServicoId: string;
  usuarioId: string;
  clienteId: string;
  tipoServico: string;
  statusOrdem: string;
  numeroOrdemDeServico: string;
  dataHoraCadastro: string;
  atribuida: boolean;
  duracao?: string; // Campo para a duração da ordem de serviço
}

export interface DesempenhoColaborador {
  usuarioId: string;
  empresa: string;
  nome: string;
  osAtribuidas: number;
  osRealizadas: number;
  osPendentes: number;
  osCanceladas: number; // Nova propriedade adicionada
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

export interface PontoRegistro {
  pontoId: string;
  usuarioId: string;
  horaEntrada: string; // ISO date string
  horaSaida?: string;  // ISO date string, optional
  // ... other properties
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
  Math = Math;
  totalOS: number = 0;
  osRealizadas: number = 0;
  osNaoAtribuidas: number = 0;
  osNaoRealizadas: number = 0;
  osPendentes: number = 0; // Nova propriedade para O.S. Pendentes
  efficiencyGeneral: number = 0;
  colaboradoresDesempenho: DesempenhoColaborador[] = [];
  colaboradores: Colaborador[] = [];

  // Propriedade para armazenar apenas colaboradores online
  get colaboradoresOnline(): DesempenhoColaborador[] {
    return this.colaboradoresDesempenho.filter(c => c.isOnline === true);
  }

  // Adicionar variáveis de paginação
  paginaAtual: number = 1;
  itensPorPagina: number = 10;
  totalItems: number = 0;
  totalPaginas: number = 0;

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
    console.log('📍 Iniciando carregamento de colaboradores no mapa...');

    this.vibeService.buscarUsuario(this.paginaAtual, this.itensPorPagina).pipe(
      catchError(error => {
        console.error('❌ Erro ao carregar colaboradores para o mapa:', error);
        return of({ items: [], totalItems: 0, totalPages: 0 });
      })
    ).subscribe({
      next: (response: any) => {
        if (!response) {
          console.warn('⚠️ Resposta vazia da API');
          return;
        }
        
        // Extrair metadados de paginação
        if (response.totalItems !== undefined) {
          this.totalItems = response.totalItems;
          this.totalPaginas = response.totalPages || Math.ceil(this.totalItems / this.itensPorPagina);
        }
        
        // Extrair os itens
        const colaboradoresData = response.items || response;
        
        if (!colaboradoresData || colaboradoresData.length === 0) {
          console.warn('⚠️ Nenhum colaborador encontrado');
          return;
        }

        const colaboradores = colaboradoresData.map((colab: any) => ({
          usuarioId: colab.usuarioId,
          nome: colab.nome || 'Sem Nome',
          empresa: colab.nomeDaEmpresa || colab.empresa || 'N/A',
          horaEntrada: colab.horaEntrada || '00:00',
          horaSaida: colab.horaSaida || '00:00',
          latitudeAtual: colab.latitudeAtual,
          longitudeAtual: colab.longitudeAtual,
          dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ? new Date(colab.dataHoraUltimaAutenticacao) : undefined,
          fotoUrl: colab.fotoUrl || '/assets/default-profile.png',
          isOnline: colab.isOnline === true
        } as Colaborador));

        const colaboradoresOnline = colaboradores.filter((u: Colaborador) =>
          u.latitudeAtual && u.longitudeAtual && u.isOnline === true
        );

        console.log(`✅ Encontrados ${colaboradoresOnline.length} colaboradores online com localização`);
        this.processarColaboradoresOnline(colaboradoresOnline);
      },
      error: (error) => {
        console.error('❌ Erro inesperado ao carregar colaboradores:', error);
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

    this.vibeService.buscarOrdemServico().pipe(
      catchError(error => {
        console.error('❌ Erro ao carregar ordens:', error);
        return of({ items: [] });
      })
    ).subscribe({
      next: (response: any) => {
        // Extrair o array de ordens da resposta, que pode vir em diferentes formatos
        const ordens = this.extrairArrayDeOrdens(response);
        
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

  // Função auxiliar para extrair o array de ordens da resposta da API
  private extrairArrayDeOrdens(response: any): OrdemServico[] {
    if (!response) return [];
    
    // Se já for um array
    if (Array.isArray(response)) {
      return response;
    }
    
    // Se for um objeto com propriedade 'items' (formato paginado)
    if (response && typeof response === 'object' && response.items && Array.isArray(response.items)) {
      return response.items;
    }
    
    console.warn('Formato de resposta inesperado para ordens de serviço:', response);
    return [];
  }

  private carregarColaboradoresAtivos() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    console.log('👥 Iniciando carregamento de colaboradores ativos...');

    // Adiciona tratamento de erros na busca de usuários
    this.vibeService.buscarUsuario(this.paginaAtual, this.itensPorPagina).pipe(
      catchError(error => {
        console.error('❌ Erro ao buscar usuários:', error);
        // Em caso de erro, tenta obter dados do localStorage como fallback
        const cachedData = localStorage.getItem('cached_colaboradores');
        if (cachedData) {
          console.log('🔄 Usando dados em cache como fallback');
          try {
            return of(JSON.parse(cachedData));
          } catch (e) {
            console.error('Erro ao analisar dados em cache:', e);
          }
        }
        return of([]); // Retorna array vazio como último recurso
      })
    ).subscribe({
      next: (response: any) => {
        // Atualizar informações de paginação
        if (response.totalItems !== undefined) {
          this.totalItems = response.totalItems;
          this.totalPaginas = response.totalPages || Math.ceil(this.totalItems / this.itensPorPagina);
        }
        
        // Extrair os itens
        const colaboradores = response.items || response;
        
        if (!colaboradores || colaboradores.length === 0) {
          console.warn('⚠️ Nenhum colaborador encontrado ou resposta vazia');
          this.colaboradoresDesempenho = [];
          this.colaboradores = [];
          return;
        }

        console.log(`✅ Recebidos ${colaboradores.length} colaboradores da API`);

        // Armazena dados em cache para uso futuro
        try {
          localStorage.setItem('cached_colaboradores', JSON.stringify(colaboradores));
        } catch (e) {
          console.warn('Não foi possível armazenar dados em cache:', e);
        }

        // Formata os dados dos colaboradores
        this.colaboradores = colaboradores
          .filter((colab: any) => colab.role === 'Colaborador')
          .map((colab: any) => {
            // Process the photo URL properly
            let photoUrl = '/assets/default-profile.png';
            if (colab.fotoUrl) {
              if (colab.fotoUrl.startsWith('http://') || colab.fotoUrl.startsWith('https://')) {
                photoUrl = colab.fotoUrl;
              } else {
                // Extract filename if it's a path
                const filename = colab.fotoUrl.split('/').pop();
                photoUrl = `${environment.mediaUrl}/images/${filename}`;
              }
            }
            
            return {
              usuarioId: colab.usuarioId,
              nome: colab.nome,
              empresa: colab.nomeDaEmpresa || colab.empresa || 'VibeTex Soluções',
              horaEntrada: colab.horaEntrada || '08:00',
              horaSaida: colab.horaSaida || '18:00',
              latitudeAtual: colab.latitudeAtual || '',
              longitudeAtual: colab.longitudeAtual || '',
              dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ?
                new Date(colab.dataHoraUltimaAutenticacao) : undefined,
              fotoUrl: photoUrl,
              isOnline: colab.isOnline === true
            };
          });

        console.log(`👥 Filtragem resultou em ${this.colaboradores.length} colaboradores válidos`);

        // Buscar ordens de serviço com tratamento de erros
        this.vibeService.buscarOrdemServico().pipe(
          catchError(err => {
            console.error('❌ Erro ao buscar ordens de serviço:', err);
            return of({ items: [] });
          })
        ).subscribe({
          next: (response: any) => {
            const ordens = this.extrairArrayDeOrdens(response);
            
            const ordensHoje = ordens.filter(ordem => {
              try {
                const dataOrdem = new Date(ordem.dataHoraCadastro);
                return dataOrdem >= hoje;
              } catch (e) {
                console.warn('⚠️ Data inválida em ordem:', ordem);
                return false;
              }
            });

            // Filtrar apenas colaboradores que estão online
            const colaboradoresOnline = this.colaboradores.filter(colab => colab.isOnline === true);
            console.log(`👤 ${colaboradoresOnline.length} colaboradores online encontrados`);

            // Buscar pontos com tratamento aprimorado de erros
            this.buscarPontosColaboradoresEAtualizarDesempenho(colaboradoresOnline, ordensHoje);
          },
          error: (err) => {
            console.error('❌ Erro inesperado ao carregar ordens do dia:', err);

            // Mesmo com erro, tenta continuar com os dados de colaboradores
            const colaboradoresOnline = this.colaboradores.filter(colab => colab.isOnline === true);
            this.buscarPontosColaboradoresEAtualizarDesempenho(colaboradoresOnline, []);
          }
        });
      },
      error: (err) => {
        console.error('❌ Erro fatal ao carregar colaboradores:', err);
        this.colaboradoresDesempenho = [];
        this.colaboradores = [];
      }
    });
  }

  // Novo método para buscar os pontos dos colaboradores em paralelo
  private buscarPontosColaboradoresEAtualizarDesempenho(colaboradores: Colaborador[], ordens: OrdemServico[]) {
    if (!colaboradores || colaboradores.length === 0) {
      this.colaboradoresDesempenho = [];
      return;
    }

    console.log(`🔄 Buscando pontos para ${colaboradores.length} colaboradores...`);

    const requisicoes: Observable<any>[] = colaboradores.map(colaborador =>
      this.controllAppService.PontoGetByUsuarioId(colaborador.usuarioId).pipe(
        catchError(err => {
          console.warn(`⚠️ Erro ao buscar pontos do colaborador ${colaborador.nome}:`, err);
          return of([]);  // Retorna array vazio em caso de erro
        })
      )
    );

    // Timeout para não bloquear a interface caso a API demore muito
    forkJoin(requisicoes).pipe(
      timeout(10000), // 10 segundos de timeout
      catchError(err => {
        console.error('❌ Timeout ou erro ao buscar pontos:', err);
        return of(colaboradores.map(() => [])); // Array de arrays vazios como fallback
      })
    ).subscribe({
      next: (resultados) => {
        console.log(`✅ Dados de pontos recebidos para ${resultados.filter(r => r.length > 0).length} colaboradores`);
        this.atualizarDesempenhoColaboradores(colaboradores, ordens, resultados);
      },
      error: (err) => {
        console.error('❌ Erro fatal ao buscar pontos dos colaboradores:', err);
        // Continue com a lógica antiga
        this.atualizarDesempenhoColaboradores(colaboradores, ordens, []);
      }
    });
  }

  private atualizarDesempenhoColaboradores(
    colaboradores: Colaborador[],
    ordens: OrdemServico[],
    pontosColaboradores: any[][] = []
  ) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    this.colaboradoresDesempenho = colaboradores.map((colaborador, index) => {
      const ordensDoColaborador = ordens.filter(o => o.usuarioId === colaborador.usuarioId);
      const ordensFinalizadas = ordensDoColaborador.filter(o =>
        ['concluído']
          .includes(o.statusOrdem?.toLowerCase().trim() || '')
      );
      const ordensCanceladas = ordensDoColaborador.filter(o =>
        ['cancelado', 'cancelada']
          .includes(o.statusOrdem?.toLowerCase().trim() || '')
      );

      const desempenho: DesempenhoColaborador = {
        usuarioId: colaborador.usuarioId,
        empresa: colaborador.empresa,
        nome: colaborador.nome,
        osAtribuidas: ordensDoColaborador.length,
        osRealizadas: ordensFinalizadas.length,
        osPendentes: ordensDoColaborador.length - ordensFinalizadas.length - ordensCanceladas.length,
        osCanceladas: ordensCanceladas.length, // Nova propriedade
        tempoMedio: this.calcularTempoMedio(ordensFinalizadas),
        eficiencia: ordensDoColaborador.length ?
          Math.round((ordensFinalizadas.length / ordensDoColaborador.length) * 100) : 0,
        jornada: '0%', // Valor inicial
        fotoUrl: colaborador.fotoUrl, // This should already be properly formatted from earlier
        isOnline: true // adicionado, pois somente colaboradores online chegam aqui
      };

      // Buscar os pontos registrados hoje para este colaborador
      const pontosDoColaborador = pontosColaboradores[index] || [];
      desempenho.jornada = this.calcularProgressoJornada(colaborador, pontosDoColaborador);

      return desempenho;
    });
  }

  private calcularProgressoJornada(colaborador: Colaborador, pontos: any[]): string {
    const agora = new Date();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    console.log(`🔍 Calculando jornada para colaborador ${colaborador.nome}...`);

    // Filtrar apenas pontos de hoje e que tenham registro de entrada (usando inicioExpediente)
    const pontosHoje = pontos.filter(ponto => {
      const horaEntrada = ponto.horaEntrada || ponto.inicioExpediente; // Usa inicioExpediente como fallback
      if (!horaEntrada) {
        console.warn(`⚠️ Ponto sem horaEntrada ou inicioExpediente para colaborador ${colaborador.nome}:`, ponto);
        return false;
      }

      const dataEntrada = new Date(horaEntrada);
      if (isNaN(dataEntrada.getTime())) {
        console.warn(`⚠️ Data de entrada inválida para colaborador ${colaborador.nome}: ${horaEntrada}`, ponto);
        return false;
      }

      return dataEntrada >= hoje && dataEntrada <= agora; // Garante que a data seja de hoje e não futura
    });

    // Ordenar pontos por data de entrada (mais recente primeiro)
    pontosHoje.sort((a, b) =>
      new Date(b.inicioExpediente || b.horaEntrada).getTime() - new Date(a.inicioExpediente || a.horaEntrada).getTime()
    );

    // Pegar o ponto mais recente de hoje
    const pontoHoje = pontosHoje.length > 0 ? pontosHoje[0] : null;

    console.log(`📍 Ponto mais recente para ${colaborador.nome}:`, pontoHoje);

    // Se tem um registro de ponto hoje, usar horário real de entrada
    if (pontoHoje && (pontoHoje.inicioExpediente || pontoHoje.horaEntrada)) {
      const dataEntrada = new Date(pontoHoje.inicioExpediente || pontoHoje.horaEntrada);
      console.log(`✅ Usando horário real de entrada para ${colaborador.nome}: ${dataEntrada.toLocaleString()}`);

      // Pegar hora de saída prevista do cadastro do colaborador
      const horaSaidaPrevista = new Date(agora);
      const [horaSaida, minutoSaida] = (colaborador.horaSaida || '17:00').split(':').map(Number);
      horaSaidaPrevista.setHours(horaSaida, minutoSaida, 0, 0);

      console.log(`⏰ Horário de saída previsto para ${colaborador.nome}: ${horaSaidaPrevista.toLocaleString()}`);

      // Se já tiver registrado saída, mostrar 100%
      if (pontoHoje.horaSaida || pontoHoje.fimExpediente) {
        console.log(`✅ Colaborador ${colaborador.nome} já registrou saída: ${pontoHoje.horaSaida || pontoHoje.fimExpediente}`);
        return '100%';
      }

      // Se o horário atual for maior que o horário de saída previsto, mostrar 100%
      if (agora > horaSaidaPrevista) {
        console.log(`✅ Jornada de ${colaborador.nome} concluída (horário atual > saída prevista)`);
        return '100%';
      }

      // Calcular o progresso com base no horário real de entrada
      const totalJornadaMs = horaSaidaPrevista.getTime() - dataEntrada.getTime();
      const decorridoMs = agora.getTime() - dataEntrada.getTime();
      const percentualJornada = Math.round((decorridoMs / totalJornadaMs) * 100);

      console.log(`📊 Progresso da jornada para ${colaborador.nome}: ${percentualJornada}% (Decorrido: ${decorridoMs / 1000 / 60} min, Total: ${totalJornadaMs / 1000 / 60} min)`);

      return `${Math.min(100, Math.max(0, percentualJornada))}%`;
    } else {
      // Fallback: usar horário cadastrado do colaborador
      console.warn(`⚠️ Nenhum ponto registrado hoje para ${colaborador.nome}. Usando horário cadastrado: ${colaborador.horaEntrada}`);

      const horaEntradaStr = colaborador.horaEntrada || '08:00';
      const horaSaidaStr = colaborador.horaSaida || '17:00';

      const dataInicioExpediente = new Date(agora);
      const [horaEntrada, minutoEntrada] = horaEntradaStr.split(':').map(Number);
      dataInicioExpediente.setHours(horaEntrada, minutoEntrada, 0, 0);

      const dataFimExpediente = new Date(agora);
      const [horaSaida, minutoSaida] = horaSaidaStr.split(':').map(Number);
      dataFimExpediente.setHours(horaSaida, minutoSaida, 0, 0);

      if (agora < dataInicioExpediente) {
        console.log(`⏳ Jornada de ${colaborador.nome} ainda não começou`);
        return '0%';
      } else if (agora > dataFimExpediente) {
        console.log(`✅ Jornada de ${colaborador.nome} concluída (horário atual > saída prevista)`);
        return '100%';
      } else {
        const totalJornadaMs = dataFimExpediente.getTime() - dataInicioExpediente.getTime();
        const decorridoMs = agora.getTime() - dataInicioExpediente.getTime();
        const percentualJornada = Math.round((decorridoMs / totalJornadaMs) * 100);

        console.log(`📊 Progresso da jornada (fallback) para ${colaborador.nome}: ${percentualJornada}% (Decorrido: ${decorridoMs / 1000 / 60} min, Total: ${totalJornadaMs / 1000 / 60} min)`);

        return `${percentualJornada}%`;
      }
    }
  }

  private resetarMetricas() {
    this.totalOS = 0;
    this.osRealizadas = 0;
    this.osNaoAtribuidas = 0;
    this.osNaoRealizadas = 0;
    this.osPendentes = 0; // Resetar a nova propriedade
    this.efficiencyGeneral = 0;
  }

  private atualizarMetricasGerais(ordens: OrdemServico[]) {
    this.totalOS = ordens.length;
  
    // Normaliza e filtra
    const statusNormalizado = (status: string) => status?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
    this.osRealizadas = ordens.filter(o => statusNormalizado(o.statusOrdem) === 'concluido').length;
  
    this.osNaoRealizadas = ordens.filter(o => ['cancelado', 'cancelada'].includes(statusNormalizado(o.statusOrdem))).length;
  
    // Ordens não atribuídas (que não têm colaborador associado)
    this.osNaoAtribuidas = ordens.filter(o => o.atribuida = false).length;
    
    // Ordens pendentes (que não estão concluídas ou canceladas)
    this.osPendentes = ordens.filter(o => {
      const status = statusNormalizado(o.statusOrdem);
      return status !== 'concluido' && !['cancelado', 'cancelada'].includes(status);
    }).length;
  
    this.efficiencyGeneral = this.totalOS > 0 ?
      Math.round((this.osRealizadas / this.totalOS) * 100) : 0;
  
    console.log('📊 Métricas atualizadas:', {
      total: this.totalOS,
      naoAtribuidas: this.osNaoAtribuidas,
      realizadas: this.osRealizadas,
      naoRealizadas: this.osNaoRealizadas,
      pendentes: this.osPendentes,
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

        this.colaboradores = colaboradores.map(colab => {
          // Process photo URL
          let photoUrl = '/assets/default-profile.png';
          if (colab.fotoUrl) {
            if (colab.fotoUrl.startsWith('http://') || colab.fotoUrl.startsWith('https://')) {
              photoUrl = colab.fotoUrl;
            } else {
              // Extract filename if it's a path
              const filename = colab.fotoUrl.split('/').pop();
               photoUrl = `${environment.mediaUrl}/images/${filename}`;
            }
          }
          
          return {
            usuarioId: colab.usuarioId,
            nome: colab.nome,
            empresa: colab.nomeDaEmpresa || colab.empresa || 'N/A',
            horaEntrada: colab.horaEntrada || '08:00',
            horaSaida: colab.horaSaida || '18:00',
            latitudeAtual: colab.latitudeAtual || '',
            longitudeAtual: colab.longitudeAtual || '',
            dataHoraUltimaAutenticacao: colab.dataHoraUltimaAutenticacao ? new Date(colab.dataHoraUltimaAutenticacao) : undefined,
            fotoUrl: photoUrl
          };
        });

        this.colaboradoresDesempenho = this.colaboradores.map(colaborador => {
          const ordensDoColaborador = ordens.filter(o => o.usuarioId === colaborador.usuarioId);
          const ordensFinalizadas = ordensDoColaborador.filter(o =>
            ['concluído']
              .includes(o.statusOrdem?.toLowerCase().trim() || '')
          );
          const ordensCanceladas = ordensDoColaborador.filter(o =>
            ['cancelado', 'cancelada']
              .includes(o.statusOrdem?.toLowerCase().trim() || '')
          );

          const tempoMedio = this.calcularTempoMedio(ordensFinalizadas);
          const osAtribuidas = ordensDoColaborador.length;
          const osRealizadas = ordensFinalizadas.length;
          const osPendentes = ordensDoColaborador.length - ordensFinalizadas.length - ordensCanceladas.length;
          const eficiencia = osAtribuidas ? Math.round((osRealizadas / osAtribuidas) * 100) : 0;

          return {
            usuarioId: colaborador.usuarioId,
            empresa: colaborador.empresa,
            nome: colaborador.nome,
            osAtribuidas,
            osRealizadas,
            osPendentes,
            osCanceladas: ordensCanceladas.length, // Adicionando a propriedade que estava faltando
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
    if (!ordens.length) return '00:00:00';

    // Filtra apenas ordens com duracao definida
    const ordensComDuracao = ordens.filter(o => !!o.duracao);
    if (ordensComDuracao.length === 0) return '00:00:00';

    // Calcula o tempo total em milissegundos
    const tempoTotalMs = ordensComDuracao.reduce((acc, ordem) => {
      // Converte a string de duração para milissegundos
      // Formato esperado: "00:00:50.8416611" (hh:mm:ss.fffffff)
      const duracao = ordem.duracao || "00:00:00";
      const [hours, minutes, seconds] = duracao.split(':');
      // Tratando o caso de segundos com frações
      const secondsValue = parseFloat(seconds);
      const duracaoMs = (parseInt(hours) * 3600 + parseInt(minutes) * 60 + secondsValue) * 1000;
      return acc + duracaoMs;
    }, 0);

    // Calcula a média
    const tempoMedioMs = tempoTotalMs / ordensComDuracao.length;
    
    // Formata o resultado no padrão 00:00:00
    const horas = Math.floor(tempoMedioMs / (1000 * 60 * 60)).toString().padStart(2, '0');
    const minutos = Math.floor((tempoMedioMs % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
    const segundos = Math.floor((tempoMedioMs % (1000 * 60)) / 1000).toString().padStart(2, '0');

    return `${horas}:${minutos}:${segundos}`;
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

  // Métodos para controle de paginação
  mudarPagina(novaPagina: number): void {
    if (novaPagina > 0 && novaPagina <= this.totalPaginas && novaPagina !== this.paginaAtual) {
      this.paginaAtual = novaPagina;
      this.carregarDados();
    }
  }
  
  mudarItensPorPagina(novoValor: number): void {
    this.itensPorPagina = novoValor;
    this.paginaAtual = 1; // Resetar para a primeira página
    this.carregarDados();
  }
}