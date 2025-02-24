import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxMaskDirective } from 'ngx-mask';
import { HttpClient } from '@angular/common/http';

interface Cliente {
  id?: number;
  nome: string;
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  uf: string;
  estado: string;
  numero: string; // Campo número
  endereco: string; // Campo endereço
}

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
    FormsModule
  ],
  templateUrl: './cadastrar-cliente.component.html',
  styleUrls: ['./cadastrar-cliente.component.css']
})
export class CadastrarClienteComponent implements OnInit {
  formulario: FormGroup;
  mensagem: string = '';
  editando: boolean = false;
  clienteEditando: Cliente | null = null;
  clientes: Cliente[] = [];

  // Paginação
  currentPage: number = 1;
  itemsPerPage: number = 5; // Padrão: 5 itens por página
  totalItems: number = 0;

  private viaCepUrl = 'https://viacep.com.br/ws/';

  constructor(private formBuilder: FormBuilder, private http: HttpClient) {
    this.formulario = this.formBuilder.group({
      nome: ['', [Validators.required, Validators.minLength(3)]],
      cep: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]], // Mantendo a validação atual
      logradouro: ['', [Validators.required]], // Editável
      complemento: [''],
      bairro: ['', [Validators.required]], // Editável
      uf: ['', [Validators.required]], // Editável
      estado: ['', [Validators.required]], // Editável
      numero: ['', [Validators.required]] // Campo número, obrigatório
    });
  }

  ngOnInit(): void {
    this.carregarClientes();
  }

  get f() {
    return this.formulario.controls;
  }

  carregarClientes() {
    // Simulando uma chamada à API com 20 clientes mockados
    this.clientes = [
      { 
        id: 1, 
        nome: 'Cliente Exemplo 1', 
        cep: '01001-000', 
        logradouro: 'Praça da Sé', 
        complemento: 'lado ímpar', 
        bairro: 'Sé', 
        uf: 'SP', 
        estado: 'São Paulo',
        numero: '123', 
        endereco: 'Praça da Sé, 123, lado ímpar, Sé, São Paulo, SP'
      },
      { 
        id: 2, 
        nome: 'Cliente Exemplo 2', 
        cep: '02002-000', 
        logradouro: 'Rua B', 
        complemento: '', 
        bairro: 'Bela Vista', 
        uf: 'SP', 
        estado: 'São Paulo',
        numero: '456', 
        endereco: 'Rua B, 456, Bela Vista, São Paulo, SP'
      },
      { 
        id: 3, 
        nome: 'Maria Oliveira', 
        cep: '01310-100', 
        logradouro: 'Avenida Paulista', 
        complemento: 'Torre Norte', 
        bairro: 'Bela Vista', 
        uf: 'SP', 
        estado: 'São Paulo',
        numero: '1500', 
        endereco: 'Avenida Paulista, 1500, Torre Norte, Bela Vista, São Paulo, SP'
      },
      { 
        id: 4, 
        nome: 'João Silva', 
        cep: '20040-070', 
        logradouro: 'Rua do Ouvidor', 
        complemento: '', 
        bairro: 'Centro', 
        uf: 'RJ', 
        estado: 'Rio de Janeiro',
        numero: '25', 
        endereco: 'Rua do Ouvidor, 25, Centro, Rio de Janeiro, RJ'
      },
      { 
        id: 5, 
        nome: 'Ana Pereira', 
        cep: '30110-010', 
        logradouro: 'Praça da Liberdade', 
        complemento: 'Bloco A', 
        bairro: 'Savassi', 
        uf: 'MG', 
        estado: 'Belo Horizonte',
        numero: '300', 
        endereco: 'Praça da Liberdade, 300, Bloco A, Savassi, Belo Horizonte, MG'
      },
      { 
        id: 6, 
        nome: 'Carlos Mendes', 
        cep: '40015-000', 
        logradouro: 'Avenida Sete de Setembro', 
        complemento: 'Sala 50', 
        bairro: 'Comércio', 
        uf: 'BA', 
        estado: 'Salvador',
        numero: '800', 
        endereco: 'Avenida Sete de Setembro, 800, Sala 50, Comércio, Salvador, BA'
      },
      { 
        id: 7, 
        nome: 'Lucia Souza', 
        cep: '90010-150', 
        logradouro: 'Rua dos Andradas', 
        complemento: '', 
        bairro: 'Centro Histórico', 
        uf: 'RS', 
        estado: 'Porto Alegre',
        numero: '100', 
        endereco: 'Rua dos Andradas, 100, Centro Histórico, Porto Alegre, RS'
      },
      { 
        id: 8, 
        nome: 'Pedro Almeida', 
        cep: '51011-020', 
        logradouro: 'Avenida Agamenon Magalhães', 
        complemento: 'Térreo', 
        bairro: 'Sto. Amaro', 
        uf: 'PE', 
        estado: 'Recife',
        numero: '2000', 
        endereco: 'Avenida Agamenon Magalhães, 2000, Térreo, Sto. Amaro, Recife, PE'
      },
      { 
        id: 9, 
        nome: 'Fernanda Lima', 
        cep: '80020-010', 
        logradouro: 'Rua XV de Novembro', 
        complemento: 'Loja 5', 
        bairro: 'Centro', 
        uf: 'PR', 
        estado: 'Curitiba',
        numero: '300', 
        endereco: 'Rua XV de Novembro, 300, Loja 5, Centro, Curitiba, PR'
      },
      { 
        id: 10, 
        nome: 'Ricardo Santos', 
        cep: '69005-050', 
        logradouro: 'Avenida Eduardo Ribeiro', 
        complemento: '', 
        bairro: 'Centro', 
        uf: 'AM', 
        estado: 'Manaus',
        numero: '400', 
        endereco: 'Avenida Eduardo Ribeiro, 400, Centro, Manaus, AM'
      },
      { 
        id: 11, 
        nome: 'Juliana Ribeiro', 
        cep: '50030-230', 
        logradouro: 'Praça da Independência', 
        complemento: 'Bloco 3', 
        bairro: 'Boa Vista', 
        uf: 'PE', 
        estado: 'Recife',
        numero: '50', 
        endereco: 'Praça da Independência, 50, Bloco 3, Boa Vista, Recife, PE'
      },
      { 
        id: 12, 
        nome: 'Thiago Costa', 
        cep: '22010-010', 
        logradouro: 'Rua Barão da Torre', 
        complemento: 'Apto 101', 
        bairro: 'Ipanema', 
        uf: 'RJ', 
        estado: 'Rio de Janeiro',
        numero: '600', 
        endereco: 'Rua Barão da Torre, 600, Apto 101, Ipanema, Rio de Janeiro, RJ'
      },
      { 
        id: 13, 
        nome: 'Mariana Freitas', 
        cep: '30410-070', 
        logradouro: 'Rua da Bahia', 
        complemento: '', 
        bairro: 'Lourdes', 
        uf: 'MG', 
        estado: 'Belo Horizonte',
        numero: '700', 
        endereco: 'Rua da Bahia, 700, Lourdes, Belo Horizonte, MG'
      },
      { 
        id: 14, 
        nome: 'Bruno Carvalho', 
        cep: '60115-190', 
        logradouro: 'Avenida Dom Luís', 
        complemento: 'Torre Sul', 
        bairro: 'Aldêa', 
        uf: 'CE', 
        estado: 'Fortaleza',
        numero: '1200', 
        endereco: 'Avenida Dom Luís, 1200, Torre Sul, Aldêa, Fortaleza, CE'
      },
      { 
        id: 15, 
        nome: 'Patrícia Mendes', 
        cep: '70040-020', 
        logradouro: 'Setor Hoteleiro Norte', 
        complemento: 'Sala 15', 
        bairro: 'Asa Norte', 
        uf: 'DF', 
        estado: 'Brasília',
        numero: '900', 
        endereco: 'Setor Hoteleiro Norte, 900, Sala 15, Asa Norte, Brasília, DF'
      },
      { 
        id: 16, 
        nome: 'Rafael Lima', 
        cep: '04002-010', 
        logradouro: 'Rua Augusta', 
        complemento: 'Loja 20', 
        bairro: 'Consolação', 
        uf: 'SP', 
        estado: 'São Paulo',
        numero: '250', 
        endereco: 'Rua Augusta, 250, Loja 20, Consolação, São Paulo, SP'
      },
      { 
        id: 17, 
        nome: 'Camila Rocha', 
        cep: '11013-020', 
        logradouro: 'Avenida Lúcio Costa', 
        complemento: '', 
        bairro: 'Barra da Tijuca', 
        uf: 'RJ', 
        estado: 'Rio de Janeiro',
        numero: '1500', 
        endereco: 'Avenida Lúcio Costa, 1500, Barra da Tijuca, Rio de Janeiro, RJ'
      },
      { 
        id: 18, 
        nome: 'Gabriel Souza', 
        cep: '88015-100', 
        logradouro: 'Rua Felipe Schmidt', 
        complemento: 'Apto 305', 
        bairro: 'Centro', 
        uf: 'SC', 
        estado: 'Florianópolis',
        numero: '400', 
        endereco: 'Rua Felipe Schmidt, 400, Apto 305, Centro, Florianópolis, SC'
      },
      { 
        id: 19, 
        nome: 'Isabela Pereira', 
        cep: '30150-001', 
        logradouro: 'Rua Rio de Janeiro', 
        complemento: '', 
        bairro: 'Funcionários', 
        uf: 'MG', 
        estado: 'Belo Horizonte',
        numero: '600', 
        endereco: 'Rua Rio de Janeiro, 600, Funcionários, Belo Horizonte, MG'
      },
      { 
        id: 20, 
        nome: 'Vinicius Almeida', 
        cep: '90610-130', 
        logradouro: 'Avenida Luiz Manoel', 
        complemento: 'Bloco B', 
        bairro: 'Menino Deus', 
        uf: 'RS', 
        estado: 'Porto Alegre',
        numero: '800', 
        endereco: 'Avenida Luiz Manoel, 800, Bloco B, Menino Deus, Porto Alegre, RS'
      }
    ];
    this.totalItems = this.clientes.length;
    this.updatePaginatedClientes();
  }

  buscarCep() {
    const cep = this.formulario.get('cep')?.value;
    if (cep && this.formulario.get('cep')?.valid) {
      const cepLimpo = cep.replace('-', ''); // Remove o hífen para a API
      this.http.get<ViaCepResponse>(`${this.viaCepUrl}${cepLimpo}/json/`).subscribe({
        next: (response) => {
          if (!response.erro) {
            const numero = this.formulario.get('numero')?.value || ''; // Mantém o valor atual do número, se houver
            const endereco = `${response.logradouro || ''}, ${numero ? numero + ', ' : ''}${response.complemento || ''}, ${response.bairro || ''}, ${response.localidade || ''}, ${response.uf || ''}`.trim();
            this.formulario.patchValue({
              logradouro: response.logradouro || '',
              complemento: response.complemento || '',
              bairro: response.bairro || '',
              uf: response.uf || '',
              estado: response.localidade || '',
              endereco: endereco // Preenche o campo endereco como uma string concatenada
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
            this.formulario.get('cep')?.setErrors({ 'invalidCep': true }); // Marca o CEP como inválido se não encontrado
          }
          setTimeout(() => this.mensagem = '', 5000);
        },
        error: (err) => {
          this.mensagem = 'Erro ao consultar o CEP. Tente novamente.';
          this.formulario.get('cep')?.setErrors({ 'invalidCep': true }); // Marca o CEP como inválido em caso de erro
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
    const novoCliente: Cliente = {
      id: this.clientes.length + 1,
      ...this.formulario.value
    };
    // Criar o campo endereco concatenando os valores
    const endereco = `${novoCliente.logradouro}, ${novoCliente.numero || ''}, ${novoCliente.complemento || ''}, ${novoCliente.bairro}, ${novoCliente.estado}, ${novoCliente.uf}`.trim();
    novoCliente.endereco = endereco;
    this.clientes.push(novoCliente);
    this.mensagem = 'Cliente cadastrado com sucesso!';
    this.formulario.reset({
      nome: '',
      cep: '',
      logradouro: '',
      complemento: '',
      bairro: '',
      uf: '',
      estado: '',
      numero: ''
    });
    this.totalItems = this.clientes.length;
    this.currentPage = this.totalPages; // Vai para a última página após cadastrar
    this.updatePaginatedClientes();
  }

  editarCliente(cliente: Cliente) {
    this.editando = true;
    this.clienteEditando = cliente;
    this.formulario.patchValue({
      nome: cliente.nome,
      cep: cliente.cep,
      logradouro: cliente.logradouro,
      complemento: cliente.complemento,
      bairro: cliente.bairro,
      uf: cliente.uf,
      estado: cliente.estado,
      numero: cliente.numero || '' // Preenche o campo número
    });
  }

  atualizarCliente() {
    if (this.clienteEditando) {
      const index = this.clientes.findIndex(c => c.id === this.clienteEditando!.id);
      if (index !== -1) {
        const updatedCliente = {
          ...this.clienteEditando,
          ...this.formulario.value
        };
        // Criar o campo endereco concatenando os valores atualizados
        const endereco = `${updatedCliente.logradouro}, ${updatedCliente.numero || ''}, ${updatedCliente.complemento || ''}, ${updatedCliente.bairro}, ${updatedCliente.estado}, ${updatedCliente.uf}`.trim();
        updatedCliente.endereco = endereco;
        this.clientes[index] = updatedCliente;
      }
      this.mensagem = 'Cliente atualizado com sucesso!';
      this.editando = false;
      this.clienteEditando = null;
      this.formulario.reset({
        nome: '',
        cep: '',
        logradouro: '',
        complemento: '',
        bairro: '',
        uf: '',
        estado: '',
        numero: ''
      });
      this.updatePaginatedClientes();
    }
  }

  excluirCliente(id: number | undefined) {
    if (id !== undefined) {
      if (confirm('Tem certeza que deseja excluir este cliente?')) {
        this.clientes = this.clientes.filter(c => c.id !== id);
        this.mensagem = 'Cliente excluído com sucesso!';
        this.totalItems = this.clientes.length;
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages > 0 ? this.totalPages : 1;
        }
        this.updatePaginatedClientes();
      }
    }
  }

  // Lógica de Paginação
  get paginatedClientes(): Cliente[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.clientes.slice(startIndex, endIndex);
  }

  onItemsPerPageChange(): void {
    this.currentPage = 1; // Reset para primeira página quando mudar itens por página
    this.totalItems = this.clientes.length;
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
    this.totalItems = this.clientes.length;
  }

  // Método para rolar a página para o topo
  rolarParaTopo(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Rolagem suave para o topo
  }
}