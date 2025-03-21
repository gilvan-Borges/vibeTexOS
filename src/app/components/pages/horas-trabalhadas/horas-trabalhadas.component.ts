import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ControllAppService } from '../../../services/controllApp.service';
import { UsuarioService } from '../../../services/usuario.service';
import { environment } from '../../../../environments/environment.development';
import { UsuarioResponseDto } from '../../../models/control-app/usuario.response.dto';
import { Usuario } from '../../../models/control-app/usuario.model';
// Importar bibliotecas para PDF
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-horas-trabalhadas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './horas-trabalhadas.component.html',
  styleUrls: ['./horas-trabalhadas.component.css'],
})
export class HorasTrabalhadasComponent implements OnInit {
  horasTrabalhadas: any[] = [];
  horasFiltradas: any[] = [];
  filtroColaborador: string = '';
  dataInicial: string = '';
  dataFinal: string = '';
  mensagemSemRegistros: string = '';
  usuarios: any[] = [];
  listaUsuarios: { usuarioId: string; nome: string }[] = []; // Lista para o dropdown
  environment = environment; // Adicionar para uso no template

  constructor(
    private controllAppService: ControllAppService,
    private usuarioService: UsuarioService
  ) { }

  ngOnInit(): void {
    this.carregarUsuarios();
  }

  carregarUsuarios(): void {
    this.usuarioService.usuarioGetAll({}).subscribe({
      next: (usuarios: Usuario[]) => {
        console.log('Usuários carregados:', usuarios);

        // Preenche a lista para o dropdown
        this.listaUsuarios = usuarios.map(usuario => ({
          usuarioId: usuario.usuarioId,
          nome: usuario.nome || 'Nome não disponível'
        }));

        this.carregarDados(); // Carrega os pontos depois dos usuários
      },
      error: (err) => console.error('Erro ao carregar usuários:', err),
    });
  }

  carregarDados(): void {
    this.controllAppService.PontoGetAll().subscribe({
      next: (dados) => {
        console.log('Dados retornados pela API de pontos:', dados);
        this.usuarios = dados;
        this.processarHorasUsuarios();
      },
      error: (err) => console.error('Erro ao carregar pontos:', err),
    });
  }

