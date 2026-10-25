import { api } from '@/services/api';
import { obterToken, sair } from '@/services/authService';
import type { ChamadoResponseDTO } from '@/types/chamado';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImagemRemota } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FotoChamadoResponseDTO = {
  id: number;
  tipo: 'PROBLEMA' | 'SOLUCAO';
  dataEnvio: string;
};

const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024; // Mesmo limite do backend: 5 MB.

// O backend aceita apenas arquivos JPG, PNG e WebP reais.
function identificarTipoImagem(foto: ImagePicker.ImagePickerAsset) {
  const nome = foto.fileName ?? foto.uri.split('?')[0];
  const extensao = nome.split('.').pop()?.toLowerCase();
  const tipoInformado = foto.mimeType?.toLowerCase();

  if (tipoInformado === 'image/jpeg' || tipoInformado === 'image/jpg') {
    return { mime: 'image/jpeg', extensao: 'jpg' };
  }
  if (tipoInformado === 'image/png') {
    return { mime: 'image/png', extensao: 'png' };
  }
  if (tipoInformado === 'image/webp') {
    return { mime: 'image/webp', extensao: 'webp' };
  }
  if (tipoInformado) return null;

  if (extensao === 'jpg' || extensao === 'jpeg') {
    return { mime: 'image/jpeg', extensao: 'jpg' };
  }
  if (extensao === 'png') return { mime: 'image/png', extensao: 'png' };
  if (extensao === 'webp') return { mime: 'image/webp', extensao: 'webp' };
  return null;
}

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
    setFotosProblema([]);
    setTokenFotos(null);

    try {
      const resposta = await api.get<ChamadoResponseDTO>(`/api/chamados/${chamadoId}`);
      setChamado(resposta.data);

      // Metadados e imagens ficam separados do DTO do chamado.
      // Se as fotos falharem, as operacoes do chamado continuam disponiveis.
      try {
        const respostaFotos = await api.get<FotoChamadoResponseDTO[]>(
          `/api/chamados/${chamadoId}/fotos`
        );
        const token = await obterToken();
        if (!token) {
          await sair();
          router.replace('/login');
          return;
        }
        setFotosProblema(respostaFotos.data);
        setTokenFotos(token);
      } catch (falhaFoto) {
        if (axios.isAxiosError(falhaFoto) && falhaFoto.response?.status === 401) {
          await sair();
          router.replace('/login');
          return;
        }
        setErroFotos('Nao foi possivel carregar as fotos do problema. Atualize a tela.');
      }
    } catch (falha) {
      if (axios.isAxiosError(falha) && falha.response?.status === 401) {
        await sair();
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

  // Centraliza o tratamento de respostas e erros das operacoes.
  async function executarAcao(
    requisicao: () => Promise<{ data: ChamadoResponseDTO }>,
    mensagemSucesso: string
  ) {
    if (processando) return;
    setProcessando(true);

    try {
      const resposta = await requisicao();
      setChamado(resposta.data);
      setMostrarImpedimento(false);
      setJustificativa('');
      setFotoSelecionada(null);
      Alert.alert('Sucesso', mensagemSucesso);
    } catch (falha) {
      if (axios.isAxiosError(falha) && falha.response?.status === 401) {
        await sair();
        router.replace('/login');
        return;
      }
      Alert.alert('Nao foi possivel continuar', mensagemDeErro(falha));
    } finally {
      setProcessando(false);
    }
  }

  function iniciarExecucao() {
    Alert.alert('Iniciar execucao', 'Deseja iniciar o servico neste chamado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Iniciar',
        onPress: () => void executarAcao(
          () => api.post<ChamadoResponseDTO>(`/api/chamados/${chamadoId}/iniciar`),
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
          () => api.post<ChamadoResponseDTO>(
            `/api/chamados/${chamadoId}/impedimento`,
            { justificativa: texto }
          ),
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

      if (!identificarTipoImagem(imagem)) {
        Alert.alert('Formato nao aceito', 'Selecione uma imagem JPG, PNG ou WebP.');
        return;
      }
      if (imagem.fileSize != null && imagem.fileSize > TAMANHO_MAXIMO_FOTO) {
        Alert.alert('Foto muito grande', 'O arquivo deve ter no maximo 5 MB.');
        return;
      }

      setFotoSelecionada(imagem);
    } catch {
      Alert.alert('Erro', 'Nao foi possivel selecionar a fotografia.');
    }
  }

  function confirmarFinalizacao() {
    if (!fotoSelecionada) {
      Alert.alert('Foto obrigatoria', 'Tire uma foto ou selecione uma imagem da solucao.');
      return;
    }
    const formato = identificarTipoImagem(fotoSelecionada);
    if (!formato) {
      Alert.alert('Formato nao aceito', 'Selecione uma imagem JPG, PNG ou WebP.');
      return;
    }

    Alert.alert('Enviar para validacao', 'Deseja enviar a foto e solicitar a validacao do atendente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Enviar',
        onPress: () => {
          const dados = new FormData();
          // React Native aceita objetos com uri, name e type em FormData.
          // A conversao de tipo e necessaria apenas para a tipagem do TypeScript.
          dados.append('foto', {
            uri: fotoSelecionada.uri,
            name: `solucao_${chamadoId}.${formato.extensao}`,
            type: formato.mime,
          } as unknown as Blob);

          void executarAcao(
            () => api.post<ChamadoResponseDTO>(
              `/api/chamados/${chamadoId}/finalizar`,
              dados
            ),
            'Solucao enviada! Aguarde a validacao do atendente.'
          );
        },
      },
    ]);
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
                <Text style={styles.protocolo}>Chamado #{chamado.id}</Text>
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

                <View style={styles.bloco}>
                  <Text style={styles.subtitulo}>Localizacao</Text>
                  <Text>Endereco: {chamado.endereco || 'Nao informado'}</Text>
                  {chamado.latitude != null && chamado.longitude != null ? (
                    <Text>Coordenadas: {chamado.latitude}, {chamado.longitude}</Text>
                  ) : null}
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
                        source={{
                          uri: `${api.defaults.baseURL?.replace(/\/$/, '')}/api/chamados/${chamadoId}/fotos/${foto.id}/imagem`,
                          headers: { Authorization: `Bearer ${tokenFotos}` },
                        }}
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
                      onPress={iniciarExecucao}
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
                    <Text>Envie uma nova foto mostrando a solucao do problema.</Text>
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
  erro: { color: '#BF0811' },
  aviso: { borderWidth: 1, borderColor: '#CCCCCC', borderRadius: 6, padding: 14 },
  campo: { borderWidth: 1, borderColor: '#999999', borderRadius: 6, padding: 12 },
  campoMultilinha: { minHeight: 100, textAlignVertical: 'top' },
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
