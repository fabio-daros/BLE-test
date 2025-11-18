import { LogEntry, LogLevel, LogsRepository } from './types';
import { hybridLogsRepository } from '@data/storage/hybrid-repository';
// Substituído expo-file-system por react-native-fs
// Substituído expo-sharing por react-native-share
// import RNFS from 'react-native-fs';
// import Share from 'react-native-share';
// Por enquanto, comentado até instalar as dependências
import { sessionContextManager } from './session-context';

export class LoggerService {
  private context: LogEntry['ctx'] = {};
  private repository: LogsRepository;

  constructor(repository: LogsRepository = hybridLogsRepository) {
    this.repository = repository;
    this.startMaintenanceJob();
    // Inicializa o contexto com informações da sessão
    this.initializeSessionContext();
  }

  private initializeSessionContext(): void {
    const sessionContext = sessionContextManager.getSessionContext();
    this.context = {
      sessionId: sessionContext.sessionId,
      deviceId: sessionContext.deviceId,
      ...(sessionContext.userId && { userId: sessionContext.userId }),
    };
  }

  setContext(ctx: LogEntry['ctx']): void {
    this.context = { ...this.context, ...ctx };
  }

  // Atualiza o contexto da sessão (útil para mudanças de usuário)
  updateSessionContext(): void {
    this.initializeSessionContext();
  }

  async debug(msg: string, meta?: object, tag?: string): Promise<void> {
    await this.log('debug', msg, meta, tag);
  }

  async info(msg: string, meta?: object, tag?: string): Promise<void> {
    await this.log('info', msg, meta, tag);
  }

  async warn(msg: string, meta?: object, tag?: string): Promise<void> {
    await this.log('warn', msg, meta, tag);
  }

  async error(msg: string, meta?: object, tag?: string): Promise<void> {
    await this.log('error', msg, meta, tag);
  }

  private async log(
    level: LogLevel,
    message: string,
    metadata?: object,
    tag?: string
  ): Promise<void> {
    try {
      const logEntry: Omit<LogEntry, 'id'> = {
        timestamp: Date.now(),
        level,
        ...(tag && { tag }),
        message,
        metadata: metadata || null,
        ctx: this.context,
      };

      await this.repository.save(logEntry);

      // Em desenvolvimento, também exibe no console
      if (__DEV__) {
        const consoleMethod =
          level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        console[consoleMethod](`[${tag || 'APP'}] ${message}`, metadata || '');
      }
    } catch (error) {
      // Fallback para console em caso de erro no repositório
      console.error('Erro ao salvar log:', error);
    }
  }

  async query(opts?: {
    level?: LogLevel[];
    tag?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<LogEntry[]> {
    return this.repository.query(opts);
  }

  async clear(): Promise<void> {
    await this.repository.clear();
  }

  async export(opts: { format?: 'json' | 'csv' } = {}): Promise<void> {
    const format = opts.format || 'json';
    const logs = await this.repository.query({ limit: 10000 }); // Limite para exportação

    let content: string;
    let filename: string;

    if (format === 'csv') {
      content = this.convertToCSV(logs);
      filename = `logs_${Date.now()}.csv`;
    } else {
      content = JSON.stringify(logs, null, 2);
      filename = `logs_${Date.now()}.json`;
    }

    const filePath = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(filePath, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Abrir share sheet
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath);
    }
  }

  private convertToCSV(logs: LogEntry[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'Level',
      'Tag',
      'Message',
      'Metadata',
      'SessionID',
      'UserID',
      'DeviceID',
    ];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.id,
        new Date(log.timestamp).toISOString(),
        log.level,
        log.tag || '',
        `"${log.message.replace(/"/g, '""')}"`,
        log.metadata
          ? `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"`
          : '',
        log.ctx?.sessionId || '',
        log.ctx?.userId || '',
        log.ctx?.deviceId || '',
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  private startMaintenanceJob(): void {
    // Limpeza automática de logs antigos (mais de 30 dias)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    setInterval(
      async () => {
        try {
          await this.repository.deleteOldLogs(thirtyDaysAgo);
        } catch (error) {
          console.error('Erro na limpeza automática de logs:', error);
        }
      },
      24 * 60 * 60 * 1000
    ); // Executar a cada 24 horas
  }
}

export const logger = new LoggerService();
