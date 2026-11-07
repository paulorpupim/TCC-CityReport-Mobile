import { alterarMinhaSenha, encerrarSessaoSeInvalida, obterToken, sair } from '@/services/authService';
import { cores, espacamentos, raios, sombras, tipografia } from '@/styles/theme';
import axios from 'axios';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AlterarSenhaScreen() {
  const router = useRouter();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useFocusEffect(useCallback(() => {
    let ativo = true;
    void obterToken().then(token => {
      if (ativo && !token) router.replace('/login');
    }).catch(() => {
      if (ativo) router.replace('/login');
    });
    return () => { ativo = false; };
  }, [router]));

  async function salvarSenha() {
    if (salvando) return;
    setErro('');

    if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
      setErro('Preencha os três campos para continuar.');
      return;
    }
    if (novaSenha.length < 8) {
      setErro('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErro('A confirmação da nova senha não confere.');
      return;
    }
    if (novaSenha === senhaAtual) {
      setErro('A nova senha deve ser diferente da atual.');
      return;
    }

    setSalvando(true);
    try {
      await alterarMinhaSenha(senhaAtual, novaSenha, confirmarNovaSenha);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarNovaSenha('');
      await sair();
      Alert.alert(
        'Senha alterada',
        'Sua senha foi atualizada. Entre novamente usando a nova senha.',
        [{ text: 'Ir para login', onPress: () => router.replace('/login') }],
        { cancelable: false }
      );
    } catch (falha) {
      if (await encerrarSessaoSeInvalida(falha)) {
        router.replace('/login');
        return;
      }
      if (axios.isAxiosError(falha)) {
        const mensagem = falha.response?.data?.mensagem;
        if (typeof mensagem === 'string' && mensagem.trim()) {
          setErro(mensagem);
        } else if (!falha.response) {
          setErro('Não foi possível conectar ao servidor. Verifique sua conexão.');
        } else if (falha.response.status === 400) {
          setErro('Não foi possível alterar a senha. Confira os campos informados.');
        } else {
          setErro('Não foi possível alterar a senha. Tente novamente.');
        }
      } else {
        setErro('Não foi possível concluir a operação. Tente novamente.');
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flexivel}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cabecalho}>
            <Pressable
              onPress={() => router.back()}
              disabled={salvando}
              accessibilityRole="button"
              accessibilityLabel="Voltar para meus atendimentos"
              style={styles.voltar}
            >
              <Text style={styles.voltarTexto}>‹  Voltar</Text>
            </Pressable>
            <Text style={styles.marca}>CITYREPORT • FUNCIONÁRIO</Text>
            <Text style={styles.titulo}>Alterar senha</Text>
            <Text style={styles.subtitulo}>
              Atualize sua senha de acesso ao aplicativo de campo.
            </Text>
          </View>

          <View style={styles.cartao}>
            <Text style={styles.tituloCartao}>Segurança da conta</Text>
            <Text style={styles.descricao}>
              Para proteger sua conta, confirme a senha atual e escolha uma nova com pelo menos 8 caracteres.
            </Text>

            <View style={styles.grupo}>
              <Text style={styles.rotulo}>Senha atual</Text>
              <TextInput
                style={styles.campo}
                value={senhaAtual}
                onChangeText={valor => { setSenhaAtual(valor); setErro(''); }}
                placeholder="Digite sua senha atual"
                placeholderTextColor={cores.placeholder}
                secureTextEntry={!mostrarSenhas}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                editable={!salvando}
                accessibilityLabel="Senha atual"
              />
            </View>

            <View style={styles.grupo}>
              <Text style={styles.rotulo}>Nova senha</Text>
              <TextInput
                style={styles.campo}
                value={novaSenha}
                onChangeText={valor => { setNovaSenha(valor); setErro(''); }}
                placeholder="Digite a nova senha"
                placeholderTextColor={cores.placeholder}
                secureTextEntry={!mostrarSenhas}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!salvando}
                accessibilityLabel="Nova senha"
              />
            </View>

            <View style={styles.grupo}>
              <Text style={styles.rotulo}>Confirmar nova senha</Text>
              <TextInput
                style={styles.campo}
                value={confirmarNovaSenha}
                onChangeText={valor => { setConfirmarNovaSenha(valor); setErro(''); }}
                placeholder="Repita a nova senha"
                placeholderTextColor={cores.placeholder}
                secureTextEntry={!mostrarSenhas}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!salvando}
                accessibilityLabel="Confirmar nova senha"
                onSubmitEditing={() => void salvarSenha()}
                returnKeyType="done"
              />
            </View>

            <Pressable
              onPress={() => setMostrarSenhas(valor => !valor)}
              accessibilityRole="button"
              accessibilityLabel={mostrarSenhas ? 'Ocultar senhas' : 'Mostrar senhas'}
              disabled={salvando}
              style={styles.mostrarSenha}
            >
              <Text style={styles.mostrarSenhaTexto}>
                {mostrarSenhas ? 'Ocultar senhas' : 'Mostrar senhas'}
              </Text>
            </Pressable>

            {!!erro && (
              <View style={styles.avisoErro} accessibilityLiveRegion="polite">
                <Text style={styles.erroTexto}>{erro}</Text>
              </View>
            )}

            <Pressable
              onPress={() => void salvarSenha()}
              disabled={salvando}
              accessibilityRole="button"
              accessibilityLabel="Salvar nova senha"
              style={({ pressed }) => [
                styles.botaoSalvar,
                (pressed || salvando) && styles.botaoSalvarPressionado,
              ]}
            >
              {salvando ? (
                <View style={styles.linhaBotao}>
                  <ActivityIndicator color={cores.noite} />
                  <Text style={styles.botaoSalvarTexto}>Salvando...</Text>
                </View>
              ) : (
                <Text style={styles.botaoSalvarTexto}>Alterar senha</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.rodape}>
            Você precisará entrar novamente após trocar a senha.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  flexivel: { flex: 1 },
  conteudo: { flexGrow: 1, paddingBottom: espacamentos.duplo },
  cabecalho: {
    backgroundColor: cores.marinho,
    paddingHorizontal: espacamentos.maior,
    paddingTop: espacamentos.grande,
    paddingBottom: espacamentos.duplo,
    gap: espacamentos.pequeno,
  },
  voltar: { alignSelf: 'flex-start', paddingVertical: espacamentos.pequeno, paddingRight: espacamentos.medio },
  voltarTexto: { color: cores.superficie, fontSize: tipografia.tamanhos.pequeno, fontWeight: '700' },
  marca: { color: cores.ciano, fontSize: 11, letterSpacing: 1, fontWeight: '800', marginTop: espacamentos.pequeno },
  titulo: { color: cores.superficie, fontSize: tipografia.tamanhos.titulo, fontWeight: '800' },
  subtitulo: { color: '#CCD8E8', fontSize: tipografia.tamanhos.pequeno, lineHeight: 21 },
  cartao: {
    backgroundColor: cores.superficie, borderRadius: raios.grande,
    borderColor: cores.borda, borderWidth: 1, padding: espacamentos.extraGrande,
    marginHorizontal: espacamentos.maior, marginTop: espacamentos.grande,
    gap: espacamentos.grande, ...sombras.cartao,
  },
  tituloCartao: { color: cores.texto, fontSize: 19, fontWeight: '800' },
  descricao: { color: cores.textoSecundario, fontSize: tipografia.tamanhos.pequeno, lineHeight: 21 },
  grupo: { gap: espacamentos.pequeno },
  rotulo: { color: cores.texto, fontSize: tipografia.tamanhos.pequeno, fontWeight: '700' },
  campo: {
    minHeight: 54, backgroundColor: cores.superficie, borderRadius: raios.medio,
    borderWidth: 1.5, borderColor: cores.borda, paddingHorizontal: espacamentos.grande,
    color: cores.texto, fontSize: tipografia.tamanhos.corpo,
  },
  mostrarSenha: { alignSelf: 'flex-end', paddingVertical: espacamentos.minimo },
  mostrarSenhaTexto: { color: cores.link, fontSize: tipografia.tamanhos.auxiliar, fontWeight: '700' },
  avisoErro: { backgroundColor: cores.erroFundo, borderColor: cores.erroBorda,
    borderWidth: 1, borderRadius: raios.aviso, padding: espacamentos.medio },
  erroTexto: { color: cores.erroTexto, fontSize: tipografia.tamanhos.auxiliar, lineHeight: 20 },
  botaoSalvar: {
    backgroundColor: cores.ciano, minHeight: 54, borderRadius: raios.medio,
    alignItems: 'center', justifyContent: 'center', marginTop: espacamentos.pequeno,
    ...sombras.botao,
  },
  botaoSalvarPressionado: { opacity: 0.75 },
  botaoSalvarTexto: { color: cores.noite, fontWeight: '800', fontSize: tipografia.tamanhos.corpo },
  linhaBotao: { flexDirection: 'row', alignItems: 'center', gap: espacamentos.pequeno },
  rodape: { textAlign: 'center', color: cores.textoSecundario,
    fontSize: tipografia.tamanhos.auxiliar, padding: espacamentos.maior, lineHeight: 20 },
});
