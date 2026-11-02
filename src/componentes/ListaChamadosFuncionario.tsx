import { encerrarSessaoSeInvalida, obterToken } from '@/services/authService';
import { listarChamadosAtribuidos, listarChamadosConcluidos } from '@/services/chamadoService';
import { cores, espacamentos, raios, sombras, tipografia } from '@/styles/theme';
import type { ChamadoResponseDTO, Prioridade, StatusChamado } from '@/types/chamado';
import axios from 'axios';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TipoLista = 'atribuidos' | 'concluidos';
type Secao = { titulo: string; cor: string; data: ChamadoResponseDTO[] };

const prioridades: { codigo: Prioridade; nome: string; cor: string }[] = [
  { codigo: 'CRITICA', nome: 'Crítica', cor: cores.vermelho },
  { codigo: 'ALTA', nome: 'Alta', cor: '#C36A05' },
  { codigo: 'MEDIA', nome: 'Média', cor: '#987000' },
  { codigo: 'BAIXA', nome: 'Baixa', cor: '#087E59' },
];

const nomeStatus: Partial<Record<StatusChamado, string>> = {
  ATRIBUIDO: 'Atribuído', PENDENTE: 'Pendente',
  AGUARDANDO_VALIDACAO: 'Aguardando validação', RESOLVIDO: 'Concluído',
};

function corPrioridade(valor: Prioridade | null) {
  return prioridades.find((p) => p.codigo === valor)?.cor ?? cores.textoSecundario;
}

function nomePrioridade(valor: Prioridade | null) {
  return prioridades.find((p) => p.codigo === valor)?.nome ?? 'Não definida';
}

function ItemChamado({ chamado, abrir }: { chamado: ChamadoResponseDTO; abrir: (id: number) => void }) {
  return (
    <Pressable onPress={() => abrir(chamado.id)} accessibilityRole="button"
      accessibilityLabel={`Abrir chamado ${chamado.protocolo}`}
      style={({ pressed }) => [styles.item, pressed && styles.pressionado]}>
      <View style={styles.linha}>
        <Text style={styles.protocolo}>#{chamado.protocolo}</Text>
        <Text style={[styles.status, chamado.status === 'RESOLVIDO' && styles.statusConcluido]}>
          {nomeStatus[chamado.status] ?? chamado.status}
        </Text>
      </View>
      <Text style={styles.tituloItem} numberOfLines={2}>{chamado.titulo}</Text>
      <Text style={styles.detalhe} numberOfLines={1}>{chamado.categoria}</Text>
      {!!chamado.endereco?.trim() && <Text style={styles.detalhe} numberOfLines={2}>{chamado.endereco}</Text>}
      <View style={[styles.linha, styles.rodape]}>
        <Text style={[styles.prioridade, { color: corPrioridade(chamado.prioridadeOficial) }]}>
          Prioridade: {nomePrioridade(chamado.prioridadeOficial)}
        </Text>
        <Text style={styles.verDetalhes}>Ver detalhes  ›</Text>
      </View>
    </Pressable>
  );
}

