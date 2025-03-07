import { HttpInterceptorFn } from '@angular/common/http';

// Lista de endpoints que precisam do token JWT para autenticação
const endpoints = [
  'http://localhost:5141/api/usuario',
  'http://localhost:5141/api/ponto',
  'http://localhost:5030/api/usuario'
  // Adicione mais endpoints conforme necessário
];

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  try {
    // Verifica se a URL da requisição corresponde a algum endpoint protegido
    if (endpoints.some(endpoint => req.url.startsWith(endpoint))) {
      // Tenta obter o usuário do localStorage
      const usuario = localStorage.getItem('usuario');

      if (usuario) {
        const usuarioData = JSON.parse(usuario);
        const token = usuarioData.token;

        if (token) {
          // Clona a requisição com o cabeçalho de autenticação
          const authRequest = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`,
            },
          });

          return next(authRequest);
        } else {
          console.warn('Token não encontrado ou inválido');
        }
      } else {
        console.warn('Usuário não encontrado no localStorage. Talvez ainda não tenha sido salvo.');
      }
    }

    // Continua sem modificar a requisição se o endpoint não exigir autenticação
    return next(req);
  } catch (error) {
    console.error('Erro no interceptor de autenticação:', error);
    // Continua a requisição mesmo se houver erro no interceptor
    return next(req);
  }
};
