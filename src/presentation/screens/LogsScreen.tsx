import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { colors, spacing } from '@presentation/theme';
import { Button, Card } from '@presentation/components';
import {
  logger,
  LogEntry,
  LogLevel,
  useNavigationLogger,
} from '@services/logging';
import { testSQLiteInitialization } from '@data/storage/test-sqlite';
import { testFallbackSystem } from '@data/storage/fallback-test';
import { hybridLogsRepository } from '@data/storage/hybrid-repository';
import { isSQLiteBlockedStatus } from '@data/storage/sqlite-wrapper';

interface LogsScreenProps {
  onNavigateBack: () => void;
}

export const LogsScreen: React.FC<LogsScreenProps> = ({ onNavigateBack }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [loading, setLoading] = useState(false);

  const { logUserAction } = useNavigationLogger({
    screenName: 'LogsScreen',
    additionalContext: { hasBackAction: true },
  });

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const options = filter !== 'all' ? { level: [filter] } : {};
      const logsData = await logger.query({ ...options, limit: 100 });
      setLogs(logsData);

      logger.info(
        'Logs carregados',
        { count: logsData.length, filter, screen: 'LogsScreen' },
        'logs'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error(
        'Erro ao carregar logs',
        { error: errorMessage, screen: 'LogsScreen' },
        'logs'
      );
      Alert.alert('Erro', 'Falha ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    logUserAction('refresh_logs', { action: 'pull_to_refresh' });
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const handleClearLogs = async () => {
    logUserAction('clear_logs_attempt', { action: 'clear_logs' });
    Alert.alert(
      'Limpar Logs',
      'Tem certeza que deseja limpar todos os logs? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              await logger.clear();
              setLogs([]);
              logger.info(
                'Logs limpos com sucesso',
                { screen: 'LogsScreen' },
                'logs'
              );
              logUserAction('clear_logs_success', { action: 'clear_logs' });
              Alert.alert('Sucesso', 'Logs limpos com sucesso!');
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Erro desconhecido';
              logger.error(
                'Erro ao limpar logs',
                { error: errorMessage, screen: 'LogsScreen' },
                'logs'
              );
              logUserAction('clear_logs_error', {
                action: 'clear_logs',
                error: errorMessage,
              });
              Alert.alert('Erro', 'Falha ao limpar logs');
            }
          },
        },
      ]
    );
  };

  const handleExportLogs = async () => {
    logUserAction('export_logs_attempt', { action: 'export_logs' });
    try {
      await logger.export({ format: 'json' });
      logger.info(
        'Logs exportados com sucesso',
        { screen: 'LogsScreen' },
        'export'
      );
      logUserAction('export_logs_success', {
        action: 'export_logs',
        format: 'json',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error(
        'Erro na exportação de logs',
        { error: errorMessage, screen: 'LogsScreen' },
        'export'
      );
      logUserAction('export_logs_error', {
        action: 'export_logs',
        error: errorMessage,
      });
      Alert.alert('Erro', 'Falha na exportação dos logs');
    }
  };

  const handleTestSQLite = async () => {
    logUserAction('test_sqlite_attempt', { action: 'test_sqlite' });
    try {
      console.log('Iniciando teste do SQLite david...');

      // Verificar se SQLite está bloqueado
      if (isSQLiteBlockedStatus()) {
        logUserAction('test_sqlite_blocked', {
          action: 'test_sqlite',
          status: 'blocked',
        });
        Alert.alert(
          'SQLite Bloqueado',
          '🚫 SQLite está bloqueado devido a problemas de compatibilidade detectados anteriormente.\n\n' +
            'O sistema está usando o repositório em memória como alternativa segura.\n\n' +
            'Isso é normal em dispositivos Android com Hermes Engine que têm problemas com SQLite.exec.'
        );
        return;
      }

      const result = await hybridLogsRepository.testSQLiteFunctionality();

      if (result) {
        logUserAction('test_sqlite_success', {
          action: 'test_sqlite',
          result: true,
        });
        Alert.alert('Sucesso', 'SQLite está funcionando corretamente!');
      } else {
        logUserAction('test_sqlite_warning', {
          action: 'test_sqlite',
          result: false,
        });
        Alert.alert(
          'Aviso',
          'SQLite não está funcionando corretamente. O sistema está usando o repositório em memória como alternativa. Isso é normal em alguns dispositivos Android com Hermes Engine.'
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro no teste do SQLite:', error);
      logUserAction('test_sqlite_error', {
        action: 'test_sqlite',
        error: errorMessage,
      });
      Alert.alert(
        'Erro',
        `Falha ao testar SQLite: ${errorMessage}. O sistema continuará funcionando com o repositório em memória.`
      );
    }
  };

  const handleTestFallback = async () => {
    logUserAction('test_fallback_attempt', { action: 'test_fallback' });
    try {
      console.log('Testando sistema de fallback...');
      const result = await testFallbackSystem();

      if (result) {
        logUserAction('test_fallback_success', {
          action: 'test_fallback',
          result: true,
        });
        Alert.alert(
          'Sucesso',
          'Sistema de fallback funcionando perfeitamente!'
        );
        // Recarregar logs para mostrar o log de teste
        await loadLogs();
      } else {
        logUserAction('test_fallback_error', {
          action: 'test_fallback',
          result: false,
        });
        Alert.alert('Erro', 'Falha no teste do sistema de fallback');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro no teste do fallback:', error);
      logUserAction('test_fallback_error', {
        action: 'test_fallback',
        error: errorMessage,
      });
      Alert.alert('Erro', `Falha no teste do fallback: ${errorMessage}`);
    }
  };

  const handleCheckRepositoryStatus = async () => {
    logUserAction('check_repository_status', {
      action: 'check_repository_status',
    });
    const repositoryType = hybridLogsRepository.getCurrentRepositoryType();
    const isSQLiteWorking =
      await hybridLogsRepository.testSQLiteFunctionality();
    const isBlocked = isSQLiteBlockedStatus();

    let message = `O sistema está usando: ${repositoryType}\n\n`;

    if (isBlocked) {
      message +=
        '🚫 SQLite está BLOQUEADO devido a problemas de compatibilidade.\n\n';
      message +=
        'O sistema está usando o repositório em memória como alternativa segura.';
    } else if (repositoryType === 'SQLite') {
      if (isSQLiteWorking) {
        message += 'SQLite está funcionando corretamente!';
      } else {
        message +=
          '⚠️ ATENÇÃO: SQLite foi selecionado mas não está funcionando corretamente!\n\nO sistema fará fallback automático para memória.';
      }
    } else {
      message += 'Usando repositório em memória como alternativa.';
    }

    Alert.alert('Status do Repositório', message);
  };

  const handleNavigateBack = () => {
    logUserAction('back_button_pressed', { action: 'navigate_back' });
    onNavigateBack();
  };

  const handleFilterChange = (newFilter: LogLevel | 'all') => {
    logUserAction('filter_changed', {
      action: 'change_filter',
      from: filter,
      to: newFilter,
    });
    setFilter(newFilter);
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return colors.error;
      case 'warn':
        return colors.warning;
      case 'info':
        return colors.gold;
      case 'debug':
        return colors.textSecondary;
      default:
        return colors.text;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const renderLogItem = ({ item }: { item: LogEntry }) => (
    <Card style={styles.logItem} padding="small">
      <View style={styles.logHeader}>
        <View style={styles.logLevelContainer}>
          <View
            style={[
              styles.logLevelBadge,
              { backgroundColor: getLevelColor(item.level) },
            ]}
          >
            <Text style={styles.logLevelText}>{item.level.toUpperCase()}</Text>
          </View>
          {item.tag && <Text style={styles.logTag}>#{item.tag}</Text>}
        </View>
        <Text style={styles.logTimestamp}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>

      <Text style={styles.logMessage}>{item.message}</Text>

      {item.metadata && (
        <Text style={styles.logMetadata}>
          {JSON.stringify(item.metadata, null, 2)}
        </Text>
      )}

      {item.ctx &&
        (item.ctx.sessionId || item.ctx.userId || item.ctx.deviceId) && (
          <View style={styles.logContext}>
            {item.ctx.sessionId && (
              <Text style={styles.contextItem}>
                Session: {item.ctx.sessionId}
              </Text>
            )}
            {item.ctx.userId && (
              <Text style={styles.contextItem}>User: {item.ctx.userId}</Text>
            )}
            {item.ctx.deviceId && (
              <Text style={styles.contextItem}>
                Device: {item.ctx.deviceId}
              </Text>
            )}
          </View>
        )}
    </Card>
  );

  const renderFilterButton = (level: LogLevel | 'all', label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === level && styles.filterButtonActive,
      ]}
      onPress={() => handleFilterChange(level)}
    >
      <Text
        style={[
          styles.filterButtonText,
          filter === level && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* ==== HEADER ==== */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleNavigateBack}
            >
              <Text style={styles.backButtonText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Logs do Sistema</Text>
          </View>

          {/* ==== BOTÕES DE AÇÃO ==== */}
          <View style={styles.actionButtons}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCheckRepositoryStatus}
              >
                <Text style={styles.actionButtonText}>Status</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleTestSQLite}
              >
                <Text style={styles.actionButtonText}>Testar SQLite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleTestFallback}
              >
                <Text style={styles.actionButtonText}>Testar Fallback</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleExportLogs}
              >
                <Text style={styles.actionButtonText}>Exportar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.clearButton]}
                onPress={handleClearLogs}
              >
                <Text style={styles.clearButtonText}>Limpar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ==== FILTROS ==== */}
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {renderFilterButton('all', 'Todos')}
            {renderFilterButton('error', 'Erros')}
            {renderFilterButton('warn', 'Avisos')}
            {renderFilterButton('info', 'Info')}
            {renderFilterButton('debug', 'Debug')}
          </ScrollView>
        </View>

        {/* ==== LISTA DE LOGS ==== */}
        <FlatList
          data={logs}
          renderItem={renderLogItem}
          keyExtractor={item => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.logsList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {loading ? 'Carregando logs...' : 'Nenhum log encontrado'}
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundGrayAlt2,
  },
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGrayAlt2,
    paddingTop: Platform.OS === 'android' ? 10 : 0, // Padding muito maior para Android
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderAlt,
    paddingTop: Platform.OS === 'android' ? spacing.lg + 10 : spacing.lg, // Padding extra maior para Android
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  backButtonText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  actionButtons: {
    gap: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.goldBackground,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  actionButtonText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  clearButton: {
    backgroundColor: '#fef2f2',
    borderColor: colors.errorAlt,
  },
  clearButtonText: {
    color: colors.errorAlt,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  filtersContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderAlt,
  },
  filters: {
    flexDirection: 'row',
    padding: spacing.md,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderAlt,
    minWidth: 60,
    minHeight: 36,
    marginRight: spacing.sm,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  filterButtonText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  logsList: {
    padding: spacing.md,
  },
  logItem: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: colors.shadowColor,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  logLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  logLevelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  logLevelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.white,
  },
  logTag: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  logTimestamp: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
    minWidth: 80,
  },
  logMessage: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  logMetadata: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.backgroundGrayAlt2,
    padding: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.sm,
    fontFamily: 'monospace',
  },
  logContext: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  contextItem: {
    fontSize: 10,
    color: colors.textMuted,
    backgroundColor: colors.backgroundGray,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
