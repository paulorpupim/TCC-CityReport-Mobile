import { encerrarSessaoSeInvalida, obterToken, sair } from '@/services/authService';
import {
  buscarChamado,
  listarAtualizacoes,
  iniciarExecucao,
  listarFotosProblema,
  obterFonteFoto,
  registrarImpedimento,
  solicitarFinalizacao,
  validarFotoSolucao
} from '@/services/chamadoService';
import type { AtualizacaoChamadoDTO, ChamadoResponseDTO, FotoChamadoResponseDTO } from '@/types/chamado';
import axios from 'axios';
import { Image as ImagemRemota } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function mensagemDeErro(erro: unknown): string {
  if (axios.isAxiosError(erro)) {
    const mensagemServidor = erro.response?.data?.erro;
    if (typeof mensagemServidor === 'string' && mensagemServidor.trim()) {
      return mensagemServidor;
    }
    if (erro.response?.status === 403) {
      return 'Este chamado nao esta atribuido a voce.';
    }
    if (erro.response?.status === 404) {
      return 'Chamado nao encontrado.';
    }
    if (!erro.response) {
      return 'Nao foi possivel conectar ao servidor. Confira o Wi-Fi e o Spring Boot.';
    }
    return 'Nao foi possivel concluir a operacao. Tente novamente.';
  }
  return erro instanceof Error ? erro.message : 'Ocorreu um erro inesperado.';
}

function formatarData(valor: string): string {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString('pt-BR');
}

