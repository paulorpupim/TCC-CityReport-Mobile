import { entrar } from '@/services/authService';
import { cores, espacamentos, raios, sombras, tipografia } from '@/styles/theme';
import axios from 'axios';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const senhaRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [campoEmFoco, setCampoEmFoco] = useState<'email' | 'senha' | null>(null);
  const [mensagemErro, setMensagemErro] = useState('');

  async function fazerLogin() {
    if (carregando) return;

    if (!email.trim() || !senha.trim()) {
      setMensagemErro('Informe seu e-mail e sua senha para continuar.');
      return;
    }

    setMensagemErro('');
    setCarregando(true);

    try {
      // O authService mantém a responsabilidade pelo login e pelo JWT.
      await entrar(email, senha);
      setSenha('');
      router.replace('/home');
    } catch (erro) {
      let mensagem = 'Não foi possível realizar o login. Tente novamente.';

      if (axios.isAxiosError(erro)) {
        if (erro.response?.status === 401 || erro.response?.status === 403) {
          mensagem = 'E-mail ou senha inválidos, ou usuário sem permissão.';
        } else if (!erro.response) {
          mensagem =
            'Não foi possível conectar ao servidor. Confira o Wi-Fi, o IP no .env e se o Spring Boot está iniciado.';
        } else {
          mensagem = 'O servidor retornou um erro. Tente novamente.';
        }
      } else if (erro instanceof Error) {
        mensagem = erro.message;
      }

      setMensagemErro(mensagem);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={styles.areaFlexivel}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.larguraMaxima}>
            <View style={styles.marca}>
              <Image
                source={require('../../../assets/images/logo/logo.png')}
                style={{ width: 54, height: 54 }}
                resizeMode="contain"
              />
              <View style={styles.marcaTitulos}>
                <Text style={styles.nomeMarca}>
                  CITY<Text style={styles.nomeMarcaDestaque}>REPORT</Text>
                </Text>
                <Text style={styles.marcaDescricao}>PORTAL DO FUNCIONÁRIO</Text>
              </View>
            </View>

            <View style={styles.cartao}>
              <View style={styles.introducao}>
                <View style={styles.identificador}>
                  <View style={styles.indicadorPonto} />
                  <Text style={styles.identificadorTexto}>ACESSO RESTRITO</Text>
                </View>
                <Text style={styles.titulo}>Acesse sua conta</Text>
                <Text style={styles.subtitulo}>
                  Entre para consultar e executar os chamados atribuídos a você.
                </Text>
              </View>

              <View style={styles.formulario}>
                <View style={styles.grupoCampo}>
                  <Text style={styles.rotulo}>E-mail</Text>
                  <TextInput
                    style={[styles.campo, campoEmFoco === 'email' && styles.campoFocado]}
                    value={email}
                    onChangeText={(valor) => {
                      setEmail(valor);
                      if (mensagemErro) setMensagemErro('');
                    }}
                    placeholder="Digite seu e-mail"
                    placeholderTextColor={cores.placeholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="username"
                    returnKeyType="next"
                    onSubmitEditing={() => senhaRef.current?.focus()}
                    onFocus={() => setCampoEmFoco('email')}
                    onBlur={() => setCampoEmFoco(null)}
                    editable={!carregando}
                    accessibilityLabel="E-mail do funcionário"
                  />
                </View>

                <View style={styles.grupoCampo}>
                  <Text style={styles.rotulo}>Senha</Text>
                  <View
                    style={[
                      styles.areaSenha,
                      campoEmFoco === 'senha' && styles.campoFocado,
                    ]}
                  >
                    <TextInput
                      ref={senhaRef}
                      style={styles.entradaSenha}
                      value={senha}
                      onChangeText={(valor) => {
                        setSenha(valor);
                        if (mensagemErro) setMensagemErro('');
                      }}
                      placeholder="Digite sua senha"
                      placeholderTextColor={cores.placeholder}
                      secureTextEntry={!mostrarSenha}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="current-password"
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={() => void fazerLogin()}
                      onFocus={() => setCampoEmFoco('senha')}
                      onBlur={() => setCampoEmFoco(null)}
                      editable={!carregando}
                      accessibilityLabel="Senha do funcionário"
                    />
                    <Pressable
                      style={styles.mostrarSenha}
                      onPress={() => setMostrarSenha((anterior) => !anterior)}
                      disabled={carregando}
                      accessibilityRole="button"
                      accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      <Text style={styles.mostrarSenhaTexto}>
                        {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {mensagemErro ? (
                  <View
                    style={styles.avisoErro}
                    accessibilityLiveRegion="polite"
                    accessible
                    accessibilityLabel={`Erro no login: ${mensagemErro}`}
                  >
                    <Text style={styles.avisoErroTexto}>{mensagemErro}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.botaoEntrar,
                    pressed && !carregando && styles.botaoPressionado,
                    carregando && styles.botaoDesabilitado,
                  ]}
                  onPress={() => void fazerLogin()}
                  disabled={carregando}
                  accessibilityRole="button"
                  accessibilityLabel="Entrar na conta"
                  accessibilityState={{ disabled: carregando, busy: carregando }}
                >
                  {carregando ? (
                    <View style={styles.conteudoBotao}>
                      <ActivityIndicator color={cores.noite} />
                      <Text style={styles.botaoTexto}>Entrando...</Text>
                    </View>
                  ) : (
                    <Text style={styles.botaoTexto}>Entrar</Text>
                  )}
                </Pressable>
              </View>
            </View>

            <Text style={styles.rodape}>
              CityReport · Acesso exclusivo para funcionários de campo
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.fundo,
  },
  areaFlexivel: {
    flex: 1,
  },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: espacamentos.duplo,
  },
  larguraMaxima: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  marca: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: espacamentos.medio,
    marginBottom: 26,
  },
  marcaTitulos: {
    gap: espacamentos.micro,
  },
  nomeMarca: {
    fontSize: tipografia.tamanhos.marca,
    fontWeight: tipografia.pesos.maximo,
    letterSpacing: -0.8,
    color: cores.marinho,
  },
  nomeMarcaDestaque: {
    color: cores.linkDestaque,
  },
  marcaDescricao: {
    color: cores.textoSecundario,
    fontSize: tipografia.tamanhos.micro,
    fontWeight: tipografia.pesos.forte,
    letterSpacing: 1.5,
  },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raios.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 25,
    ...sombras.cartao,
  },
  introducao: {
    marginBottom: 26,
  },
  identificador: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 7,
    borderRadius: raios.pilula,
    backgroundColor: cores.fundoInfo,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 18,
  },
  indicadorPonto: {
    width: 7,
    height: 7,
    borderRadius: raios.ponto,
    backgroundColor: cores.linkDestaque,
  },
  identificadorTexto: {
    color: cores.link,
    fontWeight: tipografia.pesos.extraForte,
    fontSize: tipografia.tamanhos.micro,
    letterSpacing: 1.2,
  },
  titulo: {
    color: cores.noite,
    fontSize: tipografia.tamanhos.titulo,
    fontWeight: tipografia.pesos.extraForte,
    letterSpacing: -0.65,
    marginBottom: 9,
  },
  subtitulo: {
    color: cores.textoSecundario,
    fontSize: tipografia.tamanhos.pequeno,
    lineHeight: 21,
  },
  formulario: {
    gap: 17,
  },
  grupoCampo: {
    gap: espacamentos.pequeno,
  },
  rotulo: {
    fontSize: tipografia.tamanhos.pequeno,
    fontWeight: tipografia.pesos.forte,
    color: cores.noite,
  },
  campo: {
    backgroundColor: cores.superficie,
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: raios.medio,
    minHeight: 54,
    paddingHorizontal: 15,
    color: cores.noite,
    fontSize: tipografia.tamanhos.corpo,
  },
  campoFocado: {
    borderColor: cores.ciano,
    backgroundColor: cores.fundoFoco,
  },
  areaSenha: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: raios.medio,
    backgroundColor: cores.superficie,
  },
  entradaSenha: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: espacamentos.medio,
    minHeight: 50,
    fontSize: tipografia.tamanhos.corpo,
    color: cores.noite,
  },
  mostrarSenha: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 68,
    minHeight: 48,
    paddingRight: espacamentos.medio,
  },
  mostrarSenhaTexto: {
    color: cores.link,
    fontSize: tipografia.tamanhos.auxiliar,
    fontWeight: tipografia.pesos.forte,
  },
  avisoErro: {
    borderWidth: 1,
    borderColor: cores.erroBorda,
    backgroundColor: cores.erroFundo,
    borderRadius: raios.aviso,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  avisoErroTexto: {
    color: cores.erroTexto,
    fontSize: tipografia.tamanhos.auxiliar,
    lineHeight: 19,
  },
  botaoEntrar: {
    minHeight: 54,
    borderRadius: raios.medio,
    backgroundColor: cores.ciano,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    ...sombras.botao,
  },
  botaoPressionado: {
    backgroundColor: cores.cianoPressionado,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
  conteudoBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  botaoTexto: {
    fontSize: tipografia.tamanhos.corpo,
    fontWeight: tipografia.pesos.extraForte,
    color: cores.noite,
  },
  rodape: {
    textAlign: 'center',
    marginTop: espacamentos.extraGrande,
    color: cores.textoSecundario,
    fontSize: tipografia.tamanhos.rodape,
    lineHeight: 17,
  },
});
