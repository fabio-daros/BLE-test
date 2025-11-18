// src/services/auth/firebase-functions-service.ts
// Serviço para chamar Firebase Functions para enviar código SMS
// Isso contorna o problema do RecaptchaVerifier no Expo

import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { getFirebaseApp } from './firebase-config';
import { logger } from '@services/logging';

export class FirebaseFunctionsService {
  private static instance: FirebaseFunctionsService;
  private functions: Functions | null = null;

  private constructor() {
    try {
      const app = getFirebaseApp();
      // Usar a região padrão ou configurar uma região específica
      // Se você configurou uma região nas Functions, ajuste aqui
      this.functions = getFunctions(app);
    } catch (error) {
      logger.error('Erro ao inicializar Firebase Functions', { error }, 'auth');
    }
  }

  static getInstance(): FirebaseFunctionsService {
    if (!FirebaseFunctionsService.instance) {
      FirebaseFunctionsService.instance = new FirebaseFunctionsService();
    }
    return FirebaseFunctionsService.instance;
  }

  /**
   * Envia código SMS usando Firebase Functions
   * Requer que você tenha criado uma Cloud Function chamada 'sendPhoneVerificationCode'
   */
  async sendPhoneVerificationCode(phoneNumber: string): Promise<string> {
    try {
      if (!this.functions) {
        throw new Error(
          'Firebase Functions não inicializado. Verifique a configuração.'
        );
      }

      logger.info(
        'Chamando Firebase Function para enviar código SMS',
        { phone: phoneNumber },
        'auth'
      );

      // Chamar a Cloud Function
      const sendCode = httpsCallable(
        this.functions,
        'sendPhoneVerificationCode'
      );
      const result = await sendCode({ phoneNumber });

      // A função deve retornar { verificationId: string }
      const data = result.data as any;

      if (!data?.verificationId) {
        throw new Error(
          'Resposta inválida da função. verificationId não encontrado.'
        );
      }

      logger.info(
        'Código SMS enviado via Firebase Function',
        { phone: phoneNumber, verificationId: data.verificationId },
        'auth'
      );

      return data.verificationId;
    } catch (error: any) {
      logger.error(
        'Erro ao chamar Firebase Function para enviar código',
        {
          error: error.message,
          code: error.code,
        },
        'auth'
      );

      // Se a função não existir, não mostrar erro técnico
      // (isso é esperado sem plano Blaze)
      if (
        error.code === 'functions/not-found' ||
        error.message?.includes('not-found') ||
        error.message?.includes('Function not found')
      ) {
        // Silenciosamente falhar para que o método direto seja tentado
        // ou que o erro de billing seja mostrado
        throw new Error('FUNCTION_NOT_FOUND'); // Código especial para identificar
      }

      throw new Error(
        error.message ||
          'Erro ao enviar código SMS. Verifique se a Firebase Function está configurada corretamente.'
      );
    }
  }
}

export const firebaseFunctionsService = FirebaseFunctionsService.getInstance();
