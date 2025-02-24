import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import SignaturePad from 'signature_pad';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Importe autoTable
import { WebcamModule, WebcamImage, WebcamInitError } from 'ngx-webcam';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-formulario-servico',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NgxMaskDirective,
    WebcamModule
  ],
  providers: [provideNgxMask()],
  templateUrl: './formulario-servico.component.html',
  styleUrls: ['./formulario-servico.component.css']
})
export class FormularioServicoComponent implements OnInit {
  formularioServico: FormGroup;
  private signaturePad: SignaturePad | null = null;

  // Propriedades para o modal e a câmera
  modalVisible = false;
  webcamImage: WebcamImage | null = null;
  errors: WebcamInitError[] = [];
  private trigger = new Subject<void>();

  constructor(private fb: FormBuilder) {
    this.formularioServico = this.fb.group({
      codigoOS: ['', Validators.required],
      nomeColaborador: ['', Validators.required],
      nomeCliente: ['', Validators.required],
      cpf: ['', [Validators.required, Validators.minLength(11), Validators.maxLength(11)]],
      telefone: ['', Validators.required],
      cep: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(8)]],
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

  ngOnInit() {
    setTimeout(() => {
      this.inicializarSignaturePad();
    }, 100);

    const fotoInicio = localStorage.getItem('osFotoInicio');
    const fotoFim = localStorage.getItem('osFotoFim');
    if (fotoInicio) {
      this.formularioServico.patchValue({ fotoInicio });
    }
    if (fotoFim) {
      this.formularioServico.patchValue({ fotoFim });
    }
  }

  get f() {
    return this.formularioServico.controls;
  }

  ngAfterViewInit() {
    this.inicializarSignaturePad();
  }

  private inicializarSignaturePad() {
    const canvas = document.querySelector('canvas.signature-pad') as HTMLCanvasElement;
    if (canvas) {
      this.signaturePad = new SignaturePad(canvas);
    }
  }

  limparAssinatura() {
    if (this.signaturePad) {
      this.signaturePad.clear();
    }
  }

  // Método para gerar e baixar o PDF
  gerarPDF() {
    if (this.formularioServico.valid && this.signaturePad && !this.signaturePad.isEmpty()) {
      const doc = new jsPDF();
      const formData = this.formularioServico.value;
      const assinatura = this.signaturePad.toDataURL();

      // Logotipo como marca d'água (substitua pelo base64 real do seu logotipo)
      const logoBase64 = 'data:image/png;base64,[]'; // Substitua pelo base64 do logotipo "VIBETEX"
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Adicionar marca d'água em cada página
      const addWatermark = () => {
        doc.saveGraphicsState();
        doc.setGState({ opacity: 0.1 }); // Reduz opacidade para 10%
        doc.addImage(logoBase64, 'PNG', pageWidth / 4, pageHeight / 4, pageWidth / 2, pageHeight / 2); // Centraliza a marca d'água
        doc.setGState({ opacity: 1 }); // Restaura opacidade para 100%
        doc.restoreGraphicsState();
      };

      // Adicionar marca d'água na primeira página
      addWatermark();

      // Configurações iniciais
      const margin = 10;
      let yPosition = margin;

      // Cabeçalho
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('FORMULÁRIO DE SERVIÇO', pageWidth / 2, 20, { align: 'center' });
      doc.setLineWidth(0.5);
      doc.line(margin, 22, pageWidth - margin, 22); // Linha abaixo do título
      yPosition = 30;

      // Tabela para Informações Básicas
      doc.setFontSize(12);
      autoTable(doc, {
        startY: yPosition,
        margin: { left: margin, right: margin },
        theme: 'grid', // Tema com linhas e bordas
        head: [['Informações Básicas']],
        body: [
          ['Código O.S.:', formData.codigoOS],
          ['Nome do Colaborador:', formData.nomeColaborador]
        ],
        headStyles: { fillColor: [0, 102, 204], textColor: [255, 255, 255], fontStyle: 'bold' },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 'auto' } }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 5;

      // Tabela para Informações do Cliente
      doc.setFont('helvetica', 'bold');
      doc.text('Informações do Cliente', margin, yPosition);
      doc.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);
      yPosition += 10;

      autoTable(doc, {
        startY: yPosition,
        margin: { left: margin, right: margin },
        theme: 'grid',
        body: [
          ['Nome do Cliente:', formData.nomeCliente],
          ['CPF:', formData.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')],
          ['Telefone:', formData.telefone],
          ['Logradouro:', `${formData.logradouro}, ${formData.numero}`],
          ['Bairro:', formData.bairro],
          ['CEP:', formData.cep.replace(/(\d{5})(\d{3})/, '$1-$2')],
          ['Cidade/Estado:', `${formData.cidade} - ${formData.estado}`],
          ['Complemento:', formData.complemento || 'Sem complemento']
        ],
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 'auto' } }
      });
      yPosition = (doc as any).lastAutoTable.finalY + 5;

      // Observações
      doc.setFont('helvetica', 'bold');
      doc.text('Observações', margin, yPosition);
      doc.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);
      yPosition += 10;

