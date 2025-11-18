// Configuração de ambiente para React Native CLI
// Substitui expo-constants para React Native CLI

// Carregar configurações do app.json ou variáveis de ambiente
// No React Native CLI, precisamos usar require para arquivos JSON ou definir valores diretamente
// Por enquanto, vamos usar valores diretos do app.json para evitar problemas de resolução do Metro
const appConfigExtra = {
  APP_ENV: 'production',
  API_BASE_URL: 'https://api.inpunto.com',
  BLE_UUIDS: '0000110B-0000-1000-8000-00805F9B34FB',
  LOG_LEVEL: 'info',
  LOG_RETENTION_DAYS: 30,
  LOG_MAX_ENTRIES: 10000,
  CLERK_PUBLISHABLE_KEY: 'pk_test_bG95YWwtemVicmEtOTkuY2xlcmsuYWNjb3VudHMuZGV2JA',
  HARDWARE_SIM_EXTERNAL_WS_URL: 'http://192.168.1.14:8081',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: '316827163539-qcfp294tr1ejl6ru3vudhvp33ptq8oq4.apps.googleusercontent.com',
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: '316827163539-o2pfhni8ba0nmlr6rm7jr2v6g9nl9i2p.apps.googleusercontent.com',
};

// Tentar carregar app.json usando require (pode falhar no Metro, então temos fallback)
let appConfig: any = {};
try {
  // Tentar usando caminho relativo
  appConfig = require('../app.json');
} catch (error1) {
  // Se falhar, usar configurações padrão (__dirname não está disponível no React Native)
  console.warn('Não foi possível carregar app.json, usando configurações padrão');
  appConfig = { extra: appConfigExtra };
}

// Extrair configurações do app.json (formato Expo) ou usar variáveis de ambiente
const getConfig = () => {
  // Se app.json tem estrutura Expo, usar extra
  if (appConfig.expo?.extra) {
    return appConfig.expo.extra;
  }
  
  // Se app.json tem estrutura direta (extra no root)
  if (appConfig.extra) {
    return appConfig.extra;
  }

  // Fallback para configurações padrão (process.env não está disponível no React Native)
  return appConfigExtra;
};

const config = getConfig();

export const ENV = {
  APP_ENV: config.APP_ENV || 'development',
  API_BASE_URL: config.API_BASE_URL || 'https://api.inpunto.com',
  BLE_UUIDS: config.BLE_UUIDS || '0000110B-0000-1000-8000-00805F9B34FB',
  LOG_LEVEL: config.LOG_LEVEL || 'debug',
  LOG_RETENTION_DAYS: config.LOG_RETENTION_DAYS || 30,
  LOG_MAX_ENTRIES: config.LOG_MAX_ENTRIES || 10000,
  HARDWARE_SIM_EXTERNAL_WS_URL: config.HARDWARE_SIM_EXTERNAL_WS_URL || null,
  CLERK_PUBLISHABLE_KEY: config.CLERK_PUBLISHABLE_KEY || '',
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: config.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: config.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
} as const;

// Criar um objeto similar ao Constants.expoConfig para compatibilidade
export const Constants = {
  expoConfig: {
    extra: config,
  },
};
