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
  cidade: string; // Novo campo
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
      cidade: ['', [Validators.required]], // Novo campo com validação
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
        cidade: data.localidade, // Preenche o novo campo cidade com a localidade do CEP
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

  // Função auxiliar para formatar endereço consistentemente
  formatarEndereco(endereco: any): string {
    // Verifica se temos dados de endereço
    if (!endereco) {
      console.log('Endereço nulo ou indefinido');
      return 'Endereço não disponível';
    }
    
    console.log('Dados do endereço recebidos:', endereco);
    
    // Extrai os campos com segurança
    const logradouro = endereco.logradouro || '';
    const numero = endereco.numero || '';
    const complemento = endereco.complemento ? ` - ${endereco.complemento}` : '';
    const bairro = endereco.bairro || '';
    const localidade = endereco.localidade || '';
    const uf = endereco.uf || '';
    
    // Se não temos nenhuma informação de endereço, retorna mensagem padrão
    if (!logradouro && !bairro && !localidade && !uf) {
      return 'Endereço não disponível';
    }
    
    // Monta o endereço com as partes que existem
    let enderecoFormatado = '';
    
    if (logradouro) {
      enderecoFormatado += `${logradouro}`;
      if (numero) enderecoFormatado += `, ${numero}`;
      if (complemento) enderecoFormatado += complemento;
    }
    
    if (bairro) {
      if (enderecoFormatado) enderecoFormatado += ', ';
      enderecoFormatado += bairro;
    }
    
    if (localidade || uf) {
      if (enderecoFormatado) enderecoFormatado += ', ';
      if (localidade) enderecoFormatado += localidade;
      if (uf) enderecoFormatado += ` - ${uf}`;
    }
    
    return enderecoFormatado || 'Endereço não disponível';
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
        cidade: formData.cidade, // Adicionando o novo campo
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
          endereco: this.formatarEndereco({
            logradouro: formData.logradouro,
            numero: formData.numero,
            complemento: formData.complemento,
            bairro: formData.bairro,
            localidade: formData.estado,
            uf: formData.uf
          })
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

    // Formatar dados conforme esperado pelo endpoint /usuario/empresa/{empresaId}
    const empresaData = {
      nomeDaEmpresa: formData.nome,
      endereco: {
        cep: formData.cep,
        logradouro: formData.logradouro,
        numero: formData.numero,
        complemento: formData.complemento || '',
        bairro: formData.bairro,
        cidade: formData.cidade, // Adicionando o novo campo
        localidade: formData.estado,
        uf: formData.uf
      },

      ativo: true
    };

    console.log('Dados formatados para atualização:', JSON.stringify(empresaData));
    console.log('ID da empresa para atualização:', this.empresaEditandoId);
    console.log('Endpoint de atualização: /usuario/empresa/' + this.empresaEditandoId);

    this.controllAppService.atualizarEmpresa(this.empresaEditandoId, empresaData).subscribe({
      next: (response) => {
        console.log('Resposta da API após atualização:', response);
        
        const index = this.empresas.findIndex(e => e.empresaId === this.empresaEditandoId);
        if (index !== -1) {
          // Atualiza o objeto no array local com base nos dados enviados no formulário,
          // não nos dados retornados pela API (que podem estar incompletos)
          this.empresas[index] = {
            empresaId: this.empresaEditandoId!,
            ativo: true,
            nome: formData.nome,
            cep: formData.cep,
            logradouro: formData.logradouro,
            numero: formData.numero,
            complemento: formData.complemento || '',
            bairro: formData.bairro,
            cidade: formData.cidade, // Adicionando o novo campo
            uf: formData.uf,
            estado: formData.estado,
            endereco: `${formData.logradouro}, ${formData.numero}${formData.complemento ? ` - ${formData.complemento}` : ''}, ${formData.bairro}, ${formData.cidade}, ${formData.estado} - ${formData.uf}`
          };
          
          this.updatePagination();
          this.mensagem = 'Empresa atualizada com sucesso!';
          this.isError = false;
          this.resetForm();
        }
      },
      error: (error) => {
        console.error('Erro detalhado na atualização:', error);
        
        // Verificar se é um erro 200 (que na verdade é sucesso)
        if (error.status === 200) {
          const index = this.empresas.findIndex(e => e.empresaId === this.empresaEditandoId);
          if (index !== -1) {
            // Mesmo tratamento para sucesso
            this.empresas[index] = {
              empresaId: this.empresaEditandoId!,
              ativo: true,
              nome: formData.nome,
              cep: formData.cep,
              logradouro: formData.logradouro,
              numero: formData.numero,
              complemento: formData.complemento || '',
              bairro: formData.bairro,
              cidade: formData.cidade, // Adicionando o novo campo
              uf: formData.uf,
              estado: formData.estado,
              endereco: `${formData.logradouro}, ${formData.numero}${formData.complemento ? ` - ${formData.complemento}` : ''}, ${formData.bairro}, ${formData.cidade}, ${formData.estado} - ${formData.uf}`
            };
            
            this.updatePagination();
            this.mensagem = 'Empresa atualizada com sucesso!';
            this.isError = false;
            this.resetForm();
            return;
          }
        }
        
        this.mensagem = `Erro ao atualizar empresa: ${error.message || 'Tente novamente mais tarde.'}`;
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
    
    console.log('Editando empresa com ID:', this.empresaEditandoId);
    
    // Preenche o formulário com os dados disponíveis da empresa selecionada
    this.formulario.patchValue({
      nome: empresa.nome || '',
      cep: empresa.cep || '',
      logradouro: empresa.logradouro || '',
      numero: empresa.numero || '',
      complemento: empresa.complemento || '',
      bairro: empresa.bairro || '',
      cidade: empresa.cidade || '', 
      uf: empresa.uf || '',
      estado: empresa.estado || ''
    });

    // Busca dados atualizados da empresa a partir da API
    this.controllAppService.buscarEmpresasPorId(this.empresaEditandoId).subscribe({
      next: (response) => {
        if (!response) {
          console.log('API retornou dados vazios para a empresa');
          return; // Mantenha os dados que já foram preenchidos
        }
        
        console.log('Dados da empresa recebidos da API:', response);
        
        // Apenas atualiza campos que existirem na resposta
        const updateData: any = {};
        
        if (response.nomeDaEmpresa) updateData.nome = response.nomeDaEmpresa;
        
        if (response.endereco) {
          if (response.endereco.cep) updateData.cep = response.endereco.cep;
          if (response.endereco.logradouro) updateData.logradouro = response.endereco.logradouro;
          if (response.endereco.numero) updateData.numero = response.endereco.numero;
          if (response.endereco.complemento !== undefined) updateData.complemento = response.endereco.complemento;
          if (response.endereco.bairro) updateData.bairro = response.endereco.bairro;
          if (response.endereco.uf) updateData.uf = response.endereco.uf;
          if (response.endereco.localidade) updateData.estado = response.endereco.localidade;
          if (response.endereco.cidade) updateData.cidade = response.endereco.cidade;
        }
        
        console.log('Atualizando formulário com:', updateData);
        this.formulario.patchValue(updateData);
      },
      error: (error) => {
        console.error('Erro ao buscar empresa:', error);
        // Não exibe mensagem de erro, pois já temos dados básicos preenchidos
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
        
        // Exibe toda a resposta para diagnóstico
        console.log('RESPOSTA COMPLETA:', JSON.stringify(response));
        
        this.empresas = response.map((empresa: any) => {
          // Dados de endereço diretos da API
          const endereco = empresa.endereco;
          
          // Criar formato de endereço manualmente, sem usar funções auxiliares
          let enderecoFinal = '';
          
          try {
            // Lógica direta e simplificada - tenta todas as possibilidades
            if (endereco) {
              // Concatenar logradouro e número (mesmo que apenas um exista)
              const temLogradouro = endereco.logradouro && endereco.logradouro.trim() !== '';
              const temNumero = endereco.numero && endereco.numero.trim() !== '';
              
              if (temLogradouro || temNumero) {
                if (temLogradouro) enderecoFinal += endereco.logradouro;
                if (temNumero) enderecoFinal += temLogradouro ? `, ${endereco.numero}` : endereco.numero;
              }
              
              // Adicionar complemento se existir
              if (endereco.complemento && endereco.complemento.trim() !== '') {
                enderecoFinal += ` - ${endereco.complemento}`;
              }
              
              // Adicionar bairro se existir
              if (endereco.bairro && endereco.bairro.trim() !== '') {
                if (enderecoFinal) enderecoFinal += ', ';
                enderecoFinal += endereco.bairro;
              }
              
             
              const temLocalidade = endereco.localidade && endereco.localidade.trim() !== '';
              const temUF = endereco.uf && endereco.uf.trim() !== '';
              
              if (temLocalidade || temUF) {
                if (enderecoFinal) enderecoFinal += ', ';
                if (temLocalidade) enderecoFinal += endereco.localidade;
                if (temUF) enderecoFinal += temLocalidade ? ` - ${endereco.uf}` : endereco.uf;
              }
            }
            
           
            if (!enderecoFinal) {
              
              const campos = ['logradouro', 'numero', 'bairro', 'estado', 'uf'];
              const partes = [];
              
              for (const campo of campos) {
                if (empresa[campo] && empresa[campo].trim() !== '') {
                  partes.push(empresa[campo]);
                }
              }
              
              enderecoFinal = partes.join(', ');
            }
            
            // Último recurso
            if (!enderecoFinal && typeof endereco === 'string') {
              enderecoFinal = endereco;
            }
          } catch (error) {
            console.error('Erro ao montar endereço:', error);
          }
          
          // Se depois de tudo, ainda não temos um endereço, usamos um texto padrão
          if (!enderecoFinal) {
            enderecoFinal = 'Rua ' + (empresa.logradouro || '') + 
                            ', ' + (empresa.numero || 'S/N') + 
                            (empresa.complemento ? ' - ' + empresa.complemento : '') + 
                            ', ' + (empresa.bairro || 'Centro') + 
                            ', ' + (empresa.estado || '') + 
                            ' - ' + (empresa.uf || '');
          }
          
          return {
            empresaId: empresa.empresaId,
            ativo: empresa.ativo || true,
            nome: empresa.nomeDaEmpresa || '',
            cep: empresa.endereco?.cep || '',
            logradouro: empresa.endereco?.logradouro || '',
            numero: empresa.endereco?.numero || '',
            complemento: empresa.endereco?.complemento || '',
            bairro: empresa.endereco?.bairro || '',
            cidade: empresa.endereco?.cidade || empresa.endereco?.localidade || '', 
            uf: empresa.endereco?.uf || '',
            estado: empresa.endereco?.localidade || '',
            endereco: enderecoFinal || 'Endereço não informado'
          };
        });
        
        this.updatePagination();
      },
      error: (error: any) => {
        this.mensagem = 'Erro ao carregar a lista de empresas. ' + (error.message || 'Verifique sua conexão e tente novamente.');
        this.isError = true;
      }
    });
  }
}