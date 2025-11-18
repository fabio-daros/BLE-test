// Substituído expo-sqlite por react-native-sqlite-storage
// import SQLite from 'react-native-sqlite-storage';
// Por enquanto, usando repositório em memória
import { LogEntry, LogsRepository } from '@services/logging/types';
import { memoryLogsRepository } from './memory';

class SQLiteLogsRepository implements LogsRepository {
  private fallbackToMemory = true; // Forçar uso de memória por enquanto

  constructor() {
    console.log(
      'SQLite temporariamente desabilitado, usando repositório em memória'
    );
    // TODO: Implementar quando a API do expo-sqlite v15 estiver documentada
  }

  async save(log: Omit<LogEntry, 'id'>): Promise<number> {
    return memoryLogsRepository.save(log);
  }

  async findById(id: number): Promise<LogEntry | null> {
    return memoryLogsRepository.findById(id);
  }

  async query(opts?: {
    level?: string[];
    tag?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<LogEntry[]> {
    return memoryLogsRepository.query(opts);
  }

  async clear(): Promise<void> {
    return memoryLogsRepository.clear();
  }

  async deleteOldLogs(beforeTimestamp: number): Promise<number> {
    return memoryLogsRepository.deleteOldLogs(beforeTimestamp);
  }

  async getCount(): Promise<number> {
    return memoryLogsRepository.getCount();
  }
}

export const sqliteLogsRepository = new SQLiteLogsRepository();
