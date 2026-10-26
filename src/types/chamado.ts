export type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type StatusChamado =
  | 'ENVIADO'
  | 'AGUARDANDO_INFORMACOES'
  | 'ABERTO'
  | 'ATRIBUIDO'
  | 'EM_EXECUCAO'
  | 'PENDENTE'
  | 'AGUARDANDO_VALIDACAO'
  | 'RESOLVIDO'
  | 'RECUSADO'
  | 'CANCELADO'
  | 'DUPLICADO';

export type ChamadoResponseDTO = {
  id: number;
  protocolo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  urgenciaPercebida: Prioridade;
  prioridadeOficial: Prioridade | null;
  status: StatusChamado;
  dataCriacao: string;
};

export type AtualizacaoChamadoDTO = {
  tipo: 'IMPEDIMENTO' | 'REPROVACAO_EXECUCAO' | 'OBSERVACAO_EXECUCAO';
  titulo: string;
  texto: string;
  dataHora: string;
};

export type FotoChamadoResponseDTO = {
  id: number;
  tipo: 'PROBLEMA' | 'SOLUCAO';
  dataEnvio: string;
};
