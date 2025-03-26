import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, Subscription, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment.development';
import { RegistrarPontoInicioResponseDto } from '../models/control-app/registrar.ponto.inicio.response.dto';
import { Usuario } from '../models/control-app/usuario.model';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ControllAppService } from './controllApp.service';
import { ServicoFormatacao } from './formatacao.service';
import { ServicoLocalizacao } from './localizacao.service';

@Injectable({
    providedIn: 'root'
})
export class UsuarioService {

    constructor(
        private httpClient: HttpClient,
        private controllAppService: ControllAppService,
        private servicoFormatacao: ServicoFormatacao,
        private authService: AuthService,
        private router: Router,
        private servicoLocalizacao: ServicoLocalizacao
    ) { }

    obterColaboradoresEmServico(): Observable<any[]> {
        const dataAtualServidor = new Date().toISOString().split('T')[0];
        
        return this.usuarioGetAll({}).pipe(
            switchMap(usuarios => {
                const colaboradores = usuarios.filter(u => 
                    u.role?.toLowerCase() === 'colaborador'
                );

                if (colaboradores.length === 0) {
                    return of([]);
                }

                const verificacoesPonto = colaboradores.map(usuario => 
                    this.verificarInicioExpediente(usuario.usuarioId, dataAtualServidor).pipe(
                        map(ponto => ({
                            usuario,
                            ponto
                        }))
                    )
                );

                return forkJoin(verificacoesPonto).pipe(
                    map(resultados => {
                        return resultados
                            .filter(r => r.ponto && !r.ponto.fimExpediente)
                            .map(r => ({
                                usuarioId: r.usuario.usuarioId,
                                nome: r.usuario.nome || 'Sem nome',
                                fotoUrl: this.processarUrlFoto(r.usuario.fotoUrl),
                                inicioExpediente: r.ponto.inicioExpediente,
                                inicioPausa: r.ponto.inicioPausa,
                                retornoPausa: r.ponto.retornoPausa,
                                fimExpediente: r.ponto.fimExpediente,
                                status: r.usuario.isOnline ? 'Online' : 'Offline',
                                endereco: this.formatarEndereco(r.usuario),
                                latitude: r.usuario.latitudeAtual,
                                longitude: r.usuario.longitudeAtual
                            }));
                    })
                );
            }),
            catchError(erro => {
                console.error('Erro ao carregar colaboradores em serviço:', erro);
                return of([]);
            })
        );
    }

    private processarUrlFoto(fotoUrl: string | undefined | null): string {
        if (!fotoUrl) return 'https://via.placeholder.com/40x40';

        try {
            const nomeArquivo = fotoUrl.split('/').pop();
            if (nomeArquivo && nomeArquivo !== 'string' && nomeArquivo !== 'null') {
                return `${environment.mediaUrl}/${nomeArquivo}`;
            }
        } catch (erro) {
            console.warn('Erro ao processar URL da foto:', erro);
        }
        return 'https://via.placeholder.com/40x40';
    }

    private formatarEndereco(usuario: any): string {
        if (usuario?.latitudeAtual && usuario?.longitudeAtual) {
            return `Lat: ${usuario.latitudeAtual.substring(0, 8)}, Long: ${usuario.longitudeAtual.substring(0, 8)}`;
        }
        return 'Localização não disponível';
    }

    private determinarStatus(ponto: any): string {
        if (ponto.fimExpediente) return 'Finalizado';
        if (ponto.fimPausa) return 'Em Serviço';
        if (ponto.inicioPausa) return 'Em Pausa';
        if (ponto.inicioExpediente) return 'Em Andamento';
        return 'Não Iniciado';
    }

