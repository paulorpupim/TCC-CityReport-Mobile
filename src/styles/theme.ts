/**
 * Tema visual compartilhado do CityReport Mobile.
 *
 * Este arquivo centraliza os valores usados por várias telas.
 * O StyleSheet específico de cada página continua perto da própria página.
 * Não depende de bibliotecas externas ou de fontes instaladas.
 */

/** Cores institucionais, semânticas e de interface. */
export const cores = {
  // Identidade visual do CityReport
  marinho: '#192231',
  noite: '#0F172A',
  ciano: '#2B9DF4',
  azulDetalhe: '#2A3A52',

  // Situações e prioridades
  vermelho: '#CC0000',
  amarelo: '#FFCC00',
  laranja: '#FF9500',
  verde: '#10B981',

  // Superfícies e textos (o ciano não é usado em links sobre branco)
  fundo: '#F3F6FA',
  superficie: '#FFFFFF',
  texto: '#0F172A',
  textoSecundario: '#5E6D81',
  borda: '#D9E2ED',
  placeholder: '#8896A8',
  link: '#1767A1',
  linkDestaque: '#167DCA',

  // Estados de componentes
  fundoInfo: '#E8F4FF',
  fundoFoco: '#F8FCFF',
  cianoPressionado: '#168BE0',
  erroTexto: '#AC1E2D',
  erroFundo: '#FFF1F2',
  erroBorda: '#FECDD3',
} as const;

/** Escala básica de espaçamento, em pontos de layout do React Native. */
export const espacamentos = {
  micro: 2,
  minimo: 4,
  pequeno: 8,
  medio: 12,
  grande: 16,
  maior: 20,
  extraGrande: 24,
  duplo: 32,
} as const;

/** Arredondamentos reutilizáveis. */
export const raios = {
  ponto: 4,
  pequeno: 8,
  aviso: 11,
  medio: 12,
  emblema: 14,
  grande: 18,
  cartao: 22,
  pilula: 100,
} as const;

/**
 * Escala de tipografia.
 * O aplicativo utiliza a fonte padrão do dispositivo enquanto a Inter
 * não for instalada e carregada nos assets do Expo.
 */
export const tipografia = {
  tamanhos: {
    micro: 10,
    rodape: 11,
    auxiliar: 13,
    pequeno: 14,
    corpo: 16,
    marca: 24,
    titulo: 27,
    simbolo: 29,
  },
  pesos: {
    normal: '400',
    medio: '500',
    forte: '700',
    extraForte: '800',
    maximo: '900',
  },
} as const;

/** Sombras compartilhadas, compatíveis com iOS e Android. */
export const sombras = {
  cartao: {
    shadowColor: cores.noite,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  botao: {
    shadowColor: cores.ciano,
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
