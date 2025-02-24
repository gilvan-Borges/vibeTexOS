import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { NgxMaskDirective, provideNgxMask } from "ngx-mask";
import { ControllAppService } from "../../../services/controllApp.service";
import { VibeService } from "../../../services/vibe.service";
import { UsuarioResponseDto } from "../../../models/control-app/usuario.response.dto";
import { environment } from "../../../../environments/environment.development";

@Component({
  selector: 'app-editar-colaborador',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgxMaskDirective
  ],
  providers: [provideNgxMask()],
  templateUrl: './editar-colaborador.component.html',
  styleUrl: './editar-colaborador.component.css'
})
export class EditarColaboradorComponent implements OnInit {
  mensagem = ''; // Sucesso (verde)
  mensagemErro = ''; // Erro (vermelho)
  fotoPerfil: File | null = null;
  fotoPreview: string | ArrayBuffer | null = null;
  usuarioId!: string | null;
  tiposPermitidos = ['image/jpeg', 'image/png', 'image/jpg'];
  empresas: any[] = [];

  constructor(
    private controllAppService: ControllAppService,
    private route: ActivatedRoute,
    private router: Router,
    private vibeService: VibeService
  ) { }

  formulario = new FormGroup({
    nome: new FormControl('', [Validators.required, Validators.minLength(8)]),
    userName: new FormControl('', [Validators.required, Validators.minLength(5)]),
    cpf: new FormControl('', [Validators.required, Validators.pattern(/^\d{11}$/)]),
    matricula: new FormControl('', [Validators.required]),
    empresa: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    role: new FormControl('', [Validators.required]),
    senha: new FormControl(''),
    senhaConfirmacao: new FormControl(''),
    horaInicio: new FormControl('', [Validators.required]),
    horaAlmocoInicio: new FormControl('', [Validators.required]),
    horaAlmocoFim: new FormControl('', [Validators.required]),
    horaFim: new FormControl('', [Validators.required])
  }, { validators: this.senhaConfirmacaoValidator });

  ngOnInit(): void {
    console.log("🔍 Parâmetros da rota:", this.route.snapshot.paramMap);
    
    this.usuarioId = this.route.snapshot.paramMap.get('usuarioId');
    console.log("📌 ID do usuário capturado:", this.usuarioId);

    if (!this.usuarioId || this.usuarioId === 'undefined') {
      console.error("❌ Erro: ID do colaborador não encontrado.");
      this.mensagemErro = "Erro: ID do colaborador não encontrado.";
      return;
    }

    console.log("✅ Carregando dados do usuário com ID:", this.usuarioId);
    this.carregarDadosUsuario();
    this.buscarEmpresas();
  }

