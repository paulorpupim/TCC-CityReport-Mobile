import { entrar } from '@/services/authService';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function fazerLogin() {

    if (carregando) return;

    if (!email.trim() || !senha.trim()) {
      Alert.alert('Campos obrigatorios', 'Informe seu e-mail e sua senha.');
      return;
    }

    setCarregando(true);

    try {

      await entrar(email, senha);
      setSenha('');

      router.replace('/home');
    } catch (erro) {
      let mensagem = 'Nao foi possivel realizar o login. Tente novamente.';

      if (axios.isAxiosError(erro)) {
        if (erro.response?.status === 401 || erro.response?.status === 403) {
          mensagem = 'E-mail ou senha invalidos, ou usuario sem permissao.';
        } else if (!erro.response) {
          mensagem =
            'Nao foi possivel conectar ao servidor. Confira o Wi-Fi, o IP no .env e se o Spring Boot esta iniciado.';
        } else {
          mensagem = 'O servidor retornou um erro. Tente novamente.';
        }
      } else if (erro instanceof Error) {

        mensagem = erro.message;
      }

      Alert.alert('Falha no login', mensagem);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formulario}>
          <Text style={styles.titulo}>CityReport</Text>
          <Text style={styles.subtitulo}>Acesso do funcionario</Text>

          <Text style={styles.rotulo}>E-mail</Text>
          <TextInput
            style={styles.campo}
            value={email}
            onChangeText={setEmail}
            placeholder="Digite seu e-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            editable={!carregando}
            accessibilityLabel="E-mail do funcionario"
          />

          <Text style={styles.rotulo}>Senha</Text>
          <TextInput
            style={styles.campo}
            value={senha}
            onChangeText={setSenha}
            placeholder="Digite sua senha"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            onSubmitEditing={() => void fazerLogin()}
            editable={!carregando}
            accessibilityLabel="Senha do funcionario"
          />

          <Pressable
            style={[styles.botao, carregando && styles.botaoDesabilitado]}
            onPress={() => void fazerLogin()}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel="Entrar"
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotao}>Entrar</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  formulario: {
    gap: 10,
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  rotulo: {
    fontSize: 16,
    fontWeight: '500',
  },
  campo: {
    borderWidth: 1,
    borderColor: '#999999',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  botao: {
    backgroundColor: '#1F4892',
    borderRadius: 6,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 50,
    justifyContent: 'center',
  },
  botaoDesabilitado: {
    opacity: 0.6,
  },
  textoBotao: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
