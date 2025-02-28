import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VibeService } from './vibe.service';

@Injectable({
  providedIn: 'root'
})
export class FormularioService {
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private vibeService: VibeService
  ) {}

  criarFormulario(): FormGroup {
    return this.fb.group({
      codigoOS: ['', Validators.required],
      nomeColaborador: ['', Validators.required],
      empresaColaborador: ['', Validators.required],
      nomeCliente: ['', Validators.required],
      cpf: ['', [Validators.required, Validators.minLength(11)]],
      telefone: ['', Validators.required],
      cep: ['', [Validators.required, Validators.minLength(8)]],
      logradouro: ['', Validators.required],
      numero: ['', Validators.required],
      complemento: [''],
      bairro: ['', Validators.required],
      cidade: ['', Validators.required],
      estado: ['', Validators.required],
      observacoes: [''],
      assinatura: [''],
      fotoInicio: [''],
      fotoFim: ['']
    });
  }

  async buscarCep(cep: string): Promise<any> {
    if (cep && cep.length === 8) {
      try {
        const response = await lastValueFrom(
          this.http.get(`https://viacep.com.br/ws/${cep}/json/`)
        );
        return response;
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        throw new Error('Erro ao buscar CEP');
      }
    }
    return null;
  }

  formatarTelefone(telefone: string): string {
    telefone = telefone.replace(/\D/g, '');
    if (telefone.length === 11) {
      return telefone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    }
    return telefone;
  }

  async preencherDadosAutomaticos(): Promise<any> {
    try {
      const usuarioData = localStorage.getItem('usuario');
      let usuarioId: string | null = null;
      if (usuarioData) {
        const parsedUsuario = JSON.parse(usuarioData);
        usuarioId = parsedUsuario?.usuarioId || null;
      }

      const ordemServicoId = localStorage.getItem('ordemServicoId') || '';

      if (!usuarioId || !ordemServicoId) {
        throw new Error('usuarioId ou ordemServicoId não encontrados no localStorage');
      }

      const ordensServico = await lastValueFrom(this.vibeService.buscarOrdemServico());
      console.log('Ordens de serviço retornadas:', ordensServico);

      const ordemServico = ordensServico.find((os: any) => 
        os.usuarioId === usuarioId && os.ordemDeServicoId === ordemServicoId
      );

      if (!ordemServico) {
        console.error('Ordem de serviço não encontrada para:', { usuarioId, ordemServicoId });
        throw new Error('Ordem de serviço não encontrada para o usuarioId e ordemServicoId fornecidos');
      }

      console.log('Ordem de serviço encontrada:', ordemServico);

      let nomeColaborador = '';
      try {
        const usuario = await lastValueFrom(this.vibeService.buscarUsuarioPorId(usuarioId));
        console.log('Dados do usuário (colaborador):', usuario);
        nomeColaborador = usuario?.nome || '';
      } catch (error) {
        console.error('Erro ao buscar dados do colaborador:', error);
        nomeColaborador = '';
      }

      const dadosCliente = ordemServico.cliente || {};

      console.log('Dados do colaborador:', {
        nomeColaborador: nomeColaborador,
        empresaColaborador: 'VIBETEX'
      });
      console.log('Dados do cliente:', dadosCliente);

      return {
        codigoOS: ordemServico.numeroOrdemDeServico || '',
        nomeColaborador: nomeColaborador,
        empresaColaborador: 'VIBETEX',
        nomeCliente: dadosCliente.nomeCliente || '',
        cpf: dadosCliente.cpfCliente || '',
        telefone: dadosCliente.telefoneCliente || '',
        cep: dadosCliente.endereco?.cep || '',
        logradouro: dadosCliente.endereco?.logradouro || '',
        numero: dadosCliente.endereco?.numero || '',
        complemento: dadosCliente.endereco?.complemento || '',
        bairro: dadosCliente.endereco?.bairro || '',
        cidade: dadosCliente.endereco?.localidade || '',
        estado: dadosCliente.endereco?.uf || '',
        fotoInicio: localStorage.getItem('osFotoInicio') || '',
        fotoFim: localStorage.getItem('osFotoFim') || ''
      };
    } catch (error) {
      console.error('Erro ao buscar dados automáticos via API:', error);
      return {
        codigoOS: '',
        nomeColaborador: '',
        empresaColaborador: 'VIBETEX',
        nomeCliente: '',
        cpf: '',
        telefone: '',
        cep: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: '',
        fotoInicio: localStorage.getItem('osFotoInicio') || '',
        fotoFim: localStorage.getItem('osFotoFim') || ''
      };
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar a imagem de ${url}`));
      img.src = url;
    });
  }

  async gerarPDF(formData: any, assinaturaBase64: string): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let yPosition = margin;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMULÁRIO DE SERVIÇO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    autoTable(doc, {
      startY: yPosition,
      head: [['DADOS DO SERVIÇO']],
      body: [
        ['Código O.S.:', formData.codigoOS || 'N/A'],
        ['Colaborador:', formData.nomeColaborador || 'N/A'],
        ['Empresa:', formData.empresaColaborador || 'N/A']
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 10 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: yPosition,
      head: [['DADOS DO CLIENTE']],
      body: [
        ['Nome:', formData.nomeCliente || 'N/A'],
        ['CPF:', formData.cpf || 'N/A'],
        ['Telefone:', formData.telefone || 'N/A'],
        ['Endereço:', `${formData.logradouro || 'N/A'}, ${formData.numero || 'N/A'}`],
        ['Complemento:', formData.complemento || 'N/A'],
        ['Bairro:', formData.bairro || 'N/A'],
        ['Cidade/UF:', `${formData.cidade || 'N/A'}/${formData.estado || 'N/A'}`],
        ['CEP:', formData.cep || 'N/A']
      ],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 10 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: yPosition,
      head: [['OBSERVAÇÕES']],
      body: [[formData.observacoes || 'N/A']],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 10 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    if (assinaturaBase64) {
      doc.text('Assinatura:', margin, yPosition);
      yPosition += 5;
      try {
        console.log('Tentando carregar a imagem da assinatura:', assinaturaBase64);
        const img = await this.loadImage(assinaturaBase64);
        doc.addImage(img, 'PNG', margin, yPosition, 50, 20);
      } catch (error) {
        console.error('Erro ao carregar a imagem da assinatura:', error);
        doc.text('Não foi possível carregar a assinatura.', margin, yPosition + 10);
      }
    } else {
      console.log('Nenhuma assinatura fornecida para o PDF.');
      doc.text('Nenhuma assinatura disponível.', margin, yPosition + 10);
    }

    // Alteração: Substituir template literal por concatenação de strings
    doc.save('Formulario_Servico_' + (formData.codigoOS || 'desconhecido') + '.pdf');
  }
}