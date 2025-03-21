import { Routes } from '@angular/router';
import { AutenticarComponent } from './components/pages/autenticar/autenticar.component';
import { HorasTrabalhadasComponent } from './components/pages/horas-trabalhadas/horas-trabalhadas.component';
import { DashboardComponent } from './components/pages/dashboard/dashboard.component';
import { LoginGuard } from './guards/login.guard';
import { AuthGuard } from './guards/auth.guard';
import { ExpedienteComponent } from './components/pages/expediente/expediente.component';
import { HorasColaboradorComponent } from './components/pages/horas-colaborador/horas-colaborador.component';
import { CadastrarUsuarioComponent } from './components/pages/cadastrar-usuario/cadastrar-usuario.component';
import { HistoricoTecnicoComponent } from './components/pages/historico-tecnico/historico-tecnico.component';
import { EditarColaboradorComponent } from './components/pages/editar-colaborador/editar-colaborador.component';
import { OrdemServicoExecComponent } from './components/pages/ordem-servico-exec/ordem-servico-exec.component';
import { OrdemServicoComponent } from './components/pages/ordem-servico/ordem-servico.component';
import { UsuariosComponent } from './components/pages/usuarios/usuarios.component';
import { CadastrarClienteComponent } from './components/pages/cadastrar-cliente/cadastrar-cliente.component';
import { DistribuicaoOrdemServicoComponent } from './components/pages/distribuicao-ordem-servico/distribuicao-ordem-servico.component';
import { EmpresasComponent } from './components/pages/empresas/empresas.component';
import { ConsultarOrdemServicoComponent } from './components/pages/consultar-ordem-servico/consultar-ordem-servico.component';
import { InicioExpedienteComponent } from './components/pages/expediente/inicio-expediente/inicio-expediente.component';
import { InicioPausaComponent } from './components/pages/expediente/inicio-pausa/inicio-pausa.component';
import { FimPausaComponent } from './components/pages/expediente/fim-pausa/fim-pausa.component';
import { FimExpedienteComponent } from './components/pages/expediente/fim-expediente/fim-expediente.component';

export const routes: Routes = [
  {
    path: 'pages/usuarios/autenticar',
    component: AutenticarComponent,
    canActivate: [LoginGuard]
  },
  {
    path: 'pages/cadastrar-usuario',
    component: CadastrarUsuarioComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/cadastrar-cliente',
    component: CadastrarClienteComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/empresas',
    component: EmpresasComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/usuarios',
    component: UsuariosComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/editar-colaborador/:usuarioId',
    component: EditarColaboradorComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/expediente',
    component: ExpedienteComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/expediente/:usuarioId',
    component: ExpedienteComponent,
    canActivate: [AuthGuard]
  },
  // Novas rotas específicas para as ações de expediente
  {
    path: 'pages/expediente/inicio/:usuarioId',
    component: InicioExpedienteComponent,
    canActivate: [AuthGuard],
    data: { acao: 'inicio' }
  },
  {
    path: 'pages/expediente/inicio-pausa/:usuarioId',
    component: InicioPausaComponent,
    canActivate: [AuthGuard],
    data: { acao: 'inicio-pausa' }
  },
  {
    path: 'pages/expediente/fim-pausa/:usuarioId',
    component: FimPausaComponent,
    canActivate: [AuthGuard],
    data: { acao: 'fim-pausa' }
  },
  {
    path: 'pages/expediente/fim/:usuarioId',
    component: FimExpedienteComponent,
    canActivate: [AuthGuard],
    data: { acao: 'fim' }
  },
  {
    path: 'pages/horas-trabalhadas',
    component: HorasTrabalhadasComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/horas-colaborador/:usuarioId',
    component: HorasColaboradorComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/ordem-servico-exec/:usuarioId',
    component: OrdemServicoExecComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/ordem-servico',
    children: [
      {
        path: 'pendentes/:usuarioId',
        component: OrdemServicoComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'realizadas/:usuarioId',
        component: OrdemServicoComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'canceladas/:usuarioId',
        component: OrdemServicoComponent,
        canActivate: [AuthGuard]
      },
      {
        path: 'emAndamento/:usuarioId',
        component: OrdemServicoComponent,
        canActivate: [AuthGuard]
      }
    ]
  },
  {
    path: 'pages/gerenciar-ordem-servico',
    component: DistribuicaoOrdemServicoComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/consultar-ordem-servico',
    component: ConsultarOrdemServicoComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/historico-tecnico/:id',
    component: HistoricoTecnicoComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'pages/dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/pages/usuarios/autenticar'
  }
];