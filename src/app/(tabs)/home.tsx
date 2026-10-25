import { api } from '@/services/api';
import { encerrarSessaoSeInvalida, obterToken, sair } from '@/services/authService';
import type { ChamadoResponseDTO } from '@/types/chamado';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const [chamados, setChamados] = useState<ChamadoResponseDTO[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  // Carrega apenas os chamados do funcionario autenticado.
  // O backend usa o JWT e identifica o funcionario automaticamente.
  const carregarChamados = useCallback(async (atualizacao = false) => {
    if (atualizacao) {
      setAtualizando(true);
    } else {
      setCarregando(true);
    }

    setErro('');

    try {
      const token = await obterToken();

      if (!token) {
        router.replace('/login');
        return;
      }

      const resposta = await api.get<ChamadoResponseDTO[]>('/api/chamados');
      setChamados(resposta.data);
    } catch (error) {
      if (await encerrarSessaoSeInvalida(error)) {
        router.replace('/login');
        return;
      }

      if (axios.isAxiosError(error) && error.response?.status === 403) {
        setErro('Sua conta nao tem permissao para consultar os chamados.');
      } else if (axios.isAxiosError(error) && !error.response) {
        setErro('Nao foi possivel conectar ao servidor. Confira o Wi-Fi e o Spring Boot.');
      } else {
        setErro('Nao foi possivel carregar os chamados. Tente novamente.');
      }
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [router]);

  // Atualiza a lista quando a tela recebe o foco.
  useFocusEffect(
    useCallback(() => {
      void carregarChamados();
    }, [carregarChamados])
  );

  async function fazerLogout() {
    await sair();
    router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.tela}>
      <View style={styles.cabecalho}>
        <View style={styles.titulos}>
          <Text style={styles.titulo}>Meus chamados</Text>
          <Text>Servicos atribuidos a voce</Text>
        </View>

        <Pressable
          style={styles.botaoSair}
          onPress={() => void fazerLogout()}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Text style={styles.textoSair}>Sair</Text>
        </Pressable>
      </View>

      {carregando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#1F4892" />
          <Text>Carregando chamados...</Text>
        </View>
      ) : (
        <FlatList
          data={chamados}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={() => void carregarChamados(true)}
            />
          }
          ListHeaderComponent={
            erro ? <Text style={styles.erro}>{erro}</Text> : null
          }
          ListEmptyComponent={
            erro ? null : (
              <Text style={styles.vazio}>
                Nenhum chamado atribuido a voce no momento.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.cartao}
              onPress={() => router.push({
                pathname: '/chamados/[id]',
                params: { id: String(item.id) },
              })}
              accessibilityRole="button"
              accessibilityLabel={`Abrir chamado numero ${item.id}`}
            >
              <Text style={styles.protocolo}>Chamado #{item.id}</Text>
              <Text style={styles.tituloChamado}>{item.titulo}</Text>
              <Text>Categoria: {item.categoria}</Text>
              <Text>Status: {item.status.replace(/_/g, ' ')}</Text>
              <Text>
                Prioridade: {item.prioridadeOficial ?? 'Nao definida'}
              </Text>
              <Text>Endereco: {item.endereco || 'Nao informado'}</Text>
              <Text style={styles.linkDetalhes}>Ver detalhes</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  cabecalho: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  titulos: {
    flex: 1,
    gap: 4,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  botaoSair: {
    borderWidth: 1,
    borderColor: '#999999',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textoSair: {
    fontWeight: '600',
  },
  lista: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  erro: {
    color: '#BF0811',
    marginBottom: 16,
  },
  vazio: {
    textAlign: 'center',
    marginTop: 30,
  },
  cartao: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  protocolo: {
    fontSize: 12,
  },
  tituloChamado: {
    fontSize: 17,
    fontWeight: '600',
  },
  linkDetalhes: {
    color: '#1F4892',
    fontWeight: '600',
    marginTop: 4,
  },
});
