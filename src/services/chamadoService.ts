import { api } from './api';
import type { AtualizacaoChamadoDTO, ChamadoResponseDTO, FotoChamadoResponseDTO } from '@/types/chamado';

// As telas chamam estas funcoes, sem precisar conhecer as rotas da API.
// O interceptor de api.ts ja envia o JWT nas requisicoes.

export async function listarChamados(): Promise<ChamadoResponseDTO[]> {
  const resposta = await api.get<ChamadoResponseDTO[]>('/api/chamados');
  return resposta.data;
}

export async function buscarChamado(id: number): Promise<ChamadoResponseDTO> {
  const resposta = await api.get<ChamadoResponseDTO>(`/api/chamados/${id}`);
  return resposta.data;
}

// Consulta apenas as ultimas atualizacoes de execucao autorizadas ao funcionario.
export async function listarAtualizacoes(id: number): Promise<AtualizacaoChamadoDTO[]> {
  const resposta = await api.get<AtualizacaoChamadoDTO[]>(`/api/chamados/${id}/atualizacoes`);
  return resposta.data;
}

export async function iniciarExecucao(id: number): Promise<ChamadoResponseDTO> {
  const resposta = await api.post<ChamadoResponseDTO>(`/api/chamados/${id}/iniciar`);
  return resposta.data;
}

export async function registrarImpedimento(
  id: number,
  justificativa: string
): Promise<ChamadoResponseDTO> {
  const resposta = await api.post<ChamadoResponseDTO>(
    `/api/chamados/${id}/impedimento`,
    { justificativa }
  );
  return resposta.data;
}

// Registra uma observacao no historico sem alterar o status do chamado.
export async function registrarObservacao(
  id: number,
  observacao: string
): Promise<ChamadoResponseDTO> {
  const resposta = await api.post<ChamadoResponseDTO>(
    `/api/chamados/${id}/observacoes`,
    { observacao }
  );
  return resposta.data;
}

export async function listarFotosProblema(id: number): Promise<FotoChamadoResponseDTO[]> {
  const resposta = await api.get<FotoChamadoResponseDTO[]>(`/api/chamados/${id}/fotos`);
  return resposta.data;
}

// Fonte utilizada pelo expo-image. O endpoint exige JWT mesmo para imagens.
export function obterFonteFoto(chamadoId: number, fotoId: number, token: string) {
  const urlBase = api.defaults.baseURL?.replace(/\/$/, '');
  if (!urlBase) {
    throw new Error('URL do backend nao configurada.');
  }
  return {
    uri: `${urlBase}/api/chamados/${chamadoId}/fotos/${fotoId}/imagem`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

// Dados minimos necessarios de uma foto obtida pela camera ou galeria.
// Nao dependemos diretamente da biblioteca de selecao de imagens aqui.
export type ArquivoFoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;

function identificarFormatoImagem(foto: ArquivoFoto): { mime: string; extensao: string } | null {
  const nome = foto.fileName ?? foto.uri.split('?')[0];
  const extensao = nome.split('.').pop()?.toLowerCase();
  const mime = foto.mimeType?.toLowerCase();

  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return { mime: 'image/jpeg', extensao: 'jpg' };
  }
  if (mime === 'image/png') return { mime: 'image/png', extensao: 'png' };
  if (mime === 'image/webp') return { mime: 'image/webp', extensao: 'webp' };
  if (mime) return null;

  if (extensao === 'jpg' || extensao === 'jpeg') {
    return { mime: 'image/jpeg', extensao: 'jpg' };
  }
  if (extensao === 'png') return { mime: 'image/png', extensao: 'png' };
  if (extensao === 'webp') return { mime: 'image/webp', extensao: 'webp' };
  return null;
}

// Reutilizada pela tela ao selecionar a foto e pelo metodo de upload.
export function validarFotoSolucao(foto: ArquivoFoto): void {
  if (!identificarFormatoImagem(foto)) {
    throw new Error('Selecione uma imagem JPG, PNG ou WebP.');
  }
  if (foto.fileSize != null && foto.fileSize > TAMANHO_MAXIMO_FOTO) {
    throw new Error('O arquivo deve ter no maximo 5 MB.');
  }
}

export async function solicitarFinalizacao(
  id: number,
  foto: ArquivoFoto
): Promise<ChamadoResponseDTO> {
  validarFotoSolucao(foto);
  const formato = identificarFormatoImagem(foto)!;
  const dados = new FormData();

  // O React Native aceita um objeto com uri, name e type no FormData.
  // Esta conversao existe apenas por causa da tipagem Web do TypeScript.
  dados.append('foto', {
    uri: foto.uri,
    name: `solucao_${id}.${formato.extensao}`,
    type: formato.mime,
  } as unknown as Blob);

  // Deixar o Axios configurar o multipart/form-data com seu boundary.
  const resposta = await api.post<ChamadoResponseDTO>(
    `/api/chamados/${id}/finalizar`,
    dados
  );
  return resposta.data;
}