    carregarTodosColaboradores(): Observable<any[]> {
        return this.httpClient.get<any>(`${environment.vibeservice}/usuario/public/tecnico`).pipe(
            map((response: any) => {
                console.log('Resposta bruta da API:', response);
                
                // Verifica se a resposta é um objeto paginado
                let colaboradoresData: any[] = [];
                if (response && typeof response === 'object' && response.items && Array.isArray(response.items)) {
                    // Formato paginado
                    colaboradoresData = response.items;
                } else if (Array.isArray(response)) {
                    // Já é um array
                    colaboradoresData = response;
                } else {
                    console.warn('Formato inesperado de resposta:', response);
                    return [];
                }

                return colaboradoresData
                    .filter((usuario: any) => usuario.role?.toLowerCase() === 'colaborador')
                    .map((usuario: any) => {
                        let fotoUrl = 'https://via.placeholder.com/40x40';
                        
                        if (usuario.fotoUrl) {
                            try {
                                const nomeArquivo = usuario.fotoUrl.split('/').pop();
                                if (nomeArquivo && nomeArquivo !== 'string' && nomeArquivo !== 'null') {
                                    fotoUrl = `${environment.mediaUrl}/${nomeArquivo}`;
                                }
                            } catch (erro) {
                                console.warn('Erro ao processar URL da foto:', erro);
                            }
                        }

                        return {
                            id: usuario.usuarioId,
                            usuarioId: usuario.usuarioId,
                            nome: usuario.nome || 'Sem nome',
                            email: usuario.email || '-',
                            cpf: usuario.cpf || '-',
                            empresaId: usuario.empresaId || null,
                            matricula: usuario.numeroMatricula || '-',
                            fotoUrl: fotoUrl,
                            jornada: this.formatarJornada(usuario.horaEntrada, usuario.horaSaida),
                            isOnline: usuario.isOnline || false
                        };
                    });
            }),
            switchMap((colaboradores: any[]) => {
                // Criar um array de observables para buscar o nome da empresa para cada colaborador
                const empresaRequests = colaboradores.map((colaborador: any) => 
                    this.buscarNomeEmpresa(colaborador.empresaId).pipe(
                        map(empresa => ({
                            ...colaborador,
                            empresaNome: empresa.nomeDaEmpresa || 'N/A'
                        })),
                        catchError(() => of({
                            ...colaborador,
                            empresaNome: 'N/A'
                        }))
                    )
                );

                // Executar todas as requisições em paralelo
                return forkJoin(empresaRequests);
            })
        );
    }

    private formatarJornada(entrada?: string, saida?: string): string {
        if (!entrada || !saida) return 'Não definida';
        return `${entrada} - ${saida}`;
    }
      
    usuarioGetAll(request: any): Observable<Usuario[]> {
        return this.httpClient.get<Usuario[]>(
            `${environment.controllApp}/usuario/tecnicos`,
            { params: request }
        );
    }
    
    verificarInicioExpediente(usuarioId: string, dataAtual: string): Observable<any> {
        return this.controllAppService.PontoGetByUsuarioId(usuarioId).pipe(
            map(pontos => {
                if (!Array.isArray(pontos)) return null;
                
                return pontos.find(ponto => {
                    try {
                        if (!ponto.inicioExpediente) return false;
                        const dataPonto = new Date(ponto.inicioExpediente);
                        return dataPonto.toISOString().split('T')[0] === dataAtual;
                    } catch (erro) {
                        console.warn('Erro ao processar data do ponto:', erro);
                        return false;
                    }
                }) || null;
            }),
            catchError(erro => {
                console.error(`Erro ao verificar ponto do usuário ${usuarioId}:`, erro);
                return of(null);
            })
        );
    }

