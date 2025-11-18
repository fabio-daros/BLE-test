import { memoryLogsRepository } from './memory';
import { LogEntry } from '@services/logging/types';

export async function testFallbackSystem() {
  try {
    console.log('🧪 Testando sistema de fallback...');

    // Testar salvamento
    const testLog: Omit<LogEntry, 'id'> = {
      timestamp: Date.now(),
      level: 'info',
      tag: 'fallback-test',
      message: 'Teste do sistema de fallback',
      metadata: { test: true, fallback: 'memory' },
      ctx: { sessionId: 'test-session', deviceId: 'test-device' },
    };

    const id = await memoryLogsRepository.save(testLog);
    console.log('✅ Log salvo com ID:', id);

    // Testar consulta
    const logs = await memoryLogsRepository.query({ tag: 'fallback-test' });
    console.log('✅ Logs consultados:', logs.length);

    // Testar busca por ID
    const foundLog = await memoryLogsRepository.findById(id);
    console.log('✅ Log encontrado por ID:', foundLog ? 'sim' : 'não');

    // Testar contagem
    const count = await memoryLogsRepository.getCount();
    console.log('✅ Total de logs:', count);

    // Limpar logs de teste
    await memoryLogsRepository.clear();
    console.log('✅ Logs de teste limpos');

    console.log('🎉 Sistema de fallback funcionando perfeitamente!');
    return true;
  } catch (error) {
    console.error('❌ Erro no teste do sistema de fallback:', error);
    return false;
  }
}
