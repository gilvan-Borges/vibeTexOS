import { Injectable } from '@angular/core';
import { WebcamImage } from 'ngx-webcam';

@Injectable({
  providedIn: 'root'
})
export class ServicoFoto {
  
  adicionarDataHoraImagem(base64Image: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = 'data:image/jpeg;base64,' + base64Image;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('Contexto 2D não disponível');
          resolve(base64Image);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.font = '28px Arial';

        const data = new Date().toLocaleDateString('pt-BR');
        const hora = new Date().toLocaleTimeString('pt-BR');
        const texto = `${data} ${hora}`;

        const padding = 30;
        const x = canvas.width - ctx.measureText(texto).width - padding;
        const y = padding + 10;

        ctx.strokeText(texto, x, y);
        ctx.fillText(texto, x, y);

        const novaImagemBase64 = canvas.toDataURL('image/jpeg', 0.9)
          .split(',')[1];

        resolve(novaImagemBase64);
      };

      img.onerror = () => {
        console.error('Erro ao carregar imagem');
        resolve(base64Image);
      };
    });
  }

  converterParaBlob(dataURI: string, fileName: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
  }

  formatarFotoBase64(base64Image: string): string {
    const prefix = "data:image/jpeg;base64,";
    return base64Image.startsWith(prefix) ? base64Image : `${prefix}${base64Image}`;
  }

  prepararFotoParaEnvio(webcamImage: WebcamImage | null): Promise<{ fotoFormatada: string, fotoArquivo: Blob } | null> {
    return new Promise(async (resolve) => {
      if (!webcamImage?.imageAsBase64) {
        resolve(null);
        return;
      }

      const base64Image = webcamImage.imageAsBase64.trim();
      const fotoFormatada = this.formatarFotoBase64(base64Image);
      const fotoArquivo = this.converterParaBlob(fotoFormatada, 'foto.jpg');

      const imagemComData = await this.adicionarDataHoraImagem(base64Image);
      const fotoFormatadaComData = this.formatarFotoBase64(imagemComData);

      resolve({
        fotoFormatada: fotoFormatadaComData,
        fotoArquivo: this.converterParaBlob(fotoFormatadaComData, 'foto.jpg')
      });
    });
  }
} 