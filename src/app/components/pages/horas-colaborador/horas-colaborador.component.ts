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
      this.cdr.detectChanges(); // Atualiza a tabela
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

      // Define an absolute media URL with /images
      const mediaBase = environment.mediaUrl.startsWith('http') 
        ? environment.mediaUrl 
        : 'http://' + environment.mediaUrl;
      const mediaUrlFinal = mediaBase.endsWith('/') 
        ? `${mediaBase}images/` 
        : `${mediaBase}/images/`;

      this.controllAppService.usuarioGetById(ponto.usuarioId).subscribe({
        next: (usuario) => {
          // Process profile photo URL with /images
          let fotoPerfilProcessada = `${mediaUrlFinal}default-avatar.png`;
          
          if (usuario.fotoUrl && typeof usuario.fotoUrl === 'string') {
            try {
              if (usuario.fotoUrl.startsWith('http')) {
                fotoPerfilProcessada = usuario.fotoUrl;
              } else {
                let nomeArquivo = usuario.fotoUrl;
                if (nomeArquivo.includes('/')) {
                  nomeArquivo = nomeArquivo.split('/').pop() || '';
                }
                if (nomeArquivo) {
                  fotoPerfilProcessada = `${mediaUrlFinal}${nomeArquivo}`;
                }
              }
              console.log('Foto perfil URL original:', usuario.fotoUrl);
              console.log('Foto perfil processada:', fotoPerfilProcessada);
            } catch (error) {
              console.error('Erro ao processar URL da foto de perfil:', error);
            }
          }
          
          // Process start photo URL with /images
          let fotoInicioProcessada = null;
          if (ponto.fotoInicioExpediente) {
            try {
              if (ponto.fotoInicioExpediente.startsWith('http')) {
                fotoInicioProcessada = ponto.fotoInicioExpediente;
              } else {
                let nomeArquivo = ponto.fotoInicioExpediente;
                if (nomeArquivo.includes('/')) {
                  nomeArquivo = nomeArquivo.split('/').pop() || '';
                }
                fotoInicioProcessada = `${mediaUrlFinal}${nomeArquivo}`;
              }
              console.log('Foto início URL original:', ponto.fotoInicioExpediente);
              console.log('Foto início processada:', fotoInicioProcessada);
            } catch (error) {
              console.error('Erro ao processar URL da foto de início:', error);
            }
          }
          
          // Process end photo URL with /images
          let fotoFimProcessada = null;
          if (ponto.fotoFimExpediente) {
            try {
              if (ponto.fotoFimExpediente.startsWith('http')) {
                fotoFimProcessada = ponto.fotoFimExpediente;
              } else {
                let nomeArquivo = ponto.fotoFimExpediente;
                if (nomeArquivo.includes('/')) {
                  nomeArquivo = nomeArquivo.split('/').pop() || '';
                }
                fotoFimProcessada = `${mediaUrlFinal}${nomeArquivo}`;
              }
              console.log('Foto fim URL original:', ponto.fotoFimExpediente);
              console.log('Foto fim processada:', fotoFimProcessada);
            } catch (error) {
              console.error('Erro ao processar URL da foto de fim:', error);
            }
          }

          const registro = {
            data: `${dia}/${mes}/${ano}`,
            inicio: ponto.inicioExpediente ? new Date(ponto.inicioExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            inicioPausa: ponto.inicioPausa ? new Date(ponto.inicioPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            fimPausa: ponto.retornoPausa ? new Date(ponto.retornoPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            fim: ponto.fimExpediente ? new Date(ponto.fimExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            total: this.formatarHoras(ponto.horasTrabalhadas || '00:00:00'),
            horaDevida: this.formatarHoras(ponto.horasDevidas || '00:00:00'),
            horaExtra: this.formatarHoras(ponto.horasExtras || '00:00:00'),
            fotoPerfil: fotoPerfilProcessada,
            fotoInicio: fotoInicioProcessada,
            fotoFim: fotoFimProcessada
          };
          
          resolve(registro);
        },
        error: (err) => {
          console.error("Erro ao buscar foto do usuário:", err);
          // Even in case of error, use the same URL formatting approach with /images
          const mediaBase = environment.mediaUrl.startsWith('http') 
            ? environment.mediaUrl 
            : 'http://' + environment.mediaUrl;
          const mediaUrlFinal = mediaBase.endsWith('/') 
            ? `${mediaBase}images/` 
            : `${mediaBase}/images/`;
          
          resolve({
            data: `${dia}/${mes}/${ano}`,
            inicio: ponto.inicioExpediente ? new Date(ponto.inicioExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            inicioPausa: ponto.inicioPausa ? new Date(ponto.inicioPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            fimPausa: ponto.retornoPausa ? new Date(ponto.retornoPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            fim: ponto.fimExpediente ? new Date(ponto.fimExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-',
            total: this.formatarHoras(ponto.horasTrabalhadas || '00:00:00'),
            horaDevida: this.formatarHoras(ponto.horasDevidas || '00:00:00'),
            horaExtra: this.formatarHoras(ponto.horasExtras || '00:00:00'),
            fotoPerfil: `${mediaUrlFinal}default-avatar.png`,
            fotoInicio: ponto.fotoInicioExpediente ? `${mediaUrlFinal}${ponto.fotoInicioExpediente.split('/').pop()}` : null,
            fotoFim: ponto.fotoFimExpediente ? `${mediaUrlFinal}${ponto.fotoFimExpediente.split('/').pop()}` : null
          });
        }
      });
    });
  }

  // Add an image error handler with /images
  handleImageError(event: Event, fallbackPath: string): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      // Remove error listener to avoid loop
      img.onerror = null;
      // Ensure mediaUrl ends with a slash and includes /images
      const mediaBase = environment.mediaUrl.startsWith('http') 
        ? environment.mediaUrl 
        : 'http://' + environment.mediaUrl;
      const baseUrl = mediaBase.endsWith('/')
        ? `${mediaBase}images/`
        : `${mediaBase}/images/`;
      img.src = `${baseUrl}${fallbackPath}`;
      console.log('Imagem substituída por fallback:', `${baseUrl}${fallbackPath}`);
    }
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