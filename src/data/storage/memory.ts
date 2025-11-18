import { LogEntry, LogsRepository } from '@services/logging/types';

class MemoryLogsRepository implements LogsRepository {
  private logs: LogEntry[] = [];
  private nextId = 1;

  async save(log: Omit<LogEntry, 'id'>): Promise<number> {
    const newLog: LogEntry = {
      ...log,
      id: this.nextId++,
    };

    this.logs.push(newLog);

    // Manter apenas os últimos 1000 logs em memória
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    return newLog.id;
  }

  async findById(id: number): Promise<LogEntry | null> {
    return this.logs.find(log => log.id === id) || null;
  }

  async query(opts?: {
    level?: string[];
    tag?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<LogEntry[]> {
    let filteredLogs = [...this.logs];

    // Filtrar por nível
    if (opts?.level && opts.level.length > 0) {
      filteredLogs = filteredLogs.filter(log =>
        opts.level!.includes(log.level)
      );
    }

    // Filtrar por tag
    if (opts?.tag) {
      filteredLogs = filteredLogs.filter(log => log.tag === opts.tag);
    }

    // Filtrar por timestamp
    if (opts?.from) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= opts.from!);
    }

    if (opts?.to) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= opts.to!);
    }

    // Ordenar por timestamp (mais recente primeiro)
    filteredLogs.sort((a, b) => b.timestamp - a.timestamp);

    // Aplicar offset e limit
    if (opts?.offset) {
      filteredLogs = filteredLogs.slice(opts.offset);
    }

    if (opts?.limit) {
      filteredLogs = filteredLogs.slice(0, opts.limit);
    }

    return filteredLogs;
  }

  async clear(): Promise<void> {
    this.logs = [];
    this.nextId = 1;
  }

  async deleteOldLogs(beforeTimestamp: number): Promise<number> {
    const initialCount = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp >= beforeTimestamp);
    return initialCount - this.logs.length;
  }

  async getCount(): Promise<number> {
    return this.logs.length;
  }
}

export const memoryLogsRepository = new MemoryLogsRepository();