  processarHorasUsuarios(): void {
    // Define an absolute media URL with /images
    const mediaBase = environment.mediaUrl.startsWith('http') 
      ? environment.mediaUrl 
      : 'http://' + environment.mediaUrl;
    const mediaUrlFinal = mediaBase.endsWith('/') 
      ? `${mediaBase}images/` 
      : `${mediaBase}/images/`;
    
    this.horasTrabalhadas = [];
    this.usuarios.forEach((ponto) => {
      // Buscar os dados do usuário para obter a foto correta
      this.controllAppService.usuarioGetById(ponto.usuarioId).subscribe({
        next: (usuario: UsuarioResponseDto) => {
          const data = ponto.inicioExpediente
            ? new Date(ponto.inicioExpediente).toLocaleDateString('pt-BR')
            : '-';
      
          const nomeColaborador = this.listaUsuarios.find(u => u.usuarioId === ponto.usuarioId)?.nome || 'Nome não disponível';
      
          console.log('Processando ponto do usuário:', { 
            usuarioId: ponto.usuarioId, 
            nome: nomeColaborador
          });
          
          // Processamento da foto de perfil - Ajustado para URL absoluta com /images
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
          } else {
              console.log('Usando foto padrão para usuário:', nomeColaborador);
          }
          
          // Processamento das fotos de início e fim - Ajustado com /images
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
      
          this.horasTrabalhadas.push({
            usuarioId: ponto.usuarioId,
            nome: nomeColaborador,
            fotoPerfil: fotoPerfilProcessada,
            data: data,
            horaInicio: ponto.inicioExpediente
              ? new Date(ponto.inicioExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '-',
            inicioPausa: ponto.inicioPausa
              ? new Date(ponto.inicioPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '-',
            fimPausa: ponto.retornoPausa
              ? new Date(ponto.retornoPausa).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '-',
            horaFim: ponto.fimExpediente
              ? new Date(ponto.fimExpediente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : '-',
            total: this.formatarHoras(ponto.horasTrabalhadas || '00:00:00'),
            horasDevidas: this.formatarHoras(ponto.horasDevidas || '00:00:00'),
            horasExtras: this.formatarHoras(ponto.horasExtras || '00:00:00'),
            fotoInicio: fotoInicioProcessada,
            fotoFim: fotoFimProcessada
          });
          
          this.horasFiltradas = [...this.horasTrabalhadas];
        },
        error: (error: Error) => {
          console.error('Erro ao buscar dados do usuário:', error);
        }
      });
    });
  }
  
  filtrarPorPeriodo(): void {
    let horas = [...this.horasTrabalhadas];

    if (this.filtroColaborador) {
      horas = horas.filter(h => h.usuarioId === this.filtroColaborador);
    }

    if (this.dataInicial && this.dataFinal) {
      const inicio = new Date(this.dataInicial);
      const fim = new Date(this.dataFinal);
      fim.setHours(23, 59, 59, 999);

      horas = horas.filter((h) => {
        const partes = h.data.split('/');
        const dataRegistro = new Date(
          parseInt(partes[2]),  // ano
          parseInt(partes[1]) - 1,  // mês (0-11)
          parseInt(partes[0])  // dia
        );
        return dataRegistro >= inicio && dataRegistro <= fim;
      });
    }

    this.horasFiltradas = horas;
    this.mensagemSemRegistros = this.horasFiltradas.length === 0 ? 'Nenhum registro encontrado.' : '';
  }

  filtrarMesAtual(): void {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    ultimoDia.setHours(23, 59, 59, 999);

    this.dataInicial = this.converterDateParaYYYYMMDD(primeiroDia);
    this.dataFinal = this.converterDateParaYYYYMMDD(ultimoDia);

    this.filtrarPorPeriodo(); // Chama o método de filtro por intervalo
  }

  private converterDateParaYYYYMMDD(data: Date): string {
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, '0');
    const dd = String(data.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatarHoras(horas: string): string {
    const [h, m] = horas.split(':').map(Number);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  
  // Método para gerar PDF
  gerarPDF(): void {
    // Verificar se há dados para gerar o PDF
    if (this.horasFiltradas.length === 0) {
      alert('Não há dados para gerar o PDF.');
      return;
    }

    // Selecionar a tabela para captura
    const tabela = document.querySelector('.card-body') as HTMLElement;
    if (!tabela) {
      alert('Erro ao localizar a tabela.');
      return;
    }

    // Exibir mensagem de carregamento
    const mensagem = document.createElement('div');
    mensagem.style.position = 'fixed';
    mensagem.style.top = '50%';
    mensagem.style.left = '50%';
    mensagem.style.transform = 'translate(-50%, -50%)';
    mensagem.style.padding = '20px';
    mensagem.style.background = 'rgba(0,0,0,0.7)';
    mensagem.style.color = 'white';
    mensagem.style.borderRadius = '5px';
    mensagem.style.zIndex = '9999';
    mensagem.textContent = 'Gerando PDF...';
    document.body.appendChild(mensagem);

    // Criar o PDF
    setTimeout(() => {
      html2canvas(tabela).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4'); // Paisagem (landscape)
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        // Adicionar título
        pdf.setFontSize(16);
        pdf.text('Relatório de Horas Trabalhadas', 10, 10);
        
        // Adicionar data do relatório
        const dataAtual = new Date().toLocaleDateString('pt-BR');
        pdf.setFontSize(10);
        pdf.text(`Data do relatório: ${dataAtual}`, 10, 18);
        
        // Adicionar período filtrado, se houver
        if (this.dataInicial && this.dataFinal) {
          const dataInicial = new Date(this.dataInicial).toLocaleDateString('pt-BR');
          const dataFinal = new Date(this.dataFinal).toLocaleDateString('pt-BR');
          pdf.text(`Período: ${dataInicial} a ${dataFinal}`, 10, 24);
        }
        
        // Adicionar a imagem da tabela
        pdf.addImage(imgData, 'PNG', 10, 30, pdfWidth - 20, pdfHeight - 20);
        
        // Salvar o PDF
        pdf.save('horas-trabalhadas.pdf');
        
        // Remover mensagem de carregamento
        document.body.removeChild(mensagem);
      });
    }, 500);
  }

  // Add these methods for image error handling
  // Updated image error handling to remove repetitive error events
  handleImageError(event: Event, fallbackPath: string): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      // Remove error listener to avoid loop
      img.onerror = null;
      // Ensure mediaUrl ends with a slash and includes /images
      const baseUrl = environment.mediaUrl.endsWith('/')
        ? `${environment.mediaUrl}images/`
        : `${environment.mediaUrl}/images/`;
      img.src = `${baseUrl}${fallbackPath}`;
    }
  }
}