  buscarEmpresas(): void {
    this.vibeService.buscarEmpresas().subscribe({
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

  senhaConfirmacaoValidator(abstractControl: AbstractControl) {
    const senha = abstractControl.get('senha')?.value;
    const senhaConfirmacao = abstractControl.get('senhaConfirmacao')?.value;
    
    if (!senha && !senhaConfirmacao) return null; // Se ambos estiverem vazios, não valida
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

  carregarDadosUsuario(): void {
    if (!this.usuarioId) return;

    this.controllAppService.usuarioGetById(this.usuarioId).subscribe({
      next: (usuario: UsuarioResponseDto) => {
        if (!usuario) {
          this.mensagemErro = 'Erro: Usuário não encontrado.';
          return;
        }

        this.formulario.patchValue({
          nome: usuario.nome,
          userName: usuario.userName,
          cpf: usuario.cpf,
          email: usuario.email,
          role: usuario.role,
          horaInicio: usuario.horaEntrada,
          horaAlmocoInicio: usuario.horaAlmocoInicio,
          horaAlmocoFim: usuario.horaAlmocoFim,
          horaFim: usuario.horaSaida
        });

        if (usuario.fotoUrl) {
          this.fotoPreview = `${environment.controllApp}${usuario.fotoUrl}`;
        }
      },
      error: (err) => {
        console.error('❌ Erro ao carregar usuário:', err);
        this.mensagemErro = 'Erro ao carregar os dados do usuário. Verifique se o ID é válido.';
      }
    });
  }

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    // Validação do tipo de arquivo
    if (!this.tiposPermitidos.includes(file.type)) {
      this.mensagemErro = 'Tipo de arquivo não permitido. Use apenas JPG, JPEG ou PNG.';
      return;
    }

    // Validação do tamanho (2MB)
    if (file.size > 2000000) {
      this.mensagemErro = "O arquivo é muito grande. Escolha uma imagem menor que 2MB.";
      return;
    }

    // Obtém a extensão do arquivo
    const extensao = file.name.split('.').pop()?.toLowerCase();
    if (!extensao || !['jpg', 'jpeg', 'png'].includes(extensao)) {
      this.mensagemErro = 'Formato de arquivo inválido. Use apenas JPG, JPEG ou PNG.';
      return;
    }

    this.fotoPerfil = file;
    this.processarImagem(file)
      .then(({ blob, base64 }) => {
        this.fotoPreview = base64;
        this.fotoPerfil = new File([blob], `foto.${extensao}`, { type: file.type });
        console.log('✅ Preview da foto carregado com sucesso');
      })
      .catch((error) => {
        console.error('❌ Erro ao processar a imagem:', error);
        this.mensagemErro = 'Erro ao processar a imagem. Tente novamente.';
      });
  }

  onSubmit(): void {
    if (this.formulario.invalid) {
      this.mensagemErro = 'Por favor, preencha todos os campos corretamente.';
      return;
    }

    if (!this.usuarioId) {
      this.mensagemErro = 'Erro: ID do usuário inválido.';
      return;
    }

    const formData = new FormData();
    
    // Adiciona todos os campos do formulário com verificação de valor
    Object.keys(this.formulario.controls).forEach(key => {
      const value = this.formulario.get(key)?.value;
      if (value !== null && value !== undefined && value !== '') {
        // Mapeamento específico para alguns campos
        if (key === 'horaInicio') {
          formData.append('horaEntrada', value);
        } else if (key === 'horaFim') {
          formData.append('horaSaida', value);
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    // Se houver uma nova foto, processa e adiciona ao formData
    if (this.fotoPerfil) {
      const extensao = this.fotoPerfil.name.split('.').pop()?.toLowerCase();
      if (!extensao) {
        this.mensagemErro = 'Erro: Arquivo sem extensão.';
        return;
      }

      this.processarImagem(this.fotoPerfil).then(({ blob, base64 }) => {
        const nomeArquivo = `foto.${extensao}`;
        formData.append('FotoFile', blob, nomeArquivo);
        formData.append('FotoUrl', `/images/${nomeArquivo}`);

        this.enviarAtualizacao(formData);
      }).catch(error => {
        console.error('❌ Erro ao processar imagem:', error);
        this.mensagemErro = 'Erro ao processar a imagem. Tente novamente.';
      });
    } else {
      this.enviarAtualizacao(formData);
    }
  }

  private enviarAtualizacao(formData: FormData): void {
    console.log("📤 Enviando dados para atualização...");
    
    // Adicionando senha apenas se ela existir e não estiver vazia
    const senha = this.formulario.get('senha')?.value;
    if (senha) {
      formData.append('senha', senha);
    }

    // Debug para verificar o conteúdo do FormData
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
    });

    this.controllAppService.atualizarUsuario(this.usuarioId!, formData).subscribe({
      next: (response) => {
        console.log('✅ Usuário atualizado com sucesso:', response);
        this.mensagem = 'Usuário atualizado com sucesso!';
        this.mensagemErro = '';

        setTimeout(() => {
          this.mensagem = '';
          this.router.navigate(['/pages/dashboard']);
        }, 3000);
      },
      error: (err) => {
        console.error('❌ Erro ao atualizar usuário:', err);
        this.mensagemErro = `Erro ao atualizar usuário: ${err.error?.message || 'Verifique os dados e tente novamente.'}`;
      }
    });
  }

  getImageUrl(relativePath: string): string {
    return `${environment.controllApp}${relativePath}`;
  }
}