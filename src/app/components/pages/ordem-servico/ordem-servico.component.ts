import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ControllAppService } from '../../../services/controllApp.service';
import { RegistroExpedienteService } from '../../../services/registro-expediente.service';

interface OrdemServico {
  codigo: string;
  data: string;
  cliente: string;
  endereco: string;
  tipo: string;
  status: string;
}

@Component({
  selector: 'app-ordem-servico',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ordem-servico.component.html',
  styleUrls: ['./ordem-servico.component.css']
})
export class OrdemServicoComponent implements OnInit {
  ordensFiltradas: OrdemServico[] = [];
  // Aqui o status será definido como "Pendente" ou "Concluída"
  status: string = 'Pendente';
  pausaAtiva: boolean = false;
  usuarioId: string | null = null;

  // Mock data para ordens de serviço
  private mockOrdens: OrdemServico[] = [
    // Ordens pendentes
    {
      codigo: 'OS-2024-001',
      data: new Date().toISOString(),
      cliente: 'João Silva',
      endereco: 'Rua das Flores, 123 - Jardim Primavera',
      tipo: 'Instalação',
      status: 'Pendente'
    },
    {
      codigo: 'OS-2024-002',
      data: new Date().toISOString(),
      cliente: 'Maria Santos',
      endereco: 'Av. Principal, 456 - Centro',
      tipo: 'Manutenção',
      status: 'Pendente'
    },
    {
      codigo: 'OS-2024-003',
      data: new Date().toISOString(),
      cliente: 'Carlos Oliveira',
      endereco: 'Rua dos Ipês, 789 - Vila Nova',
      tipo: 'Reparo',
      status: 'Pendente'
    },
    // Ordens concluídas
    {
      codigo: 'OS-2024-004',
      data: new Date(Date.now() - 86400000).toISOString(), // Ontem
      cliente: 'Ana Costa',
      endereco: 'Rua das Palmeiras, 321 - Jardim Europa',
      tipo: 'Instalação',
      status: 'Concluída'
    },
    {
      codigo: 'OS-2024-005',
      data: new Date(Date.now() - 172800000).toISOString(), // 2 dias atrás
      cliente: 'Pedro Lima',
      endereco: 'Av. Brasil, 654 - Centro',
      tipo: 'Manutenção',
      status: 'Concluída'
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private controllAppService: ControllAppService,
    private registroExpediente: RegistroExpedienteService
  ) {
    this.registroExpediente.tempoRestantePausa$.subscribe(minutos => {
      this.pausaAtiva = minutos > 0;
    });
  }

  ngOnInit() {
    // Obtém o status a partir da URL
    // Exemplo de rota: /pages/ordem-servico/pendentes/123 ou /pages/ordem-servico/realizadas/123
    this.route.url.subscribe(urlSegments => {
      // O primeiro segmento indica se são pendentes ou realizadas
      const segment = urlSegments[0]?.path;
      if (segment === 'pendentes') {
        this.status = 'Pendente';
      } else if (segment === 'realizadas') {
        this.status = 'Concluída';
      } else {
        // Valor padrão, se necessário
        this.status = 'Pendente';
      }
      console.log('Segmento de URL:', segment);
      console.log('Status definido:', this.status);
      this.carregarOrdens();
    });

    // Obtém o usuário a partir dos parâmetros da rota
    this.route.params.subscribe(params => {
      this.usuarioId = params['usuarioId'];
      if (this.usuarioId) {
        console.log('ID do usuário encontrado na rota:', this.usuarioId);
        this.carregarOrdens();
      } else {
        console.error('ID do usuário não encontrado na rota');
      }
    });

    // Atualiza as ordens a cada 30 segundos
    setInterval(() => {
      this.carregarOrdens();
    }, 30000);
  }

  carregarOrdens() {
    if (!this.usuarioId) {
      console.error('ID do usuário não encontrado');
      return;
    }

    console.log('Carregando ordens para status:', this.status);

    // Filtra as ordens de serviço baseadas no status definido
    this.ordensFiltradas = this.mockOrdens.filter(ordem => ordem.status === this.status);

    console.log(`Encontradas ${this.ordensFiltradas.length} ordens para status ${this.status}:`, this.ordensFiltradas);
  }

  iniciarOrdemServico(codigo: string) {
    if (this.pausaAtiva) {
      return;
    }

    localStorage.setItem('osEmAndamento', 'true');
    localStorage.setItem('osIniciada', 'false');

    // Navega para a execução da ordem, passando o usuário e o código como query param
    this.router.navigate(['/pages/ordem-servico-exec', this.usuarioId], {
      queryParams: { codigo: codigo }
    });
  }

  verificarOrdemEmAndamento(): boolean {
    return localStorage.getItem('osEmAndamento') === 'true';
  }

  formatarData(data: string): string {
    try {
      return new Date(data).toLocaleDateString('pt-BR');
    } catch (erro) {
      console.error('Erro ao formatar data:', erro);
      return 'Data inválida';
    }
  }

  formatarHora(data: string): string {
    try {
      return new Date(data).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (erro) {
      console.error('Erro ao formatar hora:', erro);
      return 'Hora inválida';
    }
  }

  abrirRota(endereco: string) {
    const enderecoFormatado = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${enderecoFormatado}`, '_blank');
  }
}
