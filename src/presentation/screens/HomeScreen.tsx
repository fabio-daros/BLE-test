import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { colors, spacing } from '@presentation/theme';
import { Button, Card } from '@presentation/components';
import { logger } from '@services/logging';

interface HomeScreenProps {
  onNavigateToLogs: () => void;
  onNavigateToHomeWip: () => void;
  onLogout: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToLogs,
  onNavigateToHomeWip,
  onLogout,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    errorLogs: 0,
  });

  useEffect(() => {
    logger.info('HomeScreen carregada', { screen: 'HomeScreen' }, 'navigation');
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Simular carregamento de estatísticas
      const mockStats = {
        totalLogs: Math.floor(Math.random() * 1000) + 100,
        todayLogs: Math.floor(Math.random() * 50) + 10,
        errorLogs: Math.floor(Math.random() * 20) + 5,
      };
      setStats(mockStats);

      logger.info('Estatísticas carregadas', mockStats, 'home');
    } catch (error: any) {
      logger.error(
        'Erro ao carregar estatísticas',
        { error: error.message },
        'home'
      );
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleTestVoice = () => {
    logger.info('Teste de voz iniciado', {}, 'voice');
    Alert.alert(
      'Voz',
      'Funcionalidade de reconhecimento de voz será implementada em breve!'
    );
  };

  const handleExportLogs = async () => {
    try {
      logger.info('Exportação de logs iniciada', {}, 'export');
      // Aqui seria chamada a função de exportação
      Alert.alert('Sucesso', 'Logs exportados com sucesso!');
    } catch (error: any) {
      logger.error(
        'Erro na exportação de logs',
        { error: error.message },
        'export'
      );
      Alert.alert('Erro', 'Falha na exportação dos logs');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Visão geral do sistema</Text>
      </View>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalLogs}</Text>
          <Text style={styles.statLabel}>Total de Logs</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.todayLogs}</Text>
          <Text style={styles.statLabel}>Logs Hoje</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.errorLogs}</Text>
          <Text style={styles.statLabel}>Erros</Text>
        </Card>
      </View>

      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>

        <Button
          title="Ver Logs"
          onPress={onNavigateToLogs}
          style={styles.actionButton}
        />

        <Button
          title="Tela HomeWip"
          onPress={onNavigateToHomeWip}
          variant="secondary"
          style={styles.actionButton}
        />

        <Button
          title="Testar Voz"
          onPress={handleTestVoice}
          variant="secondary"
          style={styles.actionButton}
        />

        <Button
          title="Exportar Logs"
          onPress={handleExportLogs}
          variant="outline"
          style={styles.actionButton}
        />
      </View>

      <View style={styles.footer}>
        <Button
          title="Sair"
          onPress={onLogout}
          variant="outline"
          size="small"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    padding: spacing.md,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionsContainer: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
