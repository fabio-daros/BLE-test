import { LogEntry, LogsRepository } from '@services/logging/types';
import { memoryLogsRepository } from './memory';
import { sqliteLogsRepository } from './sqlite';

class HybridLogsRepository implements LogsRepository {
  private repository: LogsRepository;

  constructor() {
    // Por enquanto, usar apenas repositório em memória
    // TODO: Implementar lógica híbrida quando SQLite estiver funcionando
    console.log(
      'Usando repositório em memória (SQLite temporariamente desabilitado)'
    );
    this.repository = memoryLogsRepository;
  }

  async save(log: Omit<LogEntry, 'id'>): Promise<number> {
    return this.repository.save(log);
  }

  async findById(id: number): Promise<LogEntry | null> {
    return this.repository.findById(id);
  }

  async query(opts?: {
    level?: string[];
    tag?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<LogEntry[]> {
    return this.repository.query(opts as any);
  }

  async clear(): Promise<void> {
    return this.repository.clear();
  }

  async deleteOldLogs(beforeTimestamp: number): Promise<number> {
    return this.repository.deleteOldLogs(beforeTimestamp);
  }

  async getCount(): Promise<number> {
    return this.repository.getCount();
  }

  // Método para verificar qual repositório está sendo usado
  getCurrentRepositoryType(): string {
    return 'Memory (SQLite Temporariamente Desabilitado)';
  }

  // Método para verificar se SQLite está realmente funcionando
  async testSQLiteFunctionality(): Promise<boolean> {
    // Por enquanto, retornar false
    console.log('SQLite temporariamente desabilitado');
    return false;
  }
}

export const hybridLogsRepository = new HybridLogsRepository();