    async verificarRegistroDoDia(idUsuario: string): Promise<{
        pontoId: string;
        pausaId: string;
        timestamps: { [key: string]: string };
        disabled: boolean[];
    } | null> {
        if (!idUsuario) {
            console.warn("⚠️ ID do usuário não encontrado");
            return null;
        }
    
        try {
            const data = await this.controllAppService.PontoGetByUsuarioId(idUsuario).toPromise();
            if (!data || !Array.isArray(data)) {
                console.warn("⚠️ Nenhum registro retornado pela API");
                console.log("📡 Resposta da API:", data);
                return {
                    pontoId: '',
                    pausaId: '',
                    timestamps: {
                        inicio: '',
                        'almoco-inicio': '',
                        'almoco-fim': '',
                        fim: ''
                    },
                    disabled: [false, true, true, true]
                };
            }
    
            const hoje = new Date().toISOString().split('T')[0];
    
            const registrosHoje = data.filter(ponto => {
                if (!ponto.inicioExpediente) return false;
                const dataPonto = new Date(ponto.inicioExpediente);
                return !isNaN(dataPonto.getTime()) && dataPonto.toISOString().split('T')[0] === hoje;
            });
    
            if (registrosHoje.length === 0) {
                console.warn("⚠️ Nenhum registro de ponto encontrado para hoje.");
                return {
                    pontoId: '',
                    pausaId: '',
                    timestamps: {
                        inicio: '',
                        'almoco-inicio': '',
                        'almoco-fim': '',
                        fim: ''
                    },
                    disabled: [false, true, true, true]
                };
            }
    
            console.log("📌 Registros do dia encontrados:", registrosHoje);
    
            const ultimoRegistro = registrosHoje[registrosHoje.length - 1];
            console.log("📋 Último registro do dia:", ultimoRegistro);
    
            const timestamps = {
                inicio: ultimoRegistro.inicioExpediente ? this.servicoFormatacao.formatarHora(ultimoRegistro.inicioExpediente) : '',
                'almoco-inicio': ultimoRegistro.inicioPausa ? this.servicoFormatacao.formatarHora(ultimoRegistro.inicioPausa) : '',
                'almoco-fim': ultimoRegistro.retornoPausa ? this.servicoFormatacao.formatarHora(ultimoRegistro.retornoPausa) : '',
                fim: ultimoRegistro.fimExpediente ? this.servicoFormatacao.formatarHora(ultimoRegistro.fimExpediente) : '',
            };

            const disabled = [true, true, true, true];

            if (!timestamps.inicio) {
                disabled[0] = false;
            } else if (!timestamps['almoco-inicio']) {
                disabled[1] = false;
            } else if (!timestamps['almoco-fim']) {
                disabled[2] = false;
            } else if (!timestamps.fim) {
                disabled[3] = false;
            }

            console.log("🔒 Estado dos botões:", disabled);
            console.log("⏰ Timestamps:", timestamps);
    
            if (ultimoRegistro.pontoIdExpediente) {
                localStorage.setItem('pontoIdExpediente', ultimoRegistro.pontoIdExpediente);
            }
            if (ultimoRegistro.pontoIdPausa) {
                localStorage.setItem('pontoIdPausa', ultimoRegistro.pontoIdPausa);
            }

            return {
                pontoId: ultimoRegistro.pontoIdExpediente || '',
                pausaId: ultimoRegistro.pontoIdPausa || '',
                timestamps,
                disabled
            };
    
        } catch (err) {
            console.error("❌ Erro ao verificar registros do dia:", err);
            return {
                pontoId: '',
                pausaId: '',
                timestamps: {
                    inicio: '',
                    'almoco-inicio': '',
                    'almoco-fim': '',
                    fim: ''
                },
                disabled: [false, true, true, true]
            };
        }
    }

    encerrarSessao(idUsuario: string, limparDados: boolean = true): void {
        this.controllAppService.atualizarStatusUsuario(idUsuario, false).subscribe({
            next: () => {
                this.controllAppService.autenticar('username-logout', 'senha-logout').subscribe({
                    next: () => {
                        if (limparDados) {
                            this.authService.logout();
                        }
                        this.router.navigate(['/pages/usuarios/autenticar']);
                    },
                    error: (err) => {
                        console.error('Erro ao autenticar logout:', err);
                        if (limparDados) {
                            this.authService.logout();
                        }
                        this.router.navigate(['/pages/usuarios/autenticar']);
                    },
                });
            },
            error: (err) => {
                console.error('Erro ao atualizar status de logout:', err);
                if (limparDados) {
                    this.authService.logout();
                }
                this.router.navigate(['/pages/usuarios/autenticar']);
            },
        });
    }

    iniciarAtualizacaoDeLocalizacao(idUsuario: string): Subscription {
        return this.servicoLocalizacao.iniciarAtualizacaoAutomatica(idUsuario);
    }

    async verificarExpedienteAtivo(idUsuario: string): Promise<boolean> {
        try {
            const data = await this.controllAppService.PontoGetByUsuarioId(idUsuario).toPromise();
            if (!data || !Array.isArray(data)) {
                return false;
            }

            const hoje = new Date().toISOString().split('T')[0];
            const registrosHoje = data.filter(ponto => {
                if (!ponto.inicioExpediente) return false;
                const dataPonto = new Date(ponto.inicioExpediente);
                return !isNaN(dataPonto.getTime()) && 
                       dataPonto.toISOString().split('T')[0] === hoje &&
                       !ponto.fimExpediente;
            });

            return registrosHoje.length > 0;
        } catch (err) {
            console.error("❌ Erro ao verificar expediente ativo:", err);
            return false;
        }
    }

    buscarNomeEmpresa(empresaId: string): Observable<any> {
        if (!empresaId) return of({ nomeDaEmpresa: 'N/A' });
        return this.httpClient.get<any>(`${environment.controllApp}/usuario/empresa/${empresaId}`).pipe(
            catchError(() => of({ nomeDaEmpresa: 'N/A' }))
        );
    }
}