export default function ListaChamadosFuncionario({ tipo }: { tipo: TipoLista }) {
  const router = useRouter();
  const [chamados, setChamados] = useState<ChamadoResponseDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const eAtribuidos = tipo === 'atribuidos';

  const carregar = useCallback(async (atualizacao = false, ativo = () => true) => {
    if (atualizacao) setAtualizando(true);
    else setCarregando(true);
    setErro('');
    try {
      const token = await obterToken();
      if (!token) {
        if (ativo()) router.replace('/login');
        return;
      }
      // Cada lista consulta somente sua propria rota ao receber foco.
      const lista = tipo === 'atribuidos' ? await listarChamadosAtribuidos() : await listarChamadosConcluidos();
      if (ativo()) setChamados(lista);
    } catch (falha) {
      if (await encerrarSessaoSeInvalida(falha)) {
        if (ativo()) router.replace('/login');
        return;
      }
      if (ativo()) {
        setChamados([]);
        setErro(axios.isAxiosError(falha) && !falha.response
          ? 'Não foi possível conectar ao servidor. Confira sua conexão e o Spring Boot.'
          : 'Não foi possível carregar os chamados.');
      }
    } finally {
      if (ativo()) { setCarregando(false); setAtualizando(false); }
    }
  }, [router, tipo]);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    void carregar(false, () => ativo);
    return () => { ativo = false; };
  }, [carregar]));

  const secoes = useMemo<Secao[]>(() => {
    if (!eAtribuidos) return chamados.length
      ? [{ titulo: 'Mais recentes primeiro', cor: '#087E59', data: chamados }]
      : [];
    const resultado = prioridades.map((p) => ({
      titulo: `Prioridade ${p.nome.toLowerCase()}`,
      cor: p.cor,
      data: chamados.filter((c) => c.prioridadeOficial === p.codigo),
    })).filter((s) => s.data.length > 0);
    const naoDefinida = chamados.filter((c) => !c.prioridadeOficial);
    if (naoDefinida.length) resultado.push({ titulo: 'Prioridade não definida', cor: cores.textoSecundario, data: naoDefinida });
    return resultado;
  }, [chamados, eAtribuidos]);

  function abrir(id: number) {
    router.push({ pathname: '/chamados/[id]', params: { id: String(id) } });
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.cabecalho}>
        <Pressable onPress={() => router.replace('/home')} accessibilityRole="button"
          accessibilityLabel="Voltar para meus atendimentos" style={styles.voltar}>
          <Text style={styles.textoVoltar}>‹  Voltar</Text>
        </Pressable>
        <Text style={styles.marca}>CITYREPORT • FUNCIONÁRIO</Text>
        <Text style={styles.tituloPagina}>{eAtribuidos ? 'Atribuídos a você' : 'Concluídos'}</Text>
        <Text style={styles.subtitulo}>
          {eAtribuidos ? 'Chamados pendentes, organizados por prioridade oficial.'
            : 'Serviços que você concluiu e o atendente aprovou.'}
        </Text>
      </View>

      {carregando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={cores.link} />
          <Text style={styles.detalhe}>Carregando chamados...</Text>
        </View>
      ) : (
        <SectionList<ChamadoResponseDTO, Secao>
          sections={erro ? [] : secoes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.conteudo}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshing={atualizando}
          onRefresh={() => void carregar(true)}
          ListHeaderComponent={!erro ? (
            <Text style={styles.resumo}>
              {chamados.length} {chamados.length === 1 ? 'chamado encontrado' : 'chamados encontrados'}
            </Text>
          ) : null}
          renderSectionHeader={({ section }) => section.data.length ? (
            <View style={styles.secaoCabecalho}>
              <View style={[styles.faixa, { backgroundColor: section.cor }]} />
              <Text style={styles.secaoTitulo}>{section.titulo}</Text>
              <Text style={styles.quantidade}>{section.data.length}</Text>
            </View>
          ) : null}
          renderItem={({ item }) => <ItemChamado chamado={item} abrir={abrir} />}
          ItemSeparatorComponent={() => <View style={styles.espacoItem} />}
          SectionSeparatorComponent={() => <View style={styles.espacoSecao} />}
          ListEmptyComponent={
            <View style={erro ? styles.erro : styles.vazio}>
              <Text style={erro ? styles.textoErro : styles.detalhe}>
                {erro || (eAtribuidos
                  ? 'Você não possui chamados aguardando atendimento ou validação.'
                  : 'Nenhum chamado concluído por você até agora.')}
              </Text>
              {!!erro && (
                <Pressable accessibilityRole="button" onPress={() => void carregar()}>
                  <Text style={styles.tentarNovamente}>Tentar novamente</Text>
                </Pressable>
              )}
            </View>
          }
          ListFooterComponent={<Text style={styles.dica}>Puxe para baixo para atualizar a lista.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: { backgroundColor: cores.marinho, padding: espacamentos.maior,
    paddingTop: espacamentos.grande, gap: espacamentos.pequeno },
  voltar: { alignSelf: 'flex-start', borderColor: '#66768D', borderWidth: 1,
    borderRadius: raios.pequeno, paddingVertical: espacamentos.pequeno,
    paddingHorizontal: espacamentos.medio, marginBottom: espacamentos.pequeno },
  textoVoltar: { color: cores.superficie, fontWeight: '700' },
  marca: { color: cores.ciano, fontSize: tipografia.tamanhos.rodape, fontWeight: '800', letterSpacing: 0.9 },
  tituloPagina: { color: cores.superficie, fontSize: tipografia.tamanhos.titulo, fontWeight: '800' },
  subtitulo: { color: '#CCD8E8', fontSize: tipografia.tamanhos.pequeno, lineHeight: 21 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espacamentos.medio },
  conteudo: { padding: espacamentos.maior, paddingBottom: 50 },
  resumo: { color: cores.textoSecundario, marginBottom: espacamentos.grande,
    fontSize: tipografia.tamanhos.pequeno },
  secaoCabecalho: { backgroundColor: cores.superficie, borderColor: cores.borda,
    borderWidth: 1, borderRadius: raios.medio, padding: espacamentos.medio,
    flexDirection: 'row', alignItems: 'center', gap: espacamentos.pequeno, marginBottom: espacamentos.medio },
  faixa: { width: 5, height: 27, borderRadius: raios.ponto },
  secaoTitulo: { color: cores.texto, fontWeight: '800', flex: 1, fontSize: 16 },
  quantidade: { color: cores.textoSecundario, fontWeight: '700' },
  item: { backgroundColor: cores.superficie, borderColor: cores.borda,
    borderWidth: 1, borderRadius: raios.medio, padding: espacamentos.grande,
    gap: espacamentos.pequeno, ...sombras.cartao },
  pressionado: { backgroundColor: cores.fundoInfo },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: espacamentos.pequeno },
  protocolo: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.auxiliar, fontWeight: '600' },
  status: { color: cores.link, fontWeight: '700', fontSize: 11 },
  statusConcluido: { color: '#087E59' },
  tituloItem: { color: cores.texto, fontSize: tipografia.tamanhos.corpo,
    lineHeight: 23, fontWeight: '700' },
  detalhe: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.pequeno, lineHeight: 21 },
  rodape: { borderTopColor: cores.borda, borderTopWidth: 1,
    paddingTop: espacamentos.medio, marginTop: espacamentos.minimo },
  prioridade: { fontSize: tipografia.tamanhos.auxiliar, fontWeight: '700' },
  verDetalhes: { color: cores.link, fontSize: tipografia.tamanhos.auxiliar, fontWeight: '700' },
  espacoItem: { height: espacamentos.medio },
  espacoSecao: { height: espacamentos.grande },
  vazio: { backgroundColor: cores.superficie, borderRadius: raios.medio,
    borderColor: cores.borda, borderWidth: 1, padding: espacamentos.extraGrande },
  erro: { backgroundColor: cores.erroFundo, borderColor: cores.erroBorda,
    borderWidth: 1, borderRadius: raios.medio, padding: espacamentos.grande,
    gap: espacamentos.medio },
  textoErro: { color: cores.erroTexto, lineHeight: 21 },
  tentarNovamente: { color: cores.link, fontWeight: '700' },
  dica: { textAlign: 'center', paddingTop: espacamentos.extraGrande,
    color: cores.textoSecundario, fontSize: tipografia.tamanhos.auxiliar },
});
