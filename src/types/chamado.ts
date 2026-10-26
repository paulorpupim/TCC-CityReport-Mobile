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

// Metadados das imagens. Os arquivos sao obtidos separadamente com JWT.
export type FotoChamadoResponseDTO = {
  id: number;
  tipo: 'PROBLEMA' | 'SOLUCAO';
  dataEnvio: string;
};
