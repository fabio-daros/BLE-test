/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { BleError } from 'react-native-ble-plx';

// ===== DEBUG / FILTRO DE BleError NO console.error =====

const originalConsoleError = console.error;

console.error = (...args) => {
  const [first] = args;

  // Caso especial: erro de promise envolvendo o BleError desconhecido
  if (
    first instanceof Error &&
    typeof first.message === 'string' &&
    first.message.includes(
      'BleError: Unknown error occurred. This is probably a bug! Check reason property.'
    )
  ) {
    console.log(
      '[GLOBAL] Ignorando BleError "Unknown error occurred" não-fatal:',
      first.message
    );
    return; // não chama o original
  }

  // Logs mais ricos para outros BleError
  if (first instanceof BleError || first?.name === 'BleError') {
    try {
      console.log('==================== [BLE GLOBAL ERROR] ====================');
      console.log('message:', first.message);
      console.log('errorCode:', first.errorCode);
      console.log('reason:', first.reason);
      console.log('deviceId:', first.deviceID);
      console.log('serviceUUID:', first.serviceUUID);
      console.log('characteristicUUID:', first.characteristicUUID);
      console.log('============================================================');
    } catch {
      // ignora erro de log
    }
  }

  // qualquer outro erro segue o fluxo normal
  originalConsoleError(...args);
};

// ===== INTERCEPTAR O HANDLER GLOBAL DE ERRO (opcional) =====

const g = global || globalThis;

function installGlobalErrorHandler() {
  if (!g.ErrorUtils || !g.ErrorUtils.getGlobalHandler || !g.ErrorUtils.setGlobalHandler) {
    console.log('[GLOBAL] ErrorUtils não disponível');
    return;
  }

  const previousHandler = g.ErrorUtils.getGlobalHandler
    ? g.ErrorUtils.getGlobalHandler()
    : null;

  const customHandler = (error, isFatal) => {
    const message =
      error && typeof error.message === 'string'
        ? error.message
        : String(error || '');

    // 1) BleError "unknown" (se você quiser manter isso)
    if (message.includes('BleError: Unknown error occurred')) {
      console.log('[GLOBAL] Ignorando BleError desconhecido (não-fatal)');
      return;
    }

    // 2) Erro do WebSocket do Metro (porta 8081) -> SÓ EM DEV
    if (
      __DEV__ &&
      message.includes('Uncaught (in promise') &&
      message.includes('WebSocket') &&
      message.includes(':8081')
    ) {
      console.log('[GLOBAL] Ignorando unhandled promise do WebSocket do Metro');
      return;
    }

    // Qualquer outra coisa: deixa o RN se virar
    if (typeof previousHandler === 'function') {
      previousHandler(error, isFatal);
    } else {
      console.log('[GLOBAL] Erro sem handler padrão:', error, isFatal);
    }
  };

  g.ErrorUtils.setGlobalHandler(customHandler);
  console.log('[GLOBAL] Handler global custom instalado');
}

if (typeof setImmediate === 'function') {
  setImmediate(installGlobalErrorHandler);
} else {
  setTimeout(installGlobalErrorHandler, 0);
}

AppRegistry.registerComponent(appName, () => App);
