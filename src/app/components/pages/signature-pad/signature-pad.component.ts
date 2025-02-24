import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import SignaturePad from 'signature_pad';

@Component({
  selector: 'app-signature-pad',
  templateUrl: './signature-pad.component.html',
  styleUrls: ['./signature-pad.component.css']
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  signaturePad!: SignaturePad;

  ngAfterViewInit(): void {
    this.signaturePad = new SignaturePad(this.canvasRef.nativeElement, {
      backgroundColor: 'rgb(255, 255, 255)', // Fundo branco
      penColor: 'black' // Cor da assinatura
    });
  }

  limparAssinatura(): void {
    this.signaturePad.clear();
  }

  salvarAssinatura(): void {
    if (!this.signaturePad.isEmpty()) {
      const assinaturaDataURL = this.signaturePad.toDataURL();
      console.log('Assinatura em Base64:', assinaturaDataURL);
      // Aqui você pode enviar a assinatura para um backend ou armazená-la localmente
    } else {
      console.log('A assinatura está vazia!');
    }
  }
}
