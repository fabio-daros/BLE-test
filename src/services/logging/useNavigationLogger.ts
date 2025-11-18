import { useEffect, useRef } from 'react';
import { logger } from './logger';

interface UseNavigationLoggerOptions {
  screenName: string;
  tag?: string;
  additionalContext?: Record<string, any>;
}

export const useNavigationLogger = ({
  screenName,
  tag = 'navigation',
  additionalContext = {},
}: UseNavigationLoggerOptions) => {
  const hasLoggedMount = useRef(false);
  const hasLoggedUnmount = useRef(false);

  useEffect(() => {
    if (!hasLoggedMount.current) {
      logger.info(
        `Tela ${screenName} carregada`,
        {
          screen: screenName,
          action: 'mount',
          timestamp: new Date().toISOString(),
          ...additionalContext,
        },
        tag
      );
      hasLoggedMount.current = true;
    }

    return () => {
      if (!hasLoggedUnmount.current) {
        logger.info(
          `Tela ${screenName} descarregada`,
          {
            screen: screenName,
            action: 'unmount',
            timestamp: new Date().toISOString(),
            ...additionalContext,
          },
          tag
        );
        hasLoggedUnmount.current = true;
      }
    };
  }, [screenName, tag, additionalContext]);

  const logNavigation = (
    action: string,
    targetScreen?: string,
    metadata?: Record<string, any>
  ) => {
    logger.info(
      `Navegação: ${action}${targetScreen ? ` para ${targetScreen}` : ''}`,
      {
        screen: screenName,
        action,
        targetScreen,
        timestamp: new Date().toISOString(),
        ...metadata,
        ...additionalContext,
      },
      tag
    );
  };

  const logUserAction = (action: string, metadata?: Record<string, any>) => {
    logger.info(
      `Ação do usuário: ${action}`,
      {
        screen: screenName,
        action,
        timestamp: new Date().toISOString(),
        ...metadata,
        ...additionalContext,
      },
      tag
    );
  };

  return {
    logNavigation,
    logUserAction,
  };
};
