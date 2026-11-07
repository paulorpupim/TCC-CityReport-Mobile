import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import { api } from './api';

const CHAVE_TOKEN = 'cityreport_token';

type LoginMobileRequestDTO = {
  email: string;
  senha: string;
};

export type TokenMobileResponseDTO = {
  token: string;
  tipo: string;
  expiraEmSegundos: number;
};

// Autentica o funcionario e salva o token somente depois de um login bem-sucedido.
export async function entrar(
  email: string,
  senha: string
): Promise<TokenMobileResponseDTO> {
  const dados: LoginMobileRequestDTO = {
    email: email.trim(),
    senha,
  };

  const resposta = await api.post<TokenMobileResponseDTO>(
    '/api/auth/login',
    dados
  );

  if (!resposta.data.token) {
    throw new Error('O servidor nao retornou um token de autenticacao.');
  }

  await SecureStore.setItemAsync(CHAVE_TOKEN, resposta.data.token);

  return resposta.data;
}

// Recupera o token salvo para autenticar as proximas chamadas da API.
export async function obterToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CHAVE_TOKEN);
}

// Encerra a sessao local removendo o token do dispositivo.
export async function sair(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_TOKEN);
}

// Confere se um erro de autenticacao exige novo login.
// 401 = token ausente, invalido ou expirado.
// 403 tambem pode significar "chamado de outro funcionario", por isso
// confirmamos a permissao em uma rota geral antes de encerrar a sessao.
export async function encerrarSessaoSeInvalida(erro: unknown): Promise<boolean> {
  if (!axios.isAxiosError(erro)) return false;

  const status = erro.response?.status;

  if (status === 401) {
    await sair();
    return true;
  }

  if (status !== 403) return false;

  try {
    // Esta rota lista somente chamados do proprio funcionario.
    // Se funcionar, a conta esta autorizada e o 403 era pontual.
    await api.get('/api/chamados');
    return false;
  } catch (falhaVerificacao) {
    if (
      axios.isAxiosError(falhaVerificacao) &&
      (falhaVerificacao.response?.status === 401 ||
        falhaVerificacao.response?.status === 403)
    ) {
      // Conta inativa, perfil alterado ou token invalidado.
      await sair();
      return true;
    }

    // Sem conexao/erro 5xx nao deve apagar uma sessao valida.
    return false;
  }
}

// Solicita a troca de senha usando o JWT do proprio funcionario.
// Apos a troca, a tela remove o token local e exige novo login.
export async function alterarMinhaSenha(
  senhaAtual: string,
  novaSenha: string,
  confirmarNovaSenha: string
): Promise<void> {
  await api.post('/api/funcionarios/minha-senha', {
    senhaAtual,
    novaSenha,
    confirmarNovaSenha,
  });
}
