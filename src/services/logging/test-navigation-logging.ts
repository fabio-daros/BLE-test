import { logger, sessionContextManager } from './index';

/**
 * Arquivo de teste para demonstrar o sistema de logs de navegação
 * Este arquivo pode ser removido em produção
 */

export const testNavigationLogging = async () => {
  try {
    // Teste 1: Log de inicialização do app
    logger.info(
      'Teste de sistema de logs iniciado',
      {
        testType: 'navigation_logging',
        timestamp: new Date().toISOString(),
      },
      'test'
    );

    // Teste 2: Simular mudança de usuário
    sessionContextManager.updateContext({ userId: 'usuario_teste' });
    logger.updateSessionContext();

    logger.info(
      'Usuário de teste logado',
      {
        userId: 'usuario_teste',
        action: 'login_simulation',
      },
      'test'
    );

    // Teste 3: Simular navegação
    logger.info(
      'Navegação simulada: splash -> login',
      {
        from: 'splash',
        to: 'login',
        trigger: 'test_simulation',
      },
      'navigation'
    );

    // Teste 4: Simular ação do usuário
    logger.info(
      'Ação do usuário simulada',
      {
        action: 'button_press',
        screen: 'login',
        userId: 'usuario_teste',
      },
      'user_action'
    );

    // Teste 5: Verificar contexto da sessão
    const sessionContext = sessionContextManager.getSessionContext();
    logger.info(
      'Contexto da sessão verificado',
      {
        sessionId: sessionContext.sessionId,
        deviceId: sessionContext.deviceId,
        userId: sessionContext.userId,
        platform: sessionContext.platform,
      },
      'test'
    );

    // Teste 6: Simular logout
    sessionContextManager.refreshSession();
    logger.updateSessionContext();

    logger.info(
      'Logout simulado',
      {
        previousUser: 'usuario_teste',
        action: 'logout_simulation',
      },
      'test'
    );

    logger.info(
      'Teste de sistema de logs concluído com sucesso',
      {
        testType: 'navigation_logging',
        timestamp: new Date().toISOString(),
      },
      'test'
    );

    return true;
  } catch (error) {
    logger.error(
      'Erro no teste de sistema de logs',
      {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        testType: 'navigation_logging',
      },
      'test'
    );
    return false;
  }
};
