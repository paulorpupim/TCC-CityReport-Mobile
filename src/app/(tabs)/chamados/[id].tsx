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
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { cores, espacamentos, raios, sombras, tipografia } from '@/styles/theme';
import type { Prioridade, StatusChamado } from '@/types/chamado';

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


const rotulosPrioridade: Record<Prioridade, string> = {
  CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa',
};

const coresPrioridade: Record<Prioridade, string> = {
  CRITICA: cores.vermelho, ALTA: '#C36A05', MEDIA: '#987000', BAIXA: '#087E59',
};

const rotulosStatus: Record<StatusChamado, string> = {
  ENVIADO: 'Enviado', AGUARDANDO_INFORMACOES: 'Aguardando informações',
  ABERTO: 'Em aberto', ATRIBUIDO: 'Atribuído', EM_EXECUCAO: 'Em execução',
  PENDENTE: 'Pendente', AGUARDANDO_VALIDACAO: 'Aguardando validação',
  RESOLVIDO: 'Concluído', RECUSADO: 'Recusado', CANCELADO: 'Cancelado', DUPLICADO: 'Duplicado',
};

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

  // Usa o aplicativo de mapas do celular para guiar o funcionario ate o chamado.
  // Sem informar uma origem fixa, o app de mapas usa a localizacao atual
  // do dispositivo quando ela estiver disponivel. Sem permissao extra no CityReport.
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
      : `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving&dir_action=navigate`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Erro', 'Nao foi possivel abrir o mapa neste dispositivo.');
    }
  }

  const emExecucao = chamado?.status === 'EM_EXECUCAO';
  const atribuido = chamado?.status === 'ATRIBUIDO';
  const possuiCoordenadas = Boolean(
    chamado && chamado.latitude != null && chamado.longitude != null &&
    Number.isFinite(chamado.latitude) && Number.isFinite(chamado.longitude) &&
    chamado.latitude >= -90 && chamado.latitude <= 90 &&
    chamado.longitude >= -180 && chamado.longitude <= 180
  );

  const nomeStatus = chamado ? rotulosStatus[chamado.status] : '';
  const prioridade = chamado?.prioridadeOficial ?? null;
  const corDestaque = prioridade ? coresPrioridade[prioridade] : cores.textoSecundario;

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => void carregarChamado(true)}
            colors={[cores.link]}
            tintColor={cores.link}
          />
        }
      >
        <View style={styles.cabecalho}>
          <View style={styles.cabecalhoLinha}>
            <Pressable
              style={({ pressed }) => [styles.botaoVoltar, pressed && styles.voltarPressionado]}
              accessibilityRole="button"
              accessibilityLabel="Voltar para a lista de chamados"
              onPress={() => router.back()}
            >
              <Text style={styles.textoVoltar}>‹  Voltar</Text>
            </Pressable>
            <Text style={styles.marca}>CITYREPORT · FUNCIONÁRIO</Text>
          </View>
          {chamado && !carregando ? (
            <>
              <Text style={styles.protocolo}>CHAMADO #{chamado.protocolo}</Text>
              <Text style={styles.titulo}>{chamado.titulo}</Text>
              <View style={styles.linhaEtiquetas}>
                <View style={styles.etiquetaStatus}>
                  <Text style={styles.etiquetaStatusTexto}>{nomeStatus}</Text>
                </View>
                <View style={styles.etiquetaPrioridade}>
                  <View style={[styles.pontoPrioridade, { backgroundColor: corDestaque }]} />
                  <Text style={styles.etiquetaPrioridadeTexto}>
                    {prioridade ? `Prioridade ${rotulosPrioridade[prioridade]}` : 'Prioridade não definida'}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.protocolo}>ATENDIMENTO DE CAMPO</Text>
              <Text style={styles.titulo}>Detalhes do chamado</Text>
            </>
          )}
        </View>

        {carregando ? (
          <View style={[styles.cartao, styles.carregando]}>
            <ActivityIndicator size="large" color={cores.link} />
            <Text style={styles.textoSecundario}>Carregando detalhes do atendimento...</Text>
          </View>
        ) : erro ? (
          <View style={[styles.cartao, styles.cartaoErro]}>
            <Text style={styles.tituloErro}>Não foi possível carregar</Text>
            <Text style={styles.textoErro}>{erro}</Text>
            <Pressable style={styles.botaoContorno} onPress={() => void carregarChamado()} accessibilityRole="button">
              <Text style={styles.botaoContornoTexto}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : chamado ? (
          <>
            {/* Ações vêm primeiro: o funcionário não precisa procurar o botão no fim da tela. */}
            {atribuido ? (
              <View style={[styles.cartao, styles.cartaoAcao]}>
                <Text style={styles.rotuloSecao}>SUA PRÓXIMA AÇÃO</Text>
                <Text style={styles.tituloCartao}>Iniciar atendimento</Text>
                <Text style={styles.textoSecundario}>
                  Este chamado está atribuído a você e pronto para execução.
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.botaoPrincipal, pressed && styles.botaoPrincipalPressionado, processando && styles.desabilitado]}
                  disabled={processando}
                  accessibilityRole="button"
                  onPress={iniciarExecucaoFunc}
                >
                  {processando ? <ActivityIndicator color={cores.marinho} /> : (
                    <Text style={styles.botaoPrincipalTexto}>Iniciar execução</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {emExecucao ? (
              <>
                <View style={[styles.cartao, styles.cartaoAcao]}>
                  <Text style={styles.rotuloSecao}>ATENDIMENTO EM ANDAMENTO</Text>
                  <Text style={styles.tituloCartao}>Solicitar finalização</Text>
                  <Text style={styles.textoSecundario}>
                    Registre uma fotografia do serviço realizado. Você também pode incluir uma observação para o atendente.
                  </Text>

                  <Text style={styles.rotuloCampo}>Fotografia da solução <Text style={styles.obrigatorio}>*</Text></Text>
                  <View style={styles.botoesFoto}>
                    <Pressable
                      style={({ pressed }) => [styles.botaoEscolhaFoto, pressed && styles.pressionado, processando && styles.desabilitado]}
                      disabled={processando}
                      accessibilityRole="button"
                      onPress={() => void escolherFoto('camera')}
                    >
                      <Text style={styles.botaoEscolhaFotoTexto}>Tirar foto</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.botaoEscolhaFoto, pressed && styles.pressionado, processando && styles.desabilitado]}
                      disabled={processando}
                      accessibilityRole="button"
                      onPress={() => void escolherFoto('galeria')}
                    >
                      <Text style={styles.botaoEscolhaFotoTexto}>Galeria</Text>
                    </Pressable>
                  </View>

                  {fotoSelecionada ? (
                    <View style={styles.previaFotoContainer}>
                      <Image
                        source={{ uri: fotoSelecionada.uri }}
                        style={styles.previaFoto}
                        resizeMode="contain"
                        accessibilityLabel="Fotografia selecionada para comprovar a solução"
                      />
                      <View style={styles.previaRodape}>
                        <Text style={styles.fotoSelecionadaTexto}>✓ Foto selecionada</Text>
                        <Pressable onPress={() => setFotoSelecionada(null)} disabled={processando} accessibilityRole="button">
                          <Text style={styles.removerFoto}>Remover</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.notaFoto}>Selecione uma imagem JPG, PNG ou WebP de até 5 MB.</Text>
                  )}

                  <Text style={styles.rotuloCampo}>Observação do serviço <Text style={styles.opcional}>(opcional)</Text></Text>
                  <TextInput
                    style={[styles.campo, styles.campoMultilinha]}
                    multiline
                    maxLength={1700}
                    value={observacao}
                    onChangeText={setObservacao}
                    placeholder="Descreva detalhes do serviço realizado..."
                    placeholderTextColor={cores.placeholder}
                    editable={!processando}
                    accessibilityLabel="Observação opcional do serviço"
                  />
                  <Text style={styles.contadorCaracteres}>{observacao.length}/1700 caracteres</Text>
                  <Text style={styles.notaFoto}>
                    A observação será registrada no histórico junto com a solicitação de finalização.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.botaoPrincipal,
                      pressed && styles.botaoPrincipalPressionado,
                      (processando || !fotoSelecionada) && styles.desabilitado,
                    ]}
                    disabled={processando || !fotoSelecionada}
                    accessibilityRole="button"
                    onPress={confirmarFinalizacao}
                  >
                    {processando ? <ActivityIndicator color={cores.marinho} /> : (
                      <Text style={styles.botaoPrincipalTexto}>Enviar para validação</Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.cartao}>
                  <Text style={styles.rotuloSecao}>SE HOUVER ALGUM PROBLEMA</Text>
                  <Text style={styles.tituloCartao}>Impedimento na execução</Text>
                  <Text style={styles.textoSecundario}>
                    Não consegue continuar o serviço? Registre o motivo para análise do atendente.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.botaoContorno, pressed && styles.pressionado, processando && styles.desabilitado]}
                    accessibilityRole="button"
                    disabled={processando}
                    onPress={() => setMostrarImpedimento((atual) => !atual)}
                  >
                    <Text style={styles.botaoContornoTexto}>
                      {mostrarImpedimento ? 'Ocultar formulário' : 'Registrar impedimento'}
                    </Text>
                  </Pressable>
                  {mostrarImpedimento ? (
                    <View style={styles.formImpedimento}>
                      <Text style={styles.rotuloCampo}>Motivo do impedimento <Text style={styles.obrigatorio}>*</Text></Text>
                      <TextInput
                        style={[styles.campo, styles.campoMultilinha]}
                        multiline
                        maxLength={1700}
                        value={justificativa}
                        onChangeText={setJustificativa}
                        placeholder="Ex.: ausência de material necessário para o reparo"
                        placeholderTextColor={cores.placeholder}
                        editable={!processando}
                        accessibilityLabel="Justificativa do impedimento"
                      />
                      <Text style={styles.contadorCaracteres}>{justificativa.length}/1700 caracteres</Text>
                      <Pressable
                        style={({ pressed }) => [styles.botaoAlerta, pressed && styles.botaoAlertaPressionado, processando && styles.desabilitado]}
                        disabled={processando}
                        accessibilityRole="button"
                        onPress={confirmarImpedimento}
                      >
                        <Text style={styles.botaoAlertaTexto}>Confirmar impedimento</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            {chamado.status === 'PENDENTE' ? (
              <View style={styles.cartaoEspera}>
                <Text style={styles.esperaTitulo}>Atendimento pendente</Text>
                <Text style={styles.esperaTexto}>O impedimento foi registrado. Aguarde a decisão do atendente antes de continuar.</Text>
              </View>
            ) : null}
            {chamado.status === 'AGUARDANDO_VALIDACAO' ? (
              <View style={styles.cartaoEspera}>
                <Text style={styles.esperaTitulo}>Aguardando validação</Text>
                <Text style={styles.esperaTexto}>A solução foi enviada e está aguardando aprovação do atendente.</Text>
              </View>
            ) : null}
            {chamado.status === 'RESOLVIDO' ? (
              <View style={styles.cartaoResolvido}>
                <Text style={styles.resolvidoTitulo}>✓ Serviço concluído</Text>
                <Text style={styles.resolvidoTexto}>Este chamado foi aprovado e resolvido. Não há novas ações disponíveis.</Text>
              </View>
            ) : null}

            <View style={styles.cartao}>
              <Text style={styles.rotuloSecao}>01 · OCORRÊNCIA</Text>
              <Text style={styles.tituloCartao}>Informações do problema</Text>
              <Text style={styles.rotuloDado}>Descrição</Text>
              <Text style={styles.textoPrincipal}>{chamado.descricao}</Text>
              <View style={styles.separador} />
              <View style={styles.linhaDado}>
                <View style={styles.dadoColuna}>
                  <Text style={styles.rotuloDado}>Categoria</Text>
                  <Text style={styles.valorDado}>{chamado.categoria}</Text>
                </View>
                <View style={styles.dadoColuna}>
                  <Text style={styles.rotuloDado}>Urgência informada</Text>
                  <Text style={styles.valorDado}>{rotulosPrioridade[chamado.urgenciaPercebida]}</Text>
                </View>
              </View>
              <View style={styles.separador} />
              <Text style={styles.rotuloDado}>Criado em</Text>
              <Text style={styles.valorDado}>{formatarData(chamado.dataCriacao)}</Text>
            </View>

            <View style={styles.cartao}>
              <Text style={styles.rotuloSecao}>02 · ENDEREÇO</Text>
              <Text style={styles.tituloCartao}>Localização</Text>
              <Text style={styles.textoPrincipal}>{chamado.endereco?.trim() || 'Endereço não informado.'}</Text>
              {possuiCoordenadas ? (
                <>
                  <Text style={styles.coordenadas}>Coordenadas: {chamado.latitude}, {chamado.longitude}</Text>
                  <Pressable
                    style={({ pressed }) => [styles.botaoContorno, pressed && styles.pressionado]}
                    accessibilityRole="button"
                    accessibilityLabel="Abrir rota até o chamado no aplicativo de mapas"
                    onPress={() => void abrirNoMapa()}
                  >
                    <Text style={styles.botaoContornoTexto}>Traçar rota até o chamado  ↗</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.textoSecundario}>Não há coordenadas disponíveis para abrir o mapa.</Text>
              )}
            </View>

            <View style={styles.cartao}>
              <Text style={styles.rotuloSecao}>03 · REGISTROS</Text>
              <Text style={styles.tituloCartao}>Fotografias do problema</Text>
              {erroFotos ? <Text style={styles.textoErro}>{erroFotos}</Text> : null}
              {!erroFotos && fotosProblema.length === 0 ? (
                <Text style={styles.textoSecundario}>Nenhuma fotografia do problema registrada.</Text>
              ) : null}
              {tokenFotos ? fotosProblema.map((foto, indice) => (
                <View key={foto.id} style={styles.fotoRegistrada}>
                  <Text style={styles.legendaFoto}>Foto {indice + 1} · {formatarData(foto.dataEnvio)}</Text>
                  <ImagemRemota
                    source={obterFonteFoto(chamadoId, foto.id, tokenFotos)}
                    style={styles.fotoProblema}
                    contentFit="contain"
                    cachePolicy="none"
                    accessibilityLabel={`Fotografia ${indice + 1} do problema`}
                    onError={(evento) => {
                      // Não registrar JWT: o cabeçalho de autorização contém dados sensíveis.
                      console.warn(`Falha ao exibir a fotografia ${foto.id}:`, evento.error);
                      setErroFotos('Uma ou mais fotografias não puderam ser exibidas. Confira a conexão.');
                    }}
                  />
                </View>
              )) : null}
            </View>

            {(atualizacoes.length > 0 || erroAtualizacoes) ? (
              <View style={styles.cartao}>
                <Text style={styles.rotuloSecao}>04 · ANDAMENTO</Text>
                <Text style={styles.tituloCartao}>Atualizações do chamado</Text>
                <Text style={styles.textoSecundario}>Último registro de cada assunto relacionado à execução.</Text>
                {erroAtualizacoes ? <Text style={styles.textoErro}>{erroAtualizacoes}</Text> : null}
                {atualizacoes.map((atualizacao) => (
                  <View key={atualizacao.tipo} style={styles.cartaoAtualizacao}>
                    <Text style={styles.tituloAtualizacao}>{atualizacao.titulo}</Text>
                    <Text style={styles.textoPrincipal}>{atualizacao.texto}</Text>
                    <Text style={styles.dataAtualizacao}>{formatarData(atualizacao.dataHora)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingBottom: 52, gap: espacamentos.grande },
  cabecalho: { backgroundColor: cores.marinho, paddingHorizontal: espacamentos.maior,
    paddingTop: espacamentos.grande, paddingBottom: espacamentos.extraGrande, gap: espacamentos.medio },
  cabecalhoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: espacamentos.pequeno, marginBottom: espacamentos.minimo },
  marca: { color: '#BED4EB', fontSize: tipografia.tamanhos.micro, letterSpacing: 0.7, fontWeight: '700' },
  botaoVoltar: { paddingVertical: espacamentos.pequeno, paddingRight: espacamentos.pequeno },
  voltarPressionado: { opacity: 0.7 },
  textoVoltar: { color: cores.ciano, fontWeight: '700', fontSize: tipografia.tamanhos.pequeno },
  protocolo: { color: cores.ciano, fontSize: tipografia.tamanhos.rodape, fontWeight: '800', letterSpacing: 1 },
  titulo: { color: cores.superficie, fontSize: 25, fontWeight: '800', lineHeight: 31 },
  linhaEtiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: espacamentos.pequeno, alignItems: 'center' },
  etiquetaStatus: { backgroundColor: cores.azulDetalhe, borderColor: '#62738D', borderWidth: 1,
    borderRadius: raios.pilula, paddingHorizontal: espacamentos.medio, paddingVertical: 6 },
  etiquetaStatusTexto: { color: cores.superficie, fontSize: 12, fontWeight: '700' },
  etiquetaPrioridade: { backgroundColor: '#FFFFFF', borderRadius: raios.pilula, flexDirection: 'row',
    alignItems: 'center', gap: espacamentos.pequeno, paddingHorizontal: espacamentos.medio, paddingVertical: 7 },
  etiquetaPrioridadeTexto: { color: cores.noite, fontSize: 12, fontWeight: '700' },
  pontoPrioridade: { width: 9, height: 9, borderRadius: raios.pilula },
  carregando: { alignItems: 'center', paddingVertical: 48 },
  cartao: { marginHorizontal: espacamentos.maior, backgroundColor: cores.superficie,
    borderWidth: 1, borderColor: cores.borda, borderRadius: raios.grande,
    padding: espacamentos.grande, gap: espacamentos.medio, ...sombras.cartao },
  cartaoAcao: { borderTopWidth: 4, borderTopColor: cores.link },
  rotuloSecao: { color: cores.link, fontSize: tipografia.tamanhos.rodape, letterSpacing: 0.7, fontWeight: '800' },
  tituloCartao: { color: cores.texto, fontSize: 19, fontWeight: '800', lineHeight: 25 },
  textoPrincipal: { color: cores.texto, fontSize: tipografia.tamanhos.pequeno, lineHeight: 22 },
  textoSecundario: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.auxiliar, lineHeight: 20 },
  rotuloCampo: { color: cores.texto, fontSize: tipografia.tamanhos.pequeno, fontWeight: '700', marginTop: espacamentos.pequeno },
  obrigatorio: { color: cores.vermelho },
  opcional: { color: cores.textoSecundario, fontWeight: '400' },
  campo: { minHeight: 47, borderWidth: 1, borderColor: cores.borda, borderRadius: raios.medio,
    paddingHorizontal: espacamentos.medio, paddingVertical: espacamentos.medio,
    fontSize: tipografia.tamanhos.pequeno, color: cores.texto, backgroundColor: cores.superficie },
  campoMultilinha: { minHeight: 105, textAlignVertical: 'top' },
  contadorCaracteres: { fontSize: tipografia.tamanhos.rodape, textAlign: 'right', color: cores.textoSecundario },
  botaoPrincipal: { minHeight: 50, borderRadius: raios.medio, backgroundColor: cores.ciano,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: espacamentos.grande,
    paddingVertical: espacamentos.medio, marginTop: espacamentos.pequeno },
  botaoPrincipalPressionado: { backgroundColor: cores.cianoPressionado },
  botaoPrincipalTexto: { color: cores.marinho, fontSize: tipografia.tamanhos.pequeno, fontWeight: '800' },
  botaoContorno: { minHeight: 46, borderColor: cores.borda, borderWidth: 1, borderRadius: raios.medio,
    alignItems: 'center', justifyContent: 'center', padding: espacamentos.medio },
  botaoContornoTexto: { color: cores.link, fontSize: tipografia.tamanhos.pequeno, fontWeight: '700' },
  pressionado: { backgroundColor: cores.fundoInfo },
  desabilitado: { opacity: 0.5 },
  botoesFoto: { flexDirection: 'row', gap: espacamentos.pequeno },
  botaoEscolhaFoto: { flex: 1, minHeight: 47, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: cores.borda, borderRadius: raios.medio, paddingHorizontal: espacamentos.pequeno },
  botaoEscolhaFotoTexto: { color: cores.link, fontWeight: '700', fontSize: tipografia.tamanhos.pequeno },
  notaFoto: { fontSize: tipografia.tamanhos.rodape, lineHeight: 17, color: cores.textoSecundario },
  previaFotoContainer: { backgroundColor: cores.fundo, borderRadius: raios.medio,
    borderWidth: 1, borderColor: cores.borda, overflow: 'hidden' },
  previaFoto: { width: '100%', height: 210 },
  previaRodape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: espacamentos.pequeno, padding: espacamentos.medio },
  fotoSelecionadaTexto: { fontSize: tipografia.tamanhos.auxiliar, color: '#087E59', fontWeight: '700' },
  removerFoto: { color: cores.erroTexto, fontSize: tipografia.tamanhos.auxiliar, fontWeight: '700' },
  formImpedimento: { gap: espacamentos.medio, paddingTop: espacamentos.pequeno },
  botaoAlerta: { minHeight: 47, borderWidth: 1, borderColor: '#C9731D', backgroundColor: '#FFF6E9',
    borderRadius: raios.medio, alignItems: 'center', justifyContent: 'center', padding: espacamentos.medio },
  botaoAlertaPressionado: { backgroundColor: '#FFE8CC' },
  botaoAlertaTexto: { color: '#894404', fontSize: tipografia.tamanhos.pequeno, fontWeight: '800' },
  cartaoEspera: { marginHorizontal: espacamentos.maior, backgroundColor: '#FFF8E9', borderWidth: 1,
    borderColor: '#EAD09E', borderRadius: raios.grande, padding: espacamentos.grande, gap: espacamentos.pequeno },
  esperaTitulo: { color: '#8B510B', fontSize: tipografia.tamanhos.corpo, fontWeight: '800' },
  esperaTexto: { color: '#76551E', fontSize: tipografia.tamanhos.pequeno, lineHeight: 21 },
  cartaoResolvido: { marginHorizontal: espacamentos.maior, backgroundColor: '#E7F8F1',
    borderWidth: 1, borderColor: '#B9E5D1', borderRadius: raios.grande,
    padding: espacamentos.grande, gap: espacamentos.pequeno },
  resolvidoTitulo: { color: '#087E59', fontSize: tipografia.tamanhos.corpo, fontWeight: '800' },
  resolvidoTexto: { color: '#24644D', fontSize: tipografia.tamanhos.pequeno, lineHeight: 21 },
  rotuloDado: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.auxiliar, fontWeight: '600' },
  valorDado: { color: cores.texto, fontSize: tipografia.tamanhos.pequeno, fontWeight: '700', lineHeight: 21 },
  separador: { height: 1, backgroundColor: cores.borda },
  linhaDado: { flexDirection: 'row', alignItems: 'flex-start', gap: espacamentos.grande },
  dadoColuna: { flex: 1, gap: espacamentos.minimo },
  coordenadas: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.rodape },
  fotoRegistrada: { backgroundColor: '#FAFCFF', borderRadius: raios.medio, overflow: 'hidden',
    borderWidth: 1, borderColor: cores.borda, paddingTop: espacamentos.medio },
  legendaFoto: { fontSize: tipografia.tamanhos.auxiliar, color: cores.textoSecundario,
    fontWeight: '700', paddingHorizontal: espacamentos.medio },
  fotoProblema: { width: '100%', height: 220, marginTop: espacamentos.pequeno },
  cartaoAtualizacao: { gap: espacamentos.pequeno, padding: espacamentos.medio,
    borderLeftWidth: 3, borderLeftColor: cores.ciano,
    backgroundColor: cores.fundoFoco, borderRadius: raios.pequeno },
  tituloAtualizacao: { color: cores.texto, fontSize: tipografia.tamanhos.pequeno, fontWeight: '800' },
  dataAtualizacao: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.rodape },
  cartaoErro: { backgroundColor: cores.erroFundo, borderColor: cores.erroBorda },
  tituloErro: { color: cores.erroTexto, fontSize: tipografia.tamanhos.corpo, fontWeight: '800' },
  textoErro: { color: cores.erroTexto, fontSize: tipografia.tamanhos.pequeno, lineHeight: 21 },
});
