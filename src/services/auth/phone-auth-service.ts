// src/services/auth/phone-auth-service.ts
import {
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  ConfirmationResult,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase-config';
import { logger } from '@services/logging';
import { AuthUser, authService } from './auth-service';
import { firebaseFunctionsService } from './firebase-functions-service';

export interface PhoneAuthResult {
  verificationId: string;
  confirmationResult: ConfirmationResult;
}

export class PhoneAuthService {
  private static instance: PhoneAuthService;
  private confirmationResult: ConfirmationResult | null = null;

  private constructor() {}

  static getInstance(): PhoneAuthService {
    if (!PhoneAuthService.instance) {
      PhoneAuthService.instance = new PhoneAuthService();
    }
    return PhoneAuthService.instance;
  }

  /**
   * Formata número de telefone para o formato internacional
   */
  formatPhoneNumber(phone: string, countryCode: string = '+55'): string {
    // Remove todos os caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');

    // Se já começa com +, retorna como está
    if (phone.startsWith('+')) {
      return phone;
    }

    // Adiciona código do país se não tiver
    if (!cleaned.startsWith(countryCode.replace('+', ''))) {
      return `${countryCode}${cleaned}`;
    }

    return `+${cleaned}`;
  }

  /**
   * Valida formato de telefone
   */
  isValidPhoneNumber(phone: string): boolean {
    // Remove caracteres não numéricos para validação
    const cleaned = phone.replace(/\D/g, '');
    // Telefone deve ter pelo menos 10 dígitos (com código do país)
    return cleaned.length >= 10;
  }

  /**
   * Envia código de verificação para o telefone
   *
   * NOTA: Firebase Phone Auth requer RecaptchaVerifier, que não funciona diretamente
   * no Expo Managed Workflow. Esta implementação usa Firebase Functions como backend.
   *
   * Para funcionar, você precisa criar uma Cloud Function chamada 'sendPhoneVerificationCode'.
   * Veja o arquivo functions/example-send-phone-code.js para um exemplo.
   */
  async sendVerificationCode(phoneNumber: string): Promise<string> {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      if (!this.isValidPhoneNumber(formattedPhone)) {
        throw new Error('Número de telefone inválido. Verifique o formato.');
      }

      logger.info(
        'Enviando código de verificação',
        { phone: formattedPhone },
        'auth'
      );

      // Tentar método direto do Firebase primeiro (funciona com números de teste)
      // Para números de teste configurados no Firebase Console, o Firebase
      // pode funcionar sem RecaptchaVerifier completo
      const auth = getFirebaseAuth();

      try {
        // Criar um RecaptchaVerifier simplificado para números de teste
        // Para números de teste, o Firebase pode aceitar um verifier simplificado
        const recaptchaContainer = {
          render: () => Promise.resolve(),
          clear: () => {},
          verify: () => Promise.resolve('recaptcha-token'),
          _reset: () => {},
          type: 'recaptcha',
        } as any;

        logger.info(
          'Tentando enviar código via Firebase Phone Auth (método direto)',
          { phone: formattedPhone },
          'auth'
        );

        const confirmationResult = await signInWithPhoneNumber(
          auth,
          formattedPhone,
          recaptchaContainer
        );

        this.confirmationResult = confirmationResult;
        logger.info(
          'Código enviado com sucesso! (Número de teste do Firebase)',
          { phone: formattedPhone },
          'auth'
        );

        return confirmationResult.verificationId;
      } catch (directError: any) {
        // Verificar se é erro de billing (número não é de teste)
        if (
          directError.code === 'auth/billing-not-enabled' ||
          directError.message?.includes('billing-not-enabled')
        ) {
          throw new Error('Apenas números de teste são permitidos no momento.');
        }

        // Verificar se é erro de RecaptchaVerifier
        if (
          directError.code === 'auth/app-not-authorized' ||
          directError.message?.includes('recaptcha') ||
          directError.message?.includes('RecaptchaVerifier')
        ) {
          throw new Error('Apenas números de teste são permitidos no momento.');
        }

        // Se não for erro conhecido, tentar Firebase Functions como fallback
        // (mas provavelmente não vai funcionar sem plano Blaze)
        logger.warn(
          'Método direto falhou, tentando Firebase Functions como fallback',
          { error: directError.message, code: directError.code },
          'auth'
        );

        try {
          const verificationId =
            await firebaseFunctionsService.sendPhoneVerificationCode(
              formattedPhone
            );

          logger.info(
            'Código SMS enviado via Firebase Functions',
            { phone: formattedPhone },
            'auth'
          );

          return verificationId;
        } catch (functionsError: any) {
          // Se a função não existir (esperado sem plano Blaze), ignorar e usar erro do método direto
          if (
            functionsError.message === 'FUNCTION_NOT_FOUND' ||
            functionsError.code === 'functions/not-found'
          ) {
            // Ignorar erro de função não encontrada e usar o erro do método direto
            // que já tem mensagem amigável sobre números de teste
            if (
              directError.code === 'auth/billing-not-enabled' ||
              directError.message?.includes('billing-not-enabled')
            ) {
              throw new Error(
                'Apenas números de teste são permitidos no momento.'
              );
            }

            // Se não for erro de billing, mostrar mensagem genérica
            throw new Error(
              'Apenas números de teste são permitidos no momento.'
            );
          }

          // Se for outro erro da função, propagar
          throw functionsError;
        }
      }
    } catch (error: any) {
      logger.error(
        'Erro ao enviar código de verificação',
        {
          error: error.message,
          code: error.code,
        },
        'auth'
      );

      // Se já é um Error com mensagem amigável, propagar diretamente
      if (error instanceof Error && error.message) {
        // Se a mensagem já é amigável (não contém "Firebase: Error"), usar ela
        if (!error.message.includes('Firebase: Error')) {
          throw error;
        }
      }

      // Caso contrário, tratar o erro
      throw this.handlePhoneAuthError(error);
    }
  }

  /**
   * Verifica código SMS e faz login
   */
  async verifyCode(verificationId: string, code: string): Promise<AuthUser> {
    try {
      const auth = getFirebaseAuth();

      logger.info('Verificando código SMS', { verificationId }, 'auth');

      // Criar credencial com o código
      const credential = PhoneAuthProvider.credential(verificationId, code);

      // Fazer login com a credencial
      const userCredential = await signInWithCredential(auth, credential);

      // Salvar dados do usuário
      const token = await userCredential.user.getIdToken();
      await authService.saveAuthData(
        token,
        authService.convertFirebaseUser(userCredential.user)
      );

      logger.info(
        'Código verificado com sucesso',
        { uid: userCredential.user.uid },
        'auth'
      );

      return authService.convertFirebaseUser(userCredential.user);
    } catch (error: any) {
      logger.error(
        'Erro ao verificar código',
        { error: error.message },
        'auth'
      );
      // throw this.handlePhoneAuthError(error);
    }
  }

  /**
   * Verifica código usando ConfirmationResult (método alternativo)
   */
  async verifyCodeWithConfirmation(code: string): Promise<AuthUser> {
    try {
      if (!this.confirmationResult) {
        throw new Error('Nenhuma verificação em andamento');
      }

      logger.info('Verificando código com ConfirmationResult', {}, 'auth');

      const result = await this.confirmationResult.confirm(code);

      // Salvar dados do usuário
      const token = await result.user.getIdToken();
      await authService.saveAuthData(
        token,
        authService.convertFirebaseUser(result.user)
      );

      logger.info(
        'Código verificado com sucesso',
        { uid: result.user.uid },
        'auth'
      );

      this.confirmationResult = null;
      return authService.convertFirebaseUser(result.user);
    } catch (error: any) {
      logger.error(
        'Erro ao verificar código',
        { error: error.message },
        'auth'
      );
      throw this.handlePhoneAuthError(error);
    }
  }

  /**
   * Trata erros de autenticação por telefone
   */
  private handlePhoneAuthError(error: any): Error {
    const code = error.code || error.message;

    switch (code) {
      case 'auth/invalid-phone-number':
        return new Error('Número de telefone inválido');
      case 'auth/missing-phone-number':
        return new Error('Número de telefone não fornecido');
      case 'auth/billing-not-enabled':
        return new Error('Apenas números de teste são permitidos no momento.');
      case 'auth/invalid-verification-code':
        return new Error('Código de verificação inválido');
      case 'auth/invalid-verification-id':
        return new Error('ID de verificação inválido');
      case 'auth/code-expired':
        return new Error('Código expirado. Solicite um novo código');
      case 'auth/session-expired':
        return new Error('Sessão expirada. Tente novamente');
      case 'auth/too-many-requests':
        return new Error('Muitas tentativas. Tente novamente mais tarde');
      case 'auth/network-request-failed':
        return new Error('Erro de conexão. Verifique sua internet');
      case 'functions/not-found':
        // Ignorar erro de função não encontrada (esperado sem plano Blaze)
        return new Error('Apenas números de teste são permitidos no momento.');
      default:
        // Se a mensagem já é amigável, usar ela
        if (error.message && !error.message.includes('Firebase: Error')) {
          return new Error(error.message);
        }
        return new Error('Apenas números de teste são permitidos no momento.');
    }
  }
}

export const phoneAuthService = PhoneAuthService.getInstance();
