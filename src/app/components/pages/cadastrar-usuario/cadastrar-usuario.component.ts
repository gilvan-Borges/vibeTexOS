import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { NgxMaskDirective, provideNgxMask } from "ngx-mask";
import { ControllAppService } from "../../../services/controllApp.service";
import { environment } from "../../../../environments/environment.development";
import { Observable } from "rxjs";
import { VibeService } from "../../../services/vibe.service";

// Add this interface at the top of your file, before the @Component decorator
interface Empresa {
  empresaId: string;
  nomeDaEmpresa: string;
}

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
  empresas: Empresa[] = [];
  isSuccess = false; // Flag para controlar mensagens de sucesso/erro

  constructor(
    private controllAppService: ControllAppService,
    private vibeService: VibeService
  ) {}

  formulario = new FormGroup({
    nome: new FormControl('', [Validators.required, Validators.minLength(8)]),
    userName: new FormControl('', [Validators.required, Validators.minLength(5)]),
    cpf: new FormControl('', [Validators.required, Validators.pattern(/^\d{11}$/)]),
    empresa: new FormControl<Empresa | null>(null, [Validators.required]), // Valor inicial como null para objeto
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
    this.carregarEmpresas();
  }

  private carregarEmpresas(): void {
    this.buscarEmpresas().subscribe({
      next: (response) => {
        this.empresas = response;
        console.log('✅ Empresas carregadas:', this.empresas);
      },
      error: (err) => {
        console.error('❌ Erro ao carregar empresas:', err);
        this.mensagem = 'Erro ao carregar lista de empresas.';
        this.isSuccess = false;
      }
    });
  }

  private buscarEmpresas(): Observable<any> {
    return this.controllAppService.buscarEmpresas();
  }

  private senhaConfirmacaoValidator(abstractControl: AbstractControl) {
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

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    if (!this.tiposPermitidos.includes(file.type)) {
      this.mensagem = 'Tipo de arquivo não permitido. Use apenas JPG, JPEG ou PNG.';
      this.isSuccess = false;
      return;
    }

    if (file.size > 2000000) {
      this.mensagem = 'O arquivo é muito grande. Escolha uma imagem menor que 2MB.';
      this.isSuccess = false;
      return;
    }

    const extensao = file.name.split('.').pop()?.toLowerCase();
    if (!extensao || !['jpg', 'jpeg', 'png'].includes(extensao)) {
      this.mensagem = 'Formato de arquivo inválido. Use apenas JPG, JPEG ou PNG.';
      this.isSuccess = false;
      return;
    }

    this.fotoUrl = file;
    this.processarImagem(file)
      .then(({ blob, base64 }) => {
        this.fotoPreview = base64;
        this.fotoUrl = new File([blob], `foto.${extensao}`, { type: file.type }) as any;
        console.log('✅ Preview da foto carregado com sucesso');
        this.mensagem = ''; // Limpa mensagem após sucesso
      })
      .catch((error) => {
        console.error('❌ Erro ao processar a imagem:', error);
        this.mensagem = 'Erro ao processar a imagem. Tente novamente.';
        this.isSuccess = false;
      });
  }

  onSubmit(): void {
    if (this.formulario.invalid) {
      this.mensagem = 'Por favor, preencha todos os campos corretamente.';
      this.isSuccess = false;
      return;
    }
  
    if (!this.fotoUrl && this.formulario.get('role')?.value !== 'Roteirizador') {
      this.mensagem = 'Por favor, selecione uma foto de perfil.';
      this.isSuccess = false;
      return;
    }
  
    console.log('📌 Tentando cadastrar usuário...');
  
    const formData = new FormData();
  
    // Log all form values for debugging
    console.log('Form values:', this.formulario.value);
  
    const empresaValue = this.formulario.get('empresa')?.value as Empresa | null;
    if (!empresaValue) {
      this.mensagem = 'Por favor, selecione uma empresa.';
      this.isSuccess = false;
      return;
    }
  
    // Processamento genérico para todos os campos (exceto senhaConfirmacao)
    Object.keys(this.formulario.controls).forEach((key) => {
      if (key === 'empresa') {
        formData.append('empresaId', empresaValue.empresaId);
        formData.append('empresa', empresaValue.nomeDaEmpresa);
        formData.append('nomeDaEmpresa', empresaValue.nomeDaEmpresa);
        console.log('Empresa values:', {
          id: empresaValue.empresaId,
          nome: empresaValue.nomeDaEmpresa
        });
      } else if (key === 'horaInicio') {
        const value = this.formulario.get(key)?.value;
        if (value) formData.append('horaEntrada', value);
      } else if (key === 'horaFim') {
        const value = this.formulario.get(key)?.value;
        if (value) formData.append('horaSaida', value);
      } else if (key !== 'senhaConfirmacao') {
        const value = this.formulario.get(key)?.value;
        if (value) formData.append(key, value);
      }
    });
  
    formData.append('IsOnline', 'false');
  
    const extensao = this.fotoUrl?.name.split('.').pop()?.toLowerCase();
    if (this.fotoUrl && (!extensao || !['jpg', 'jpeg', 'png'].includes(extensao))) {
      this.mensagem = 'Erro: Arquivo inválido ou sem extensão.';
      this.isSuccess = false;
      return;
    }
  
    const processarImagem = this.fotoUrl
      ? this.processarImagem(this.fotoUrl)
      : Promise.resolve({ blob: null, base64: null });
  
    processarImagem.then(({ blob }) => {
      if (blob) {
        const nomeArquivo = `foto.${extensao}`;
        formData.append('FotoFile', blob, nomeArquivo);
        formData.append('FotoUrl', `/images/${nomeArquivo}`);
      }
  
      // Verifica o valor de 'role' e ajusta o FormData para Roteirizador
      const role = this.formulario.get('role')?.value;
      if (role === 'Roteirizador') {
        // Validação extra para garantir que os campos obrigatórios não estejam vazios
        const nome = this.formulario.get('nome')?.value?.trim();
        const userName = this.formulario.get('userName')?.value?.trim();
        const senha = this.formulario.get('senha')?.value?.trim();
      
        if (!nome || !userName || !senha) {
          this.mensagem = 'Nome, userName e senha são obrigatórios para Roteirizador.';
          this.isSuccess = false;
          return;
        }
      
        // Enviar como JSON
        const data = {
          nome: nome,
          userName: userName,
          senha: senha
        };
      
        console.log('Enviando para Roteirizador (JSON):', data);
      
        // Chama o endpoint específico para Roteirizador com JSON
        this.vibeService.cadastrarRoteirizadorJson(data).subscribe({
          next: (response) => {
            console.log(`✅ Usuário ${role} cadastrado com sucesso:`, response);
            this.mensagem = `Usuário ${this.formulario.get('nome')?.value} cadastrado com sucesso!`;
            this.isSuccess = true;
            localStorage.removeItem('tempUsuarioId');
            this.formulario.reset();
            this.fotoPreview = null;
            this.fotoUrl = null;
            setTimeout(() => this.mensagem = '', 5000);
          },
          error: (err) => {
            console.error(`❌ Erro ao cadastrar ${role}:`, err);
            this.mensagem = `Erro ao cadastrar usuário: ${err.error?.message || 'Ocorreu um erro inesperado.'}`;
            this.isSuccess = false;
          }
        });
      } else {
        // Para outros perfis (ex.: Colaborador), usa o FormData original
        const cadastroObservable = this.controllAppService.register(formData);
        cadastroObservable.subscribe({
          next: (response) => {
            console.log(`✅ Usuário ${role} cadastrado com sucesso:`, response);
            this.mensagem = `Usuário ${this.formulario.get('nome')?.value} cadastrado com sucesso!`;
            this.isSuccess = true;
            localStorage.removeItem('tempUsuarioId');
            this.formulario.reset();
            this.fotoPreview = null;
            this.fotoUrl = null;
            setTimeout(() => this.mensagem = '', 5000);
          },
          error: (err) => {
            console.error(`❌ Erro ao cadastrar ${role}:`, err);
            this.mensagem = `Erro ao cadastrar usuário: ${err.error?.message || 'Ocorreu um erro inesperado.'}`;
            this.isSuccess = false;
          }
        });
      }
    });
  }
  getImageUrl(relativePath: string): string {
    return `${environment.controllApp}${relativePath}`;
  }
}