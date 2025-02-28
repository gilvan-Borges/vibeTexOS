import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ControllAppService } from '../../../services/controllApp.service';
import { UsuarioService } from '../../../services/usuario.service';


import { environment } from '../../../../environments/environment.development';
import { UsuarioResponseDto } from '../../../models/control-app/usuario.response.dto';
import { Usuario } from '../../../models/control-app/usuario.model';


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
            nome: nomeColaborador,
            fotoUrl: usuario.fotoUrl,
            fotoInicio: ponto.fotoInicioExpediente,
            fotoFim: ponto.fotoFimExpediente
          });
          
          // Processamento da foto de perfil
          let fotoPerfilProcessada = `${environment.mediaUrl}/default-avatar.png`;
          if (usuario.fotoUrl && typeof usuario.fotoUrl === 'string' && usuario.fotoUrl !== 'string') {
            const nomeArquivo = usuario.fotoUrl.replace('/images/', '').split('/').pop();
            if (nomeArquivo) {
              fotoPerfilProcessada = `${environment.mediaUrl}/${nomeArquivo}`;
              console.log('Foto perfil processada:', fotoPerfilProcessada);
            }
          } else {
            console.log('Usando foto padrão:', fotoPerfilProcessada);
          }
          
          // Processamento da foto de início
          let fotoInicioProcessada = ponto.fotoInicioExpediente ? 
            `${environment.mediaUrl}/${ponto.fotoInicioExpediente.replace('/images/', '').split('/').pop()}` : 
            null;
          
          // Processamento da foto de fim
          let fotoFimProcessada = ponto.fotoFimExpediente ? 
            `${environment.mediaUrl}/${ponto.fotoFimExpediente.replace('/images/', '').split('/').pop()}` : 
            null;
      
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
}
