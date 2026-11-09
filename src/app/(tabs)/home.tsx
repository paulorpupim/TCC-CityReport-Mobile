import { encerrarSessaoSeInvalida, obterToken, sair } from '@/services/authService';
import { buscarChamadoEmExecucao } from '@/services/chamadoService';
import { cores, espacamentos, raios, sombras, tipografia } from '@/styles/theme';
import type { ChamadoResponseDTO, Prioridade } from '@/types/chamado';
import axios from 'axios';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const nomePrioridade: Record<Prioridade, string> = {
  CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa',
};

function corPrioridade(prioridade: Prioridade | null): string {
  switch (prioridade) {
    case 'CRITICA': return cores.vermelho;
    case 'ALTA': return '#C36A05';
    case 'MEDIA': return '#987000';
    case 'BAIXA': return '#087E59';
    default: return cores.textoSecundario;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const [emExecucao, setEmExecucao] = useState<ChamadoResponseDTO | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const [menuContaAberto, setMenuContaAberto] = useState(false);

  const carregar = useCallback(async (atualizacao = false, ativo: () => boolean = ()  => true) => {
    if (atualizacao) setAtualizando(true);
    else setCarregando(true);
    setErro('');
    try {
      const token = await obterToken();
      if (!token) {
        if (ativo()) router.replace('/login');
        return;
      }
      const resultado = await buscarChamadoEmExecucao();
      if (ativo()) setEmExecucao(resultado);
    } catch (falha) {
      if (await encerrarSessaoSeInvalida(falha)) {
        if (ativo()) router.replace('/login');
        return;
      }
      if (ativo()) {
        setEmExecucao(null);
        setErro(axios.isAxiosError(falha) && !falha.response
          ? 'Não foi possível conectar ao servidor. Confira sua conexão e o Spring Boot.'
          : 'Não foi possível consultar o atendimento em execução.');
      }
    } finally {
      if (ativo()) { setCarregando(false); setAtualizando(false); }
    }
  }, [router]);

  // Atualiza somente o atendimento atual quando voltar de detalhes ou de uma lista.
  useFocusEffect(useCallback(() => {
    let ativo = true;
    void carregar(false, () => ativo);
    return () => { ativo = false; };
  }, [carregar]));

  function abrirChamado(id: number) {
    router.push({ pathname: '/chamados/[id]', params: { id: String(id) } });
  }

  async function fazerLogout() {
    await sair();
    router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      {menuContaAberto && (
        <Pressable
          style={styles.fundoFecharMenu}
          onPress={() => setMenuContaAberto(false)}
          accessibilityLabel="Fechar menu da conta"
          accessibilityRole="button"
        />
      )}
      <View style={styles.cabecalho}>
        <View style={styles.titulos}>
          <Text style={styles.marca}>CITYREPORT <Text style={styles.marcaSecundaria}>• FUNCIONÁRIO</Text></Text>
          <Text style={styles.titulo}>Meus atendimentos</Text>
          <Text style={styles.subtitulo}>Gerencie suas atividades de campo.</Text>
        </View>
        <View style={styles.areaConta}>
          <Pressable
            style={({ pressed }) => [
              styles.botaoConta,
              menuContaAberto && styles.botaoContaAberto,
              pressed && styles.botaoContaPressionado,
            ]}
            onPress={() => setMenuContaAberto(aberto => !aberto)}
            accessibilityRole="button"
            accessibilityLabel="Menu da conta"
            accessibilityHint="Alterar senha ou sair da conta"
            accessibilityState={{ expanded: menuContaAberto }}
          >
            <View style={styles.iconePessoa} accessible={false}>
              <View style={styles.cabecaPessoa} />
              <View style={styles.corpoPessoa} />
            </View>
            <Text style={styles.setaConta}>⌄</Text>
          </Pressable>
          {menuContaAberto && (
            <View style={styles.menuConta}>
              <Text style={styles.rotuloMenu}>MINHA CONTA</Text>
              <Pressable
                style={({ pressed }) => [styles.opcaoMenu, pressed && styles.opcaoPressionada]}
                onPress={() => {
                  setMenuContaAberto(false);
                  router.push('/alterar-senha');
                }}
                accessibilityRole="button"
                accessibilityLabel="Alterar senha"
              >
                <Text style={styles.textoOpcaoMenu}>Alterar senha</Text>
              </Pressable>
              <View style={styles.divisoriaMenu} />
              <Pressable
                style={({ pressed }) => [styles.opcaoMenu, pressed && styles.opcaoPressionada]}
                onPress={() => {
                  setMenuContaAberto(false);
                  void fazerLogout();
                }}
                accessibilityRole="button"
                accessibilityLabel="Sair da conta"
              >
                <Text style={[styles.textoOpcaoMenu, styles.textoOpcaoSair]}>Sair da conta</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={atualizando}
          onRefresh={() => void carregar(true)} tintColor={cores.link} colors={[cores.link]} />}>
        <View style={[styles.secao, styles.secaoExecucao]}>
          <View style={styles.textosSecao}>
            <Text style={[styles.indice, { color: cores.link }]}>01 · ATENDIMENTO ATUAL</Text>
            <Text style={styles.tituloSecao}>Em execução</Text>
            <Text style={styles.descricaoSecao}>O serviço que você está realizando agora.</Text>
          </View>
          {carregando ? (
            <View style={styles.centro}><ActivityIndicator color={cores.link} />
              <Text style={styles.textoVazio}>Consultando atendimento...</Text></View>
          ) : erro ? (
            <View style={styles.avisoErro}>
              <Text style={styles.textoErro}>{erro}</Text>
              <Pressable onPress={() => void carregar()} accessibilityRole="button">
                <Text style={styles.tentarNovamente}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : emExecucao ? (
            <Pressable onPress={() => abrirChamado(emExecucao.id)} accessibilityRole="button"
              accessibilityLabel={`Ver chamado em execução ${emExecucao.protocolo}`}
              style={({ pressed }) => [styles.itemChamado, pressed && styles.itemPressionado]}>
              <View style={styles.linhaProtocolo}>
                <Text style={styles.protocolo}>#{emExecucao.protocolo}</Text>
                <Text style={styles.etiquetaStatus}>EM EXECUÇÃO</Text>
              </View>
              <Text style={styles.tituloChamado}>{emExecucao.titulo}</Text>
              <Text style={styles.informacaoChamado}>{emExecucao.categoria}</Text>
              {!!emExecucao.endereco?.trim() && (
                <Text style={styles.informacaoChamado}>{emExecucao.endereco}</Text>
              )}
              <View style={styles.rodapeChamado}>
                <Text style={[styles.prioridade, { color: corPrioridade(emExecucao.prioridadeOficial) }]}>
                  Prioridade: {emExecucao.prioridadeOficial ? nomePrioridade[emExecucao.prioridadeOficial] : 'Não definida'}
                </Text>
                <Text style={styles.verDetalhes}>Ver detalhes  ›</Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.estadoVazio}>
              <Text style={styles.textoVazio}>Você não possui nenhum chamado em execução no momento.</Text>
            </View>
          )}
        </View>

        <Pressable style={({ pressed }) => [styles.cartaoNavegacao, styles.cartaoAtribuidos, pressed && styles.itemPressionado]}
          accessibilityRole="button" accessibilityLabel="Abrir chamados atribuídos a você"
          onPress={() => router.push('/atribuidos')}>
          <View style={[styles.iconeCartao, { backgroundColor: cores.fundoInfo }]}>
            <Text style={[styles.iconeTexto, { color: cores.link }]}>≡</Text>
          </View>
          <View style={styles.textosNavegacao}>
            <Text style={styles.tituloNavegacao}>Atribuídos a você</Text>
            <Text style={styles.descricaoSecao}>Veja sua fila organizada por prioridade.</Text>
          </View>
          <Text style={styles.seta}>›</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.cartaoNavegacao, styles.cartaoConcluidos, pressed && styles.itemPressionado]}
          accessibilityRole="button" accessibilityLabel="Abrir chamados concluídos"
          onPress={() => router.push('/concluidos')}>
          <View style={[styles.iconeCartao, { backgroundColor: '#E7F8F1' }]}>
            <Text style={[styles.iconeTexto, { color: '#087E59' }]}>✓</Text>
          </View>
          <View style={styles.textosNavegacao}>
            <Text style={styles.tituloNavegacao}>Concluídos</Text>
            <Text style={styles.descricaoSecao}>Consulte serviços aprovados pelo atendente.</Text>
          </View>
          <Text style={styles.seta}>›</Text>
        </Pressable>

        <Text style={styles.dicaAtualizacao}>Puxe a tela para baixo para atualizar o atendimento atual.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  // Mantém o menu sobre a lista ao abrir, sem alterar o layout da página.
  cabecalho: {
    paddingHorizontal: espacamentos.maior, paddingTop: espacamentos.extraGrande,
    paddingBottom: espacamentos.extraGrande, backgroundColor: cores.marinho,
    flexDirection: 'row', alignItems: 'flex-start', gap: espacamentos.pequeno,
    zIndex: 20,
  },
  fundoFecharMenu: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  titulos: { flex: 1, gap: espacamentos.pequeno },
  marca: { color: cores.ciano, fontSize: 11, letterSpacing: 1, fontWeight: '800' },
  marcaSecundaria: { color: '#C1D1E6', fontWeight: '500' },
  titulo: { color: cores.superficie, fontSize: tipografia.tamanhos.titulo, fontWeight: '800' },
  subtitulo: { color: '#CCD8E8', fontSize: tipografia.tamanhos.pequeno, lineHeight: 20 },
  areaConta: { position: 'relative', zIndex: 21 },
  botaoConta: {
    marginTop: espacamentos.minimo,
    width: 58, height: 46,
    borderWidth: 1, borderColor: '#66768D', borderRadius: raios.medio,
    backgroundColor: cores.azulDetalhe,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5,
  },
  botaoContaAberto: { borderColor: cores.ciano, backgroundColor: '#344967' },
  botaoContaPressionado: { backgroundColor: '#344967' },
  iconePessoa: { width: 21, height: 23, justifyContent: 'center', alignItems: 'center' },
  cabecaPessoa: { width: 9, height: 9, borderRadius: 5, backgroundColor: cores.superficie, marginBottom: 2 },
  corpoPessoa: {
    width: 18, height: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10,
    borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
    backgroundColor: cores.superficie,
  },
  setaConta: { color: cores.superficie, fontSize: 17, fontWeight: '700', marginTop: -5 },
  menuConta: {
    position: 'absolute', top: 57, right: 0, width: 216,
    padding: espacamentos.pequeno, borderRadius: raios.medio,
    backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda,
    ...sombras.cartao, zIndex: 22, elevation: 12,
  },
  rotuloMenu: {
    color: cores.textoSecundario, fontSize: tipografia.tamanhos.rodape,
    fontWeight: '800', letterSpacing: 0.6,
    paddingHorizontal: espacamentos.medio, paddingVertical: espacamentos.pequeno,
  },
  opcaoMenu: {
    minHeight: 45, borderRadius: raios.pequeno,
    justifyContent: 'center', paddingHorizontal: espacamentos.medio,
  },
  opcaoPressionada: { backgroundColor: cores.fundoInfo },
  textoOpcaoMenu: { color: cores.texto, fontWeight: '700', fontSize: tipografia.tamanhos.pequeno },
  textoOpcaoSair: { color: cores.erroTexto },
  divisoriaMenu: { borderTopWidth: 1, borderColor: cores.borda, marginVertical: 3 },
  conteudo: { padding: espacamentos.maior, paddingBottom: 48, gap: espacamentos.grande },
  secao: {
    backgroundColor: cores.superficie, borderRadius: raios.grande, borderTopWidth: 4,
    borderWidth: 1, borderColor: cores.borda, padding: espacamentos.grande,
    gap: espacamentos.grande, ...sombras.cartao,
  },
  secaoExecucao: { borderTopColor: cores.link },
  textosSecao: { gap: espacamentos.pequeno },
  indice: { fontSize: tipografia.tamanhos.rodape, letterSpacing: 0.9, fontWeight: '800' },
  tituloSecao: { color: cores.texto, fontSize: 20, lineHeight: 25, fontWeight: '800' },
  descricaoSecao: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.auxiliar, lineHeight: 19 },
  centro: { paddingVertical: 12, alignItems: 'center', gap: espacamentos.pequeno },
  avisoErro: { backgroundColor: cores.erroFundo, borderColor: cores.erroBorda, borderWidth: 1,
    borderRadius: raios.medio, padding: espacamentos.grande, gap: espacamentos.pequeno },
  textoErro: { color: cores.erroTexto, lineHeight: 21 },
  tentarNovamente: { color: cores.link, fontWeight: '700' },
  itemChamado: {
    borderWidth: 1, borderColor: cores.borda, backgroundColor: '#FAFCFF',
    borderRadius: raios.medio, padding: espacamentos.grande, gap: espacamentos.pequeno,
  },
  itemPressionado: { backgroundColor: cores.fundoInfo },
  linhaProtocolo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: espacamentos.pequeno },
  protocolo: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.auxiliar, fontWeight: '600' },
  etiquetaStatus: { color: cores.link, fontSize: 11, fontWeight: '800' },
  tituloChamado: { color: cores.texto, fontSize: tipografia.tamanhos.corpo, fontWeight: '700', lineHeight: 23 },
  informacaoChamado: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.auxiliar },
  rodapeChamado: { marginTop: espacamentos.minimo, borderTopWidth: 1, borderColor: cores.borda,
    paddingTop: espacamentos.medio, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: espacamentos.pequeno },
  prioridade: { fontSize: tipografia.tamanhos.auxiliar, fontWeight: '700' },
  verDetalhes: { color: cores.link, fontSize: tipografia.tamanhos.auxiliar, fontWeight: '700' },
  estadoVazio: { backgroundColor: cores.fundo, borderRadius: raios.medio, padding: espacamentos.grande },
  textoVazio: { color: cores.textoSecundario, lineHeight: 21, fontSize: tipografia.tamanhos.pequeno },
  cartaoNavegacao: { backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda,
    borderRadius: raios.grande, padding: espacamentos.grande, flexDirection: 'row',
    alignItems: 'center', gap: espacamentos.medio, ...sombras.cartao },
  cartaoAtribuidos: { borderLeftWidth: 4, borderLeftColor: '#A66A13' },
  cartaoConcluidos: { borderLeftWidth: 4, borderLeftColor: '#087E59' },
  iconeCartao: { width: 47, height: 47, borderRadius: raios.medio, alignItems: 'center', justifyContent: 'center' },
  iconeTexto: { fontSize: 25, fontWeight: '800' },
  textosNavegacao: { flex: 1, gap: espacamentos.minimo },
  tituloNavegacao: { color: cores.texto, fontSize: tipografia.tamanhos.corpo, fontWeight: '800' },
  seta: { color: cores.link, fontSize: 30, marginBottom: 3 },
  dicaAtualizacao: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.auxiliar,
    textAlign: 'center', paddingBottom: espacamentos.pequeno },
});
