import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxMaskDirective } from 'ngx-mask';
import { VibeService } from '../../../services/vibe.service';
import { AuthService } from '../../../services/auth.service';

interface Empresa {
  empresaId: string; // Alterado de 'id: number' para 'empresaId: string' para corresponder ao backend
  nome: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  uf: string;
  estado: string;
  endereco: string;
  ativo: boolean; // Adicionado para corresponder ao EmpresaResponseDto
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
  empresaEditandoId: string | null = null; // Alterado de 'number | null' para 'string | null'
  mensagem = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;
  pages: number[] = [];
  paginatedClientes: Empresa[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private vibeService: VibeService,
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
        return;
      }

      this.formulario.patchValue({
        logradouro: data.logradouro,
        bairro: data.bairro,
        uf: data.uf,
        estado: this.getEstadoPorUF(data.uf)
      });
    } catch (error) {
      this.mensagem = 'Erro ao buscar CEP';
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
    console.log('Editando:', this.editando, 'Empresa ID:', this.empresaEditandoId); // Log para depuração
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

    this.vibeService.cadastrarEmpresa(empresaData).subscribe({
      next: (response) => {
        const novaEmpresa: Empresa = {
          empresaId: response.empresaId, // Alterado de 'id' para 'empresaId'
          ativo: response.ativo || true, // Adicionado para corresponder ao EmpresaResponseDto
          ...formData,
          endereco: `${formData.logradouro}, ${formData.numero}${formData.complemento ? ` - ${formData.complemento}` : ''}, ${formData.bairro}, ${formData.estado} - ${formData.uf}`
        };
        this.empresas.push(novaEmpresa);
        this.resetForm();
        this.updatePagination();
        this.mensagem = 'Empresa cadastrada com sucesso!';
      },
      error: (error) => {
        this.mensagem = 'Erro ao cadastrar empresa: ' + error.message;
      }
    });
  }

  atualizarEmpresa(formData: any, endereco: string) {
    if (!this.empresaEditandoId) {
      console.error('Erro: empresaEditandoId é undefined. Não é possível atualizar.');
      this.mensagem = 'Erro: Não foi possível identificar a empresa para atualização.';
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

    console.log('Enviando requisição de atualização para ID:', this.empresaEditandoId); // Log the ID being sent
    this.vibeService.atualizarEmpresa(this.empresaEditandoId, empresaData).subscribe({ // Alterado para aceitar string diretamente
      next: (response) => {
        console.log('Resposta da atualização:', response);
        const index = this.empresas.findIndex(e => e.empresaId === this.empresaEditandoId);
        if (index !== -1) {
          this.empresas[index] = {
            ...formData,
            empresaId: this.empresaEditandoId!, // Alterado de 'id' para 'empresaId'
            ativo: response.ativo || true, // Mantém o estado ativo, se retornado
            endereco
          };
          this.updatePagination();
          this.mensagem = 'Empresa atualizada com sucesso!';
          this.resetForm();
        }
      },
      error: (error) => {
        this.mensagem = 'Erro ao atualizar empresa: ' + error.message;
      }
    });
  }

  editarEmpresa(empresa: Empresa) {
    if (!empresa || !empresa.empresaId) { // Alterado de 'id' para 'empresaId'
      console.error('Erro: Empresa ou ID da empresa indefinido');
      this.mensagem = 'Erro: Não foi possível identificar a empresa';
      return;
    }

    this.editando = true;
    this.empresaEditandoId = empresa.empresaId; // Alterado de 'id' para 'empresaId'
    
    console.log('Buscando empresa com ID:', this.empresaEditandoId);
    
    // Preencher o formulário com os dados existentes primeiro (dos dados locais)
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

    // Buscar dados atualizados da API usando empresaId
    this.vibeService.buscarEmpresasPorId(this.empresaEditandoId).subscribe({
      next: (response) => {
        if (!response) {
          this.mensagem = 'Erro: Empresa não encontrada';
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
      error: (error) => {
        console.error('Erro ao buscar empresa:', error);
        this.mensagem = 'Erro ao carregar dados da empresa: ' + error.message;
      }
    });

    // Rolagem para o topo após clicar em "Editar"
    this.rolarParaTopo();
  }

  excluirEmpresa(empresaId: string) {
    if (confirm('Tem certeza que deseja excluir esta empresa?')) {
      this.vibeService.deletarEmpresa(empresaId).subscribe({
        next: () => {
          // Success case - don't try to use the response
          this.empresas = this.empresas.filter(e => e.empresaId !== empresaId);
          this.updatePagination();
          this.mensagem = 'Empresa excluída com sucesso!';
        },
        error: (error) => {
          // Only show error if it's not a parsing error with status 200
          if (error.status !== 200) {
            console.error('Erro ao excluir empresa:', error);
            this.mensagem = 'Erro ao excluir empresa: ' + error;
          } else {
            // If status is 200, consider it a success even with parsing error
            this.empresas = this.empresas.filter(e => e.empresaId !== empresaId);
            this.updatePagination();
            this.mensagem = 'Empresa excluída com sucesso!';
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
    this.vibeService.buscarEmpresas().subscribe({
      next: (response) => {
        console.log('Response from buscarEmpresas:', response);
        this.empresas = response.map((empresa: any) => ({
          empresaId: empresa.empresaId, // Alterado de 'id' para 'empresaId'
          ativo: empresa.ativo || true, // Adicionado para corresponder ao EmpresaResponseDto
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
      error: (error) => {
        this.mensagem = 'Erro ao carregar empresas: ' + error.message;
      }
    });
  }
}