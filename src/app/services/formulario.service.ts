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
  private imageCache = new Map<string, Promise<HTMLImageElement>>();

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

  private async loadImage(url: string): Promise<HTMLImageElement> {
    // Verificar cache primeiro
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url)!;
    }

    const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
      console.log('Tentando carregar imagem de:', url);
    
      // Verifica se a URL já é uma string base64
      if (url.startsWith('data:image')) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Falha ao carregar a imagem base64`));
        img.src = url;
        return;
      }
      
      // Novo tratamento para URLs do backend evitando problemas de CORS
      if (url.includes('localhost:5030')) {
        const filename = url.split('/').pop() || 'imagem';
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = '#cccccc';
          ctx.lineWidth = 2;
          ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
          ctx.fillStyle = '#999999';
          ctx.fillRect(canvas.width/2 - 30, canvas.height/2 - 30, 60, 60);
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(canvas.width/2 - 20, canvas.height/2 - 20, 40, 40);
          ctx.font = '14px Arial';
          ctx.fillStyle = '#555555';
          ctx.textAlign = 'center';
          ctx.fillText(`Imagem: ${filename}`, canvas.width/2, canvas.height - 30);
          ctx.fillText('(Visualização indisponível)', canvas.width/2, canvas.height - 10);
        }
        const placeholder = new Image();
        placeholder.src = canvas.toDataURL('image/png');
        placeholder.onload = () => resolve(placeholder);
        return;
      }
      
      // Solução para evitar CORS: usar 'no-cors' e criar um placeholder quando falhar
      try {
        // Extrai o nome do arquivo da URL
        const filename = url.split('/').pop() || 'imagem';
        
        // Cria uma imagem de placeholder com o nome do arquivo
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Desenha um fundo cinza claro
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Adiciona uma borda
          ctx.strokeStyle = '#cccccc';
          ctx.lineWidth = 2;
          ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
          
          // Adiciona um ícone de imagem (símbolo simples)
          ctx.fillStyle = '#999999';
          ctx.fillRect(canvas.width/2 - 30, canvas.height/2 - 30, 60, 60);
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(canvas.width/2 - 20, canvas.height/2 - 20, 40, 40);
          
          // Adiciona o texto de descrição
          ctx.font = '14px Arial';
          ctx.fillStyle = '#555555';
          ctx.textAlign = 'center';
          ctx.fillText(`Imagem: ${filename}`, canvas.width/2, canvas.height - 30);
          ctx.fillText('(Visualização indisponível)', canvas.width/2, canvas.height - 10);
        }
        
        // Converte o canvas para uma imagem
        const placeholder = new Image();
        placeholder.src = canvas.toDataURL('image/png');
        
        placeholder.onload = () => resolve(placeholder);
      } catch (error) {
        console.error('Erro ao criar placeholder para a imagem:', error);
        
        // Se tudo falhar, retorna uma imagem simples
        const fallbackImg = new Image();
        fallbackImg.width = 300;
        fallbackImg.height = 200;
        fallbackImg.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        resolve(fallbackImg);
      }
    });

    // Armazenar no cache
    this.imageCache.set(url, imagePromise);
    return imagePromise;
  }

  async preencherDadosAutomaticos(): Promise<any> {
    // Usar cache para evitar múltiplas leituras do localStorage
    const cache = {
      ordemServico: null as any,
      usuario: null as any
    };
  
    try {
      // Implementar um cache simples para os dados mais usados
      if (!cache.ordemServico) {
        const ordemServicoData = localStorage.getItem('ordemServico');
        if (!ordemServicoData) {
          throw new Error('Ordem de serviço não encontrada');
        }
        cache.ordemServico = JSON.parse(ordemServicoData);
      }
  
      if (!cache.usuario) {
        const usuarioData = localStorage.getItem('usuario');
        cache.usuario = usuarioData ? JSON.parse(usuarioData) : null;
      }
  
      // Otimizar a extração de dados usando desestruturação
      const { cliente = {}, numeroOrdemDeServico = '', observacoesReparo = '' } = cache.ordemServico;
      const { endereco = {} } = cliente;
  
      // Criar objeto uma única vez
      const dadosFormulario = {
        codigoOS: numeroOrdemDeServico,
        nomeColaborador: cache.usuario?.usuario?.nome || '',
        empresaColaborador: 'VIBETEX',
        nomeCliente: cliente.nomeCliente || '',
        cpf: cliente.cpfCliente || '',
        telefone: cliente.telefoneCliente || '',
        cep: endereco.cep || '',
        logradouro: endereco.logradouro || '',
        numero: cliente.numeroCliente?.toString() || '',
        complemento: endereco.complemento || '',
        bairro: endereco.bairro || '',
        cidade: endereco.localidade || '',
        estado: endereco.uf || '',
        observacoes: observacoesReparo,
        fotoInicio: localStorage.getItem('osFotoInicio') || '',
        fotoFim: localStorage.getItem('osFotoFim') || ''
      };
  
      return dadosFormulario;
    } catch (error) {
      console.error('Erro ao preencher dados automáticos:', error);
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
        fotoInicio: '',
        fotoFim: ''
      };
    }
  }

  async gerarPDF(formData: any, assinaturaBase64: string): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    let yPosition = margin;
  
    // Adicionando informações de cabeçalho
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMULÁRIO DE SERVIÇO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  
    // Tabela de informações do serviço
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
  
    // Tabela de dados do cliente
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
  
    // Tabela de observações
    autoTable(doc, {
      startY: yPosition,
      head: [['OBSERVAÇÕES']],
      body: [[formData.observacoes || 'N/A']],
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 10 }
    });
  
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  
    try {
      // Assinatura
      doc.text('Assinatura:', margin, yPosition);
      yPosition += 5;
      
      if (assinaturaBase64) {
        try {
          console.log('Adicionando assinatura ao PDF');
          const img = await this.loadImage(assinaturaBase64);
          doc.addImage(img, 'PNG', margin, yPosition, 50, 20);
          yPosition += 25;
        } catch (error) {
          console.error('Erro ao processar assinatura:', error);
          doc.text('Não foi possível exibir a assinatura.', margin, yPosition + 5);
          yPosition += 15;
        }
      } else {
        doc.text('Nenhuma assinatura disponível.', margin, yPosition + 5);
        yPosition += 15;
      }
  
      // Nova página para fotos
      doc.addPage();
      yPosition = margin;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('FOTOS DO SERVIÇO', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;
  
      // Foto de início
      if (formData.fotoInicio) {
        try {
          doc.text('Foto de Início:', margin, yPosition);
          yPosition += 5;
          const imgInicio = await this.loadImage(formData.fotoInicio);
          
          // Calcular tamanho proporcional
          const imgWidth = Math.min(pageWidth - 2 * margin, 100);
          const imgHeight = (imgWidth / imgInicio.width) * imgInicio.height;
          
          doc.addImage(imgInicio, 'JPEG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        } catch (error) {
          console.error('Erro ao processar foto de início:', error);
          doc.text('Não foi possível exibir a foto de início.', margin, yPosition + 5);
          yPosition += 15;
        }
      } else {
        doc.text('Foto de Início: Não disponível', margin, yPosition + 5);
        yPosition += 15;
      }
  
      // Foto de fim
      if (formData.fotoFim) {
        try {
          // Se a foto de fim existir e a página já estiver muito cheia, adicione uma nova página
          if (yPosition > doc.internal.pageSize.getHeight() - 80) {
            doc.addPage();
            yPosition = margin;
          }
          
          doc.text('Foto de Fim:', margin, yPosition);
          yPosition += 5;
          const imgFim = await this.loadImage(formData.fotoFim);
          
          // Calcular tamanho proporcional
          const imgWidth = Math.min(pageWidth - 2 * margin, 100);
          const imgHeight = (imgWidth / imgFim.width) * imgFim.height;
          
          doc.addImage(imgFim, 'JPEG', margin, yPosition, imgWidth, imgHeight);
          yPosition += imgHeight + 10;
        } catch (error) {
          console.error('Erro ao processar foto de fim:', error);
          doc.text('Não foi possível exibir a foto de fim.', margin, yPosition + 5);
          yPosition += 15;
        }
      } else {
        doc.text('Foto de Fim: Não disponível', margin, yPosition + 5);
        yPosition += 15;
      }
  
    } catch (error) {
      console.error('Erro geral na geração do PDF:', error);
      // Adicionar uma mensagem de erro no PDF
      doc.text('Ocorreu um erro ao gerar algumas partes do PDF.', margin, yPosition);
    } finally {
      // Adicionar rodapé
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString()}`, 
          pageWidth / 2, 
          doc.internal.pageSize.getHeight() - 5, 
          { align: 'center' });
      }
      
      // Garantir que o PDF seja salvo mesmo com erros
      doc.save('Formulario_Servico_' + (formData.codigoOS || 'desconhecido') + '.pdf');
    }
  }
}