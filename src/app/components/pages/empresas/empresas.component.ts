import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxMaskDirective } from 'ngx-mask';
import { VibeService } from '../../../services/vibe.service';
import { AuthService } from '../../../services/auth.service';
import { ControllAppService } from '../../../services/controllApp.service';

interface Empresa {
  empresaId: string;
  nome: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  uf: string;
  estado: string;
  endereco: string;
  ativo: boolean;
}

interface EnderecoDto {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  uf: string;
  localidade: string;
}

@Component({
  selector: 'app-empresas',
  templateUrl: './empresas.component.html',
  styleUrls: ['./empresas.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxMaskDirective]
})
export class EmpresasComponent implements OnInit {
  formulario: FormGroup;
  empresas: Empresa[] = [];
  editando = false;
  empresaEditandoId: string | null = null;
  mensagem = '';
  isError = false; // Nova variável para controlar o tipo de alerta

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;
  pages: number[] = [];
  paginatedClientes: Empresa[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private controllAppService: ControllAppService,
  
    private authService: AuthService
  ) {
    this.formulario = this.formBuilder.group({
      nome: ['', [Validators.required]],
      cep: ['', [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]],
      logradouro: ['', [Validators.required]],
      numero: ['', [Validators.required]],
      complemento: [''],
      bairro: ['', [Validators.required]],
      uf: ['', [Validators.required]],
      estado: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.loadEmpresas();
  }

  get f() {
    return this.formulario.controls;
  }

  async buscarCep() {
    const cep = this.f['cep'].value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        this.f['cep'].setErrors({ invalidCep: true });
        this.mensagem = 'CEP não encontrado. Verifique o CEP informado.';
        this.isError = true;
        return;
      }

      this.formulario.patchValue({
        logradouro: data.logradouro,
        bairro: data.bairro,
        uf: data.uf,
        estado: this.getEstadoPorUF(data.uf)
      });
      this.mensagem = 'CEP encontrado com sucesso!';
      this.isError = false;
    } catch (error: any) {
      this.mensagem = 'Erro ao buscar o CEP. Verifique sua conexão ou tente novamente mais tarde.';
      this.isError = true;
    }
  }

  getEstadoPorUF(uf: string): string {
    const estados: { [key: string]: string } = {
      AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
      CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
      MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
      PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
      RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
      RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
      SE: 'Sergipe', TO: 'Tocantins'
    };
    return estados[uf] || '';
  }

  onSubmit() {
    console.log('Editando:', this.editando, 'Empresa ID:', this.empresaEditandoId);
    if (this.formulario.valid) {
      const formData = this.formulario.value;
      const endereco = `${formData.logradouro}, ${formData.numero}${formData.complemento ? ` - ${formData.complemento}` : ''}, ${formData.bairro}, ${formData.estado} - ${formData.uf}`;

      if (this.editando && this.empresaEditandoId !== null) {
        console.log('Chamando atualizarEmpresa');
        this.atualizarEmpresa(formData, endereco);
      } else {
        console.log('Chamando cadastrarEmpresa');
        this.cadastrarEmpresa(formData);
      }
    } else {
      this.mensagem = 'Por favor, preencha todos os campos corretamente.';
      this.isError = true;
    }
  }

  cadastrarEmpresa(formData: any) {
    const empresaData = {
      nomeDaEmpresa: formData.nome,
      endereco: {
        cep: formData.cep,
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento || '',
        bairro: formData.bairro,
        localidade: formData.estado,
        uf: formData.uf
      }
    };

    this.controllAppService.cadastrarEmpresa(empresaData).subscribe({
      next: (response) => {
        const novaEmpresa: Empresa = {
          empresaId: response.empresaId,
          ativo: response.ativo || true,
          ...formData,
          endereco: `${formData.logradouro}, ${formData.numero}${formData.complemento ? ` - ${formData.complemento}` : ''}, ${formData.bairro}, ${formData.estado} - ${formData.uf}`
        };
        this.empresas.push(novaEmpresa);
        this.resetForm();
        this.updatePagination();
        this.mensagem = 'Empresa cadastrada com sucesso!';
        this.isError = false;
      },
      error: (error: any) => {
        this.mensagem = 'Erro ao cadastrar empresa. ' + (error.message || 'Tente novamente mais tarde.');
        this.isError = true;
      }
    });
  }

  atualizarEmpresa(formData: any, endereco: string) {
    if (!this.empresaEditandoId) {
      console.error('Erro: empresaEditandoId é undefined. Não é possível atualizar.');
      this.mensagem = 'Erro: Não foi possível identificar a empresa para atualização.';
      this.isError = true;
      return;
    }

    const empresaData = {
      nomeDaEmpresa: formData.nome,
      endereco: {
        cep: formData.cep,
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento || '',
        bairro: formData.bairro,
        localidade: formData.estado,
        uf: formData.uf
      }
    };

    console.log('Enviando requisição de atualização para ID:', this.empresaEditandoId);
    this.controllAppService.atualizarEmpresa(this.empresaEditandoId, empresaData).subscribe({
      next: (response) => {
        console.log('Resposta da atualização:', response);
        const index = this.empresas.findIndex(e => e.empresaId === this.empresaEditandoId);
        if (index !== -1) {
          this.empresas[index] = {
            ...formData,
            empresaId: this.empresaEditandoId!,
            ativo: response.ativo || true,
            endereco
          };
          this.updatePagination();
          this.mensagem = 'Empresa atualizada com sucesso!';
          this.isError = false;
          this.resetForm();
        }
      },
      error: (error: any) => {
        this.mensagem = 'Erro ao atualizar empresa. ' + (error.message || 'Tente novamente mais tarde.');
        this.isError = true;
      }
    });
  }

  editarEmpresa(empresa: Empresa) {
    if (!empresa || !empresa.empresaId) {
      console.error('Erro: Empresa ou ID da empresa indefinido');
      this.mensagem = 'Erro: Não foi possível identificar a empresa';
      this.isError = true;
      return;
    }

    this.editando = true;
    this.empresaEditandoId = empresa.empresaId;
    
    console.log('Buscando empresa com ID:', this.empresaEditandoId);
    
    this.formulario.patchValue({
      nome: empresa.nome,
      cep: empresa.cep,
      logradouro: empresa.logradouro,
      numero: empresa.numero,
      complemento: empresa.complemento || '',
      bairro: empresa.bairro,
      uf: empresa.uf,
      estado: empresa.estado
    });

    this.controllAppService.buscarEmpresasPorId(this.empresaEditandoId).subscribe({
      next: (response) => {
        if (!response) {
          this.mensagem = 'Erro: Empresa não encontrada';
          this.isError = true;
          return;
        }
        
        console.log('Dados recebidos da empresa:', response);
        
        this.formulario.patchValue({
          nome: response.nomeDaEmpresa || '',
          cep: response.endereco?.cep || '',
          logradouro: response.endereco?.logradouro || '',
          numero: response.endereco?.numero || '',
          complemento: response.endereco?.complemento || '',
          bairro: response.endereco?.bairro || '',
          uf: response.endereco?.uf || '',
          estado: response.endereco?.localidade || ''
        });

        console.log('Formulário atualizado:', this.formulario.value);
      },
      error: (error: any) => {
        console.error('Erro ao buscar empresa:', error);
        this.mensagem = 'Erro ao carregar dados da empresa. ' + (error.message || 'Tente novamente mais tarde.');
        this.isError = true;
      }
    });

    this.rolarParaTopo();
  }

  excluirEmpresa(empresaId: string) {
    if (confirm('Tem certeza que deseja excluir esta empresa?')) {
      this.controllAppService.deletarEmpresa(empresaId).subscribe({
        next: () => {
          this.empresas = this.empresas.filter(e => e.empresaId !== empresaId);
          this.updatePagination();
          this.mensagem = 'Empresa excluída com sucesso!';
          this.isError = false;
        },
        error: (error: any) => {
          if (error.status !== 200) {
            console.error('Erro ao excluir empresa:', error);
            this.mensagem = 'Erro ao excluir empresa. ' + (error.message || 'Tente novamente mais tarde.');
            this.isError = true;
          } else {
            this.empresas = this.empresas.filter(e => e.empresaId !== empresaId);
            this.updatePagination();
            this.mensagem = 'Empresa excluída com sucesso!';
            this.isError = false;
          }
        }
      });
    }
  }

  resetForm() {
    this.formulario.reset();
    this.editando = false;
    this.empresaEditandoId = null;
    this.mensagem = '';
    this.isError = false;
  }

  // Pagination methods
  updatePagination() {
    this.totalPages = Math.ceil(this.empresas.length / this.itemsPerPage);
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.updatePaginatedEmpresas();
  }

  updatePaginatedEmpresas() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedClientes = this.empresas.slice(startIndex, endIndex);
  }

  onItemsPerPageChange() {
    this.currentPage = 1;
    this.updatePagination();
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedEmpresas();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedEmpresas();
    }
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.updatePaginatedEmpresas();
  }

  rolarParaTopo() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadEmpresas() {
    this.controllAppService.buscarEmpresas().subscribe({
      next: (response) => {
        console.log('Response from buscarEmpresas:', response);
        this.empresas = response.map((empresa: any) => ({
          empresaId: empresa.empresaId,
          ativo: empresa.ativo || true,
          nome: empresa.nomeDaEmpresa || '',
          cep: empresa.endereco?.cep || '',
          logradouro: empresa.endereco?.logradouro || '',
          numero: empresa.endereco?.numero || '',
          complemento: empresa.endereco?.complemento || '',
          bairro: empresa.endereco?.bairro || '',
          uf: empresa.endereco?.uf || '',
          estado: empresa.endereco?.localidade || '',
          endereco: `${empresa.endereco?.logradouro || ''}, ${empresa.endereco?.numero || ''}${empresa.endereco?.complemento ? ` - ${empresa.endereco.complemento}` : ''}, ${empresa.endereco?.bairro || ''}, ${empresa.endereco?.localidade || ''} - ${empresa.endereco?.uf || ''}`
        }));
        this.updatePagination();
      },
      error: (error: any) => {
        this.mensagem = 'Erro ao carregar a lista de empresas. ' + (error.message || 'Verifique sua conexão e tente novamente.');
        this.isError = true;
      }
    });
  }
}