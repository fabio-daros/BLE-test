import { logger } from './logger';

const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

export function patchConsoleWithLogger(): void {
  // Patch console.log -> logger.info
  console.log = (...args: any[]) => {
    const message = args
      .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');

    logger.info(message, { originalArgs: args }, 'console.log');
    originalConsole.log(...args);
  };

  // Patch console.info -> logger.info
  console.info = (...args: any[]) => {
    const message = args
      .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');

    logger.info(message, { originalArgs: args }, 'console.info');
    originalConsole.info(...args);
  };

  // Patch console.warn -> logger.warn
  console.warn = (...args: any[]) => {
    const message = args
      .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');

    logger.warn(message, { originalArgs: args }, 'console.warn');
    originalConsole.warn(...args);
  };

  // Patch console.error -> logger.error
  console.error = (...args: any[]) => {
    const message = args
      .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');

    logger.error(message, { originalArgs: args }, 'console.error');
    originalConsole.error(...args);
  };

  // Patch console.debug -> logger.debug
  console.debug = (...args: any[]) => {
    const message = args
      .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ');

    logger.debug(message, { originalArgs: args }, 'console.debug');
    originalConsole.debug(...args);
  };
}

export function restoreConsole(): void {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
}
