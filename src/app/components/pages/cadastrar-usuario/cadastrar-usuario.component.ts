import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { NgxMaskDirective, provideNgxMask } from "ngx-mask";
import { ControllAppService } from "../../../services/controllApp.service";
import { environment } from "../../../../environments/environment.development";
import { Observable } from "rxjs";
import { VibeService } from "../../../services/vibe.service";

@Component({
  selector: 'app-cadastrar-usuario',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgxMaskDirective
  ],
  providers: [provideNgxMask()],
  templateUrl: './cadastrar-usuario.component.html',
  styleUrls: ['./cadastrar-usuario.component.css']
})
export class CadastrarUsuarioComponent implements OnInit {
  mensagem = '';
  fotoUrl: File | null = null;
  fotoPreview: string | ArrayBuffer | null = null;
  tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg'];
  empresas: any[] = [];

  constructor(
    private controllAppService: ControllAppService,
    private vibeService : VibeService
  ) { }

  formulario = new FormGroup({
    nome: new FormControl('', [Validators.required, Validators.minLength(8)]),
    userName: new FormControl('', [Validators.required, Validators.minLength(5)]),
    cpf: new FormControl('', [Validators.required, Validators.pattern(/^\d{11}$/)]),
    matricula: new FormControl('', [Validators.required]),
    empresa: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    senha: new FormControl('', [Validators.required, Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$%^&+=!])(?=\S+$).{8,}$/)]),
    senhaConfirmacao: new FormControl('', [Validators.required]),
    fotoUrl: new FormControl(''),
    role: new FormControl('', [Validators.required]),
    horaInicio: new FormControl('', [Validators.required]),
    horaAlmocoInicio: new FormControl('', [Validators.required]),
    horaAlmocoFim: new FormControl('', [Validators.required]),
    horaFim: new FormControl('', [Validators.required])
  }, { validators: this.senhaConfirmacaoValidator });

  ngOnInit(): void {
    this.buscarEmpresas().subscribe({
      next: (response) => {
        this.empresas = response;
        console.log('✅ Empresas carregadas:', this.empresas);
      },
      error: (err) => {
        console.error('❌ Erro ao carregar empresas:', err);
        this.mensagem = 'Erro ao carregar lista de empresas.';
      }
    });
  }

  buscarEmpresas(): Observable<any> {
    return this.vibeService.buscarEmpresas();
  }

  senhaConfirmacaoValidator(abstractControl: AbstractControl) {
    const senha = abstractControl.get('senha')?.value;
    const senhaConfirmacao = abstractControl.get('senhaConfirmacao')?.value;

    return senhaConfirmacao && senhaConfirmacao !== senha ? { matchPassword: true } : null;
  }

  get f() {
    return this.formulario.controls;
  }

  private dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
  }

  private processarImagem(file: File): Promise<{ blob: Blob; base64: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const blob = this.dataURItoBlob(base64);
        resolve({ blob, base64 });
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Validação do tipo de arquivo
    if (!this.tiposPermitidos.includes(file.type)) {
      this.mensagem = 'Tipo de arquivo não permitido. Use apenas JPG, JPEG ou PNG.';
      return;
    }

    // Validação do tamanho (2MB)
    if (file.size > 2000000) {
      this.mensagem = "O arquivo é muito grande. Escolha uma imagem menor que 2MB.";
      return;
    }

    // Obtém a extensão do arquivo
    const extensao = file.name.split('.').pop()?.toLowerCase();
    if (!extensao || !['jpg', 'jpeg', 'png'].includes(extensao)) {
      this.mensagem = 'Formato de arquivo inválido. Use apenas JPG, JPEG ou PNG.';
      return;
    }

    this.fotoUrl = file;
    this.processarImagem(file)
      .then(({ blob, base64 }) => {
        this.fotoPreview = base64;
        // Criando um novo Blob com o tipo MIME correto
        this.fotoUrl = new File([blob], `foto.${extensao}`, { type: file.type }) as any;
        console.log('✅ Preview da foto carregado com sucesso');
      })
      .catch((error) => {
        console.error('❌ Erro ao processar a imagem:', error);
        this.mensagem = 'Erro ao processar a imagem. Tente novamente.';
      });
  }

  onSubmit() {
    if (this.formulario.invalid) {
      this.mensagem = 'Por favor, preencha todos os campos corretamente.';
      return;
    }

    if (!this.fotoUrl) {
      this.mensagem = 'Por favor, selecione uma foto de perfil.';
      return;
    }

    console.log("📌 Tentando cadastrar usuário...");

    const formData = new FormData();
    Object.keys(this.formulario.controls)
      .filter(key => key !== 'empresa' && key !== 'matricula')
      .forEach(key => {
        const value = this.formulario.get(key)?.value;
        if (value) formData.append(key, value);
      });

    formData.append('IsOnline', 'false');

    const extensao = this.fotoUrl?.name.split('.').pop();
    if (!extensao || !['jpg', 'jpeg', 'png'].includes(extensao.toLowerCase())) {
      this.mensagem = 'Erro: Arquivo inválido ou sem extensão.';
      return;
    }

    this.processarImagem(this.fotoUrl).then(({ blob, base64 }) => {
      const nomeArquivo = `foto.${extensao.toLowerCase()}`;
      
      formData.append('FotoFile', blob, nomeArquivo);
      formData.append('FotoUrl', `/images/${nomeArquivo}`);

      // Primeiro: Cadastrar na ControllApp
      this.controllAppService.register(formData).subscribe({
        next: (response) => {
          console.log('✅ Usuário cadastrado com sucesso na ControllApp:', response);
          
          const empresaId = this.formulario.get('empresa')?.value;
          const matricula = this.formulario.get('matricula')?.value;
          const usuarioId = response.usuarioId;

          // Salvar usuarioId no localStorage
          localStorage.setItem('tempUsuarioId', usuarioId);

          if (!empresaId || !matricula || !usuarioId) {
            console.error('❌ Dados inválidos:', { empresaId, matricula, usuarioId });
            this.mensagem = 'Erro: Dados técnicos inválidos.';
            return;
          }

          const empresaSelecionada = this.empresas.find(emp => emp.empresaId === empresaId);
          if (!empresaSelecionada) {
            console.error('❌ Empresa não encontrada');
            this.mensagem = 'Erro: Empresa selecionada não encontrada';
            return;
          }

          const dadosTecnicos = {
            NumeroMatricula: matricula,
            Empresa: empresaSelecionada.nomeDaEmpresa,
          };

          console.log('⏳ Aguardando para atualizar dados técnicos...');

          // Adicionar delay de 2 segundos antes de fazer o PUT
          setTimeout(() => {
            console.log('📤 Atualizando dados técnicos:', dadosTecnicos);
            
            this.vibeService.atualizarUsuarioTecnico(
              empresaId,
              usuarioId,
              dadosTecnicos
            ).subscribe({
              next: (tecResponse) => {
                console.log('✅ Informações técnicas atualizadas:', tecResponse);
                this.mensagem = `Usuário ${this.formulario.get('nome')?.value} cadastrado com sucesso!`;
                // Limpar usuarioId do localStorage após sucesso
                localStorage.removeItem('tempUsuarioId');
                this.formulario.reset();
                this.fotoPreview = null;
                this.fotoUrl = null;
                setTimeout(() => this.mensagem = '', 5000);
              },
              error: (err) => {
                console.error('❌ Erro ao atualizar informações técnicas:', err);
                this.mensagem = `Erro ao vincular empresa/matrícula: ${err.error || err.message || 'Erro desconhecido'}`;
              }
            });
          }, 2000); // Delay de 2 segundos
        },
        error: (err) => {
          console.error('❌ Erro ao cadastrar usuário:', err);
          this.mensagem = `Erro ao cadastrar usuário: ${err.error?.message || 'Ocorreu um erro inesperado.'}`;
        }
      });
    });
  }

  getImageUrl(relativePath: string): string {
    return `${environment.controllApp}${relativePath}`;
  }
}