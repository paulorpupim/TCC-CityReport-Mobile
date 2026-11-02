import { obterToken } from '@/services/authService';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let ativo = true;

    async function verificarLogin() {
      try {
        const token = await obterToken();

        if (ativo) {
          router.replace(token ? '/home' : '/login');
        }
      } catch {
        if (ativo) {
          router.replace('/login');
        }
      }
    }

    void verificarLogin();

    return () => {
      ativo = false;
    };
  }, [router]);

  return (
    <View style={styles.centro}>
      <ActivityIndicator size="large" color="#1F4892" />
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