export default function DetalhesChamadoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chamadoId = Number(id);

  const [chamado, setChamado] = useState<ChamadoResponseDTO | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [fotosProblema, setFotosProblema] = useState<FotoChamadoResponseDTO[]>([]);
  const [tokenFotos, setTokenFotos] = useState<string | null>(null);
  const [erroFotos, setErroFotos] = useState('');
  const [mostrarImpedimento, setMostrarImpedimento] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [observacao, setObservacao] = useState('');
  const [atualizacoes, setAtualizacoes] = useState<AtualizacaoChamadoDTO[]>([]);
  const [erroAtualizacoes, setErroAtualizacoes] = useState('');
  const [fotoSelecionada, setFotoSelecionada] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const carregarChamado = useCallback(async (porAtualizacao = false) => {
    if (!Number.isInteger(chamadoId) || chamadoId <= 0) {
      setErro('Numero do chamado invalido.');
      setCarregando(false);
      return;
    }

    if (porAtualizacao) setAtualizando(true);
    else setCarregando(true);
    setErro('');
    setErroFotos('');
    setErroAtualizacoes('');
    setAtualizacoes([]);
    setFotosProblema([]);
    setTokenFotos(null);

    try {
      const detalhes = await buscarChamado(chamadoId);
      setChamado(detalhes);

      // As atualizacoes nao sao o historico completo. Falha aqui nao bloqueia as acoes.
      try {
        setAtualizacoes(await listarAtualizacoes(chamadoId));
      } catch (falhaAtualizacoes) {
        if (await encerrarSessaoSeInvalida(falhaAtualizacoes)) {
          router.replace('/login');
          return;
        }
        setErroAtualizacoes('Nao foi possivel consultar as atualizacoes. Atualize a tela.');
      }

      // Metadados e imagens ficam separados do DTO do chamado.
      // Se as fotos falharem, as operacoes do chamado continuam disponiveis.
      try {
        const fotos = await listarFotosProblema(chamadoId);
        const token = await obterToken();
        if (!token) {
          await sair();
          router.replace('/login');
          return;
        }
        setFotosProblema(fotos);
        setTokenFotos(token);
      } catch (falhaFoto) {
        if (await encerrarSessaoSeInvalida(falhaFoto)) {
          router.replace('/login');
          return;
        }
        setErroFotos('Nao foi possivel carregar as fotos do problema. Atualize a tela.');
      }
    } catch (falha) {
      if (await encerrarSessaoSeInvalida(falha)) {
        router.replace('/login');
        return;
      }
      setErro(mensagemDeErro(falha));
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [chamadoId, router]);

  // Atualiza os detalhes sempre que a tela volta a receber foco.
  useFocusEffect(useCallback(() => {
    void carregarChamado();
  }, [carregarChamado]));

  // Atualiza apenas os destaques apos salvar uma acao, sem recarregar as fotos.
  async function atualizarAtualizacoes() {
    try {
      setAtualizacoes(await listarAtualizacoes(chamadoId));
      setErroAtualizacoes('');
    } catch (falha) {
      if (await encerrarSessaoSeInvalida(falha)) {
        router.replace('/login');
        return;
      }
      setErroAtualizacoes('Nao foi possivel atualizar as informacoes. Arraste a tela para atualizar.');
    }
  }

  // Centraliza o tratamento de respostas e erros das operacoes.
  async function executarAcao(
    requisicao: () => Promise<ChamadoResponseDTO>,
    mensagemSucesso: string
  ) {
    if (processando) return;
    setProcessando(true);

    try {
      const chamadoAtualizado = await requisicao();
      setChamado(chamadoAtualizado);
      setMostrarImpedimento(false);
      setJustificativa('');
      setFotoSelecionada(null);
      setObservacao('');
      void atualizarAtualizacoes();
      Alert.alert('Sucesso', mensagemSucesso);
    } catch (falha) {
      if (await encerrarSessaoSeInvalida(falha)) {
        router.replace('/login');
        return;
      }
      Alert.alert('Nao foi possivel continuar', mensagemDeErro(falha));
    } finally {
      setProcessando(false);
    }
  }

  function iniciarExecucaoFunc() {
    Alert.alert('Iniciar execucao', 'Deseja iniciar o servico neste chamado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Iniciar',
        onPress: () => void executarAcao(
          () => iniciarExecucao(chamadoId),
          'Execucao iniciada.'
        ),
      },
    ]);
  }

  function confirmarImpedimento() {
    const texto = justificativa.trim();
    if (!texto) {
      Alert.alert('Justificativa obrigatoria', 'Descreva o que impediu a execucao.');
      return;
    }
    if (texto.length > 1700) {
      Alert.alert('Texto muito longo', 'Utilize no maximo 1700 caracteres.');
      return;
    }

    Alert.alert('Registrar impedimento', 'O chamado ficara pendente para o atendente.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => void executarAcao(
          () => registrarImpedimento(chamadoId, texto),
          'Impedimento registrado. Aguarde a decisao do atendente.'
        ),
      },
    ]);
  }

  async function escolherFoto(origem: 'camera' | 'galeria') {
    try {
      if (origem === 'camera') {
        const permissao = await ImagePicker.requestCameraPermissionsAsync();
        if (!permissao.granted) {
          Alert.alert('Permissao necessaria', 'Autorize o uso da camera nas configuracoes do celular.');
          return;
        }
      }

      const opcoes: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      };
      const resultado = origem === 'camera'
        ? await ImagePicker.launchCameraAsync(opcoes)
        : await ImagePicker.launchImageLibraryAsync(opcoes);

      if (resultado.canceled || !resultado.assets.length) return;
      const imagem = resultado.assets[0];

      validarFotoSolucao(imagem);
      setFotoSelecionada(imagem);
    } catch (erro) {
      const mensagem = erro instanceof Error
        ? erro.message
        : 'Nao foi possivel selecionar a fotografia.';
      Alert.alert('Fotografia', mensagem);
    }
  }

  function confirmarFinalizacao() {
    if (!fotoSelecionada) {
      Alert.alert('Foto obrigatoria', 'Tire uma foto ou selecione uma imagem da solucao.');
      return;
    }
    try {
      validarFotoSolucao(fotoSelecionada);
    } catch (erro) {
      Alert.alert('Foto invalida', erro instanceof Error ? erro.message : 'Foto invalida.');
      return;
    }

    const fotoConfirmada = fotoSelecionada;
    const observacaoConfirmada = observacao.trim();
    Alert.alert(
      'Enviar para validacao',
      observacaoConfirmada
        ? 'Deseja enviar a foto e a observacao para validacao do atendente?'
        : 'Deseja enviar a foto para validacao do atendente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: () => void executarAcao(
            () => solicitarFinalizacao(chamadoId, fotoConfirmada, observacaoConfirmada),
            'Solucao enviada! Aguarde a validacao do atendente.'
          ),
        },
      ]
    );
  }

  // Abre o trajeto ate a localizacao registrada no chamado.
  // A navegacao e feita pelo aplicativo de mapas do celular, sem
  // solicitar a localizacao do funcionario dentro do CityReport.
  async function abrirNoMapa() {
    if (!chamado) return;

    const latitude = chamado.latitude;
    const longitude = chamado.longitude;

    if (
      latitude == null || longitude == null ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      Alert.alert('Localizacao indisponivel', 'Este chamado nao possui coordenadas validas.');
      return;
    }

    const destino = encodeURIComponent(`${latitude},${longitude}`);
    const url = Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${destino}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erro', 'Nao foi possivel abrir o mapa neste dispositivo.');
    }
  }

  const emExecucao = chamado?.status === 'EM_EXECUCAO';
  const atribuido = chamado?.status === 'ATRIBUIDO';

  return (
    <SafeAreaView style={styles.tela}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => void carregarChamado(true)}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.botaoVoltar}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.textoVoltar}>Voltar aos chamados</Text>
        </Pressable>

        {carregando ? (
          <View style={styles.centro}>
            <ActivityIndicator size="large" color="#1F4892" />
            <Text>Carregando detalhes...</Text>
          </View>
        ) : (
          <>
            {erro ? (
              <View style={styles.bloco}>
                <Text style={styles.erro}>{erro}</Text>
                <Pressable style={styles.botaoSecundario} onPress={() => void carregarChamado()}>
                  <Text>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}

            {chamado ? (
              <>
                <Text style={styles.protocolo}>Protocolo: {chamado.protocolo}</Text>
                <Text style={styles.titulo}>{chamado.titulo}</Text>
                <Text style={styles.status}>Status: {chamado.status.replace(/_/g, ' ')}</Text>

                <View style={styles.bloco}>
                  <Text style={styles.subtitulo}>Informacoes do problema</Text>
                  <Text>Descricao: {chamado.descricao}</Text>
                  <Text>Categoria: {chamado.categoria}</Text>
                  <Text>Prioridade oficial: {chamado.prioridadeOficial ?? 'Nao definida'}</Text>
                  <Text>Urgencia informada: {chamado.urgenciaPercebida}</Text>
                  <Text>Data de criacao: {formatarData(chamado.dataCriacao)}</Text>
                </View>


                {(atualizacoes.length > 0 || erroAtualizacoes) ? (
                  <View style={styles.bloco}>
                    <Text style={styles.subtitulo}>Atualizacoes do chamado</Text>
                    <Text>Ultimo registro de cada assunto ligado a execucao.</Text>
                    {erroAtualizacoes ? <Text style={styles.erro}>{erroAtualizacoes}</Text> : null}
                    {atualizacoes.map((atualizacao) => (
                      <View key={atualizacao.tipo} style={styles.cartaoAtualizacao}>
                        <Text style={styles.tituloAtualizacao}>{atualizacao.titulo}</Text>
                        <Text style={styles.textoAtualizacao}>{atualizacao.texto}</Text>
                        <Text style={styles.dataAtualizacao}>{formatarData(atualizacao.dataHora)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.bloco}>
                  <Text style={styles.subtitulo}>Localizacao</Text>
                  <Text>Endereco: {chamado.endereco || 'Nao informado'}</Text>
                  {chamado.latitude != null && chamado.longitude != null &&
                    Number.isFinite(chamado.latitude) && Number.isFinite(chamado.longitude) &&
                    chamado.latitude >= -90 && chamado.latitude <= 90 &&
                    chamado.longitude >= -180 && chamado.longitude <= 180 ? (
                    <>
                      <Text>Coordenadas: {chamado.latitude}, {chamado.longitude}</Text>
                      <Pressable
                        style={styles.botaoSecundario}
                        accessibilityRole="button"
                        accessibilityLabel="Abrir rota ate o chamado no aplicativo de mapas"
                        onPress={() => void abrirNoMapa()}
                      >
                        <Text>Abrir rota no mapa</Text>
                      </Pressable>
                    </>
                  ) : (
                    <Text>Este chamado nao possui coordenadas para abrir o mapa.</Text>
                  )}
                </View>

                <View style={styles.bloco}>
                  <Text style={styles.subtitulo}>Fotografias do problema</Text>
                  {erroFotos ? <Text style={styles.erro}>{erroFotos}</Text> : null}
                  {!erroFotos && fotosProblema.length === 0 ? (
                    <Text>Nenhuma fotografia do problema registrada.</Text>
                  ) : null}
                  {tokenFotos ? fotosProblema.map((foto, indice) => (
                    <View key={foto.id} style={styles.secaoInterna}>
                      <Text>Foto {indice + 1} - {formatarData(foto.dataEnvio)}</Text>
                      <ImagemRemota
                        source={obterFonteFoto(chamadoId, foto.id, tokenFotos)}
                        style={styles.fotoProblema}
                        contentFit="contain"
                        cachePolicy="none"
                        accessibilityLabel={`Fotografia ${indice + 1} do problema`}
                        onError={(evento) => {
                          // Nao registrar o JWT no console: somente o erro de carregamento.
                          console.warn(`Falha ao exibir a fotografia ${foto.id}:`, evento.error);
                          setErroFotos('Uma ou mais fotografias nao puderam ser exibidas. Confira o console do Expo.');
                        }}
                      />
                    </View>
                  )) : null}
                </View>

                {atribuido ? (
                  <View style={styles.bloco}>
                    <Text style={styles.subtitulo}>Execucao</Text>
                    <Text>Este chamado esta pronto para iniciar.</Text>
                    <Pressable
                      style={[styles.botaoPrincipal, processando && styles.desabilitado]}
                      disabled={processando}
                      onPress={iniciarExecucaoFunc}
                    >
                      <Text style={styles.textoPrincipal}>Iniciar execucao</Text>
                    </Pressable>
                  </View>
                ) : null}

                {emExecucao ? (
                  <View style={styles.bloco}>
                    <Text style={styles.subtitulo}>Execucao em andamento</Text>

                    <Pressable
                      style={styles.botaoSecundario}
                      disabled={processando}
                      onPress={() => setMostrarImpedimento(!mostrarImpedimento)}
                    >
                      <Text>Registrar impedimento</Text>
                    </Pressable>

                    {mostrarImpedimento ? (
                      <View style={styles.secaoInterna}>
                        <Text>Explique o impedimento:</Text>
                        <TextInput
                          style={[styles.campo, styles.campoMultilinha]}
                          multiline
                          maxLength={1700}
                          value={justificativa}
                          onChangeText={setJustificativa}
                          placeholder="Ex.: falta de materiais para realizar o servico"
                          editable={!processando}
                        />
                        <Pressable
                          style={[styles.botaoPrincipal, processando && styles.desabilitado]}
                          disabled={processando}
                          onPress={confirmarImpedimento}
                        >
                          <Text style={styles.textoPrincipal}>Confirmar impedimento</Text>
                        </Pressable>
                      </View>
                    ) : null}

                    <Text style={styles.subtitulo}>Solicitar finalizacao</Text>
                    <Text>Envie uma nova foto da solucao. Se necessario, descreva detalhes do servico realizado.</Text>
                    <View style={styles.acoesFoto}>
                      <Pressable
                        style={styles.botaoSecundario}
                        disabled={processando}
                        onPress={() => void escolherFoto('camera')}
                      >
                        <Text>Tirar foto</Text>
                      </Pressable>
                      <Pressable
                        style={styles.botaoSecundario}
                        disabled={processando}
                        onPress={() => void escolherFoto('galeria')}
                      >
                        <Text>Galeria</Text>
                      </Pressable>
                    </View>

                    {fotoSelecionada ? (
                      <View style={styles.secaoInterna}>
                        <Image
                          source={{ uri: fotoSelecionada.uri }}
                          style={styles.previewFoto}
                          resizeMode="contain"
                          accessibilityLabel="Foto selecionada como evidencia da solucao"
                        />
                        <Text>Foto selecionada.</Text>
                      </View>
                    ) : null}

                    <View style={styles.secaoInterna}>
                      <Text style={styles.subtitulo}>Observacao do servico (opcional)</Text>
                      <TextInput
                        style={[styles.campo, styles.campoMultilinha]}
                        multiline
                        maxLength={1700}
                        value={observacao}
                        onChangeText={setObservacao}
                        placeholder="Ex.: o reparo foi concluido, mas sera preciso acompanhar a area nos proximos dias"
                        editable={!processando}
                        accessibilityLabel="Observacao opcional para a validacao do servico"
                      />
                      <Text style={styles.contadorCaracteres}>{observacao.length}/1700 caracteres</Text>
                      <Text>A observacao sera registrada no historico ao enviar a finalizacao.</Text>
                    </View>

                    <Pressable
                      style={[
                        styles.botaoPrincipal,
                        (processando || !fotoSelecionada) && styles.desabilitado,
                      ]}
                      disabled={processando || !fotoSelecionada}
                      onPress={confirmarFinalizacao}
                    >
                      {processando ? <ActivityIndicator color="#FFFFFF" /> : (
                        <Text style={styles.textoPrincipal}>Enviar para validacao</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}

                {chamado.status === 'PENDENTE' ? (
                  <Text style={styles.aviso}>Execucao pendente. Aguarde a decisao do atendente.</Text>
                ) : null}
                {chamado.status === 'AGUARDANDO_VALIDACAO' ? (
                  <Text style={styles.aviso}>Solucao enviada. Aguarde a validacao do atendente.</Text>
                ) : null}
                {chamado.status === 'RESOLVIDO' ? (
                  <Text style={styles.aviso}>Este chamado foi resolvido.</Text>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#FFFFFF' },
  conteudo: { padding: 20, paddingBottom: 40, gap: 14 },
  botaoVoltar: { paddingVertical: 8, alignSelf: 'flex-start' },
  textoVoltar: { color: '#1F4892', fontWeight: '600' },
  centro: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  protocolo: { color: '#555555' },
  titulo: { fontSize: 24, fontWeight: 'bold' },
  status: { fontWeight: '600' },
  bloco: { borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 6, padding: 15, gap: 10 },
  subtitulo: { fontWeight: 'bold', fontSize: 17 },
  cartaoAtualizacao: {
    borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 6,
    padding: 12, gap: 7,
  },
  tituloAtualizacao: { fontWeight: '600' },
  textoAtualizacao: { lineHeight: 21 },
  dataAtualizacao: { color: '#555555', fontSize: 12 },
  erro: { color: '#BF0811' },
  aviso: { borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 6, padding: 14 },
  campo: { borderWidth: 1, borderColor: '#999999', borderRadius: 6, padding: 12 },
  campoMultilinha: { minHeight: 100, textAlignVertical: 'top' },
  contadorCaracteres: { color: '#555555', fontSize: 12, textAlign: 'right' },
  secaoInterna: { gap: 8 },
  botaoPrincipal: {
    backgroundColor: '#1F4892', borderRadius: 6, padding: 14,
    minHeight: 48, justifyContent: 'center', alignItems: 'center',
  },
  textoPrincipal: { color: '#FFFFFF', fontWeight: 'bold' },
  botaoSecundario: {
    borderWidth: 1, borderColor: '#999999', borderRadius: 6,
    paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center',
  },
  desabilitado: { opacity: 0.55 },
  acoesFoto: { flexDirection: 'row', gap: 8 },
  previewFoto: { width: '100%', height: 200 },
  fotoProblema: { width: '100%', height: 220 },
});
