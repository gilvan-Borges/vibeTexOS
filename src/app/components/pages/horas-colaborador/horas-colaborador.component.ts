import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControllAppService } from '../../../services/controllApp.service';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment.development';

@Component({
  selector: 'app-horas-colaborador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './horas-colaborador.component.html',
  styleUrls: ['./horas-colaborador.component.css'],
})
export class HorasColaboradorComponent implements OnInit {
  usuarioId: string = '';
  horasFiltradas: any[] = [];
  horasTrabalhadas: any[] = [];
  dataInicial: string = '';
  dataFinal: string = '';
  mensagemSemRegistros: string = '';
  bancoDeHoras: number = 0; // Armazena o total de horas acumuladas no período

  constructor(
    private controllAppService: ControllAppService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Obtém o usuárioId da URL
    this.usuarioId = this.route.snapshot.paramMap.get('usuarioId') || '';

    // Define o mês atual como período inicial
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    ultimoDia.setHours(23, 59, 59, 999);

    this.dataInicial = this.converterDateParaYYYYMMDD(primeiroDia);
    this.dataFinal = this.converterDateParaYYYYMMDD(ultimoDia);

    // Carrega os dados de horas combinadas para o usuário logado
    this.carregarHorasUsuario();
  }

  carregarHorasUsuario(): void {
    this.controllAppService.PontoGetByUsuarioId(this.usuarioId).subscribe({
      next: (dados) => {
        this.horasTrabalhadas = dados;
        console.log('Dados de horas do colaborador:', this.horasTrabalhadas);
        this.filtrarPorPeriodo(); // Inicializa o filtro padrão ao carregar
      },
      error: (err) => console.error('Erro ao carregar horas do colaborador:', err),
    });
  }

  filtrarPorPeriodo(): void {
    let horas = [...this.horasTrabalhadas];
  
    if (this.dataInicial && this.dataFinal) {
      const inicio = new Date(this.dataInicial);
      const fim = new Date(this.dataFinal);
      fim.setHours(23, 59, 59, 999); // Inclui todo o último dia no filtro
  
      horas = horas.filter((h) => {
        const dataRegistro = new Date(h.inicioExpediente);
        return dataRegistro >= inicio && dataRegistro <= fim;
      });
    }
  
    // Formata os registros e busca as fotos antes de atualizar a tabela
    const registrosFormatados = horas.map(ponto => this.formatarRegistro(ponto));
  
    // Espera todas as fotos carregarem antes de atualizar `horasFiltradas`
    Promise.all(registrosFormatados).then((registros) => {
      this.horasFiltradas = registros;
      this.cdr.detectChanges(); // �� Atualiza a tabela
      this.mensagemSemRegistros = this.horasFiltradas.length === 0 ? 'Nenhum registro encontrado.' : '';
    });
  
    this.calcularBancoDeHoras();
  }
  

  filtrarMesAtual(): void {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    ultimoDia.setHours(23, 59, 59, 999);

    this.dataInicial = this.converterDateParaYYYYMMDD(primeiroDia);
    this.dataFinal = this.converterDateParaYYYYMMDD(ultimoDia);

    this.filtrarPorPeriodo(); // Filtra com o mês atual
  }

  abrirImagem(url: string): void {
    if (url) {
      window.open(url, '_blank');
    }
  }

  private formatarRegistro(ponto: any): Promise<any> {
    return new Promise((resolve) => {
      const data = new Date(ponto.inicioExpediente);
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();

      this.controllAppService.usuarioGetById(ponto.usuarioId).subscribe({
        next: (usuario) => {
          const registro = {
            data: `${dia}/${mes}/${ano}`,
            inicio: ponto.inicioExpediente ? new Date(ponto.inicioExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            inicioPausa: ponto.inicioPausa ? new Date(ponto.inicioPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            fimPausa: ponto.retornoPausa ? new Date(ponto.retornoPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            fim: ponto.fimExpediente ? new Date(ponto.fimExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            total: this.formatarHoras(ponto.horasTrabalhadas || '00:00:00'),
            horaDevida: this.formatarHoras(ponto.horasDevidas || '00:00:00'),
            horaExtra: this.formatarHoras(ponto.horasExtras || '00:00:00'),
            fotoPerfil: usuario?.fotoUrl ? `${environment.mediaUrl}/${usuario.fotoUrl.split('/').pop()}` : 'https://via.placeholder.com/40x40',
            fotoInicio: ponto.fotoInicioExpediente ? `${environment.mediaUrl}/${ponto.fotoInicioExpediente.split('/').pop()}` : null,
            fotoFim: ponto.fotoFimExpediente ? `${environment.mediaUrl}/${ponto.fotoFimExpediente.split('/').pop()}` : null
          };
          
          resolve(registro);
        },
        error: (err) => {
          console.error("Erro ao buscar foto do usuário:", err);
          resolve({
            data: `${dia}/${mes}/${ano}`,
            inicio: ponto.inicioExpediente ? new Date(ponto.inicioExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            inicioPausa: ponto.inicioPausa ? new Date(ponto.inicioPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            fimPausa: ponto.retornoPausa ? new Date(ponto.retornoPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            fim: ponto.fimExpediente ? new Date(ponto.fimExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            total: this.formatarHoras(ponto.horasTrabalhadas || '00:00:00'),
            horaDevida: this.formatarHoras(ponto.horasDevidas || '00:00:00'),
            horaExtra: this.formatarHoras(ponto.horasExtras || '00:00:00'),
            fotoPerfil: 'https://via.placeholder.com/40x40',
            fotoInicio: ponto.fotoInicioExpediente ? `${environment.mediaUrl}/${ponto.fotoInicioExpediente.split('/').pop()}` : null,
            fotoFim: ponto.fotoFimExpediente ? `${environment.mediaUrl}/${ponto.fotoFimExpediente.split('/').pop()}` : null
          });
        }
      });
    });
  }
  
  

  private calcularBancoDeHoras(): void {
    let totalHoras = 0;

    this.horasFiltradas.forEach(hora => {
      const [horasExtras, minutosExtras] = hora.horaExtra.split(':').map(Number);
      const [horasDevidas, minutosDevidos] = hora.horaDevida.split(':').map(Number);

      const horas = horasExtras - horasDevidas;
      const minutos = minutosExtras - minutosDevidos;

      totalHoras += horas + minutos / 60;
    });

    this.bancoDeHoras = totalHoras;
  }

  private formatarHoras(horas: string): string {
    const [h, m] = horas.split(':').map(Number);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private converterDateParaYYYYMMDD(data: Date): string {
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, '0');
    const dd = String(data.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