      doc.setFont('helvetica', 'normal');
      const observacoes = doc.splitTextToSize(formData.observacoes || 'Nenhuma observação', pageWidth - 2 * margin);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, observacoes.length * 7 + 5); // Caixa para observações
      doc.text(observacoes, margin + 2, yPosition + 5);
      yPosition += observacoes.length * 7 + 15;

      // Assinatura
      doc.setFont('helvetica', 'bold');
      doc.text('Assinatura do Cliente', margin, yPosition);
      doc.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);
      yPosition += 10;

      doc.rect(margin, yPosition, pageWidth - 2 * margin, 30); // Caixa para assinatura
      doc.addImage(assinatura, 'PNG', margin + 5, yPosition + 5, 60, 20); // Assinatura dentro da caixa
      yPosition += 40;

      // Fotos (em nova página, se existirem)
      if (formData.fotoInicio || formData.fotoFim) {
        doc.addPage();
        // Adicionar marca d'água na nova página
        addWatermark();

        yPosition = margin;

        if (formData.fotoInicio) {
          doc.setFont('helvetica', 'bold');
          doc.text('Foto de Início da O.S', margin, yPosition);
          doc.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);
          yPosition += 10;
          doc.rect(margin, yPosition, 90, 67.5); // Borda para a foto
          doc.addImage(formData.fotoInicio, 'JPEG', margin + 1, yPosition + 1, 88, 65.5); // Foto dentro da borda
          yPosition += 75;
        }

        if (formData.fotoFim) {
          yPosition += 5;
          doc.setFont('helvetica', 'bold');
          doc.text('Foto de Fim da O.S', margin, yPosition);
          doc.line(margin, yPosition + 2, pageWidth - margin, yPosition + 2);
          yPosition += 10;
          doc.rect(margin, yPosition, 90, 67.5); // Borda para a foto
          doc.addImage(formData.fotoFim, 'JPEG', margin + 1, yPosition + 1, 88, 65.5); // Foto dentro da borda
        }
      }

      // Rodapé
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100); // Cinza
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | VIBETEX`, pageWidth - margin, doc.internal.pageSize.getHeight() - margin, { align: 'right' });

      // Salva o PDF
      doc.save(`Formulario_Servico_${formData.codigoOS}.pdf`);
    } else {
      alert('Por favor, preencha todos os campos obrigatórios e forneça uma assinatura antes de gerar o PDF.');
    }
  }

  // Restante do código (métodos como onSubmit, buscarCep, etc.) permanece igual
  get triggerObservable(): Subject<void> {
    return this.trigger;
  }

  triggerCapture(): void {
    this.trigger.next();
  }

  fecharModal(): void {
    this.modalVisible = false;
    this.webcamImage = null;
  }

  onSubmit() {
    if (this.formularioServico.valid && this.signaturePad && !this.signaturePad.isEmpty()) {
      const formData = this.formularioServico.value;
      formData.assinatura = this.signaturePad.toDataURL();
      console.log('Dados do formulário:', formData);
      alert('Formulário enviado com sucesso!');
    } else {
      alert('Por favor, preencha todos os campos obrigatórios e forneça uma assinatura.');
    }
  }

  async buscarCep() {
    const cep = this.formularioServico.get('cep')?.value;
    if (cep && cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          this.formularioServico.patchValue({
            logradouro: data.logradouro,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf
          });
        } else {
          alert('CEP não encontrado');
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        alert('Erro ao buscar CEP');
      }
    }
  }

  formatarTelefone(event: any) {
    let telefone = event.target.value;
    telefone = telefone.replace(/\D/g, '');
    if (telefone.length === 11) {
      telefone = telefone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    }
    event.target.value = telefone;
  }
}