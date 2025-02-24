import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxMaskDirective } from 'ngx-mask';

interface Empresa {
  id: number;
  nome: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  uf: string;
  estado: string;
  endereco: string;
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
  empresaEditandoId: number | null = null;
  mensagem = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;
  pages: number[] = [];
  paginatedClientes: Empresa[] = [];

  constructor(private formBuilder: FormBuilder) {
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
    this.updatePagination();
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
    if (this.formulario.valid) {
      const formData = this.formulario.value;
      const endereco = `${formData.logradouro}, ${formData.numero}${formData.complemento ? ` - ${formData.complemento}` : ''}, ${formData.bairro}, ${formData.cidade} - ${formData.uf}`;

      if (this.editando && this.empresaEditandoId) {
        this.atualizarEmpresa(formData, endereco);
      } else {
        this.cadastrarEmpresa(formData, endereco);
      }
    }
  }

  cadastrarEmpresa(formData: any, endereco: string) {
    const novaEmpresa: Empresa = {
      id: this.empresas.length + 1,
      ...formData,
      endereco
    };
    this.empresas.push(novaEmpresa);
    this.resetForm();
    this.updatePagination();
  }

  atualizarEmpresa(formData: any, endereco: string) {
    const index = this.empresas.findIndex(e => e.id === this.empresaEditandoId);
    if (index !== -1) {
      this.empresas[index] = {
        ...formData,
        id: this.empresaEditandoId!,
        endereco
      };
      this.resetForm();
      this.updatePagination();
    }
  }

  editarEmpresa(empresa: Empresa) {
    this.editando = true;
    this.empresaEditandoId = empresa.id;
    this.formulario.patchValue(empresa);
  }

  excluirEmpresa(id: number) {
    if (confirm('Tem certeza que deseja excluir esta empresa?')) {
      this.empresas = this.empresas.filter(e => e.id !== id);
      this.updatePagination();
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
    // Here you would typically load companies from a service or API
    this.empresas = [];
  }
}
