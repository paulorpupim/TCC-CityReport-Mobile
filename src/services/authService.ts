
import * as SecureStore from 'expo-secure-store';

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
