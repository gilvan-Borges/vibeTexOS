import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxMaskDirective, NgxMaskPipe } from 'ngx-mask';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { VibeService } from '../../../services/vibe.service';
import { ClienteResponseDto } from '../../../models/vibe-service/clienteResponseDto';
import { CriarClienteRequestDto } from '../../../models/vibe-service/criarClienteRequestDto';

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  uf: string;
  localidade: string;
  erro?: boolean;
}

@Component({
  selector: 'app-cadastrar-cliente',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgxMaskDirective,
    NgxMaskPipe,
    FormsModule
  ],
  templateUrl: './cadastrar-cliente.component.html',
  styleUrls: ['./cadastrar-cliente.component.css']
})
export class CadastrarClienteComponent implements OnInit {
  formulario: FormGroup;
  mensagem: string = '';
  editando: boolean = false;
  clienteEditando: ClienteResponseDto | null = null;
  clientes: ClienteResponseDto[] = [];
  filteredClientes: ClienteResponseDto[] = []; // Lista filtrada de clientes

  // Variáveis de filtro
  filtroNome: string = '';
  filtroCpf: string = '';

  // Paginação
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalItems: number = 0;

  private viaCepUrl = 'https://viacep.com.br/ws/';

  constructor(
    private formBuilder: FormBuilder, 
    private http: HttpClient,
    private vibeService: VibeService
  ) {
    this.formulario = this.formBuilder.group({
      nomeCliente: ['', [Validators.required, Validators.minLength(3)]],
      cpfCliente: ['', [Validators.required]],
      telefoneCliente: ['', [Validators.required]],
      cep: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      logradouro: ['', [Validators.required]],
      complemento: [''],
      bairro: ['', [Validators.required]],
      uf: ['', [Validators.required]],
      estado: ['', [Validators.required]],
      numero: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    this.carregarClientes();
  }

  get f() {
    return this.formulario.controls;
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  carregarClientes() {
    this.vibeService.buscarClientes(this.currentPage, this.itemsPerPage).subscribe({
      next: (response) => {
        this.clientes = response.items || response; // Verifica se sua API retorna em `items` ou direto
        this.filteredClientes = [...this.clientes];
  
        // Verifica se tem campo com total de registros
        this.totalItems = response.totalItems || this.clientes.length;
  
        this.updatePaginatedClientes();
      },
      error: (error) => {
        this.mensagem = 'Erro ao carregar clientes.';
        console.error('Erro:', error);
      }
    });
  }
  

  buscarCep() {
    const cep = this.formulario.get('cep')?.value;
    if (cep && this.formulario.get('cep')?.valid) {
      const cepLimpo = cep.replace('-', '');
      this.http.get<ViaCepResponse>(`${this.viaCepUrl}${cepLimpo}/json/`).subscribe({
        next: (response) => {
          if (!response.erro) {
            const numero = this.formulario.get('numero')?.value || '';
            const endereco = `${response.logradouro || ''}, ${numero ? numero + ', ' : ''}${response.complemento || ''}, ${response.bairro || ''}, ${response.localidade || ''}, ${response.uf || ''}`.trim();
            this.formulario.patchValue({
              logradouro: response.logradouro || '',
              complemento: response.complemento || '',
              bairro: response.bairro || '',
              uf: response.uf || '',
              estado: response.localidade || '',
              endereco: endereco
            });
            this.mensagem = 'Endereço preenchido com sucesso!';
          } else {
            this.mensagem = 'CEP não encontrado. Verifique o CEP informado.';
            this.formulario.patchValue({
              logradouro: '',
              complemento: '',
              bairro: '',
              uf: '',
              estado: '',
              numero: '',
              endereco: ''
            });
            this.formulario.get('cep')?.setErrors({ 'invalidCep': true });
          }
          setTimeout(() => this.mensagem = '', 5000);
        },
        error: (err) => {
          this.mensagem = 'Erro ao consultar o CEP. Tente novamente.';
          this.formulario.get('cep')?.setErrors({ 'invalidCep': true });
          console.error('Erro ao buscar CEP:', err);
          setTimeout(() => this.mensagem = '', 5000);
        }
      });
    } else {
      this.mensagem = 'Por favor, informe um CEP válido (xxxxx-xxx).';
      this.formulario.get('cep')?.setErrors({ 'invalid': true });
      setTimeout(() => this.mensagem = '', 5000);
    }
  }

  onSubmit() {
    if (this.formulario.invalid) {
      this.mensagem = 'Por favor, preencha todos os campos corretamente.';
      return;
    }

    if (this.editando && this.clienteEditando) {
      this.atualizarCliente();
    } else {
      this.cadastrarCliente();
    }
  }

  cadastrarCliente() {
    const requestDto: CriarClienteRequestDto = {
      nomeCliente: this.formulario.value.nomeCliente,
      cpfCliente: this.formulario.value.cpfCliente,
      telefoneCliente: this.formulario.value.telefoneCliente,
      endereco: {
        logradouro: this.formulario.value.logradouro,
        numero: this.formulario.value.numero,
        complemento: this.formulario.value.complemento,
        bairro: this.formulario.value.bairro,
        cidade: this.formulario.value.estado,
        uf: this.formulario.value.uf,
        cep: this.formulario.value.cep
      }
    };

    this.vibeService.cadastrarCliente(requestDto).subscribe({
      next: (response) => {
        this.mensagem = 'Cliente cadastrado com sucesso!';
        this.formulario.reset();
        this.carregarClientes();
      },
      error: (error) => {
        this.mensagem = 'Erro ao cadastrar cliente. Tente novamente.';
        console.error('Erro:', error);
      }
    });
  }

  atualizarCliente() {
    if (this.clienteEditando?.clienteId) {
      const requestDto: CriarClienteRequestDto = {
        nomeCliente: this.formulario.value.nomeCliente,
        cpfCliente: this.formulario.value.cpfCliente,
        telefoneCliente: this.formulario.value.telefoneCliente,
        endereco: {
          logradouro: this.formulario.value.logradouro,
          numero: this.formulario.value.numero,
          complemento: this.formulario.value.complemento,
          bairro: this.formulario.value.bairro,
          cidade: this.formulario.value.estado,
          uf: this.formulario.value.uf,
          cep: this.formulario.value.cep
        }
      };

      this.vibeService.atualizarCliente(this.clienteEditando.clienteId, requestDto).subscribe({
        next: (response) => {
          this.mensagem = 'Cliente atualizado com sucesso!';
          this.editando = false;
          this.clienteEditando = null;
          this.formulario.reset();
          this.carregarClientes();
        },
        error: (error) => {
          this.mensagem = 'Erro ao atualizar cliente. Tente novamente.';
          console.error('Erro:', error);
        }
      });
    }
  }

  excluirCliente(clienteId: string) {
    if (clienteId && confirm('Tem certeza que deseja excluir este cliente?')) {
      this.vibeService.deletarCliente(clienteId).subscribe({
        next: (response) => {
          this.mensagem = 'Cliente excluído com sucesso!';
          this.carregarClientes();
        },
        error: (error) => {
          this.mensagem = 'Erro ao excluir cliente. Tente novamente.';
          console.error('Erro:', error);
        }
      });
    }
  }

  editarCliente(cliente: ClienteResponseDto) {
    this.editando = true;
    this.clienteEditando = cliente;
    
    this.formulario.patchValue({
      nomeCliente: cliente.nomeCliente,
      cpfCliente: cliente.cpfCliente,
      telefoneCliente: cliente.telefoneCliente,
      logradouro: cliente.endereco?.logradouro,
      numero: cliente.endereco?.numero,
      complemento: cliente.endereco?.complemento || '',
      bairro: cliente.endereco?.bairro,
      uf: cliente.endereco?.uf,
      cep: cliente.endereco?.cep
    });
  }

  cancelarEdicao() {
    this.editando = false;
    this.clienteEditando = null;
    this.formulario.reset();
  }

  // Método de Filtro
  filtrarClientes(): void {
    this.filteredClientes = this.clientes.filter(cliente => {
      const nomeMatch = this.filtroNome
        ? cliente.nomeCliente?.toLowerCase().includes(this.filtroNome.toLowerCase()) ?? false
        : true;
      const cpfMatch = this.filtroCpf
        ? cliente.cpfCliente?.replace(/[^\d]/g, '').includes(this.filtroCpf.replace(/[^\d]/g, ''))
        : true;
      return nomeMatch && cpfMatch;
    });
    this.totalItems = this.filteredClientes.length;
    this.currentPage = 1; // Reseta para a primeira página ao filtrar
    this.updatePaginatedClientes();
  }

  // Lógica de Paginação
  get paginatedClientes(): ClienteResponseDto[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredClientes.slice(startIndex, endIndex);
  }

  onItemsPerPageChange(): void {
    this.currentPage = 1;
    this.totalItems = this.filteredClientes.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  updatePaginatedClientes(): void {
    this.totalItems = this.filteredClientes.length;
  }

  rolarParaTopo(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}